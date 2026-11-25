import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 配置正式版签名；macOS 重试沿用 app 和 dmg 两种目标以生成更新归档。
export function releaseBuildArgs(environment, bundleOnly = false) {
  const pubkey = environment.TAURI_UPDATER_PUBLIC_KEY?.trim()
  const hasPrivateKey = Boolean(environment.TAURI_SIGNING_PRIVATE_KEY?.trim())
  if (Boolean(pubkey) !== hasPrivateKey) {
    throw new Error('更新签名需要同时配置 TAURI_UPDATER_PUBLIC_KEY 和 TAURI_SIGNING_PRIVATE_KEY')
  }
  const config = pubkey ? ['--config', JSON.stringify({
    bundle: { createUpdaterArtifacts: true },
    plugins: { updater: { pubkey } },
  })] : []
  return bundleOnly ? ['bundle', ...config] : ['build', ...config, '--', '--locked']
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cli = createRequire(import.meta.url).resolve('@tauri-apps/cli/tauri.js')
  const args = releaseBuildArgs(process.env, process.argv[2] === '--bundle-only')
  execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit', windowsHide: true })
}
