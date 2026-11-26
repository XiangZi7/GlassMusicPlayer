import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// 在内存构建生产媒体会话桥接，使用可控制返回时序的 Tauri IPC 模拟原生端。
async function loadBridge() {
  const src = fileURLToPath(new URL('../src/', import.meta.url))
  const entry = fileURLToPath(new URL('../src/services/player/system-media-session.ts', import.meta.url))
  const [bundle] = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: { '@': src } },
    build: { lib: { entry, formats: ['es'] }, write: false },
  })
  const code = bundle.output.find(item => item.type === 'chunk' && item.isEntry).code
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}

// 检查恢复、播放、暂停、快速切歌和失败时传入原生会话的最终状态及 IPC 次数。
test('Windows 媒体会话只发布实际播放过的当前曲目，合并迟到更新并撤下失败卡片', async () => {
  const calls = []
  const callbacks = []
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke(command, { playback }) {
        assert.equal(command, 'update_system_media_session')
        calls.push(playback)
        const { promise, resolve } = Promise.withResolvers()
        callbacks.push(resolve)
        return promise
      },
    },
  }
  const { createSystemMediaSession } = await loadBridge()
  const session = createSystemMediaSession()
  const first = {
    catalog: { platform: 'netease', id: '1', sourceUrl: 'https://example.com/song' },
    title: '第一首',
    artist: '歌手',
    album: '专辑',
    cover: 'https://example.com/cover.jpg',
    dur: 180,
  }
  const second = {
    ...first, title: '第二首', cover: '/images/music-placeholder.svg', album: '—',
    catalog: { platform: 'kugou', id: '1', kugouAlbumAudioId: '7' },
  }
  const state = { playing: false, catalogStatus: null, t: 30, streamDuration: 0, queue: [0, 1], radioOn: false, shuffle: false }

  // 等待当前 IPC 完成，使合并后的下一次同步有机会发送。
  async function complete() {
    callbacks.shift()()
    await new Promise(resolve => setImmediate(resolve))
  }

  session.update(undefined, state)
  session.update(first, state)
  session.update(first, { ...state, catalogStatus: 'loading' })
  assert.deepEqual(calls, [])

  const playing = { ...state, playing: true, catalogStatus: 'preview', streamDuration: 30, t: 4.2 }
  session.update(first, playing)
  await complete()
  assert.deepEqual(calls[0], {
    track: { id: 'netease:1', title: '第一首', artist: '歌手', album: '专辑', coverUrl: first.cover },
    playing: true, canNext: true, canPrevious: true, duration: 30, position: 4.2,
  })
  session.update(first, { ...playing, t: 4.8 })
  assert.equal(calls.length, 1)
  session.update(first, { ...playing, playing: false, t: 4.8 })
  assert.equal(calls[1].playing, false)
  assert.equal(calls[1].position, 4.8)

  session.update(second, { ...state, catalogStatus: 'loading', t: 0 })
  session.update(second, { ...playing, streamDuration: 180, t: 0, queue: [1] })
  await complete()
  assert.equal(calls.length, 3)
  assert.deepEqual(calls[2], {
    track: { id: 'kugou:1:audio:7', title: '第二首', artist: '歌手', album: '', coverUrl: null },
    playing: true, canNext: false, canPrevious: false, duration: 180, position: 0,
  })
  session.update(second, { ...state, catalogStatus: 'error' })
  await complete()
  assert.equal(calls[3], null)
  await complete()
  session.update(second, state)
  session.clear()
  assert.equal(calls.length, 4)
})
