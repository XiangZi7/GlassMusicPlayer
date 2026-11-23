import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
} from 'vue/compiler-sfc'

const root = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(
  path.join(root, 'src/components/player/PlayerQueueMenu.vue'),
  'utf8'
)
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'queue-test' })
assert.equal(
  compileTemplate({
    source: descriptor.template.content,
    filename: 'PlayerQueueMenu.vue',
    id: 'queue-test',
    compilerOptions: { bindingMetadata: script.bindings },
  }).errors.length,
  0
)
assert.equal(
  compileStyle({
    source: descriptor.styles[0].content,
    filename: 'PlayerQueueMenu.vue',
    id: 'queue-test',
    scoped: true,
  }).errors.length,
  0
)
const tree = ts.createSourceFile(
  'queue.ts',
  descriptor.scriptSetup.content,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
)
const functions = []
// 提取实际气泡处理函数，避免在测试中复制业务行为。
function visit(node) {
  if (ts.isFunctionDeclaration(node)) functions.push(node.getText(tree))
  ts.forEachChild(node, visit)
}
visit(tree)
const code = ts.transpileModule(
  functions.join('\n') + '\nconst api = {toggle,close,keydown};',
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText

// 模拟队列行和焦点，检查打开菜单不改变页面、全屏或媒体状态。
function harness() {
  const state = { open: false }
  const player = {
    state: { stage: false, fsQ: false, playing: false, vol: 70 },
  }
  const document = { activeElement: null }
  let focusedTrigger = 0
  const rows = Array.from({ length: 3 }, (_, index) => ({
    index,
    closest() {
      return this
    },
    focus() {
      document.activeElement = this
    },
    scrollIntoView() {},
  }))
  const context = {
    state,
    player,
    document,
    nextTick: async () => {},
    trigger: {
      value: {
        focus() {
          focusedTrigger++
        },
      },
    },
    panel: {
      value: { querySelector: () => rows[1], querySelectorAll: () => rows },
    },
  }
  vm.createContext(context)
  vm.runInContext(code, context)
  return {
    ...context,
    rows,
    api: vm.runInContext('api', context),
    get focusedTrigger() {
      return focusedTrigger
    },
  }
}
// 构造能够检测是否阻断背景快捷键的按键事件。
function key(key) {
  return {
    key,
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
let count = 0
// 逐项输出实际处理器的回归结果。
async function check(name, test) {
  await test()
  count++
  console.log(`PASS ${name}`)
}
await check(
  'bottom queue opens locally and never enters fullscreen',
  async () => {
    const h = harness()
    await h.api.toggle()
    assert.equal(h.state.open, true)
    assert.equal(h.player.state.stage, false)
    assert.equal(h.player.state.fsQ, false)
    assert.equal(h.player.state.playing, false)
  }
)
await check('second click closes locally', async () => {
  const h = harness()
  await h.api.toggle()
  await h.api.toggle()
  assert.equal(h.state.open, false)
})
await check('Escape closes and restores trigger focus', async () => {
  const h = harness()
  h.state.open = true
  const e = key('Escape')
  await h.api.keydown(e)
  assert(e.prevented && e.stopped)
  assert.equal(h.state.open, false)
  assert.equal(h.focusedTrigger, 1)
})
await check('outside-style close does not steal focus', async () => {
  const h = harness()
  h.state.open = true
  h.api.close()
  assert.equal(h.focusedTrigger, 0)
})
await check('arrow keys navigate without changing global volume', async () => {
  const h = harness()
  const e = key('ArrowDown')
  await h.api.keydown(e)
  assert(e.prevented && e.stopped)
  assert.equal(h.document.activeElement, h.rows[0])
  assert.equal(h.player.state.vol, 70)
})
await check('Home End and ArrowUp use actual queue rows', async () => {
  const h = harness()
  for (const [name, index] of [
    ['End', 2],
    ['Home', 0],
    ['ArrowUp', 2],
  ]) {
    await h.api.keydown(key(name))
    assert.equal(h.document.activeElement, h.rows[index])
  }
})
await check('rapid repeated toggles preserve last closed intent', async () => {
  const h = harness()
  await Promise.all([h.api.toggle(), h.api.toggle()])
  assert.equal(h.state.open, false)
  assert.equal(h.player.state.stage, false)
})
await check(
  'semantic trigger, reduced motion and nested row keyboard guards are present',
  async () => {
    assert(source.includes('aria-haspopup="dialog"'))
    assert(source.includes(':aria-expanded="open"'))
    assert(source.includes('prefers-reduced-motion: reduce'))
    const bar = fs.readFileSync(
      path.join(root, 'src/components/player/PlayerBar.vue'),
      'utf8'
    )
    const runtime = fs.readFileSync(
      path.join(root, 'src/services/player/runtime.js'),
      'utf8'
    )
    const list = fs.readFileSync(
      path.join(root, 'src/components/player/QueueList.vue'),
      'utf8'
    )
    assert(bar.includes('<PlayerQueueMenu />'))
    assert(!bar.includes('data-queuebtn'))
    assert(!runtime.includes('data-queuebtn'))
    assert(list.includes('@keydown.enter.self.stop.prevent'))
    assert(list.includes('@keydown.space.self.stop.prevent'))
  }
)
console.log(
  `Queue menu verified: ${count} mocked local state/focus/keyboard cases plus Vue SFC compilation.`
)
