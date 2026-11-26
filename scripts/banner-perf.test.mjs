import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// 在内存构建实际频谱模块，复用项目的别名与生产分支，无需启动开发服务器。
async function loadSpectrum() {
  const src = fileURLToPath(new URL('../src/', import.meta.url))
  const entry = fileURLToPath(new URL('../src/services/player/spectrum.ts', import.meta.url))
  const [bundle] = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: { '@': src } },
    build: { lib: { entry, formats: ['es'] }, write: false },
  })
  const code = bundle.output.find(item => item.type === 'chunk' && item.isEntry).code
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}

// 模拟浏览器帧时钟与支持采样的音频设备，记录真实渲染器申请的资源与每次点阵更新。
test('首页点阵只消费可见实频及暂停淡出，稳态没有专用帧与隐藏位图', async () => {
  const { createSpectrum } = await loadSpectrum()
  const scheduled = new Map()
  let frameId = 0
  let now = performance.now()
  let images = 0
  let fftReads = 0
  let bannerPaints = 0
  let visibilityChanged
  let resized
  const motion = Object.assign(new EventTarget(), { matches: false })
  class AudioContext {
    state = 'running'
    sampleRate = 48000
    createMediaStreamSource() { return { connect() {}, disconnect() {} } }
    async close() {}
  }
  Object.assign(globalThis, {
    window: { matchMedia: () => motion, AudioContext, devicePixelRatio: 1 },
    AudioContext,
    AnalyserNode: class { getByteFrequencyData(bins) { fftReads++; bins.fill(160) } },
    MutationObserver: class {
      constructor(callback) { visibilityChanged = callback }
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class {
      constructor(callback) { resized = callback }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    Image: class { constructor() { images++ } },
    requestAnimationFrame(callback) { scheduled.set(++frameId, callback); return frameId },
    cancelAnimationFrame(id) { scheduled.delete(id) },
  })

  // 每次只执行本次刷新前已排队的回调，也保留取消尚未开始的同一帧回调的行为。
  function advance(count) {
    for (let tick = 0; tick < count; tick++) {
      now += 1000 / 60
      for (const [key, callback] of [...scheduled]) {
        if (scheduled.delete(key)) callback(now)
      }
    }
  }
  const paint = { setTransform() {}, clearRect() {}, fillRect() {} }
  const bar = { clientWidth: 320, clientHeight: 24, dataset: {}, style: {}, getContext: () => paint }
  const strip = { clientWidth: 176, clientHeight: 28, isConnected: true, dataset: {},
    getContext: () => ({ ...paint, fillRect() { bannerPaints++ } }) }
  let hiddenContexts = 0
  const dots = Object.assign(new EventTarget(), {
    dataset: { dotsRenderer: 'three' },
    getContext() { hiddenContexts++; return paint },
    isConnected: true,
  })
  const samples = []
  dots.addEventListener('halftone-frame', ({ detail }) => {
    samples.push({ fade: detail.fade, live: detail.live, energy: Math.max(...detail.targets) })
  })
  const audio = { paused: false, readyState: 4, crossOrigin: 'anonymous',
    captureStream: () => ({ getAudioTracks: () => [{}] }) }
  const player = createSpectrum(bar, audio)
  const playback = { playing: true, duration: 180, time: 0, seed: 1, demo: false }
  player.setBannerCanvas(strip)
  player.setDotsCanvas(dots)
  assert.equal(scheduled.size, 0)
  player.setPlayback(playback)
  assert.ok(samples.every(frame => !frame.live && frame.fade === 0))
  assert.equal(scheduled.size, 0, '没有真实分析输入时静止')
  player.resume()
  player.setPlayback(playback)
  advance(75)
  assert.equal(samples.at(-1).fade, 1)
  assert.ok(samples.at(-1).energy > 0)
  assert.equal(scheduled.size, 1, '稳定播放只使用底栏的帧时钟')

  player.setPlayback({ ...playback, playing: false })
  advance(24)
  assert.ok(samples.at(-1).fade > 0 && samples.at(-1).fade < 1)
  player.setPlayback(playback)
  advance(75)
  assert.equal(samples.at(-1).fade, 1, '快速恢复后旧淡出不会覆盖新播放')
  dots.dataset.dotsSuspended = 'true'
  strip.dataset.bannerSuspended = 'true'
  visibilityChanged()
  const offscreenPaints = bannerPaints
  advance(4)
  assert.equal(samples.at(-1).fade, 0)
  const hiddenCount = samples.length
  advance(30)
  assert.equal(samples.length, hiddenCount, '全屏、折叠或后台时不发布显示帧')
  assert.equal(bannerPaints, offscreenPaints, '横幅离屏后停止绘制左下角频谱')
  assert.equal(scheduled.size, 1, '可见底栏继续消费音频采样')
  bar.clientWidth = 0
  resized()
  const offscreenReads = fftReads
  player.setPlayback(playback)
  advance(45)
  assert.equal(fftReads, offscreenReads)
  assert.equal(scheduled.size, 0, '底栏也关闭时停止共享帧时钟')
  delete dots.dataset.dotsSuspended
  delete strip.dataset.bannerSuspended
  visibilityChanged()
  advance(75)
  assert.ok(fftReads > offscreenReads && bannerPaints > offscreenPaints, '底栏关闭时滚回横幅也能恢复')
  assert.equal(samples.at(-1).fade, 1)
  motion.matches = true
  motion.dispatchEvent(new Event('change'))
  advance(2)
  assert.equal(samples.at(-1).fade, 0)
  assert.equal(scheduled.size, 0)
  motion.matches = false
  motion.dispatchEvent(new Event('change'))
  advance(75)
  player.setPlayback({ ...playback, playing: false })
  advance(75)
  assert.equal(samples.at(-1).fade, 0)
  assert.equal(scheduled.size, 0, '暂停淡出后不再轮询')
  assert.equal(images, 0)
  assert.equal(hiddenContexts, 0)
  player.destroy()
})
