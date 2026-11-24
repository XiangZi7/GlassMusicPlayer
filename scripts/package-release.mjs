import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import './check-release.mjs'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const systems = { win32: 'windows', darwin: 'macos', linux: 'linux' }
const platform = systems[process.platform] + '_' + process.arch
const targets = {
  windows_x64: [['nsis', '-setup.exe', '_setup.exe']],
  macos_x64: [['dmg', '.dmg', '.dmg']],
  macos_arm64: [['dmg', '.dmg', '.dmg']],
  linux_x64: [['deb', '.deb', '.deb'], ['appimage', '.AppImage', '.AppImage']],
}
if (!targets[platform]) throw new Error('未配置发行目标 ' + platform)
const release = join(root, 'src-tauri/target/release')
const output = join(root, 'src-tauri/target/distribution', version, platform)
await mkdir(output, { recursive: true })
const prefix = 'MiraiPlayer_' + version + '_' + platform
const names = []

// 只收集本次版本的原生安装包，有歧义或缺少产物时中止。
for (const [folder, suffix, ending] of targets[platform]) {
  const folderPath = join(release, 'bundle', folder)
  const matches = (await readdir(folderPath)).filter(file =>
    file.includes('_' + version + '_') && file.endsWith(suffix)
  )
  if (matches.length !== 1) throw new Error('应有一个匹配版本的 ' + folder + ' 安装包，找到 ' + matches.length)
  const source = join(folderPath, matches[0])
  if (!(await stat(source)).size) throw new Error('安装包为空 ' + source)
  const name = prefix + ending
  const temporary = join(output, randomUUID() + '.partial')
  await copyFile(source, temporary)
  await rename(temporary, join(output, name))
  names.push(name)
}

if (platform === 'windows_x64') {
  const name = prefix + '_portable.zip'
  const temporary = join(output, randomUUID() + '.zip')
  execFileSync('tar.exe', ['-a', '-cf', temporary, '-C', release, 'miraiplayer.exe'])
  await rename(temporary, join(output, name))
  names.push(name)
}

const checksums = []
for (const name of names.sort()) {
  const hash = createHash('sha256')
  for await (const data of createReadStream(join(output, name))) hash.update(data)
  checksums.push(hash.digest('hex') + '  ' + name)
}
await writeFile(join(output, 'SHA256SUMS-' + platform + '.txt'), checksums.join('\n') + '\n')
console.log(output, '\n' + names.join('\n'))
