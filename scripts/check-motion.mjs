import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const html = read('ui/music-player-glass-vs-minimal.html')
const originalScript = [
  ...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
].at(-1)[1]
const originalCss = html.match(
  /<script type="text\/x-tailwind-source"[^>]*>([\s\S]*?)<\/script>/
)[1]

// AST 只比较语义节点，格式、注释与引号风格不会干扰动画参数校验。
function canonical(node) {
  if (ts.isParenthesizedExpression(node)) return canonical(node.expression)
  if (ts.isIdentifier(node)) return ['identifier', node.text]
  if (ts.isStringLiteral(node)) return ['string', node.text]
  if (ts.isNumericLiteral(node)) return ['number', Number(node.text)]
  return [
    node.kind,
    ...node
      .getChildren()
      .filter(
        child =>
          ![ts.SyntaxKind.SemicolonToken, ts.SyntaxKind.CommaToken].includes(
            child.kind
          )
      )
      .map(canonical),
  ]
}

// 找到源文件中的指定动画函数，避免把其他交互误计入切歌动画。
function findFunction(source, name) {
  const tree = ts.createSourceFile(
    'player.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  )
  let result
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name)
      result = node
    else ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(result, `Missing animation function: ${name}`)
  return result
}

// 保证关键帧、时长、延迟、offset、fill 和缓动与原稿完全一致。
function animationCalls(node) {
  const calls = []
  const visit = child => {
    if (
      ts.isCallExpression(child) &&
      ts.isPropertyAccessExpression(child.expression) &&
      child.expression.name.text === 'animate'
    )
      calls.push(child.arguments.map(canonical))
    ts.forEachChild(child, visit)
  }
  visit(node)
  return calls
}

const fullscreen = animationCalls(
  findFunction(originalScript, 'animateFsTrackChange')
)
assert.deepEqual(
  animationCalls(
    findFunction(
      read('src/services/player/fullscreen-motion.js'),
      'animateFsTrackChange'
    )
  ),
  fullscreen,
  'Fullscreen animation changed'
)
const currentFullscreen = read('src/services/player/fullscreen-motion.js')
const entrance = findFunction(originalScript, 'animateFsEntrance')
assert.deepEqual(
  canonical(findFunction(currentFullscreen, 'animateFsEntrance').body),
  canonical(entrance.body),
  'Fullscreen entrance choreography changed'
)
assert.deepEqual(
  canonical(findFunction(currentFullscreen, 'cancelFsStageAnims').body),
  canonical(findFunction(originalScript, 'cancelFsStageAnims').body),
  'Fullscreen entrance/track-change cancellation changed'
)
const desktop = animationCalls(
  findFunction(originalScript, 'animateDeskTrackChange')
)
assert.deepEqual(
  animationCalls(
    findFunction(
      read('src/services/player/desktop-motion.js'),
      'animateSourceDesktop'
    )
  ),
  desktop,
  'Desktop animation changed'
)
assert.deepEqual(
  animationCalls(
    findFunction(
      read('src/services/player/desktop-motion.js'),
      'animateSourceLyric'
    )
  ),
  animationCalls(findFunction(originalScript, 'syncDesk')),
  'Desktop lyric flip changed'
)
// 原稿由 setStage 直接收起主队列、取消主题过渡，Vue 组件通过 stage 观察器实现这两步。
// 其余开关场景、定时器和分层动画仍逐项对照当前 HTML。
const stageTimingReference = originalScript
  .replace('state.stage=true; state.mainQ=false;', 'state.stage=true;')
  .replace('fsThemeRun++; fsThemeAnims.forEach(function(a){ try{a.cancel();}catch(e){} }); fsThemeAnims=[];', '')
assert.deepEqual(
  canonical(
    findFunction(read('src/services/player/runtime.js'), 'setStage').body
  ),
  canonical(findFunction(stageTimingReference, 'setStage').body),
  'Fullscreen open/close timing changed'
)

// 鼠标视差、歌词拖动/跟随和横幅收缩的事件处理保持原阈值与调用顺序。
function motionHandlers(source) {
  const tree = ts.createSourceFile(
    'player.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  )
  const handlers = new Map()
  const targets = new Set(['fsEl', 'fl', 'seek', 'mainEl', 'banner', 'p'])
  const visit = node => {
    if (ts.isCallExpression(node)) {
      let target, event, handler
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'addEventListener'
      ) {
        target = node.expression.expression
        ;[event, handler] = node.arguments
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'listenElement'
      ) {
        ;[target, event, handler] = node.arguments
      }
      if (
        target &&
        ts.isIdentifier(target) &&
        targets.has(target.text) &&
        event &&
        ts.isStringLiteral(event) &&
        handler &&
        ts.isFunctionExpression(handler)
      )
        handlers.set(`${target.text}:${event.text}`, canonical(handler.body))
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return handlers
}
// 仅将进度条时间来源替换为真实媒体时钟，保留鼠标提示和其余动效的原始校验。
const expectedSeek = originalScript
  // 首页只在收起后仍可滚动时折叠，原稿的两个滚动阈值及其余处理继续逐项核对。
  .replace('!c&&mainEl.scrollTop>70', '!c&&mainEl.scrollTop>70&&hasRoomForCompactBanner(mainEl)')
  // 封面组独立上下浮动，背景巨字和粒子的指针通道照旧校验。
  .replace(/fsEl\.style\.setProperty\("--t[xy]",(?:n[xy]\.toFixed\(3\)|0)\);/g, '')
  .replace(
    'var tr=TRACKS[state.idx]; state.t=seek.value/1000*tr.dur; render();',
    'seekTo((seek.value / 1000) * currentDuration());'
  )
  .replace('var total=TRACKS[state.idx].dur;', 'var total=currentDuration();')
  // 虚拟行仅改变可命中的节点和绝对行号，保留原滚动抑制、拖动阈值与松手时序。
  .replace('if(fl._progUntil&&Date.now()<fl._progUntil)return; browse();',
    'if (!state.stage) return; fl._window?.sync(fl._activeLine); if(fl._progUntil&&Date.now()<fl._progUntil)return; browse();')
  .replace(/for\(var k=0;k<fl\.children\.length;k\+\+\)\{\s*var rr=fl\.children\[k\]\.getBoundingClientRect\(\);/,
    'for(const row of mountedLyricRows(fl)){ var rr=row.getBoundingClientRect();')
  .replace('seekLine(k); break;', "seekLine(Number(row.getAttribute('data-lj'))); break;")
const originalHandlers = motionHandlers(expectedSeek)
const currentHandlers = motionHandlers(read('src/services/player/runtime.js'))
for (const [key, value] of originalHandlers)
  assert.deepEqual(
    currentHandlers.get(key),
    value,
    `Motion input changed: ${key}`
  )

// CSS 关键帧按名字与声明核对，保留天气、呼吸、光带、粒子及进出场。
function keyframes(css) {
  const frames = new Map()
  for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1,
      end = match.index + match[0].length
    for (; end < css.length && depth; end++) {
      if (css[end] === '{') depth++
      if (css[end] === '}') depth--
    }
    frames.set(
      match[1],
      css
        .slice(match.index, end)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, '')
        .replace(/;}/g, '}')
        .replace(/(?<![\w])(-?)\.(\d)/g, '$10.$2')
    )
  }
  return frames
}
const currentCss = ['src/styles/main.css', 'src/styles/player-effects.css']
  .filter(file => fs.existsSync(path.join(root, file)))
  .map(read)
  .join('\n')
const expectedKeyframes = keyframes(originalCss)
// 底栏频谱已使用实时音频数据，旧的随机脉冲关键帧不再使用。
expectedKeyframes.delete('specPulse')
// 窗内歌词胶囊改用短淡出和淡入，长短句的尺寸过渡由浏览器回归覆盖。
expectedKeyframes.delete('capFlipIn')
// 原稿中的流场 / 唱片属于其他主题。本应用四种舞台使用各自的背景层。
expectedKeyframes.delete('ambFlow')
expectedKeyframes.delete('fsDiscSpin')
// 队列的单向入场改为可中断的双向过渡，同时保留少动效分支。
expectedKeyframes.delete('fsQIn')
assert.match(currentCss, /\.fs-queue\s*\{[^}]*opacity:\s*0[^}]*transition:\s*opacity 200ms/)
assert.match(currentCss, /\.fs\.qopen \.fs-queue\s*\{[^}]*opacity:\s*1/)
assert.match(currentCss, /\.fs\.fs-calm \.fs-queue\s*\{[^}]*transition:\s*none/)
assert.deepEqual(
  keyframes(currentCss),
  expectedKeyframes,
  'CSS keyframes changed'
)
// 真正调用动画控制器，校验入场 ↔ 切歌 ↔ 关闭/立即重开没有残余 run 或 ghost。
const ghosts = new Set()
const nodes = new Map()
const timers = new Map()
let timerId = 0
let liquid = false
const media = { matches: false }
function element(name) {
  const classes = new Set()
  const el = {
    name,
    style: {},
    className: '',
    parentNode: {
      insertBefore(ghost) {
        ghosts.add(ghost)
      },
    },
    classList: {
      contains: value =>
        classes.has(value) || el.className.split(' ').includes(value),
      add: value => classes.add(value),
      remove: value => classes.delete(value),
    },
    querySelector: selector => nodes.get(selector) || null,
    querySelectorAll: selector =>
      selector === '.fs-xghost'
        ? [...ghosts]
        : selector === '.fs-specmono,.fs-toptitle'
          ? [nodes.get('.fs-specmono'), nodes.get('.fs-toptitle')]
          : [],
    closest: () => (liquid ? {} : null),
    appendChild: ghost => ghosts.add(ghost),
    remove: () => ghosts.delete(el),
    setAttribute() {},
    animate(keyframes, options) {
      return {
        keyframes,
        options,
        canceled: false,
        cancel() {
          this.canceled = true
        },
      }
    },
  }
  return el
}
for (const selector of [
  '[data-fs]',
  '[data-fs-bg]',
  '.fs-amb',
  '.fs-shade',
  '[data-fs-giant]',
  '.fs-main img.fs-cover[data-cover]',
  '.fs-main .fs-reflect',
  '.fs-titleblock',
  '.fs-kicker',
  'h4',
  'p',
  '.fs-titleactions',
  '.fs-lyrcol',
  '.fs-side',
  '[data-fsnum]',
  '.fs-specmono',
  '.fs-toptitle',
  '.fs-top',
  '.fs-themebar',
  '.fs-dock',
  '.fs-main .fs-coverwrap',
  '.fs-coverkb',
  '.fs-sheen i',
  '.dock-cover',
])
  nodes.set(selector, element(selector))
nodes.set(
  'img.fs-cover[data-cover]',
  nodes.get('.fs-main img.fs-cover[data-cover]')
)
nodes.set('.fs-reflect', nodes.get('.fs-main .fs-reflect'))
const stage = nodes.get('[data-fs]')
const player = element('player')
const bodyClasses = new Set()
const environment = {
  state: { stage: false, idx: 0, fsQ: false },
  TRACKS: [{ cover: 'old.jpg' }, { cover: 'new.jpg' }],
  players: () => [player],
  document: {
    body: { classList: { contains: value => bodyClasses.has(value) } },
    createElement: () => element('ghost'),
  },
  window: { matchMedia: () => media },
  setTimeout: (callback, delay) => {
    const id = ++timerId
    timers.set(id, { callback, delay })
    return id
  },
  clearTimeout: id => timers.delete(id),
  queueNextTi: () => 1,
  render() {},
  fsCloseTimer: null,
}
vm.runInNewContext(
  `${currentFullscreen.replace('export function createFullscreenMotion', 'function createFullscreenMotion')}
const { animateFsTrackChange, animateFsEntrance, cancelFsStageAnims } = createFullscreenMotion({players,state,tracks:TRACKS,document,window,setTimeout,queueNextTi});
${findFunction(read('src/services/player/runtime.js'), 'setStage').getText()}
globalThis.motion = { setStage, animateFsTrackChange };`,
  environment
)
const motion = environment.motion
motion.setStage(true)
const firstEntrance = stage._xAnims.slice()
assert.equal(firstEntrance.length, 18)
assert(firstEntrance.some(a => a.options.duration === 420 && a.options.delay === 660 && a.keyframes[0].transform === 'translateY(-6px)'))
assert.equal(firstEntrance[0].keyframes[0].transform, 'scale(1.230)')
assert(
  firstEntrance.some(a => a.options.duration === 540 && a.options.delay === 560)
)
motion.setStage(true)
assert(
  firstEntrance.every(a => a.canceled),
  'Reopening cancels the previous entrance'
)
const secondEntrance = stage._xAnims.slice()
environment.state.idx = 1
motion.animateFsTrackChange(1, environment.TRACKS[0])
assert(
  secondEntrance.every(a => a.canceled),
  'Track change cancels the entrance'
)
assert(ghosts.size > 0)
const trackChange = stage._xAnims.slice()
motion.setStage(false)
assert(
  trackChange.every(a => a.canceled),
  'Close cancels all track-change layers'
)
assert.equal(ghosts.size, 0)
assert.equal(stage._xAnims.length, 0)
const closeTimer = environment.fsCloseTimer
assert.equal(timers.get(closeTimer).delay, 360)
liquid = true
motion.setStage(true)
assert.equal(
  timers.has(closeTimer),
  false,
  'Immediate reopen clears the old close timer'
)
assert.equal(player.classList.contains('fs-closing'), false)
assert.equal(stage._xAnims[0].keyframes[0].transform, 'scale(1.187)')
assert.equal(stage._xAnims[0].keyframes[1].transform, 'scale(1.12)')
motion.setStage(false)
media.matches = true
motion.setStage(true)
assert.equal(stage._xAnims.length, 0, 'Reduced motion skips the entrance')
motion.setStage(false)
media.matches = false
bodyClasses.add('calm')
motion.setStage(true)
assert.equal(stage._xAnims.length, 0, 'Motion off skips the entrance')

// 标题阈值独立验证，并检查取消旧 shell 动画的最后一条 CSS 覆盖仍生效。
const titleExports = {}
vm.runInNewContext(
  ts.transpileModule(read('src/services/player/fullscreen-title.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: titleExports }
)
for (const [length, expected] of [
  [11, ''],
  [12, 't-mid'],
  [18, 't-mid'],
  [19, 't-long'],
  [26, 't-long'],
  [27, 't-xlong'],
])
  assert.equal(titleExports.fullscreenTitleClass('中'.repeat(length)), expected)
assert.equal(titleExports.fullscreenTitleClass('A'.repeat(19)), '')
assert.equal(titleExports.fullscreenTitleClass('A'.repeat(21)), 't-mid')
const shellRules = [
  ...currentCss.matchAll(/\.win\.fs-open\s+\.fs\s*\{([^}]+)\}/g),
]
assert.match(shellRules.at(-1)[1], /animation:\s*none/)
console.log(
  `Motion verified: original layered entrance, ${fullscreen.length} fullscreen track-change animations, ${desktop.length} desktop animations, ${expectedKeyframes.size} CSS keyframes, ${originalHandlers.size} motion input handlers, rapid open/skip/close cancellation, both themes, reduced motion and title tiers.`
)
