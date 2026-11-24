import assert from 'node:assert/strict'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetName, checksum, releaseTargets } from './release-targets.mjs'
import { parseReleaseTag } from './release-version.mjs'

// 从四个独立归档校验版本、源码提交和摘要，再生成 GitHub Release 的附件。
export async function assembleRelease(input, output, tag, commit) {
  const release = parseReleaseTag(tag)
  assert.match(commit, /^[a-f0-9]{40}$/)
  const assets = []
  for (const [id, targets] of Object.entries(releaseTargets)) {
    const directory = join(input, 'MiraiPlayer-' + id)
    const names = targets.map(target => assetName(release.version, id, target))
    const manifest = await readFile(join(directory, 'SHA256SUMS.txt'), 'utf8')
    const expected = []
    for (const name of [...names, 'version.json'].sort()) {
      const file = join(directory, name)
      assert((await stat(file)).size > 0, '空文件 ' + file)
      expected.push(await checksum(file) + '  ' + name)
    }
    assert.deepEqual(manifest.trimEnd().split(/\r?\n/).sort(), expected.sort(), '校验清单不匹配 ' + id)
    const [platform, arch] = id.split('_')
    const metadata = JSON.parse(await readFile(join(directory, 'version.json'), 'utf8'))
    assert.deepEqual(metadata, { name: 'MiraiPlayer', ...release, commit, platform, arch }, '构建来源不匹配 ' + id)
    for (const name of names) assets.push({ name, file: join(directory, name) })
  }

  await mkdir(output)
  for (const asset of assets) await copyFile(asset.file, join(output, asset.name))
  const metadata = { name: 'MiraiPlayer', ...release, commit, targets: Object.keys(releaseTargets) }
  await writeFile(join(output, 'version.json'), JSON.stringify(metadata, null, 2) + '\n')
  const names = [...assets.map(asset => asset.name), 'version.json'].sort()
  const sums = []
  for (const name of names) sums.push(await checksum(join(output, name)) + '  ' + name)
  await writeFile(join(output, 'SHA256SUMS.txt'), sums.join('\n') + '\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [tag, commit, input, output] = process.argv.slice(2)
  await assembleRelease(input, output, tag, commit)
}
