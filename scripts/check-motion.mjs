import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

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
assert.deepEqual(
  canonical(
    findFunction(read('src/services/player/runtime.js'), 'setStage').body
  ),
  canonical(findFunction(originalScript, 'setStage').body),
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
const originalHandlers = motionHandlers(originalScript)
const currentHandlers = motionHandlers(read('src/services/player/runtime.js'))
for (const [key, value] of originalHandlers)
  assert.deepEqual(
    currentHandlers.get(key),
    value,
    `Motion input changed: ${key}`
  )

// CSS 关键帧按名字与声明核对，保留天气、呼吸、频峰、光带、粒子及进出场。
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
assert.deepEqual(
  keyframes(currentCss),
  keyframes(originalCss),
  'CSS keyframes changed'
)
console.log(
  `Motion verified: ${fullscreen.length} fullscreen animations, ${desktop.length} desktop animations, ${keyframes(originalCss).size} CSS keyframes, ${originalHandlers.size} motion input handlers, and original fullscreen exit timing.`
)
