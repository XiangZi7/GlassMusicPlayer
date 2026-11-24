import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { test } from 'node:test'
import { assembleRelease } from '../scripts/assemble-release.mjs'
import { generateReleaseNotes } from '../scripts/release-notes.mjs'
import { assetName, checksum, releaseTargets } from '../scripts/release-targets.mjs'

// 将本次临时输入、输出和 Git 标签都限制在独立目录。
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'miraiplayer-assets-'))
  t.after(async () => {
    assert.match(relative(resolve(tmpdir()), resolve(root)), /^miraiplayer-assets-[^/\\]+$/)
    await rm(root, { recursive: true, force: true })
  })
  return root
}

test('four checked archives assemble six packages and two verifiable manifests', async t => {
  const root = await fixture(t)
  const commit = 'a'.repeat(40)
  const names = []
  for (const [id, targets] of Object.entries(releaseTargets)) {
    const directory = join(root, 'MiraiPlayer-' + id)
    const [platform, arch] = id.split('_')
    await mkdir(directory)
    const metadata = { name: 'MiraiPlayer', tag: 'v0.1.0', version: '0.1.0', commit, prerelease: false, platform, arch }
    await writeFile(join(directory, 'version.json'), JSON.stringify(metadata))
    for (const target of targets) {
      const name = assetName('0.1.0', id, target)
      names.push(name)
      await writeFile(join(directory, name), name)
    }
    const sums = []
    for (const name of await readdir(directory)) sums.push(await checksum(join(directory, name)) + '  ' + name)
    await writeFile(join(directory, 'SHA256SUMS.txt'), sums.join('\n') + '\n')
  }
  const output = join(root, 'combined')
  await assembleRelease(root, output, 'v0.1.0', commit)
  assert.deepEqual((await readdir(output)).sort(), [...names, 'version.json', 'SHA256SUMS.txt'].sort())
  const metadata = JSON.parse(await readFile(join(output, 'version.json'), 'utf8'))
  assert.equal(metadata.commit, commit)
  assert.equal(metadata.targets.length, 4)
  const manifest = await readFile(join(output, 'SHA256SUMS.txt'), 'utf8')
  for (const name of [...names, 'version.json']) assert(manifest.includes(await checksum(join(output, name)) + '  ' + name + '\n'))
  await assert.rejects(assembleRelease(root, join(root, 'wrong'), 'v0.1.0', 'b'.repeat(40)), /构建来源不匹配/)
  await writeFile(join(root, 'MiraiPlayer-windows_x64', names[0]), 'changed')
  await assert.rejects(assembleRelease(root, join(root, 'corrupt'), 'v0.1.0', commit), /校验清单不匹配/)
})

test('release notes link all six packages and list changes since the published tag', async t => {
  const root = await fixture(t)
  // 为测试历史显式设置本地身份和提交选项。
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd: root, stdio: 'pipe' })
  git('-c', 'init.templateDir=', 'init', '--initial-branch=main')
  git('commit', '--allow-empty', '-m', '已发布的功能')
  git('tag', 'v0.1.0')
  git('commit', '--allow-empty', '-m', 'fix: 修复歌词面板')
  git('tag', 'v0.1.1')
  const notes = generateReleaseNotes(root, { tag: 'v0.1.1', repository: 'test/MiraiPlayer', releases: [{ tag_name: 'v0.1.0' }] })
  assert.match(notes, /修复歌词面板/)
  assert.doesNotMatch(notes, /已发布的功能/)
  assert.equal((notes.match(/\/releases\/download\/v0\.1\.1\//g) || []).length, 6)
  for (const [id, targets] of Object.entries(releaseTargets)) {
    for (const target of targets) assert(notes.includes('/releases/download/v0.1.1/' + assetName('0.1.1', id, target)))
  }
})
