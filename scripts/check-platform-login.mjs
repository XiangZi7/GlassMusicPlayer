import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(root, 'src/services/platform-login.ts'), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
const avatarModule = { exports: {} }
const avatarCode = ts.transpileModule(
  fs.readFileSync(path.join(root, 'src/services/public-avatar.ts'), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
vm.runInNewContext(avatarCode, {
  module: avatarModule,
  exports: avatarModule.exports,
  URL,
})
const base = Date.parse('2026-11-20T12:00:00Z')
const token = 'a'.repeat(43)
const secondToken = 'b'.repeat(43)
const qrImage = 'data:image/svg+xml;base64,PHN2Zy8+'
const validProfile = {
  userId: '12345',
  displayName: 'Mock user',
  avatarUrl: null,
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}
function harness(overrides = {}) {
  let clock = base
  let id = 0
  const timers = new Map()
  const created = [],
    checked = [],
    cancelled = []
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    AbortController,
    Date,
    Error,
    require: name => {
      assert.equal(name, '@/services/public-avatar')
      return avatarModule.exports
    },
    setTimeout: (run, ms) => {
      const handle = ++id
      timers.set(handle, { run, at: clock + ms })
      return handle
    },
    clearTimeout: handle => timers.delete(handle),
  })
  const result = (changes = {}) => ({
    platform: 'netease',
    sessionId: token,
    qrCodeUrl: qrImage,
    expiresAt: new Date(base + 60_000).toISOString(),
    status: 'waiting',
    ...changes,
  })
  const api = {
    create: async (platform, signal) => {
      created.push({ platform, signal })
      return overrides.create
        ? overrides.create(platform, signal)
        : result({ platform })
    },
    check: async (platform, sessionId, signal) => {
      checked.push({ platform, sessionId, signal })
      return overrides.check
        ? overrides.check(platform, sessionId, signal)
        : { platform, status: 'waiting' }
    },
    cancel: async (platform, sessionId) => {
      cancelled.push({ platform, sessionId })
    },
  }
  const state = module.exports.createPlatformLoginState()
  const flow = module.exports.createPlatformLoginFlow(state, api, () => clock)
  async function tick(ms = 1_500) {
    clock += ms
    const due = [...timers].filter(([, task]) => task.at <= clock)
    for (const [handle, task] of due) {
      timers.delete(handle)
      task.run()
    }
    await flush()
  }
  return { state, flow, timers, created, checked, cancelled, result, tick }
}
let count = 0
async function check(name, test) {
  await test()
  count++
  console.log(`PASS ${name}`)
}
await check(
  'real session contract stays waiting, with no credential in view state',
  async () => {
    const h = harness()
    await h.flow.start('netease')
    assert.equal(h.state.status, 'waiting')
    assert.equal(h.state.qrCodeUrl, qrImage)
    assert.equal(h.state.profile, null)
    assert(!JSON.stringify(h.state).includes(token))
    await h.tick()
    assert.equal(h.checked.length, 1)
    assert.equal(h.state.status, 'waiting')
    h.flow.cancel()
    assert.equal(h.cancelled.length, 1)
  }
)
await check(
  'scanning alone never authorizes or creates a profile',
  async () => {
    const h = harness({
      check: async () => ({ platform: 'netease', status: 'scanned' }),
    })
    await h.flow.start('netease')
    await h.tick()
    assert.equal(h.state.status, 'scanned')
    assert.equal(h.state.profile, null)
    h.flow.cancel()
  }
)
await check('authorized requires a verified positive user ID', async () => {
  const h = harness({
    check: async () => ({
      platform: 'netease',
      status: 'authorized',
      profile: validProfile,
    }),
  })
  await h.flow.start('netease')
  await h.tick()
  assert.equal(h.state.status, 'authorized')
  assert.equal(h.state.profile.userId, '12345')
  assert.equal(h.state.qrCodeUrl, '')
  assert.equal(h.timers.size, 0)
  h.flow.cancel()
  assert.equal(
    h.cancelled.length,
    1,
    'The verified flow releases its public profile and capacity slot immediately'
  )
})
for (const profile of [
  undefined,
  null,
  {},
  { userId: '0' },
  { userId: 12345 },
  { userId: 'wrong' },
  { userId: '12345' },
  { userId: '12345', displayName: '' },
  { userId: '12345', displayName: '   ' },
  { userId: '12345', displayName: 'x'.repeat(201) },
]) {
  await check(
    `invalid authorized identity (${JSON.stringify(profile)}) is rejected`,
    async () => {
      const h = harness({
        check: async () => ({
          platform: 'netease',
          status: 'authorized',
          profile,
        }),
      })
      await h.flow.start('netease')
      await h.tick()
      assert.equal(h.state.status, 'error')
      assert.equal(h.state.profile, null)
      assert.equal(h.state.qrCodeUrl, '')
      assert.equal(h.cancelled.length, 1)
    }
  )
}
await check(
  'closing while creating aborts and releases a late session',
  async () => {
    const pending = deferred()
    const h = harness({ create: () => pending.promise })
    const start = h.flow.start('netease')
    h.flow.cancel()
    assert(h.created[0].signal.aborted)
    pending.resolve(h.result())
    await start
    assert.equal(h.state.status, 'idle')
    assert.equal(h.state.qrCodeUrl, '')
    assert.equal(h.cancelled[0].sessionId, token)
  }
)
await check(
  'refresh cannot be overwritten by an older create response',
  async () => {
    const old = deferred(),
      fresh = deferred()
    let calls = 0
    const h = harness({
      create: () => (++calls === 1 ? old.promise : fresh.promise),
    })
    const first = h.flow.start('netease'),
      second = h.flow.start('netease')
    fresh.resolve(h.result({ sessionId: secondToken }))
    await second
    old.resolve(h.result())
    await first
    assert.equal(h.state.status, 'waiting')
    assert.equal(h.cancelled[0].sessionId, token)
    await h.tick()
    assert.equal(h.checked[0].sessionId, secondToken)
    h.flow.cancel()
  }
)
await check(
  'closing during polling cannot resurrect authorized state',
  async () => {
    const pending = deferred()
    const h = harness({ check: () => pending.promise })
    await h.flow.start('netease')
    await h.tick()
    h.flow.cancel()
    pending.resolve({
      platform: 'netease',
      status: 'authorized',
      profile: validProfile,
    })
    await flush()
    assert.equal(h.state.status, 'idle')
    assert.equal(h.state.profile, null)
    assert(h.checked[0].signal.aborted)
    assert.equal(h.timers.size, 0)
  }
)
await check(
  'slow status requests are serial, never an overlapping interval',
  async () => {
    const pending = deferred()
    const h = harness({ check: () => pending.promise })
    await h.flow.start('netease')
    await h.tick()
    await h.tick(10_000)
    assert.equal(h.checked.length, 1)
    pending.resolve({ platform: 'netease', status: 'scanned' })
    await flush()
    assert.equal(
      h.timers.size,
      2,
      'One status timer plus one independent expiry timer'
    )
    h.flow.cancel()
  }
)
await check(
  'local deadline removes the QR and releases the server session',
  async () => {
    const h = harness()
    await h.flow.start('netease')
    await h.tick(60_000)
    assert.equal(h.state.status, 'expired')
    assert.equal(h.state.qrCodeUrl, '')
    assert.equal(h.checked.length, 0)
    assert.equal(h.cancelled.length, 1)
  }
)
await check(
  'late authorization after the deadline is not accepted',
  async () => {
    const pending = deferred()
    const h = harness({ check: () => pending.promise })
    await h.flow.start('netease')
    await h.tick()
    await h.tick(60_000)
    assert.equal(
      h.state.status,
      'expired',
      'A stalled request must not extend QR validity'
    )
    assert.equal(h.state.qrCodeUrl, '')
    assert(h.checked[0].signal.aborted)
    pending.resolve({
      platform: 'netease',
      status: 'authorized',
      profile: validProfile,
    })
    await flush()
    assert.equal(h.state.status, 'expired')
    assert.equal(h.state.profile, null)
  }
)
await check('upstream expiry is terminal', async () => {
  const h = harness({
    check: async () => ({ platform: 'netease', status: 'expired' }),
  })
  await h.flow.start('netease')
  await h.tick()
  assert.equal(h.state.status, 'expired')
  assert.equal(h.timers.size, 0)
})
for (const qrCodeUrl of [
  'https://third-party.invalid/qr',
  'javascript:alert(1)',
  'data:text/html;base64,PHN2Zy8+',
]) {
  await check(
    `non-local QR is rejected (${qrCodeUrl.split(':')[0]})`,
    async () => {
      let h
      h = harness({ create: async () => h.result({ qrCodeUrl }) })
      await h.flow.start('netease')
      assert.equal(h.state.status, 'error')
      assert.equal(h.state.qrCodeUrl, '')
      assert.equal(h.cancelled.length, 1)
    }
  )
}
await check('wrong platform and unknown status never authorize', async () => {
  for (const response of [
    { platform: 'kuwo', status: 'authorized', profile: validProfile },
    { platform: 'netease', status: 'unexpected' },
  ]) {
    const h = harness({ check: async () => response })
    await h.flow.start('netease')
    await h.tick()
    assert.equal(h.state.status, 'error')
    assert.equal(h.state.profile, null)
  }
})
await check(
  'upstream failures stop the flow and expose a retryable message',
  async () => {
    const h = harness({
      check: async () => {
        throw new Error('Mock upstream timeout')
      },
    })
    await h.flow.start('netease')
    await h.tick()
    assert.equal(h.state.status, 'error')
    assert.equal(h.state.error, 'Mock upstream timeout')
    assert.equal(h.timers.size, 0)
    assert.equal(h.cancelled.length, 1)
  }
)
await check('unsupported platforms never create a fake QR', async () => {
  for (const platform of ['kuwo']) {
    const h = harness()
    await h.flow.start(platform)
    assert.equal(h.state.status, 'error')
    assert.equal(h.created.length, 0)
    assert.equal(h.state.qrCodeUrl, '')
  }
})
for (const platform of ['netease', 'kugou']) {
  await check(
    `${platform}: complete QR identity lifecycle and immediate release`,
    async () => {
      const statuses = ['scanned', 'waiting', 'authorized']
      const h = harness({
        check: async () => ({
          platform,
          status: statuses.shift(),
          profile: validProfile,
        }),
      })
      await h.flow.start(platform)
      await h.tick()
      assert.equal(h.state.status, 'scanned')
      await h.tick()
      assert.equal(
        h.state.status,
        'scanned',
        'A transient waiting result cannot undo scanning.'
      )
      await h.tick()
      assert.equal(h.state.status, 'authorized')
      assert.equal(h.state.profile.userId, validProfile.userId)
      assert.equal(h.cancelled.length, 1)
      assert.equal(h.cancelled[0].platform, platform)
      assert.equal(h.timers.size, 0)
      h.flow.cancel()
      assert.equal(
        h.cancelled.length,
        1,
        'Do not release a completed session twice.'
      )
    }
  )
}
await check(
  'switching platform never accepts a late identity from the previous flow',
  async () => {
    const old = deferred()
    const h = harness({
      check: platform =>
        platform === 'netease'
          ? old.promise
          : Promise.resolve({
              platform,
              status: 'authorized',
              profile: { ...validProfile, userId: '67890' },
            }),
    })
    await h.flow.start('netease')
    await h.tick()
    await h.flow.start('kugou')
    await h.tick()
    old.resolve({
      platform: 'netease',
      status: 'authorized',
      profile: validProfile,
    })
    await flush()
    assert.equal(h.state.profile.userId, '67890')
    assert.equal(h.cancelled.length, 2)
    assert.equal(h.cancelled[0].platform, 'netease')
    assert.equal(h.cancelled[1].platform, 'kugou')
  }
)
await check(
  'excessive QR lifetime and malformed session ID are rejected',
  async () => {
    for (const changes of [
      { expiresAt: new Date(base + 600_000).toISOString() },
      { sessionId: 'a'.repeat(42) },
      { sessionId: 'a'.repeat(44) },
    ]) {
      let h
      h = harness({ create: async () => h.result(changes) })
      await h.flow.start('netease')
      assert.equal(h.state.status, 'error')
      assert.equal(h.state.qrCodeUrl, '')
      assert.equal(h.timers.size, 0)
    }
  }
)
// 从实际播放器源文件提取快捷键回调，验证模态层不会误操作背景播放器。
const runtimeTree = ts.createSourceFile(
  'runtime.js',
  fs.readFileSync(path.join(root, 'src/services/player/runtime.js'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS
)
let keyboardCallback
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(runtimeTree) === 'document.addEventListener' &&
    ts.isStringLiteral(node.arguments[0]) &&
    node.arguments[0].text === 'keydown'
  )
    keyboardCallback = node.arguments[1].getText(runtimeTree)
  ts.forEachChild(node, visit)
}
visit(runtimeTree)
assert(keyboardCallback, 'Actual player keyboard handler missing')
function keyboardHarness(modal, stage = false) {
  const calls = []
  const state = { stage, page: 'connect', playing: false }
  const handler = vm.runInNewContext(`(${keyboardCallback})`, {
    state,
    nativeDocument: { querySelector: () => (modal ? {} : null) },
    document: { activeElement: { tagName: 'BODY' } },
    setPage: value => calls.push(['page', value]),
    closeStage: () => calls.push(['stage', false]),
    setPlaying: value => calls.push(['playing', value]),
    seekTo: value => calls.push(['seek', value]),
    setVol: value => calls.push(['volume', value]),
    toggleMute: () => calls.push(['mute']),
  })
  return { handler, calls }
}
await check(
  'modal Escape and Space never act on background player',
  async () => {
    for (const code of ['Escape', 'Space', 'ArrowRight', 'ArrowUp', 'KeyM']) {
      const h = keyboardHarness(true)
      h.handler({ code, preventDefault() {} })
      assert.equal(h.calls.length, 0)
    }
  }
)
await check(
  'Escape outside a modal retains the original home shortcut',
  async () => {
    const h = keyboardHarness(false)
    h.handler({ code: 'Escape' })
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0][0], 'page')
    assert.equal(h.calls[0][1], 'home')
  }
)
await check(
  'fullscreen Escape outside a modal closes only the stage',
  async () => {
    const h = keyboardHarness(false, true)
    h.handler({ code: 'Escape' })
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0][0], 'stage')
    assert.equal(h.calls[0][1], false)
  }
)
console.log(
  `Platform login verified: ${count} mocked lifecycle/identity/security/keyboard cases. No live login or user credentials used.`
)
