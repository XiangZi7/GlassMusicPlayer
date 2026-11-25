import { onScopeDispose, reactive, watch } from 'vue'
import { defineStore } from 'pinia'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  checkAppUpdate,
  releasePage,
  type AvailableUpdate,
  type UpdatePreferences,
} from '@/services/app-updater'
import { notify } from '@/services/notification'
import { usePlayerStore } from '@/stores/player'

type Phase =
  | 'idle'
  | 'checking'
  | 'latest'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'
type Command = 'status' | 'check' | 'download' | 'install' | 'defer' | 'dismiss'
const stateEvent = 'mirai-update-state'
const commandEvent = 'mirai-update-command'
const interval = 6 * 60 * 60 * 1000

// 主窗口持有一次检查和一个签名包，独立设置窗口订阅同一份状态。
export const useAppUpdaterStore = defineStore('app-updater', () => {
  const native = isTauri()
  const owner = !native || getCurrentWindow().label === 'main'
  const player = usePlayerStore()
  // 响应式状态：两个入口看到同一版本、进度、操作阶段及错误。
  const state = reactive({
    // 当前检查、下载或安装阶段。
    phase: 'idle' as Phase,
    // 最近发现的新版本，保留到下载或安装错误处理结束。
    version: '',
    // 当前线路已接收的安装包字节数。
    downloaded: 0,
    // 安装包总大小，服务器未提供时为零。
    total: 0,
    // 供关于页按需展开的错误详情。
    error: '',
    // 失败的操作，决定再次点击时重试哪一步。
    errorStage: '' as '' | 'check' | 'download' | 'install',
    // manual 表示当前安装方式或发现的发行版需要在浏览器下载。
    reason: native ? '' : 'manual',
    // 用户是否选择稍后安装已验签的更新。
    deferred: false,
    // 用户是否已收起当前版本的安装提示。
    dismissed: false,
  })
  let prefs: UpdatePreferences = {
    autoUpdate: player.state.settings.autoUpdate,
    updateSource: player.state.settings.updateSource,
    updateDownloadProxy: player.state.settings.updateDownloadProxy,
  }
  let environmentReason = state.reason
  let pending: AvailableUpdate | null = null
  let startup: Promise<void> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let checking = false
  let downloadRequested = false
  let sourceRevision = 0
  let failures = 0
  const cleanups: (() => void)[] = []

  // 状态快照只发给设置窗口；后打开的窗口会主动索取当前进度。
  function publish(patch: Partial<typeof state>): void {
    if (disposed) return
    Object.assign(state, patch)
    if (native && owner)
      void emitTo('settings', stateEvent, { ...state }).catch(() => {})
  }

  // 自动检查只发现更新；网络失败短暂退避，下载与安装始终需要点击。
  function schedule(delay: number): void {
    clearTimeout(timer)
    if (!disposed && owner && prefs.autoUpdate)
      timer = setTimeout(() => void check(false), delay)
  }

  // 清理不再使用的清单及更新包，避免重复点击、换源或销毁后遗留资源。
  function release(): void {
    const previous = pending
    pending = null
    void previous?.close().catch(() => {})
  }

  // 合并并发检查，手动请求能接续尚未完成的后台检查并启动一次下载。
  async function check(download: boolean): Promise<void> {
    if (
      disposed ||
      ['ready', 'downloading', 'installing'].includes(state.phase) ||
      state.errorStage === 'install'
    )
      return
    if (checking) {
      downloadRequested ||= download
      return
    }
    clearTimeout(timer)
    checking = true
    downloadRequested = download
    const revision = sourceRevision
    let stage: 'check' | 'download' = 'check'
    try {
      if (!pending || !download) {
        release()
        publish({
          phase: 'checking',
          version: '',
          error: '',
          errorStage: '',
          reason: environmentReason,
          total: 0,
          downloaded: 0,
          deferred: false,
          dismissed: false,
        })
        pending = await checkAppUpdate(prefs)
      }
      if (disposed || revision !== sourceRevision) return
      failures = 0
      if (!pending) {
        publish({ phase: 'latest' })
        return
      }
      publish({
        phase: 'available',
        version: pending.version,
        reason: pending.manual ? 'manual' : '',
        dismissed: false,
        deferred: false,
      })
      if (pending.manual || !downloadRequested) return
      stage = 'download'
      publish({
        phase: 'downloading',
        errorStage: '',
        error: '',
        downloaded: 0,
        total: 0,
      })
      let downloaded = 0
      let lastReport = 0
      await pending.download(event => {
        if (event.event === 'Started') {
          downloaded = 0
          lastReport = 0
          publish({ downloaded, total: event.data.contentLength ?? 0 })
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          if (Date.now() - lastReport >= 100) {
            lastReport = Date.now()
            publish({ downloaded })
          }
        }
      })
      publish({ phase: 'ready', downloaded })
    } catch (error) {
      release()
      if (revision === sourceRevision)
        publish({ phase: 'error', errorStage: stage, error: String(error) })
    } finally {
      checking = false
      if (disposed) release()
      else if (revision !== sourceRevision) {
        release()
        publish({
          phase: 'idle',
          version: '',
          reason: environmentReason,
          error: '',
          errorStage: '',
        })
        if (downloadRequested) void check(true)
        else schedule(0)
      } else if (state.phase !== 'ready') {
        const delay =
          state.errorStage === 'check'
            ? [60_000, 300_000, 900_000][failures++]
            : undefined
        schedule(delay ?? interval)
      }
    }
  }

  // 仅响应用户明确的安装意图，安装失败保留已验签资源以供重试。
  async function install(): Promise<void> {
    if (!pending || (state.phase !== 'ready' && state.errorStage !== 'install'))
      return
    publish({
      phase: 'installing',
      deferred: false,
      dismissed: false,
      error: '',
      errorStage: '',
    })
    try {
      await pending.install()
    } catch (error) {
      publish({ phase: 'error', errorStage: 'install', error: String(error) })
    } finally {
      if (disposed) release()
    }
  }

  // 只接受已应用偏好，换源刷新尚未下载的结果，进行中的下载沿用所选包。
  function applyPreferences(settings: UpdatePreferences): void {
    if (!owner) return
    const sourceChanged =
      prefs.updateSource !== settings.updateSource ||
      prefs.updateDownloadProxy !== settings.updateDownloadProxy
    const enabledChanged = prefs.autoUpdate !== settings.autoUpdate
    prefs = {
      autoUpdate: settings.autoUpdate,
      updateSource: settings.updateSource,
      updateDownloadProxy: settings.updateDownloadProxy,
    }
    if (
      sourceChanged &&
      !['downloading', 'ready', 'installing'].includes(state.phase) &&
      state.errorStage !== 'install'
    ) {
      sourceRevision++
      failures = 0
      if (!checking) {
        release()
        publish({
          phase: 'idle',
          version: '',
          reason: environmentReason,
          error: '',
          errorStage: '',
        })
        schedule(0)
      }
    } else if (enabledChanged) schedule(0)
  }

  // 主窗口执行命令；关闭与稍后只影响提示，保留待安装的更新包。
  async function dispatch(action: Command): Promise<void> {
    if (action === 'check' || action === 'download') await check(true)
    else if (action === 'install') await install()
    else if (action === 'defer' && state.phase === 'ready')
      publish({ dismissed: true, deferred: true })
    else if (action === 'dismiss') publish({ dismissed: true })
    else if (action === 'status') publish({})
  }

  // 建立原生窗口订阅并安排首次后台检查，浏览器预览直接使用正式发行接口。
  async function initialize(): Promise<void> {
    if (native) {
      const unlisten = owner
        ? await listen<Command>(
            commandEvent,
            event => void dispatch(event.payload)
          )
        : await listen<typeof state>(stateEvent, event =>
            Object.assign(state, event.payload)
          )
      if (disposed) {
        unlisten()
        return
      }
      cleanups.push(unlisten)
      if (!owner) {
        await emitTo('main', commandEvent, 'status')
        return
      }
      environmentReason = (await invoke<boolean>('updater_can_install'))
        ? ''
        : 'manual'
      if (disposed) return
      publish({ reason: environmentReason })
      cleanups.push(
        watch(
          () => [
            player.state.settings.autoUpdate,
            player.state.settings.updateSource,
            player.state.settings.updateDownloadProxy,
          ],
          () => applyPreferences(player.state.settings)
        )
      )
    }
    // 网络恢复后及时重试失败的检查，已完成的安装包不受网络变化影响。
    function online(): void {
      if (state.errorStage === 'check') schedule(0)
    }
    window.addEventListener('online', online)
    cleanups.push(() => window.removeEventListener('online', online))
    schedule(15_000)
  }

  // 两个入口重复挂载只需初始化一次。
  function start(): Promise<void> {
    return (startup ??= initialize().catch(error => {
      cleanups.splice(0).forEach(cleanup => cleanup())
      startup = undefined
      publish({ phase: 'error', errorStage: 'check', error: String(error) })
    }))
  }

  // 独立设置窗口将操作发往拥有更新资源的主窗口，浏览器与主窗口直接执行。
  async function command(action: Command): Promise<void> {
    await start()
    if (disposed || !startup) return
    if (owner) await dispatch(action)
    else
      await emitTo('main', commandEvent, action).catch(error =>
        publish({ phase: 'error', errorStage: 'check', error: String(error) })
      )
  }

  // 仅打开本项目正式发行页，可供浏览器、便携包和旧版本手动更新。
  async function openRelease(): Promise<void> {
    const url = state.version
      ? releasePage + '/tag/v' + encodeURIComponent(state.version)
      : releasePage
    try {
      if (native) await openUrl(url)
      else window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      notify('无法打开 MiraiPlayer 发行页，请重试', 'error')
    }
  }

  onScopeDispose(() => {
    disposed = true
    clearTimeout(timer)
    cleanups.forEach(cleanup => cleanup())
    if (!checking && state.phase !== 'installing') release()
  })
  return { state, start, command, openRelease, applyPreferences }
})
