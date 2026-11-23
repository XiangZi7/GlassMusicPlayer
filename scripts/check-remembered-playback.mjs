import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const code = ts.transpileModule(
  readFileSync(
    new URL('../src/services/player/playback-session.ts', import.meta.url),
    'utf8'
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
const profile = { userId: '123', displayName: '测试账号', avatarUrl: null }
const grant = {
  token: 'a'.repeat(43),
  expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  remembered: true,
  isVip: true,
  vipLevel: 6,
}
const result = {
  platform: 'netease',
  status: 'authorized',
  profile,
  playback: grant,
}
let saved = null
let restoreCalls = 0
const ended = []
let restore = async () => result

// 每次创建独立的客户端内存，只有模拟的系统凭据库在重启间保留。
function launch(native = true) {
  const modules = {
    vue: { shallowRef: value => ({ value }) },
    '@tauri-apps/api/core': {
      isTauri: () => native,
      async invoke(command, args) {
        assert.equal(args.server, 'http://127.0.0.1:8000/api/v1')
        if (command === 'read_playback_credential') return saved
        assert.equal(command, 'write_playback_credential')
        saved = args.credential
      },
    },
    '@/utils/http': {
      apiBaseUrl: 'http://127.0.0.1:8000/api/v1',
      async httpPost(path, body) {
        if (path.endsWith('/end')) {
          ended.push(body.sessionId)
          return
        }
        assert.equal(path, '/netease/auth/playback/restore')
        assert.equal(body.sessionId, grant.token)
        restoreCalls++
        return restore()
      },
    },
    '@/services/notification': { notify() {} },
  }
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    require: name => modules[name],
    URL,
    Error,
    location: { href: 'http://tauri.localhost' },
    navigator: { userAgent: 'Windows NT' },
    clearTimeout() {},
    setTimeout(_fn, ms) {
      assert(ms <= 2147483647)
    },
  })
  return exports
}

await launch().acceptPlaybackGrant(profile, grant)
assert.equal(saved.token, grant.token)
const restarted = launch()
restarted.initializePlaybackGrant(() => profile.userId)
await Promise.all([
  restarted.restorePlaybackGrant(),
  restarted.restorePlaybackGrant(),
])
assert.equal(restoreCalls, 1)
assert.equal(restarted.playbackBearer(), grant.token)
assert.equal(restarted.playbackAccount.value.badge, 'VIP 6')

const offline = launch()
restore = async () => {
  throw new Error('临时断网')
}
await assert.rejects(offline.restorePlaybackGrant(), /临时断网/)
assert.equal(saved.token, grant.token)
restore = async () => result
await offline.restorePlaybackGrant()
assert.equal(offline.playbackBearer(), grant.token)

const pending = launch()
let finish
let started
const requestStarted = new Promise(resolve => {
  started = resolve
})
restore = () =>
  new Promise(resolve => {
    finish = resolve
    started()
  })
const loading = pending.restorePlaybackGrant()
await requestStarted
pending.clearPlaybackGrant()
finish(result)
await loading
await new Promise(resolve => setImmediate(resolve))
assert.equal(pending.playbackBearer(), '')
assert.equal(saved, null)

await launch().acceptPlaybackGrant(profile, grant)
const expired = launch()
restore = async () => {
  throw Object.assign(new Error('授权失效'), {
    name: 'playback_session_expired',
  })
}
await assert.rejects(expired.restorePlaybackGrant(), /授权失效/)
await new Promise(resolve => setImmediate(resolve))
assert.equal(saved, null)
await launch(false).acceptPlaybackGrant(profile, grant)
assert.equal(saved, null)
const switching = launch()
await switching.acceptPlaybackGrant(profile, grant)
assert.equal(await launch().previousPlaybackToken(), grant.token)
assert.equal(await switching.previousPlaybackToken(), grant.token)
const replacement = { ...grant, token: 'b'.repeat(43) }
ended.length = 0
await switching.acceptPlaybackGrant({ ...profile, userId: '456' }, replacement)
assert.deepEqual(ended, [grant.token])
assert.equal(saved.token, replacement.token)
assert.equal(switching.playbackAccount.value.userId, '456')
assert.equal(switching.playbackBearer(), replacement.token)
console.log('PASS 重扫成功调用旧会话退出接口并保存新账号')
console.log(
  'PASS 模拟客户端跨重启恢复、首次点播并发、离线重试、撤销与过期，以及浏览器临时会话'
)
