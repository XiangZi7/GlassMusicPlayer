import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

// 本机收集、云端验收和 Release 下载表共同使用的六种分发包。
export const releaseTargets = {
  windows_x64: [
    { extension: 'setup.exe', folder: 'nsis', sourceSuffix: '-setup.exe', label: 'Setup x64', badge: 'windows-setup' },
    { extension: 'portable.zip', label: 'Portable ZIP x64', badge: 'windows-portable' },
  ],
  macos_x64: [{ extension: 'dmg', folder: 'dmg', sourceSuffix: '.dmg', label: 'DMG Intel x64', badge: 'macos-x64' }],
  macos_arm64: [{ extension: 'dmg', folder: 'dmg', sourceSuffix: '.dmg', label: 'DMG Apple Silicon', badge: 'macos-arm64' }],
  linux_x64: [
    { extension: 'deb', folder: 'deb', sourceSuffix: '.deb', label: 'DEB x64', badge: 'linux-deb' },
    { extension: 'AppImage', folder: 'appimage', sourceSuffix: '.AppImage', label: 'AppImage x64', badge: 'linux-appimage' },
  ],
}

// 按平台拼出用户下载的文件名。
export function assetName(version, platform, { extension }) {
  const separator = platform === 'windows_x64' ? '_' : '.'
  return `MiraiPlayer_${version}_${platform}${separator}${extension}`
}

// 流式计算大安装包的摘要，兼容开发机和发布运行器。
export async function checksum(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
