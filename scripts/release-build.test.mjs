import assert from 'node:assert/strict'
import { test } from 'node:test'
import { releaseBuildArgs } from './release-build.mjs'

test('正式版标签必须生成已签名的应用内更新包', () => {
  const release = { RELEASE_TAG: 'v0.1.9' }
  assert.throws(() => releaseBuildArgs(release), /正式版需要配置/)
  assert.throws(
    () => releaseBuildArgs({ ...release, TAURI_UPDATER_PUBLIC_KEY: 'test-key' }),
    /正式版需要配置/
  )

  const args = releaseBuildArgs({
    ...release,
    TAURI_UPDATER_PUBLIC_KEY: 'test-key',
    TAURI_SIGNING_PRIVATE_KEY: 'test-private-key',
  })
  assert.deepEqual(JSON.parse(args[2]), {
    bundle: { createUpdaterArtifacts: true },
    plugins: { updater: { pubkey: 'test-key' } },
  })
  assert.deepEqual(releaseBuildArgs({}), ['build', '--', '--locked'])
  assert.deepEqual(releaseBuildArgs({ RELEASE_TAG: 'v0.1.9-rc.1' }), [
    'build',
    '--',
    '--locked',
  ])
})
