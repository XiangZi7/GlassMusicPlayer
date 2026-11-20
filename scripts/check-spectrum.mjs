import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const delayed = new Map()
const created = new Map()
const colors = {
  green: [20, 120, 40],
  white: [240, 240, 240],
  black: [0, 0, 0],
  'slow-blue': [20, 50, 180],
  'fast-red': [190, 40, 30],
}
const document = {
  createElement(tag) {
    if (tag === 'img')
      return {
        onload: null,
        onerror: null,
        set src(url) {
          this.url = url
          created.set(url, (created.get(url) || 0) + 1)
          const load = () => this.onload?.()
          if (url.startsWith('slow')) delayed.set(url, load)
          else queueMicrotask(load)
        },
      }
    let image
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage(value) {
          image = value
        },
        getImageData() {
          if (image.url === 'blocked') throw new Error('CORS image')
          const pixels = new Uint8ClampedArray(24 * 24 * 4)
          const color = colors[image.url] || [50, 60, 70]
          for (let offset = 0; offset < pixels.length; offset += 4) {
            pixels.set([...color, 255], offset)
          }
          return { data: pixels }
        },
      }),
    }
  },
}
let nextFrame = 0
const frames = new Map()
class AudioContext {
  state = 'running'
  sampleRate = 48000
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} }
  }
  resume() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}
class AnalyserNode {
  constructor(_context, options) {
    assert.equal(options.fftSize, 4096)
  }
  getByteFrequencyData(bins) {
    bins.fill(192)
  }
}
function load(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(
    compiled,
    {
      exports: module.exports,
      module,
      require: name => {
        assert(name in dependencies, `Unexpected import: ${name}`)
        return dependencies[name]
      },
      setTimeout,
      clearTimeout,
      AudioContext,
      AnalyserNode,
      window: {
        AudioContext,
        devicePixelRatio: 2,
        matchMedia: () => ({
          matches: false,
          addEventListener() {},
          removeEventListener() {},
        }),
      },
      requestAnimationFrame: callback => {
        const id = ++nextFrame
        frames.set(id, callback)
        return id
      },
      cancelAnimationFrame: id => frames.delete(id),
    },
    { filename: relative }
  )
  return module.exports
}
const palette = load('src/services/player/artwork-color.ts')
const profile = load('src/services/player/spectrum-profile.ts')
const spectrum = load('src/services/player/spectrum.ts', {
  '@/services/player/artwork-color': palette,
  '@/services/player/spectrum-profile': profile,
})
const first = palette.artworkColor('green', document)
assert.equal(
  first,
  palette.artworkColor('green', document),
  'Palette should be cached'
)
const green = await first
assert(green[1] > green[0] && green[1] > green[2])
assert.equal(created.get('green'), 1)
assert.deepEqual(
  Array.from(await palette.artworkColor('white', document)),
  [240, 240, 240]
)
assert.deepEqual(
  Array.from(await palette.artworkColor('black', document)),
  [140, 140, 150]
)
assert.equal(
  await palette.artworkColor('blocked', document),
  undefined,
  'CORS failure should not reject'
)
for (const width of [180, 375, 900, 1360, 1920]) {
  const layout = spectrum.spectrumLayout(width)
  assert(layout.barWidth <= 2)
  assert(layout.count > 0 && layout.count <= 320)
}
assert.equal(spectrum.spectrumLayout(1360).count, 320)
assert.equal(spectrum.spectrumLayout(0).count, 0)
const calls = []
let currentPath
const paint = {
  setTransform() {},
  resetTransform() {},
  clearRect() {},
  beginPath() {},
  roundRect(x, y, width, height, radii) {
    currentPath = { x, y, width, height, radii: Array.from(radii) }
  },
  fill() {
    calls.push({ ...currentPath, color: this.fillStyle })
  },
  fillRect(x, y, width, height) {
    calls.push({ x, y, width, height, color: this.fillStyle })
  },
}
const canvas = {
  clientWidth: 1360,
  clientHeight: 14,
  width: 0,
  height: 0,
  style: {},
  dataset: {},
  ownerDocument: document,
  getContext: () => paint,
}
const audio = {
  paused: false,
  readyState: 4,
  crossOrigin: 'anonymous',
  captureStream: () => ({ getAudioTracks: () => [{}] }),
}
const renderer = spectrum.createSpectrum(canvas, audio)
renderer.setArtwork('slow-blue', 'rgba(20,50,180,.5)')
renderer.setArtwork('fast-red', 'rgba(190,40,30,.5)')
await new Promise(resolve => setTimeout(resolve, 0))
const current = canvas.dataset.spectrumColor
assert(
  +current.split(',')[0] > +current.split(',')[2],
  'Current cover should be red'
)
delayed.get('slow-blue')()
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(
  canvas.dataset.spectrumColor,
  current,
  'Old cover must not override the current song'
)
renderer.resume()
calls.length = 0
renderer.update()
assert.equal(calls.length, 320)
assert.equal(canvas.dataset.spectrumMode, 'live')
assert(
  calls.every(call => Math.abs(call.y + call.height - 14) < 1e-6),
  'Bars must reach the bottom edge'
)
assert(
  calls.every(
    call =>
      call.radii?.[0] <= 1 && call.radii?.[2] === 0 && call.radii?.[3] === 0
  ),
  'Only top corners are rounded'
)
assert.equal(
  new Set(calls.map(call => call.height)).size,
  1,
  'Equal real peaks must not be reshaped by a random skyline'
)
assert(calls.every(call => call.width <= 2 && call.height > 0))
assert(
  calls.every(call => call.color.includes(current)),
  'Bars should use the current artwork color'
)
renderer.setMotion(false)
assert.equal(frames.size, 0, 'Reduced motion setting should stop rendering')
renderer.destroy()
renderer.setArtwork('after-destroy', 'rgba(0,255,0,.5)')
assert.equal(created.has('after-destroy'), false)
// 原稿的种子轮廓重采样：同曲稳定、换曲不同，窄宽均不越界。
const skyline = profile.spectrumProfile(2, 168)
assert.deepEqual(
  Array.from(skyline),
  Array.from(profile.spectrumProfile(2, 168))
)
assert.notDeepEqual(
  Array.from(skyline),
  Array.from(profile.spectrumProfile(3, 168))
)
assert(
  skyline.every(value => value >= 0.16 - 1e-6 && value <= 1 + 1e-6),
  'Skyline bounds allow only Float32 rounding error'
)
for (const width of [1, 2, 180, 375, 768, 1024, 1440, 1920]) {
  const layout = spectrum.spectrumLayout(width)
  assert(layout.padding >= 0 && layout.barWidth > 0 && layout.barWidth <= 2)
  const right =
    layout.padding +
    (layout.count - 1) * layout.step +
    (layout.step - layout.barWidth) / 2 +
    layout.barWidth
  assert(right <= width, `Spectrum overflow at ${width}px`)
}
const rhythmA = new Float32Array(168)
const rhythmB = new Float32Array(168)
profile.spectrumRhythm(2, 20, 200, skyline, rhythmA)
profile.spectrumRhythm(2, 20.15, 200, skyline, rhythmB)
assert.notDeepEqual(
  Array.from(rhythmA),
  Array.from(rhythmB),
  'Rhythm must change with the playhead'
)
assert(rhythmA.every(value => value >= 0 && value <= 1))

// 模拟只为显式 demo 开启；首帧时间不能被页面已运行时间污染。
const sampleCanvas = { ...canvas, dataset: {}, style: {} }
const sampleAudio = {
  paused: true,
  readyState: 0,
  crossOrigin: '',
  captureStream() {
    throw new Error('Demo must not capture audio')
  },
}
const sample = spectrum.createSpectrum(sampleCanvas, sampleAudio)
sample.setArtwork('demo-orange', 'rgba(255,90,30,.5)', false)
assert.equal(created.has('demo-orange'), false)
assert.equal(sampleCanvas.dataset.spectrumColor, '255,90,30')
sample.setPlayback({
  playing: true,
  time: 20,
  duration: 200,
  seed: 2,
  demo: true,
})
assert.equal(sampleCanvas.dataset.spectrumMode, 'simulated')
assert.equal(frames.size, 1)
function stepFrame(timestamp) {
  const [id, callback] = frames.entries().next().value
  frames.delete(id)
  calls.length = 0
  callback(timestamp)
  return calls.map(call => ({ ...call }))
}
const firstSample = stepFrame(1000000)
const sampleProfile = profile.spectrumProfile(2, 320)
const sampleTargets = new Float32Array(320)
profile.spectrumRhythm(2, 20, 200, sampleProfile, sampleTargets)
firstSample.forEach((call, band) => {
  const expected = Math.min(
    14,
    14 * sampleProfile[band] * (0.06 + sampleTargets[band] * 0.84 * 1.12)
  )
  assert(
    Math.abs(call.height - expected) < 1e-4,
    'First frame must stay on the playback clock'
  )
  assert.equal(call.color, 'rgba(255,90,30,0.55)')
})
const nextSample = stepFrame(1000150)
assert.notDeepEqual(
  firstSample.map(call => call.height),
  nextSample.map(call => call.height)
)
sample.setPlayback({
  playing: false,
  time: 20.15,
  duration: 200,
  seed: 2,
  demo: true,
})
assert.equal(frames.size, 0)
assert.equal(sampleCanvas.dataset.spectrumMode, 'static')
assert(
  new Set(calls.slice(-320).map(call => call.height)).size > 20,
  'Pause keeps a shaped skyline, not a flat baseline'
)
sample.setPlayback({
  playing: true,
  time: 21,
  duration: 200,
  seed: 2,
  demo: true,
})
sample.setMotion(false)
assert.equal(frames.size, 0)
sample.destroy()

// 无 CORS/无可用分析器的真实曲目不冒用模拟峰值，也不影响原来的出声路径。
const unavailableCanvas = { ...canvas, dataset: {}, style: {} }
const unavailableAudio = {
  paused: false,
  readyState: 4,
  crossOrigin: '',
  captureStream() {
    throw new Error('CORS must block analysis only')
  },
}
const unavailable = spectrum.createSpectrum(unavailableCanvas, unavailableAudio)
unavailable.resume()
unavailable.setPlayback({
  playing: true,
  time: 10,
  duration: 200,
  seed: 3,
  demo: false,
})
assert.equal(unavailableCanvas.dataset.spectrumMode, 'static')
assert.equal(frames.size, 0)
assert.equal(unavailableAudio.paused, false)
unavailable.destroy()
console.log(
  'Spectrum verified: thin rounded bottom-aligned bars, 4096 FFT, real peaks, cover colors/cache/CORS/stale-cover protection, seeded skyline, demo rhythm/playback clock and cleanup.'
)
