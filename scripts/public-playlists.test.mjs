import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// 只替换平台 API，内存构建真实的首页预览、缓存和排序逻辑。
async function loadPreviews() {
  const src = fileURLToPath(new URL('../src/', import.meta.url))
  const entry = fileURLToPath(new URL('../src/pages/index/public-playlists.ts', import.meta.url))
  const [bundle] = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: { '@': src } },
    plugins: [{
      name: 'controlled-playlist-api',
      load(id) {
        if (id.replaceAll('\\', '/').endsWith('/src/api/index.ts'))
          return 'export const getCatalogPlaylist = (...args) => globalThis.testPlaylistRequest(...args); export const resolveCatalogPlaylist = () => { throw Error("unexpected resolve") }'
      },
    }],
    build: { lib: { entry, formats: ['es'] }, write: false },
  })
  const { code } = bundle.output.find(item => item.type === 'chunk' && item.isEntry)
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}

test('公开歌单渐进展示、失败重试与取消隔离', async t => {
  const { loadPublicPlaylists, discoveryPreview } = await loadPreviews()
  const pending = []
  globalThis.testPlaylistRequest = (platform, id, page, size) => {
    assert.equal(page, 1)
    assert.equal(size, 12)
    const request = Promise.withResolvers()
    pending.push({
      id, platform, reject: request.reject,
      finish(title = id) { request.resolve({ platform, id, title, tracks: [{ title }] }) },
    })
    return request.promise
  }
  t.after(() => { delete globalThis.testPlaylistRequest })

  // 记录每次预览的快照，保留请求控制权来模拟乱序、失败和撤销后迟到。
  function begin(day) {
    const controller = new AbortController()
    const snapshots = []
    const done = loadPublicPlaylists(day, controller.signal, lists => snapshots.push(lists.map(list => list.id)))
    return { requests: pending.splice(0), controller, snapshots, done }
  }
  const first = begin('day-1')
  assert.equal(first.requests.length, 6)
  const ids = first.requests.map(r => r.id)
  first.requests[4].finish()
  await setImmediate()
  assert.deepEqual(first.snapshots.at(-1), [ids[4]], '慢平台仍在等待时就展示最快的来源')
  first.requests[1].finish()
  await setImmediate()
  assert.deepEqual(first.snapshots.at(-1), [ids[1], ids[4]])
  first.requests[2].reject(Error('测试平台超时'))
  for (const i of [5, 3, 0]) first.requests[i].finish()
  const partial = await first.done
  const successful = ids.filter((_, i) => i !== 2)
  assert.equal(partial.incomplete, true)
  assert.deepEqual(partial.playlists.map(p => p.id), successful)
  const retry = begin('day-1')
  assert.deepEqual(retry.snapshots.at(-1), successful)
  assert.deepEqual(retry.requests.map(r => r.id), [ids[2]])
  retry.requests[0].finish()
  const full = await retry.done
  assert.equal(full.incomplete, false)
  assert.deepEqual(full.playlists.map(p => p.id), ids)
  assert.deepEqual(retry.snapshots.at(-1), ids)

  const stale = begin('day-2')
  stale.controller.abort()
  const countAtAbort = stale.snapshots.length
  const current = begin('day-3')
  for (const request of current.requests) request.finish('新日期')
  await current.done
  for (const request of stale.requests) request.finish('迟到的旧日期')
  await stale.done
  assert.equal(stale.snapshots.length, countAtAbort)
  for (const { platform, id } of current.requests)
    assert.equal(discoveryPreview(platform, id).title, '新日期')
  const cached = begin('day-3')
  assert.deepEqual(cached.requests, [])
  assert.deepEqual(cached.snapshots.at(-1), ids)
  await cached.done
})
