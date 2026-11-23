import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')
// 编译实际 TS 模块，测试真实处理器而不是在回归中重写 EQ 行为。
function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
}
const equalizerCode = compile('src/services/player/equalizer.ts')
const catalogCode = compile('src/services/player/catalog-audio.ts')
// 在模拟浏览器环境中读取实际模块，禁止意外引入额外依赖。
function moduleFrom(code, dependencies, globals) {
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(name) {
      assert(name in dependencies, `Unexpected dependency ${name}`)
      return dependencies[name]
    },
    ...globals,
  })
  return module.exports
}
// 构造可控的异步响应，覆盖 Context 激活、请求取消和迟到的返回。
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
// 清空实际微任务队列；定时激活预算仍由测试自己的时钟控制。
const flush = () => new Promise(resolve => setImmediate(resolve))

// 模拟 Web Audio 图、单媒体元素和频谱调用，记录节点接管及参数自动化。
function harness(options = {}) {
  const h = {
    contexts: [],
    audios: [],
    spectra: [],
    states: [],
    playback: [],
    times: [],
    notices: [],
    requests: [],
    timers: new Map(),
    connections: [],
    sourceCreations: 0,
  }
  let timerId = 0
  class Param {
    value = 0
    calls = []
    cancelAndHoldAtTime(time) {
      this.calls.push(['hold', time])
    }
    cancelScheduledValues(time) {
      this.calls.push(['cancel', time])
    }
    setValueAtTime(value, time) {
      this.value = value
      this.calls.push(['set', value, time])
    }
    linearRampToValueAtTime(value, time) {
      this.value = value
      this.calls.push(['ramp', value, time])
    }
  }
  class Node {
    constructor(context, kind) {
      this.context = context
      this.kind = kind
      this.outputs = []
      this.gain = new Param()
      this.frequency = new Param()
      this.Q = new Param()
      context.nodes.push(this)
    }
    connect(target) {
      if (options.failNode === 'filter' && this.kind === 'filter')
        throw new Error('Mock filter connection failure')
      if (options.failNode === 'source' && this.kind === 'source')
        throw new Error('Mock source connection failure')
      this.outputs.push(target)
      h.connections.push([this, target])
      return target
    }
    disconnect() {
      this.outputs = []
    }
  }
  class Context {
    constructor() {
      if (options.throwConstructor) throw new Error('Mock unsupported context')
      this.state = 'suspended'
      this.currentTime = 10
      this.sampleRate = options.sampleRate || 48000
      this.nodes = []
      this.destination = { kind: 'destination' }
      this.listeners = new Map()
      this.closeCalls = 0
      this.resumeGate = deferred()
      h.contexts.push(this)
    }
    resume() {
      if (options.rejectResume)
        return Promise.reject(
          new DOMException('Mock rejected activation', 'NotAllowedError')
        )
      if (options.deferResume) return this.resumeGate.promise
      this.state = 'running'
      return Promise.resolve()
    }
    resolveResume() {
      if (this.state !== 'closed') this.state = 'running'
      this.resumeGate.resolve()
    }
    close() {
      this.closeCalls++
      this.state = 'closed'
      return Promise.resolve()
    }
    createGain() {
      return new Node(this, 'gain')
    }
    createBiquadFilter() {
      return new Node(this, 'filter')
    }
    createMediaElementSource(element) {
      assert.equal(
        this.state,
        'running',
        'Must run Context before hijacking media'
      )
      assert.equal(
        element.crossOrigin,
        'anonymous',
        'Must verify CORS mode before hijacking'
      )
      assert(
        element.readyState >= 2 && !element.paused,
        'Must have successfully playable media'
      )
      assert(
        !element.hijacked,
        'A MediaElementSource cannot be attached twice to the same element'
      )
      h.sourceCreations++
      element.hijacked = true
      const node = new Node(this, 'source')
      node.element = element
      element.graph = node
      return node
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(callback)
    }
    removeEventListener(type, callback) {
      this.listeners.get(type)?.delete(callback)
    }
    interrupt(state = 'suspended') {
      this.state = state
      for (const callback of [...(this.listeners.get('statechange') || [])])
        callback()
    }
  }
  class Audio {
    constructor(document) {
      this.ownerDocument = document
      this.paused = true
      this.readyState = 0
      this.duration = NaN
      this.currentTime = 0
      this.volume = 1
      this.muted = false
      this.ended = false
      this.crossOrigin = ''
      this.src = ''
      this.error = null
      this.listeners = new Map()
      this.hijacked = false
      this.removed = false
      this.playCalls = 0
      h.audios.push(this)
    }
    get currentSrc() {
      return this.src
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(callback)
    }
    removeEventListener(type, callback) {
      this.listeners.get(type)?.delete(callback)
    }
    emit(type) {
      for (const callback of [...(this.listeners.get(type) || [])])
        callback({ target: this })
    }
    play() {
      this.playCalls++
      const isProxy = this.src.startsWith('https://service.test/')
      if (
        isProxy &&
        (options.failProxy === true ||
          options.failProxyIds?.some(id => this.src.includes(`/tracks/${id}/`)))
      ) {
        this.error = { code: 4 }
        return Promise.reject(
          new DOMException('Mock proxy unavailable', 'NotSupportedError')
        )
      }
      if (options.deferPlay) return options.deferPlay(this)
      this.error = null
      this.paused = false
      this.readyState = 4
      this.duration = 120
      this.emit('durationchange')
      this.emit('loadedmetadata')
      this.emit('playing')
      return Promise.resolve()
    }
    pause() {
      this.paused = true
      this.emit('pause')
    }
    load() {
      this.readyState = 0
      this.duration = NaN
      this.error = null
    }
    removeAttribute(name) {
      if (name.toLowerCase() === 'crossorigin') this.crossOrigin = ''
      if (name === 'src') this.src = ''
    }
    remove() {
      this.removed = true
    }
    get audible() {
      if (this.paused || this.removed || !this.src) return false
      if (!this.hijacked) return true
      return (
        this.crossOrigin === 'anonymous' &&
        this.graph.context.state === 'running' &&
        this.graph.outputs.length > 0
      )
    }
  }
  const document = {
    defaultView: options.unsupported ? {} : { AudioContext: Context },
    createElement: tag => {
      assert.equal(tag, 'audio')
      return new Audio(document)
    },
  }
  const elementRoot = {
    ownerDocument: document,
    append() {},
    querySelector: () => ({ ownerDocument: document }),
  }
  const globals = {
    URL,
    AbortController,
    DOMException,
    setTimeout(callback) {
      const id = ++timerId
      h.timers.set(id, callback)
      return id
    },
    clearTimeout(id) {
      h.timers.delete(id)
    },
  }
  const eq = moduleFrom(equalizerCode, {}, globals)
  const spectrum = {
    createSpectrum(_canvas, audio) {
      const calls = []
      const api = Object.fromEntries(
        [
          'reset',
          'resume',
          'update',
          'stop',
          'destroy',
          'setMotion',
          'setArtwork',
          'setPlayback',
          'setBannerCanvas',
        ].map(name => [name, (...args) => calls.push([name, ...args])])
      )
      h.spectra.push({ audio, calls, api })
      return api
    },
  }
  const catalog = moduleFrom(
    catalogCode,
    {
      '@/api': {
        getCatalogAudioUrl: (platform, id) =>
          `https://service.test/api/v1/${platform}/tracks/${id}/audio`,
        getCatalogPlayback: async (platform, id, signal) => {
          h.requests.push({ platform, id, signal })
          return options.playback
            ? options.playback(platform, id, signal)
            : { url: `https://cdn.test/${id}.mp3`, status: 'full' }
        },
      },
      '@/services/notification': { notify: (...args) => h.notices.push(args) },
      '@/services/player/catalog': {
        catalogKey: item => `${item.platform}:${item.id}`,
      },
      '@/services/player/equalizer': eq,
      '@/services/player/spectrum': spectrum,
    },
    globals
  )
  h.eq = eq
  h.makeAudio = () => new Audio(document)
  h.direct = () => {
    const audio = h.makeAudio()
    audio.src = 'https://service.test/audio'
    audio.crossOrigin = 'anonymous'
    audio.readyState = 4
    audio.paused = false
    const states = [],
      recovery = []
    const equalizer = eq.createEqualizer(audio, {
      status: status => states.push(status),
      recover: () => recovery.push(true),
    })
    return { audio, equalizer, states, recovery }
  }
  h.controller = catalog.createCatalogAudio(elementRoot, {
    time(time, duration) {
      h.times.push({ time, duration })
      options.time?.(h, time, duration)
    },
    playing: playing => h.playback.push(playing),
    status: status => h.states.push(status),
    ended() {},
    ...(options.omitEqualizerCallback
      ? {}
      : {
          equalizer: status => {
            h.equalizerStates ??= []
            h.equalizerStates.push(status)
          },
        }),
  })
  h.current = () => h.audios.filter(audio => !audio.removed).at(-1)
  h.flushTimers = () => {
    const callbacks = [...h.timers.values()]
    h.timers.clear()
    callbacks.forEach(callback => callback())
  }
  h.close = () => h.controller.destroy()
  return h
}
const config = (gains = Array(10).fill(0), overrides = {}) => ({
  enabled: true,
  preamp: 0,
  gains,
  autoHeadroom: true,
  ...overrides,
})
const track = id => ({
  platform: 'netease',
  id: String(id),
  sourceUrl: `https://music.163.com/song?id=${id}`,
})
let cases = 0
// 完整等待每个实际模块的操作结果，失败停止回归而不继续声称通过。
async function check(name, test) {
  await test()
  cases++
  console.log(`PASS ${name}`)
}

await check(
  'exports ten bands and at least ten documented finite presets',
  async () => {
    const h = harness()
    assert.deepEqual(
      Array.from(h.eq.equalizerBands, band => band.frequency),
      [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
    )
    assert(h.eq.equalizerPresets.length >= 10)
    assert.equal(
      new Set(h.eq.equalizerPresets.map(preset => preset.id)).size,
      h.eq.equalizerPresets.length
    )
    for (const preset of h.eq.equalizerPresets) {
      assert(preset.name && preset.description)
      assert.equal(preset.gains.length, 10)
      assert(
        preset.gains.every(
          value => Number.isFinite(value) && Math.abs(value) <= 12
        )
      )
      assert(Math.abs(preset.preamp) <= 12)
    }
    h.close()
  }
)
await check(
  'comma parsing and normalization never pass invalid or out-of-range values',
  async () => {
    const h = harness()
    assert.deepEqual(
      Array.from(h.eq.parseEqualizerGains('wrong')),
      Array(10).fill(0)
    )
    assert.deepEqual(
      Array.from(
        h.eq.parseEqualizerGains('99,-99,NaN,Infinity,,1.5,-2.5,0,12,-12')
      ),
      [12, -12, 0, 0, 0, 1.5, -2.5, 0, 12, -12]
    )
    const input = config([NaN, Infinity, -999, 999], { preamp: Infinity })
    const normalized = h.eq.normalizeEqualizerConfig(input)
    assert.equal(normalized.preamp, 0)
    assert.deepEqual(
      Array.from(normalized.gains),
      [0, 0, -12, 12, 0, 0, 0, 0, 0, 0]
    )
    h.close()
  }
)
await check(
  'headroom protects positive preamp and overlapping band boosts, bypass is opt-in',
  async () => {
    const h = harness()
    assert.equal(h.eq.equalizerHeadroom(config()), 0)
    assert(
      h.eq.equalizerHeadroom(config(Array(10).fill(12), { preamp: 12 })) < -12
    )
    assert(h.eq.equalizerHeadroom(config([0, 0, 0, 0, 0, 6, 6, 0, 0, 0])) < -6)
    assert.equal(
      h.eq.equalizerHeadroom(
        config(Array(10).fill(12), { preamp: 12, autoHeadroom: false })
      ),
      12
    )
    h.close()
  }
)
await check(
  'default disabled keeps original audio path and creates no EQ context',
  async () => {
    const h = harness({ omitEqualizerCallback: true })
    await h.controller.play(track(1))
    await flush()
    assert.equal(h.contexts.length, 0)
    assert.equal(h.sourceCreations, 0)
    assert(h.current().audible)
    assert.equal(h.current().hijacked, false)
    assert(h.spectra[0].calls.some(([name]) => name === 'resume'))
    assert(h.spectra[0].calls.some(([name]) => name === 'update'))
    h.close()
  }
)
await check(
  'enabled without a loaded source remains pending without hijacking media',
  async () => {
    const h = harness()
    h.controller.setEqualizer(config())
    await flush()
    assert.equal(h.sourceCreations, 0)
    assert.equal(h.contexts.length, 0)
    assert.equal(h.equalizerStates.at(-1), 'pending')
    h.close()
  }
)
await check(
  'Context must run before a successfully CORS-loaded media source is attached',
  async () => {
    const h = harness({ deferResume: true })
    h.controller.setEqualizer(config([1, 2, 3, 4, 0, -1, -2, 1, 0, 1]))
    await h.controller.play(track(1))
    await flush()
    assert(h.current().audible)
    assert.equal(h.sourceCreations, 0)
    assert.equal(h.equalizerStates.at(-1), 'pending')
    h.contexts[0].resolveResume()
    await flush()
    assert.equal(h.sourceCreations, 1)
    assert.equal(h.equalizerStates.at(-1), 'active')
    const filters = h.contexts[0].nodes.filter(node => node.kind === 'filter')
    assert.equal(filters.length, 10)
    assert.deepEqual(
      filters.map(node => node.frequency.value),
      [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
    )
    assert(
      filters.every(
        node => node.type === 'peaking' && node.Q.value === Math.SQRT2
      )
    )
    h.close()
  }
)
await check(
  'updates smooth 20–80ms without rebuilding nodes or repeating identical config',
  async () => {
    const h = harness()
    const input = config(Array(10).fill(2))
    h.controller.setEqualizer(input)
    await h.controller.play(track(1))
    await flush()
    const context = h.contexts[0],
      filters = context.nodes.filter(node => node.kind === 'filter')
    input.gains[0] = 12
    assert.equal(
      filters[0].gain.value,
      2,
      'Caller mutation must not alter saved config'
    )
    h.controller.setEqualizer(config(Array(10).fill(-2)))
    const count = filters[0].gain.calls.length
    h.controller.setEqualizer(config(Array(10).fill(-2)))
    assert.equal(filters[0].gain.calls.length, count)
    assert.equal(h.sourceCreations, 1)
    assert.equal(h.contexts.length, 1)
    const ramps = context.nodes.flatMap(node =>
      node.gain.calls.filter(call => call[0] === 'ramp')
    )
    assert(
      ramps.every(
        call =>
          call[2] - context.currentTime >= 0.019 &&
          call[2] - context.currentTime <= 0.081
      )
    )
    h.close()
  }
)
await check(
  'disabling is true unity dry bypass regardless of saved preamp and gains',
  async () => {
    const h = harness()
    h.controller.setEqualizer(config(Array(10).fill(3)))
    await h.controller.play(track(1))
    await flush()
    h.controller.setEqualizer(
      config(Array(10).fill(12), { enabled: false, preamp: -12 })
    )
    const gains = h.contexts[0].nodes.filter(node => node.kind === 'gain')
    assert.equal(gains[1].gain.value, 1)
    assert.equal(gains[2].gain.value, 0)
    assert.equal(h.equalizerStates.at(-1), 'bypassed')
    assert(h.current().audible)
    h.close()
  }
)
for (const options of [
  { unsupported: true },
  { throwConstructor: true },
  { rejectResume: true },
]) {
  await check(
    `unsupported activation preserves audible original (${JSON.stringify(options)})`,
    async () => {
      const h = harness(options)
      h.controller.setEqualizer(config())
      await h.controller.play(track(1))
      await flush()
      assert.equal(h.sourceCreations, 0)
      assert(h.current().audible)
      assert.equal(h.equalizerStates.at(-1), 'unavailable')
      assert.equal(h.notices.length, 0)
      h.close()
    }
  )
}
await check(
  'activation timeout has a finite budget and never hijacks original audio',
  async () => {
    const h = harness({ deferResume: true })
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    await flush()
    h.flushTimers()
    await flush()
    assert.equal(h.sourceCreations, 0)
    assert(h.current().audible)
    assert.equal(h.equalizerStates.at(-1), 'unavailable')
    assert(h.contexts[0].closeCalls > 0)
    h.close()
  }
)
await check(
  'disable during pending activation ignores the late running Context',
  async () => {
    const h = harness({ deferResume: true })
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    h.controller.setEqualizer(config([], { enabled: false }))
    h.contexts[0].resolveResume()
    await flush()
    assert.equal(h.sourceCreations, 0)
    assert.equal(h.equalizerStates.at(-1), 'bypassed')
    assert(h.current().audible)
    h.close()
  }
)
await check(
  'pause and destroy cancel late activation without resuming playback',
  async () => {
    const h = harness({ deferResume: true })
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    h.controller.pause()
    h.contexts[0].resolveResume()
    await flush()
    assert.equal(h.sourceCreations, 0)
    assert.equal(h.current().paused, true)
    h.close()
    assert.equal(h.timers.size, 0)
  }
)
await check(
  'initial CORS proxy fallback remains native and explicitly unavailable',
  async () => {
    const h = harness({ failProxy: true })
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    await flush()
    assert.equal(h.sourceCreations, 0)
    assert.equal(h.audios.length, 1)
    assert.equal(h.current().crossOrigin, '')
    assert(h.current().audible)
    assert.equal(h.equalizerStates.at(-1), 'unavailable')
    assert.equal(h.notices.length, 0)
    h.close()
  }
)
await check(
  'fallback after prior EQ replaces hijacked audio, kills old events, retains spectrum',
  async () => {
    const h = harness({ failProxyIds: ['2'] })
    h.controller.setSpectrumMotion(false)
    h.controller.setSpectrumArtwork('/art.webp', 'rgba(20,30,40,.5)')
    h.controller.setSpectrumPlayback({
      playing: true,
      time: 12,
      duration: 120,
      seed: 1,
      demo: false,
    })
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    await flush()
    const old = h.current()
    assert(old.hijacked)
    h.controller.reset()
    await h.controller.play(track(2))
    await flush()
    const current = h.current()
    assert.notEqual(current, old)
    assert(current.audible)
    assert(!current.hijacked)
    assert(old.paused && old.removed)
    assert.equal(
      h.audios.filter(audio => !audio.paused && !audio.removed).length,
      1
    )
    assert.equal(h.equalizerStates.at(-1), 'unavailable')
    const times = h.times.length,
      playback = h.playback.length
    old.currentTime = 99
    old.emit('timeupdate')
    old.paused = false
    old.emit('playing')
    assert.equal(h.times.length, times)
    assert.equal(h.playback.length, playback)
    assert([...old.listeners.values()].every(listeners => listeners.size === 0))
    assert(h.spectra[0].calls.some(([name]) => name === 'destroy'))
    assert(
      h.spectra[1].calls.some(
        ([name, enabled]) => name === 'setMotion' && enabled === false
      )
    )
    assert(
      h.spectra[1].calls.some(
        ([name, cover]) => name === 'setArtwork' && cover === '/art.webp'
      )
    )
    h.close()
  }
)
for (const failNode of ['filter', 'source'])
  await check(
    `graph failure stays audible and honest (${failNode})`,
    async () => {
      const h = harness({ failNode })
      h.controller.setEqualizer(config())
      await h.controller.play(track(1))
      await flush()
      assert(h.current().audible)
      assert.equal(h.equalizerStates.at(-1), 'unavailable')
      assert.equal(h.notices.length, 0)
      if (failNode === 'filter') assert.equal(h.sourceCreations, 0)
      else {
        assert(h.audios[0].paused && h.audios[0].removed)
        assert.equal(h.audios.length, 2)
      }
      h.close()
    }
  )
await check(
  'Context interruption restores the same source position and volume with one clock',
  async () => {
    const h = harness()
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    await flush()
    const old = h.current()
    h.controller.seek(42)
    h.controller.setVolume(0.37)
    h.contexts[0].interrupt()
    await flush()
    assert.notEqual(h.current(), old)
    assert(h.current().audible)
    assert.equal(h.current().currentTime, 42)
    assert.equal(h.current().volume, 0.37)
    assert.equal(
      h.audios.filter(audio => !audio.paused && !audio.removed).length,
      1
    )
    assert.equal(h.equalizerStates.at(-1), 'unavailable')
    h.close()
  }
)
await check(
  'cached progress can seek on first duration callback without a second timer',
  async () => {
    let restored = false
    const h = harness({
      time(h, _time, duration) {
        if (!restored && duration > 0) {
          restored = true
          h.controller.seek(67)
        }
      },
    })
    await h.controller.play(track(1))
    assert(restored)
    assert.equal(h.current().currentTime, 67)
    h.current().emit('timeupdate')
    assert.equal(h.times.at(-1).time, 67)
    h.close()
  }
)
await check(
  'cancelled playback response cannot create a source or revive old audio',
  async () => {
    const pending = deferred()
    const h = harness({ playback: () => pending.promise })
    h.controller.setEqualizer(config())
    const operation = h.controller.play(track(1))
    h.controller.reset()
    pending.resolve({ status: 'full', url: 'https://cdn.test/late.mp3' })
    await operation
    await flush()
    assert.equal(h.sourceCreations, 0)
    assert.equal(h.current().src, '')
    assert(h.current().paused)
    assert(h.requests[0].signal.aborted)
    h.close()
  }
)
await check(
  'late play after explicit pause is stopped instead of publishing playing=true',
  async () => {
    const gate = deferred()
    const h = harness({
      deferPlay: audio =>
        gate.promise.then(() => {
          audio.paused = false
          audio.readyState = 4
          audio.duration = 120
          audio.emit('playing')
        }),
    })
    const operation = h.controller.play(track(1))
    await flush()
    h.controller.pause()
    gate.resolve()
    await operation
    await flush()
    assert.equal(h.current().paused, true)
    assert.equal(h.playback.at(-1), false)
    assert.equal(h.sourceCreations, 0)
    h.close()
  }
)
await check(
  'destroy disconnects nodes, context and listeners; late events remain inert',
  async () => {
    const h = harness()
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    await flush()
    const old = h.current(),
      context = h.contexts[0]
    h.close()
    const times = h.times.length,
      states = h.equalizerStates.length
    old.emit('timeupdate')
    old.emit('playing')
    old.emit('error')
    context.interrupt('closed')
    await flush()
    assert.equal(h.times.length, times)
    assert.equal(h.equalizerStates.length, states)
    assert(old.removed && old.paused)
    assert(context.closeCalls > 0)
    assert(context.nodes.every(node => node.outputs.length === 0))
    assert.equal(h.timers.size, 0)
    assert([...old.listeners.values()].every(listeners => listeners.size === 0))
  }
)
await check(
  'known native fallback replay never creates another EQ context',
  async () => {
    const h = harness({ failProxy: true })
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    await flush()
    const contextCount = h.contexts.length
    h.controller.pause()
    await h.controller.play(track(1))
    await flush()
    assert.equal(h.contexts.length, contextCount)
    assert.equal(h.sourceCreations, 0)
    assert(h.current().audible)
    assert.equal(h.equalizerStates.at(-1), 'unavailable')
    h.close()
  }
)
await check(
  'paused bypassed Context interruption restores native audio without autoplay',
  async () => {
    const h = harness()
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    await flush()
    h.controller.seek(51)
    const old = h.current()
    h.controller.pause()
    h.controller.setEqualizer(config([], { enabled: false }))
    h.contexts[0].interrupt('closed')
    await flush()
    assert.notEqual(h.current(), old)
    assert(h.current().paused && !h.current().hijacked)
    assert.equal(
      h.audios.filter(audio => !audio.paused && !audio.removed).length,
      0
    )
    await h.controller.play(track(1))
    await flush()
    assert(h.current().audible)
    assert.equal(h.current().currentTime, 51)
    assert.equal(h.sourceCreations, 1)
    assert.equal(h.equalizerStates.at(-1), 'bypassed')
    h.close()
  }
)
await check(
  'unavailable upstream source releases pending activation and never plays',
  async () => {
    const h = harness({
      playback: async () => ({ status: 'unavailable', url: null }),
    })
    h.controller.setEqualizer(config())
    await h.controller.play(track(1))
    await flush()
    assert.equal(h.sourceCreations, 0)
    assert.equal(h.current().playCalls, 0)
    assert.equal(h.equalizerStates.at(-1), 'unavailable')
    assert(h.contexts.every(context => context.closeCalls > 0))
    h.close()
  }
)
console.log(
  `Equalizer verified: ${cases} mocked graph/parameters/CORS/native recovery/lifecycle cases. No live account, output device or permission bypass is used.`
)
