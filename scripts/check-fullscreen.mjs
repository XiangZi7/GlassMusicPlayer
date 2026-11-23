import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(
  path.join(root, 'src/services/player/runtime.js'),
  'utf8'
)
const component = fs.readFileSync(
  path.join(root, 'src/components/player/PlayerFullscreen.vue'),
  'utf8'
)
const tree = ts.createSourceFile(
  'runtime.js',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS
)
let bindLyrics
// 提取实际歌词绑定回调，运行真实处理函数而不是在测试中重写交互逻辑。
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(tree) ===
      "p.querySelectorAll('[data-fs-lyrics]').forEach"
  )
    bindLyrics = node.arguments[0].getText(tree)
  ts.forEachChild(node, visit)
}
visit(tree)
assert(bindLyrics, 'Missing fullscreen lyric binding')

// 模拟最小歌词 DOM 和媒体时钟，不需要真人账号或占用播放器端口。
function harness() {
  const events = new Map(),
    timers = new Map(),
    seeks = []
  const state = { idx: 0, t: 12, vol: 70, _lyrHoldUntil: 0, _lyrKey: 'old' }
  const document = { activeElement: null }
  let timerId = 0,
    renders = 0
  const classList = () => {
    const values = new Set()
    return {
      add: name => values.add(name),
      remove: name => values.delete(name),
      contains: name => values.has(name),
      toggle: (name, on) => (on ? values.add(name) : values.delete(name)),
    }
  }
  const chip = {
    hidden: true,
    classList: classList(),
    style: {},
    querySelector: () => ({ textContent: '' }),
  }
  const returnButton = { hidden: true }
  const column = {
    querySelector: selector =>
      selector === '[data-lyrseek]' ? chip : returnButton,
    getBoundingClientRect: () => ({ top: 0, height: 300 }),
  }
  const fl = {
    children: [],
    classList: classList(),
    scrollTop: 0,
    clientHeight: 80,
    closest: () => column,
    contains: target => target === fl || fl.children.includes(target),
    querySelector: () => fl.children.find(row => row.classList.contains('on')),
    querySelectorAll: () =>
      fl.children.filter(row => row.classList.contains('focus')),
    setPointerCapture: () => {},
  }
  // 将焦点事件投递回实际注册的处理器，覆盖恢复焦点后的浏览抑制。
  function emit(target, type, event = {}) {
    for (const callback of events.get(target)?.get(type) || []) callback(event)
  }
  fl.children = [0, 1, 2, 3].map(index => ({
    index,
    classList: classList(),
    offsetTop: index * 60,
    offsetHeight: 40,
    getAttribute: () => String(index),
    closest: () => fl.children[index],
    getBoundingClientRect: () => ({
      top: index * 60 - fl.scrollTop,
      bottom: index * 60 - fl.scrollTop + 40,
      height: 40,
    }),
    focus() {
      document.activeElement = this
      emit(fl, 'focusin', { target: this })
    },
  }))
  fl.children[1].classList.add('on')
  const ctx = {
    state,
    document,
    TRACKS: [{ dur: 60 }],
    window: { getSelection: () => ({ removeAllRanges() {} }) },
    Date: class extends Date {
      static now() {
        return 1000
      }
    },
    fmt: time => `0:${Math.floor(time).toString().padStart(2, '0')}`,
    fsLinesFor: () => [0, 10, 20, 30].map(t => ({ t, o: `Line ${t}` })),
    currentDuration: () => 60,
    seekTo: time => {
      state.t = time
      seeks.push(time)
    },
    render: () => {
      renders++
      fl.children.forEach(row =>
        row.classList.toggle('on', row.index === Math.floor(state.t / 10))
      )
    },
    setTimeout: callback => {
      timers.set(++timerId, callback)
      return timerId
    },
    clearTimeout: id => timers.delete(id),
    listenElement(target, type, callback) {
      if (!events.has(target)) events.set(target, new Map())
      if (!events.get(target).has(type)) events.get(target).set(type, [])
      events.get(target).get(type).push(callback)
    },
  }
  vm.runInNewContext(`(${bindLyrics})`, ctx)(fl)
  return {
    fl,
    chip,
    returnButton,
    state,
    document,
    seeks,
    events,
    emit,
    get renders() {
      return renders
    },
    flush() {
      const callbacks = [...timers.values()]
      timers.clear()
      callbacks.forEach(callback => callback())
    },
  }
}

// 构造可检测默认行为和事件传播的真实处理器输入。
function keyEvent(key, row) {
  return {
    key,
    target: row,
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true
    },
    stopPropagation() {
      this.stopped = true
    },
  }
}
let cases = 0
// 每项验证都检查对应的实际处理器结果，便于定位回归。
function check(name, test) {
  test()
  cases++
  console.log(`PASS ${name}`)
}

check(
  'wheel interrupts programmatic follow and reveals a return action',
  () => {
    const h = harness()
    h.fl._progUntil = 999999
    h.emit(h.fl, 'wheel')
    assert.equal(h.fl._progUntil, 0)
    assert.equal(h.returnButton.hidden, false)
    assert.equal(h.chip.hidden, false)
    assert(h.state._lyrHoldUntil > 1000)
  }
)
check(
  'automatic browse timeout restores current line even while paused',
  () => {
    const h = harness()
    h.emit(h.fl, 'wheel')
    h.flush()
    assert.equal(h.state._lyrHoldUntil, 0)
    assert.equal(h.returnButton.hidden, true)
    assert.equal(h.chip.hidden, true)
    assert.equal(h.fl._focus, null)
    assert.equal(h.renders, 1)
    assert.equal(h.seeks.length, 0)
  }
)
check(
  'arrow navigation focuses a lyric immediately without changing volume or playback',
  () => {
    const h = harness()
    const event = keyEvent('ArrowDown', h.fl.children[1])
    h.emit(h.fl, 'keydown', event)
    assert(event.prevented && event.stopped)
    assert.equal(h.document.activeElement, h.fl.children[2])
    assert.equal(h.state.vol, 70)
    assert.equal(h.seeks.length, 0)
    assert(h.fl.classList.contains('keyboard-browsing'))
  }
)
check(
  'Home and End stay inside the lyric list and stop global shortcuts',
  () => {
    const h = harness()
    for (const [key, wanted] of [
      ['Home', 0],
      ['End', 3],
      ['ArrowDown', 3],
    ]) {
      const event = keyEvent(key, h.document.activeElement || h.fl.children[1])
      h.emit(h.fl, 'keydown', event)
      assert(event.prevented && event.stopped)
      assert.equal(h.document.activeElement, h.fl.children[wanted])
    }
  }
)
for (const key of ['Enter', ' '])
  check(
    `${JSON.stringify(key)} seeks the selected line once using the shared clock`,
    () => {
      const h = harness()
      const event = keyEvent(key, h.fl.children[2])
      h.emit(h.fl, 'keydown', event)
      assert(event.prevented && event.stopped)
      assert.equal(h.seeks.length, 1)
      assert.equal(h.seeks[0], 20.02)
    }
  )
check(
  'keyboard focus holds reading position until the user leaves or returns',
  () => {
    const h = harness()
    h.fl.children[2].focus()
    h.flush()
    assert.equal(h.state._lyrHoldUntil, Number.MAX_SAFE_INTEGER)
    h.document.activeElement = h.returnButton
    h.emit(h.fl, 'focusout', { relatedTarget: h.returnButton })
    h.flush()
    assert.equal(h.state._lyrHoldUntil, 0)
  }
)
check(
  'return action hides the chip and restores focus without restarting browsing',
  () => {
    const h = harness()
    h.emit(h.fl, 'wheel')
    h.document.activeElement = h.returnButton
    h.emit(h.returnButton, 'click')
    assert.equal(h.returnButton.hidden, true)
    assert.equal(h.chip.hidden, true)
    assert.equal(h.state._lyrHoldUntil, 0)
    assert.equal(h.document.activeElement, h.fl.children[1])
    assert.equal(h.fl._keyboardBrowsing, false)
    assert.equal(h.seeks.length, 0)
  }
)
check(
  'Escape and unrelated keys remain available to the enclosing fullscreen',
  () => {
    const h = harness()
    const event = keyEvent('Escape', h.fl.children[1])
    h.emit(h.fl, 'keydown', event)
    assert(!event.prevented && !event.stopped)
    assert.equal(h.seeks.length, 0)
  }
)
check('drag browse does not accidentally seek on pointer release', () => {
  const h = harness()
  h.emit(h.fl, 'pointerdown', {
    pointerType: 'mouse',
    clientY: 100,
    pointerId: 1,
    preventDefault() {},
  })
  h.emit(h.fl, 'pointermove', { clientY: 70 })
  h.emit(h.fl, 'pointerup', { clientY: 70 })
  assert.equal(h.seeks.length, 0)
  assert.equal(h.fl.classList.contains('dragging'), false)
})
check(
  'new display controls preserve scoped reduced-motion and native lyric semantics',
  () => {
    assert(component.includes('aria-label="歌词阅读模式"'))
    assert(component.includes('aria-label="显示译文"'))
    assert(component.includes('useResizeObserver(lyrics, alignLyrics)'))
    assert(component.includes('prefers-reduced-motion: reduce'))
    assert(component.includes("'fs-calm': !settings.motion"))
    assert(!component.includes(':global(body.calm)'))
    assert(component.includes('scroll-behavior: auto'))
    assert(source.includes('\'<button type="button" class="\''))
    assert(source.includes("'aria-current'"))
    assert(source.includes('!state.settings.motion ||'))
  }
)
console.log(
  `Fullscreen verified: ${cases} mocked lyric interaction and display cases; no live login or native WebView verification implied.`
)
