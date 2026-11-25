import { invoke, isTauri } from '@tauri-apps/api/core'
import { Update, type DownloadEvent } from '@tauri-apps/plugin-updater'
import { isValidUpdateProxy } from '@/services/update-preferences'

export const releasePage = 'https://github.com/XiangZi7/MiraiPlayer/releases'

export interface UpdatePreferences {
  autoUpdate: boolean
  updateSource: string
  updateDownloadProxy: string
}

interface Candidate {
  version: string
  package: Update | null
}

export interface AvailableUpdate {
  version: string
  manual: boolean
  download: (report: (event: DownloadEvent) => void) => Promise<void>
  install: () => Promise<void>
  close: () => Promise<void>
}

// 所选镜像不可用时重试官方线路，自动模式依次尝试两个预设 HTTPS 镜像。
function routes(settings: UpdatePreferences): string[] {
  const ghproxy = 'https://gh-proxy.com/'
  const ghfast = 'https://ghfast.top/'
  switch (settings.updateSource) {
    case 'auto':
      return [ghproxy, ghfast, '']
    case 'ghproxy':
      return [ghproxy, '']
    case 'ghfast':
      return [ghfast, '']
    case 'custom': {
      const prefix = settings.updateDownloadProxy.trim()
      if (!isValidUpdateProxy(prefix))
        throw new Error('自定义更新线路需要有效的 HTTPS 地址')
      return [prefix.replace(/\/+$/, '') + '/', '']
    }
    default:
      return ['']
  }
}

// 浏览器仅检查正式发行标签，通过已发布的数字版本判断是否需要手动升级。
export function newerStableTag(tag: unknown, current: string): string | null {
  const stable = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/
  const match = typeof tag === 'string' && stable.exec(tag)
  if (!match || match[0] !== tag) throw new Error('未取得有效的正式版标签')
  const parts = match[1]!.split('.').map(Number)
  if (parts.some(part => part > 65535)) throw new Error('发行版本号超出范围')
  const [local, prerelease] = current.split('-')
  const installed = local!.split('.').map(Number)
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== installed[i])
      return parts[i]! > installed[i]! ? match[1]! : null
  }
  return prerelease ? match[1]! : null
}

// 桌面使用原生更新资源；浏览器读取支持跨域的正式发行信息，无安装能力。
async function readCandidate(prefix: string): Promise<Candidate | null> {
  if (isTauri()) {
    const result = await invoke<{
      version: string
      package: ConstructorParameters<typeof Update>[0] | null
    } | null>('updater_check_source', { prefix })
    return (
      result && {
        version: result.version,
        package: result.package && new Update(result.package),
      }
    )
  }
  const url = prefix
    ? prefix + releasePage + '/latest/download/version.json'
    : 'https://api.github.com/repos/XiangZi7/MiraiPlayer/releases/latest'
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok) throw new Error('发行服务返回 HTTP ' + response.status)
  const data = await response.json()
  if (
    data.prerelease !== false ||
    (prefix
      ? data.name !== 'MiraiPlayer' || data.tag !== 'v' + data.version
      : data.draft !== false)
  )
    throw new Error('未取得 MiraiPlayer 正式版的发行信息')
  const version = newerStableTag(
    prefix ? data.tag : data.tag_name,
    __APP_INFO__.version
  )
  return version ? { version, package: null } : null
}

// 从首个可用线路检查；下载失败时只接受相同版本的备用签名包。
export async function checkAppUpdate(
  settings: UpdatePreferences,
  read: (prefix: string) => Promise<Candidate | null> = readCandidate
): Promise<AvailableUpdate | null> {
  const sources = routes(settings)
  let index = 0
  let lastError: unknown
  let candidate: Candidate | null = null
  for (; index < sources.length; index++) {
    try {
      candidate = await read(sources[index]!)
      if (!candidate) return null
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!candidate) throw lastError
  const version = candidate.version
  let resource = candidate.package
  let installed = false

  // 下载失败、换源或退出后释放清单资源与已下载的原生字节。
  async function close(): Promise<void> {
    const previous = resource
    resource = null
    await previous?.close().catch(() => {})
  }

  // 插件完成下载与签名校验后才返回，镜像切换时重新计算该包的字节进度。
  async function download(
    report: (event: DownloadEvent) => void
  ): Promise<void> {
    while (resource) {
      try {
        await resource.download(report, { timeout: 600_000 })
        return
      } catch (error) {
        lastError = error
        await close()
      }
      while (++index < sources.length) {
        try {
          const alternative = await read(sources[index]!)
          if (alternative?.version === version && alternative.package) {
            resource = alternative.package
            break
          }
          await alternative?.package?.close().catch(() => {})
        } catch (error) {
          lastError = error
        }
      }
    }
    throw lastError ?? new Error('该发行版本需要手动下载')
  }

  // 用户确认后安装该资源已验签的字节，再由原生窗口完成平台重启。
  async function install(): Promise<void> {
    if (!resource) throw new Error('缺少已校验的更新包')
    if (!installed) {
      await resource.install()
      installed = true
    }
    await invoke('updater_restart')
  }
  return { version, manual: !resource, close, download, install }
}
