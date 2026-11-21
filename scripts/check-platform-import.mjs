import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')
const compile = file =>
  ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
const avatarCode = compile('src/services/public-avatar.ts')
const storeCode = compile('src/stores/player.ts')
const importCode = compile('src/composables/usePlatformImport.ts')
const avatarModule = { exports: {} }
vm.runInNewContext(avatarCode, {
  module: avatarModule,
  exports: avatarModule.exports,
  URL,
})
const names = { netease: '网易云音乐', kugou: '酷狗音乐', kuwo: '酷我音乐' }
const profileKey = 'miraiMusic.publicPlatformProfiles.v1'
const now = Date.parse('2026-11-21T02:00:00+08:00')
class ClockDate extends Date {
  static now() {
    return now
  }
}
const vue = {
  reactive: value => value,
  computed: get => ({
    get value() {
      return get()
    },
  }),
  toRefs: object =>
    Object.fromEntries(
      Object.keys(object).map(key => [
        key,
        {
          get value() {
            return object[key]
          },
          set value(value) {
            object[key] = value
          },
        },
      ])
    ),
}
const deferred = () => {
  let resolve
  const promise = new Promise(yes => {
    resolve = yes
  })
  return { promise, resolve }
}
const result = (platform = 'netease', userId = '123') => ({
  platform,
  userId,
  displayName: 'Public name',
  pageNum: 1,
  pageSize: 20,
  total: 0,
  hasMore: false,
  playlists: [],
})
function harness(options = {}) {
  const saved = new Map(
    options.saved ? [[profileKey, JSON.stringify(options.saved)]] : []
  )
  const writes = [],
    calls = [],
    notices = [],
    hooks = []
  const localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem(key, value) {
      if (options.failStorage) throw new Error('Mock storage unavailable')
      writes.push({ key, value })
      saved.set(key, value)
    },
  }
  const catalog = {
    platformNames: names,
    catalogKey: item => `${item.platform}:${item.id}`,
    toSourceTrack: item => ({ ...item }),
    fetchLinkedPlaylist: async () => {
      throw new Error('Unexpected playlist fetch')
    },
    fetchPublicPlaylist: async () => {
      throw new Error('Unexpected playlist fetch')
    },
  }
  const storeModule = { exports: {} }
  const common = {
    Date: ClockDate,
    URL,
    AbortController,
    require: name => {
      if (name === 'vue') return vue
      if (name === 'pinia') return { defineStore: (_id, setup) => setup }
      if (name === '@vueuse/core')
        return { useLocalStorage: () => ({ value: {} }) }
      if (name === '@/constants/music') return { tracks: [] }
      if (name === '@/services/public-avatar') return avatarModule.exports
      if (name === '@/services/player/catalog') return catalog
      throw new Error(`Unexpected store dependency ${name}`)
    },
  }
  vm.runInNewContext(storeCode, {
    ...common,
    module: storeModule,
    exports: storeModule.exports,
    localStorage,
  })
  const player = storeModule.exports.usePlayerStore()
  const api = {
    async getPublicUserPlaylists(platform, uid, pageNum, pageSize, signal) {
      calls.push({ platform, uid, pageNum, pageSize, signal })
      return options.fetch
        ? options.fetch(platform, uid, signal)
        : result(platform, uid)
    },
  }
  const module = { exports: {} }
  vm.runInNewContext(importCode, {
    ...common,
    module,
    exports: module.exports,
    require: name => {
      if (name === 'vue')
        return {
          ...vue,
          onBeforeUnmount: callback => hooks.push(callback),
          onDeactivated: callback => hooks.push(callback),
        }
      if (name === 'vue-router')
        return { useRouter: () => ({ push: async () => undefined }) }
      if (name === '@/api') return api
      if (name === '@/services/notification')
        return { notify: (...args) => notices.push(args) }
      if (name === '@/stores/player') return { usePlayerStore: () => player }
      if (name === '@/services/public-avatar') return avatarModule.exports
      if (name === '@/services/player/catalog') return catalog
      throw new Error(`Unexpected importer dependency ${name}`)
    },
  })
  return {
    importer: module.exports.usePlatformImport(),
    player,
    calls,
    writes,
    saved,
    hooks,
    notices,
  }
}
let count = 0
async function check(name, test) {
  await test()
  count++
  console.log(`PASS ${name}`)
}
await check('refresh preserves the same verified UID avatar', async () => {
  const avatar = 'https://p1.music.126.net/public.jpg'
  const h = harness({
    saved: {
      netease: {
        userId: '123',
        displayName: 'Old name',
        syncedAt: now - 1000,
        avatarUrl: avatar,
      },
    },
  })
  assert.equal(await h.importer.connectProfile('netease', '123'), true)
  assert.equal(h.player.state.linkedProfiles.netease.avatarUrl, avatar)
  assert.equal(h.writes.length, 1)
})
await check('switching UID never reuses another account avatar', async () => {
  const h = harness({
    saved: {
      netease: {
        userId: '123',
        displayName: 'Old name',
        syncedAt: now - 1000,
        avatarUrl: 'https://p1.music.126.net/old.jpg',
      },
    },
  })
  assert.equal(await h.importer.connectProfile('netease', '456'), true)
  assert.equal(h.player.state.linkedProfiles.netease.userId, '456')
  assert.equal(h.player.state.linkedProfiles.netease.avatarUrl, null)
})
await check(
  'verified Netease profile is committed once after the public list succeeds',
  async () => {
    const h = harness()
    assert.equal(
      await h.importer.connectQrProfile('netease', {
        userId: '123',
        displayName: 'Verified',
        avatarUrl: 'https://p1.music.126.net/new.jpg',
      }),
      true
    )
    assert.equal(h.calls.length, 1)
    assert.equal(
      h.writes.length,
      1,
      'There must be no partially saved intermediate identity.'
    )
    assert.equal(h.player.state.linkedProfiles.netease.displayName, 'Verified')
    assert.equal(
      h.player.state.linkedProfiles.netease.avatarUrl,
      'https://p1.music.126.net/new.jpg'
    )
  }
)
await check(
  'Kugou identity never starts an account playlist or audio request',
  async () => {
    const h = harness()
    assert.equal(
      await h.importer.connectQrProfile('kugou', {
        userId: '456',
        displayName: 'Verified Kugou',
        avatarUrl: null,
      }),
      true
    )
    assert.equal(h.calls.length, 0)
    assert.equal(h.player.state.linkedProfiles.kugou.userId, '456')
    assert.equal(h.player.state.linkedProfiles.kugou.syncedAt, now)
    assert.equal(h.importer.page.value, null)
    assert.equal(h.importer.selected.value.length, 0)
  }
)
await check('Kuwo uses public UID, never a synthetic QR identity', async () => {
  const h = harness()
  assert.equal(
    await h.importer.connectQrProfile('kuwo', {
      userId: '123',
      displayName: 'Unverified QR',
      avatarUrl: null,
    }),
    false
  )
  assert.equal(h.calls.length, 0)
  assert.equal(h.writes.length, 0)
  assert.equal(await h.importer.connectProfile('kuwo', '123'), true)
  assert.equal(h.calls[0].platform, 'kuwo')
})
await check(
  'storage failure does not create a partial association',
  async () => {
    const h = harness({ failStorage: true })
    assert.equal(
      await h.importer.connectQrProfile('netease', {
        userId: '123',
        displayName: 'Verified',
        avatarUrl: null,
      }),
      false
    )
    assert.equal(Object.keys(h.player.state.linkedProfiles).length, 0)
    assert.equal(h.importer.loading.value, null)
    assert(h.importer.profileError.value)
  }
)
await check(
  'late canceled public profile cannot overwrite the next connection',
  async () => {
    const old = deferred(),
      fresh = deferred()
    let calls = 0
    const h = harness({
      fetch: () => (++calls === 1 ? old.promise : fresh.promise),
    })
    const first = h.importer.connectProfile('netease', '123')
    h.importer.cancelProfileConnection()
    const second = h.importer.connectProfile('netease', '456')
    assert(h.calls[0].signal.aborted)
    old.resolve(result('netease', '123'))
    assert.equal(await first, false)
    assert.equal(
      h.importer.loading.value,
      'profile',
      'Old finally must not clear a newer loading state.'
    )
    fresh.resolve(result('netease', '456'))
    assert.equal(await second, true)
    assert.equal(h.player.state.linkedProfiles.netease.userId, '456')
    assert.equal(h.writes.length, 1)
  }
)
for (const response of [
  result('kuwo', '123'),
  result('netease', '456'),
  { ...result(), playlists: null },
]) {
  await check(
    'mismatched or incomplete public profile never commits identity',
    async () => {
      const h = harness({ fetch: async () => response })
      assert.equal(await h.importer.connectProfile('netease', '123'), false)
      assert.equal(h.writes.length, 0)
      assert.equal(Object.keys(h.player.state.linkedProfiles).length, 0)
    }
  )
}
for (const link of [
  'https://music.163.com.evil.test/user/home?id=123',
  'https://music.163.com/playlist?id=123',
  'https://evil.test/user/home?id=123',
  '0',
]) {
  await check('invalid personal-home input performs no request', async () => {
    const h = harness()
    assert.equal(await h.importer.connectProfile('netease', link), false)
    assert.equal(h.calls.length, 0)
  })
}
await check(
  'restored profiles ignore damaged IDs and strip credentials',
  async () => {
    const h = harness({
      saved: {
        netease: {
          userId: 123,
          displayName: 'Invalid numeric ID',
          syncedAt: now,
        },
        kugou: {
          userId: '456',
          displayName: 'Public',
          syncedAt: now,
          avatarUrl: 'javascript:alert(1)',
          token: 'mock_secret',
          cookie: 'mock_cookie',
          sessionId: 'mock_flow',
        },
        unknown: { userId: '789', syncedAt: now },
      },
    })
    assert.deepEqual(Object.keys(h.player.state.linkedProfiles), ['kugou'])
    assert.equal(h.player.state.linkedProfiles.kugou.avatarUrl, null)
    assert(!JSON.stringify(h.player.state.linkedProfiles).includes('mock_'))
  }
)
await check(
  'saving identity uses a detached public whitelist and remains atomic',
  async () => {
    const h = harness()
    const input = {
      userId: '123',
      displayName: 'Public',
      syncedAt: now,
      avatarUrl: 'https://p1.music.126.net/a.jpg',
      cookie: 'mock_cookie',
      token: 'mock_secret',
      sessionId: 'mock_flow',
    }
    h.player.setLinkedProfile('netease', input)
    input.displayName = 'Changed after save'
    const saved = JSON.parse(h.saved.get(profileKey)).netease
    assert.deepEqual(Object.keys(saved).sort(), [
      'avatarUrl',
      'displayName',
      'syncedAt',
      'userId',
    ])
    assert.equal(h.player.state.linkedProfiles.netease.displayName, 'Public')
    assert(!JSON.stringify(saved).includes('mock_'))
    assert.throws(
      () =>
        h.player.setLinkedProfile('netease', { userId: 123, syncedAt: now }),
      /无效公开账号/
    )
    assert.throws(
      () => h.player.setLinkedProfile('__proto__', input),
      /无效音乐平台/
    )
    assert.equal(h.player.state.linkedProfiles.netease.userId, '123')
  }
)
await check(
  'deactivated importer aborts an outstanding public read',
  async () => {
    const pending = deferred()
    const h = harness({ fetch: () => pending.promise })
    const loading = h.importer.connectProfile('netease', '123')
    h.hooks.forEach(hook => hook())
    assert(h.calls[0].signal.aborted)
    pending.resolve(result())
    assert.equal(await loading, false)
    assert.equal(h.writes.length, 0)
  }
)
console.log(
  `Public profile import verified: ${count} mocked storage/identity/cancellation cases. No live account or private playlist is used.`
)
