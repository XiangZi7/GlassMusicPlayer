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
    routes = [],
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
    fetchLinkedPlaylist: async (...args) => {
      if (options.linkedPlaylist) return options.linkedPlaylist(...args)
      throw new Error('Unexpected playlist fetch')
    },
    fetchPublicPlaylist: async (...args) => {
      if (options.publicPlaylist) return options.publicPlaylist(...args)
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
        return {
          useRouter: () => ({ push: async route => routes.push(route) }),
        }
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
    readPlaylistLinks: module.exports.readPlaylistLinks,
    player,
    calls,
    writes,
    saved,
    hooks,
    notices,
    routes,
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
// 构造完整歌单快照，验证保存、更新和取消不依赖真实平台账号。
const playlist = (id, title = 'List ' + id, platform = 'netease') => ({
  platform,
  id,
  title,
  coverUrl: null,
  sourceUrl: `https://music.163.com/playlist?id=${id}`,
  pageNum: 1,
  pageSize: 100,
  total: 0,
  tracks: [],
})
await check(
  'share text extracts multiple links and removes repeated copies',
  async () => {
    const h = harness()
    const links = h.readPlaylistLinks(
      '分享（https://music.163.com/playlist?id=1），来听听\nhttps://www.kuwo.cn/playlist_detail/2。\nhttps://music.163.com/playlist?id=1'
    )
    assert.deepEqual(Array.from(links), [
      'https://music.163.com/playlist?id=1',
      'https://www.kuwo.cn/playlist_detail/2',
    ])
    assert.deepEqual(
      Array.from(h.readPlaylistLinks('music.163.com/playlist?id=1')),
      ['music.163.com/playlist?id=1']
    )
    assert.throws(() => h.readPlaylistLinks('x'.repeat(32769)), /过长/)
    assert.throws(
      () =>
        h.readPlaylistLinks(
          Array.from(
            { length: 51 },
            (_, i) => `https://music.163.com/playlist?id=${i + 1}`
          ).join('\n')
        ),
      /50/
    )
  }
)
await check(
  'one failed link does not block later links, retry fetches only failures',
  async () => {
    const calls = []
    let fail = true
    const h = harness({
      publicPlaylist: async text => {
        calls.push(text)
        const id = new URL(text).searchParams.get('id')
        if (id === '2' && fail) throw new Error('Mock upstream unavailable')
        return playlist(id)
      },
    })
    h.importer.link.value = [1, 2, 3]
      .map(id => `https://music.163.com/playlist?id=${id}`)
      .join('\n')
    await h.importer.importPlaylists('link')
    assert.equal(h.player.state.imported.length, 2)
    assert.equal(h.importer.importDone.value, 3)
    assert.equal(h.importer.retryTasks.value.length, 1)
    assert.equal(h.notices.length, 1)
    fail = false
    await h.importer.importPlaylists('retry')
    assert.equal(calls.length, 4)
    assert.equal(calls[3], 'https://music.163.com/playlist?id=2')
    assert.equal(h.player.state.imported.length, 3)
    assert.equal(h.importer.retryTasks.value.length, 0)
  }
)
await check(
  'selected existing playlist updates in place, failures keep its old version',
  async () => {
    let fail = true
    const h = harness({
      linkedPlaylist: async (_platform, id) => {
        if (fail) throw new Error('Mock failure')
        return playlist(id, 'Updated')
      },
    })
    h.player.savePublicPlaylist(playlist('1', 'Original'))
    h.importer.active.value = 'netease'
    h.importer.selected.value = ['1']
    await h.importer.importPlaylists('selection')
    assert.equal(h.player.state.imported[0].name, 'Original')
    assert.equal(h.importer.selected.value.length, 1)
    fail = false
    await h.importer.importPlaylists('retry')
    assert.equal(h.player.state.imported.length, 1)
    assert.equal(h.player.state.imported[0].name, 'Updated')
    assert.equal(h.importer.selected.value.length, 0)
  }
)
await check(
  'page select all preserves selections from other pages and includes imported lists',
  async () => {
    const h = harness()
    h.importer.active.value = 'netease'
    h.player.savePublicPlaylist(playlist('1'))
    h.importer.page.value = {
      ...result(),
      playlists: [{ id: '1' }, { id: '2' }],
    }
    h.importer.selected.value = ['3']
    h.importer.togglePageSelection()
    assert.deepEqual(Array.from(h.importer.selected.value), ['3', '1', '2'])
    h.importer.togglePageSelection()
    assert.deepEqual(Array.from(h.importer.selected.value), ['3'])
  }
)
await check(
  'cancel keeps saved lists and uncompleted tasks, late response cannot save',
  async () => {
    const pending = deferred()
    const started = deferred()
    let signal
    const h = harness({
      publicPlaylist: async (text, incoming) => {
        if (text.endsWith('=1')) return playlist('1')
        signal = incoming
        started.resolve()
        return pending.promise
      },
    })
    h.importer.link.value =
      'https://music.163.com/playlist?id=1\nhttps://music.163.com/playlist?id=2'
    const work = h.importer.importPlaylists('link')
    await started.promise
    assert.equal(h.player.state.imported.length, 1)
    h.importer.cancelImport()
    assert(signal.aborted)
    pending.resolve(playlist('2'))
    await work
    assert.equal(h.player.state.imported.length, 1)
    assert.equal(h.importer.retryTasks.value.length, 1)
    assert.equal(h.importer.loading.value, null)
  }
)
await check(
  'retry retains original platform even after user changes visible account',
  async () => {
    const calls = []
    let fail = true
    const h = harness({
      linkedPlaylist: async (platform, id) => {
        calls.push(platform)
        if (fail) throw new Error('Mock failure')
        return playlist(id, 'Recovered', platform)
      },
    })
    h.importer.active.value = 'netease'
    h.importer.selected.value = ['1']
    await h.importer.importPlaylists('selection')
    h.importer.active.value = 'kuwo'
    fail = false
    await h.importer.importPlaylists('retry')
    assert.deepEqual(calls, ['netease', 'netease'])
    assert.equal(h.player.state.imported[0].id, 'netease:1')
  }
)
await check(
  'storage failures remain retryable without partially registering a playlist',
  async () => {
    const h = harness({
      failStorage: true,
      publicPlaylist: async () => playlist('1'),
    })
    h.importer.link.value = 'https://music.163.com/playlist?id=1'
    await h.importer.importPlaylists('link')
    assert.equal(h.player.state.imported.length, 0)
    assert.equal(h.importer.retryTasks.value.length, 1)
    assert.equal(h.notices.length, 1)
  }
)
// 导航只在单链接成功后发生，批量操作保留结果及重试入口。
await check(
  'single successful link opens playlist, batches stay on import page',
  async () => {
    const h = harness({
      publicPlaylist: async text =>
        playlist(new URL(text).searchParams.get('id')),
    })
    h.importer.link.value = 'https://music.163.com/playlist?id=1'
    await h.importer.importPlaylists('link')
    assert.equal(h.routes.length, 1)
    assert.equal(h.routes[0].query.playlist, 'netease:1')
    h.importer.link.value =
      'https://music.163.com/playlist?id=2\nhttps://music.163.com/playlist?id=3'
    await h.importer.importPlaylists('link')
    assert.equal(h.routes.length, 1)
  }
)

// 旧批次的响应和 finally 不得覆盖取消后立即启动的新批次。
await check(
  'late canceled batch never clears or saves over a fresh batch',
  async () => {
    const old = deferred(),
      fresh = deferred()
    const h = harness({
      publicPlaylist: async text =>
        text.endsWith('=1') ? old.promise : fresh.promise,
    })
    h.importer.link.value = 'https://music.163.com/playlist?id=1'
    const first = h.importer.importPlaylists('link')
    h.importer.cancelImport()
    h.importer.link.value = 'https://music.163.com/playlist?id=2'
    const second = h.importer.importPlaylists('link')
    old.resolve(playlist('1'))
    await first
    assert.equal(h.importer.loading.value, 'link')
    assert.equal(h.player.state.imported.length, 0)
    assert.equal(
      h.importer.retryTasks.value[0].text,
      'https://music.163.com/playlist?id=2'
    )
    fresh.resolve(playlist('2'))
    await second
    assert.equal(h.player.state.imported.length, 1)
    assert.equal(h.player.state.imported[0].id, 'netease:2')
  }
)

// 实际 catalog 服务不截取第一个链接，并沿用完整分页读取契约。
await check(
  'catalog passes whole share text to resolver and preserves paginated order',
  async () => {
    const module = { exports: {} }
    let resolvedText
    const signal = new AbortController().signal
    const progress = []
    vm.runInNewContext(compile('src/services/player/catalog.ts'), {
      module,
      exports: module.exports,
      require: name => {
        assert.equal(name, '@/api')
        return {
          resolveCatalogPlaylist: async (text, size, incoming) => {
            resolvedText = text
            assert.equal(incoming, signal)
            assert.equal(size, 100)
            return {
              ...playlist('1'),
              pageSize: 1,
              total: 2,
              tracks: [{ id: 'a' }],
            }
          },
          getCatalogPlaylist: async (platform, id, pageNum, size, incoming) => {
            assert.equal(platform, 'netease')
            assert.equal(id, '1')
            assert.equal(pageNum, 2)
            assert.equal(size, 1)
            assert.equal(incoming, signal)
            return {
              ...playlist('1'),
              pageNum: 2,
              pageSize: 1,
              total: 2,
              tracks: [{ id: 'b' }],
            }
          },
        }
      },
    })
    const text = '分享歌单（https://music.163.com/#/playlist?id=1），来听听'
    const result = await module.exports.fetchPublicPlaylist(
      text,
      signal,
      count => progress.push(count)
    )
    assert.equal(resolvedText, text)
    assert.deepEqual(
      Array.from(result.tracks, track => track.id),
      ['a', 'b']
    )
    assert.deepEqual(progress, [1, 2])
  }
)
console.log(
  `Public profile import verified: ${count} mocked storage/identity/cancellation cases. No live account or private playlist is used.`
)
