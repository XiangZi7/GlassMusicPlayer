import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import './check-release.mjs'
import { parseReleaseTag } from './release-version.mjs'
import { assetName, checksum, releaseTargets, updaterTargets } from './release-targets.mjs'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const systems = { win32: 'windows', darwin: 'macos', linux: 'linux' }
const platform = systems[process.platform] + '_' + process.arch
const targets = releaseTargets[platform]
if (!targets) throw new Error('未配置发行目标 ' + platform)
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const metadata = {
  name: 'MiraiPlayer', ...parseReleaseTag('v' + version), commit,
  platform: systems[process.platform], arch: process.arch,
}
const release = join(root, 'src-tauri/target/release')
const output = join(root, 'src-tauri/target/distribution', version, platform)
await mkdir(output, { recursive: true })
const names = []
const updater = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim() ? updaterTargets[platform] : undefined
const artifacts = [...targets]
if (updater?.extension === 'app.tar.gz') {
  artifacts.push({ ...updater, folder: 'macos', filename: 'MiraiPlayer.app.tar.gz' })
}

// 先检查安装文件或签名，再原子替换分发目录中同名的产物。
async function collect(source, name) {
  if (!(await stat(source)).size) throw new Error('构建产物为空 ' + source)
  const temporary = join(output, randomUUID() + '.partial')
  await copyFile(source, temporary)
  await rename(temporary, join(output, name))
  names.push(name)
}

// 只收集本次版本的原生安装包，有歧义或缺少产物时中止。
for (const target of artifacts) {
  const name = assetName(version, platform, target)
  if (target.extension === 'portable.zip') {
    const temporary = join(output, randomUUID() + '.zip')
    execFileSync('tar.exe', ['-a', '-cf', temporary, '-C', release, 'miraiplayer.exe'])
    await rename(temporary, join(output, name))
    names.push(name)
    continue
  }
  const { folder, sourceSuffix } = target
  const folderPath = join(release, 'bundle', folder)
  const matches = (await readdir(folderPath)).filter(file => target.filename
    ? file === target.filename
    : file.includes('_' + version + '_') && file.endsWith(sourceSuffix))
  if (matches.length !== 1) throw new Error('应有一个匹配版本的 ' + folder + ' 安装包，找到 ' + matches.length)
  const source = join(folderPath, matches[0])
  await collect(source, name)
  if (target.extension === updater?.extension) await collect(source + '.sig', name + '.sig')
}

await writeFile(join(output, 'version.json'), JSON.stringify(metadata, null, 2) + '\n')
names.push('version.json')
const checksums = []
for (const name of names.sort()) {
  checksums.push(await checksum(join(output, name)) + '  ' + name)
}
const sums = checksums.join('\n') + '\n'
await writeFile(join(output, 'SHA256SUMS-' + platform + '.txt'), sums)
const local = join(root, 'release-output')
await mkdir(local, { recursive: true })
// 从已归档的完整文件更新本机交付目录，最后写入本次构建的校验清单。
for (const name of names) {
  const temporary = join(local, randomUUID() + '.partial')
  await copyFile(join(output, name), temporary)
  await rename(temporary, join(local, name))
}
const manifest = join(local, randomUUID() + '.partial')
await writeFile(manifest, sums)
await rename(manifest, join(local, 'SHA256SUMS.txt'))
console.log(local, '\n' + [...names, 'SHA256SUMS.txt'].join('\n'))
