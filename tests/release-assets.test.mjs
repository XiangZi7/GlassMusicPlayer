import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { test } from 'node:test'
import { assembleRelease } from '../scripts/assemble-release.mjs'
import { checkSignedVersion } from '../scripts/verify-update-signature.mjs'
import { releaseBuildArgs } from '../scripts/release-build.mjs'
import { generateReleaseNotes } from '../scripts/release-notes.mjs'
import { assetName, checksum, releaseTargets, updaterTargets } from '../scripts/release-targets.mjs'

// 将本次临时输入、输出和 Git 标签都限制在独立目录。
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'miraiplayer-assets-'))
  t.after(async () => {
    assert.match(relative(resolve(tmpdir()), resolve(root)), /^miraiplayer-assets-[^/\\]+$/)
    await rm(root, { recursive: true, force: true })
  })
  return root
}

// 用独立的小文件模拟 CI 的四个平台归档和可选的 Tauri 签名附件。
async function createArchives(root, commit, signed = false) {
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
    if (signed) {
      const name = assetName('0.1.0', id, updaterTargets[id])
      if (!names.includes(name)) {
        names.push(name)
        await writeFile(join(directory, name), name)
      }
      const signature = Buffer.from('fixture-' + id).toString('base64')
      await writeFile(join(directory, name + '.sig'), signature)
    }
    const sums = []
    for (const name of await readdir(directory)) sums.push(await checksum(join(directory, name)) + '  ' + name)
    await writeFile(join(directory, 'SHA256SUMS.txt'), sums.join('\n') + '\n')
  }
  return names
}

test('four checked archives assemble six packages and two verifiable manifests', async t => {
  const root = await fixture(t)
  const commit = 'a'.repeat(40)
  const names = await createArchives(root, commit)
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

test('signed releases pin four updater downloads to their verified tag and architecture', async t => {
  const root = await fixture(t)
  const commit = 'a'.repeat(40)
  await createArchives(root, commit, true)
  const output = join(root, 'combined')
  const options = { signed: true, repository: 'example/MiraiPlayer' }
  await assembleRelease(root, output, 'v0.1.0', commit, options)
  const manifest = JSON.parse(await readFile(join(output, 'latest.json'), 'utf8'))
  const metadata = JSON.parse(await readFile(join(output, 'version.json'), 'utf8'))
  assert.equal(manifest.version, '0.1.0')
  assert.equal(metadata.updater, true)
  const packages = {
    'windows-x86_64': 'windows_x64_setup.exe',
    'darwin-x86_64': 'macos_x64.app.tar.gz',
    'darwin-aarch64': 'macos_arm64.app.tar.gz',
    'linux-x86_64': 'linux_x64.AppImage',
  }
  assert.deepEqual(Object.keys(manifest.platforms).sort(), Object.keys(packages).sort())
  for (const [platform, suffix] of Object.entries(packages)) {
    const name = 'MiraiPlayer_0.1.0_' + suffix
    const { url, signature } = manifest.platforms[platform]
    assert.equal(url, 'https://github.com/example/MiraiPlayer/releases/download/v0.1.0/' + name)
    assert.equal(signature, await readFile(join(output, name + '.sig'), 'utf8'))
  }
  const sums = await readFile(join(output, 'SHA256SUMS.txt'), 'utf8')
  assert(sums.includes(await checksum(join(output, 'latest.json')) + '  latest.json\n'))
  const windowsSignature = join(root, 'MiraiPlayer-windows_x64', 'MiraiPlayer_0.1.0_windows_x64_setup.exe.sig')
  await writeFile(windowsSignature, '')
  await assert.rejects(assembleRelease(root, join(root, 'incomplete'), 'v0.1.0', commit, options), /更新签名格式无效/)
})

test('updater signing config enables the paired keys and rejects partial configuration', () => {
  const publicKey = 'public-key-fixture'
  const privateKey = 'private-fixture'
  assert.deepEqual(releaseBuildArgs({}), ['build', '--', '--locked'])
  assert.throws(() => releaseBuildArgs({ TAURI_UPDATER_PUBLIC_KEY: publicKey }), /同时配置/)
  assert.throws(() => releaseBuildArgs({ TAURI_SIGNING_PRIVATE_KEY: privateKey }), /同时配置/)
  const args = releaseBuildArgs({ TAURI_UPDATER_PUBLIC_KEY: publicKey, TAURI_SIGNING_PRIVATE_KEY: privateKey })
  assert.equal(args[1], '--config')
  assert.deepEqual(JSON.parse(args[2]), { bundle: { createUpdaterArtifacts: true }, plugins: { updater: { pubkey: publicKey } } })
})

test('macOS signed packaging and DMG retries retain the app target for the updater archive', async () => {
  const config = JSON.parse(await readFile(new URL('../src-tauri/tauri.macos.conf.json', import.meta.url), 'utf8'))
  assert(config.bundle.targets.includes('app'))
  assert(config.bundle.targets.includes('dmg'))
  const environment = { TAURI_UPDATER_PUBLIC_KEY: 'public-fixture', TAURI_SIGNING_PRIVATE_KEY: 'private-fixture' }
  const build = releaseBuildArgs(environment)
  const retry = releaseBuildArgs(environment, true)
  assert.deepEqual(retry, ['bundle', '--config', build[2]])
  assert.equal(JSON.parse(retry[2]).bundle.targets, undefined)
})

test('signed version comes from a unique trusted field and must match the release tag', () => {
  const tag = 'v1.2.3-beta.1'
  const prefix = 'timestamp:1700000000\tfile:example_1.2.3-beta.1.exe'
  assert.doesNotThrow(() => checkSignedVersion(tag, prefix + '\tversion:1.2.3-beta.1\n'))
  for (const invalid of [prefix, prefix + '\tversion:1.2.3', prefix + '\tversion:1.2.3-beta.1 ', prefix + '-version:1.2.3-beta.1', prefix + '\tversion:1.2.2\tversion:1.2.3-beta.1']) {
    assert.throws(() => checkSignedVersion(tag, invalid), /版本与发行标签不匹配/)
  }
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
