import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { PhysicalPosition } from '@tauri-apps/api/dpi'
import {
  computed,
  effectScope,
  nextTick,
  reactive,
  shallowRef,
  watch,
} from 'vue'
import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
  registerTS,
} from 'vue/compiler-sfc'

registerTS(() => ts)

const root = path.resolve(import.meta.dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

// 可交给现有原生 WebView 的 CDP Runtime.evaluate；不创建或启动应用/服务器。
// 这只检查 WebView 的实际布局/材质参数，不证明桌面原生 blur 或真实托盘事件。
export function inspectDesktopSurface() {
  const kind = location.hash.split('/').at(-1)
  const expected = {
    lyrics: { selector: '#deskLyr', width: 440, radius: 16 },
    mini: { selector: '#trayPop', width: 324, radius: 18 },
    media: { selector: '#deskSmtc', width: 368, radius: 16 },
    island: { selector: '.island-surface', width: 320, radius: 20 },
  }[kind]
  if (!expected) return { errors: ['不是桌面小窗路由'] }
  const element = document.querySelector(expected.selector)
  if (!element) return { kind, errors: ['表面尚未收到播放器快照或未挂载'] }
  const rect = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const wrapper = element.parentElement
  const errors = []
  const near = (actual, wanted) => Math.abs(actual - wanted) <= 1
  const padding = {
    left: rect.left,
    top: rect.top,
    right: innerWidth - rect.right,
    bottom: innerHeight - rect.bottom,
  }
  if (!near(rect.width, expected.width)) errors.push('卡片本体宽度偏离原稿')
  const radius = Math.min(
    parseFloat(style.borderTopLeftRadius),
    rect.width / 2,
    rect.height / 2
  )
  if (!near(radius, expected.radius)) errors.push('卡片有效圆角偏离原稿')
  if (kind === 'island' && !near(rect.height, 40))
    errors.push('独立胶囊本体不是40px高')
  for (const [edge, value] of Object.entries(padding)) {
    if (!near(value, 32)) errors.push(`${edge}阴影留白不是32px`)
  }
  if (!style.backdropFilter.includes('blur(22px)'))
    errors.push('缺少WebView内玻璃滤镜')
  const alphas = [
    ...style.backgroundImage.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g),
  ].map(match => Number(match[1]))
  if (!alphas.length || alphas.some(alpha => alpha < 0.98))
    errors.push('暗玻璃背景遮蔽不足')
  if (kind !== 'island' && getComputedStyle(wrapper).boxShadow !== 'none')
    errors.push('透明画布仍带模拟桌面的大矩形阴影')
  return {
    kind,
    dpr: devicePixelRatio,
    viewport: [innerWidth, innerHeight],
    card: { width: rect.width, height: rect.height, radius },
    padding,
    background: style.backgroundImage,
    backdropFilter: style.backdropFilter,
    shadow: style.boxShadow,
    errors,
    limitation:
      '桌面遮蔽和阴影是否可见、真实托盘/失焦/菜单/DPI切换仍需原生交互及截图验收；未启用原生blur',
  }
}

if (process.argv.includes('--probe')) {
  console.log(`(${inspectDesktopSurface.toString()})()`)
} else {
  const desktop = read('src/pages/desktop.vue')
  const island = read('src/pages/lyric-island.vue')
  const native = read('src-tauri/src/desktop/windows.rs')
  const tray = read('src-tauri/src/desktop/tray.rs')
  const capability = JSON.parse(read('src-tauri/capabilities/default.json'))

  for (const [selector, width, radius] of [
    ['desk-lyr', 440, 16],
    ['tray-pop', 324, 18],
    ['desk-smtc', 368, 16],
  ]) {
    // 原稿中的三组宽度和圆角已列于上表，直接对照应用实际样式。
    const rule = desktop.match(
      new RegExp(
        `\\.native-desktop \\.${selector} \\{\\s*(width:[\\s\\S]*?)\\}`
      )
    )[1]
    assert.match(rule, new RegExp(`width: ${width}px`))
    assert.match(rule, new RegExp(`border-radius: ${radius}px`))
    const shadow = rule.match(/0 (\d+)px (\d+)px rgba\(0, 0, 0, ([\d.]+)\)/)
    assert.ok(shadow, `${selector}: 小阴影`)
    const [, offset, blur, alpha] = shadow.map(Number)
    assert.ok(alpha <= 0.28)
    // CSS Gaussian尾部没有硬边界；3σ+偏移小于留白，防止可见阴影被截成硬边。
    assert.ok(offset + blur * 1.5 < 32, `${selector}: 阴影可见尾部留在画布内`)
  }
  for (const source of [desktop, island]) {
    assert.match(source, /padding: 32px/)
    assert.match(source, /rgba\(32, 35, 46, 0\.985\)/)
    assert.match(source, /rgba\(14, 16, 24, 0\.98\)/)
    assert.match(source, /backdrop-filter: blur\(22px\) saturate\(1\.25\)/)
    assert.match(source, /@contextmenu\.prevent="openContextMenu"/)
    assert.doesNotMatch(
      source,
      /process\.exit|app\.exit|PredefinedMenuItem\.quit/
    )
  }
  assert.match(desktop, /getBoundingClientRect\(\)\.height/)
  assert.match(desktop, /\.native-desktop \{[\s\S]*?box-shadow: none/)
  assert.match(native, /SURFACE_INSET: f64 = 32\.0/)
  assert.match(native, /content_height\.ceil\(\) \+ SURFACE_INSET \* 2\.0/)
  assert.match(
    native,
    /inner_size\(320\.0 \+ SURFACE_INSET \* 2\.0, 40\.0 \+ SURFACE_INSET \* 2\.0\)/
  )
  assert.match(native, /add_surface_window\(&window, SURFACE_INSET, 20\.0\)/)
  assert.match(native, /api\.prevent_close\(\);\s*let _ = window\.hide\(\);/)
  assert.match(
    native,
    /window\.label\(\) == "mini" && matches!\(event, WindowEvent::Focused\(false\)\)/
  )
  assert.match(tray, /\.menu\(&menu\)/)
  assert.match(tray, /\.on_menu_event\(/)
  for (const id of ['tray-mini', 'tray-lyrics', 'tray-media'])
    assert.ok(tray.includes(id))
  const sidebar = read('src/components/player/PlayerSidebar.vue')
  assert.doesNotMatch(
    sidebar,
    /data-util="(?:mini|lyr|media)"|桌面独有|data-nav="settings"|Haruto/
  )
  assert.match(read('src/components/player/PlayerTitlebar.vue'), /AccountMenu/)
  assert.match(
    read('src/components/player/PlayerTitlebar.vue'),
    /data-titlebar-settings/
  )
  assert.ok(
    capability.windows.includes('island'),
    '独立灵动岛必须有现有IPC/拖动能力'
  )

  const accountSource = read('src/components/player/AccountMenu.vue')
  const newComponents = [
    ['src/components/player/AccountMenu.vue', accountSource],
    [
      'src/components/player/PlayerTitlebar.vue',
      read('src/components/player/PlayerTitlebar.vue'),
    ],
    [
      'src/components/player/PlatformConnectionDialog.vue',
      read('src/components/player/PlatformConnectionDialog.vue'),
    ],
    [
      'src/components/player/PlatformQrLogin.vue',
      read('src/components/player/PlatformQrLogin.vue'),
    ],
    [
      'src/components/player/PlayerFullscreen.vue',
      read('src/components/player/PlayerFullscreen.vue'),
    ],
  ]
  for (const [filename, source] of [
    ['src/pages/desktop.vue', desktop],
    ['src/pages/lyric-island.vue', island],
    ...newComponents,
  ]) {
    const { descriptor, errors } = parse(source, {
      filename: path.join(root, filename),
    })
    assert.deepEqual(errors, [], `${filename}: SFC parse`)
    const script = compileScript(descriptor, { id: filename })
    const template = compileTemplate({
      id: filename,
      filename,
      source: descriptor.template.content,
      compilerOptions: { bindingMetadata: script.bindings },
    })
    assert.deepEqual(template.errors, [], `${filename}: template compile`)
    for (const style of descriptor.styles) {
      const compiled = compileStyle({
        id: `desktop-check-${path.basename(filename, '.vue')}`,
        filename,
        source: style.content,
        scoped: style.scoped,
      })
      assert.deepEqual(compiled.errors, [], `${filename}: style compile`)
    }
    console.log(`PASS SFC script/template/style compile: ${filename}`)
  }

  // 用源文件中的真实菜单函数模拟Tauri边界：缓存、定向关闭、锁定及Escape。
  function makeMenuHarness(source, label) {
    const { descriptor } = parse(source)
    const tree = ts.createSourceFile(
      'desktop.ts',
      descriptor.scriptSetup.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    const functions = tree.statements
      .filter(ts.isFunctionDeclaration)
      .map(node => node.getText(tree))
      .join('\n')
    const keyBinding = tree.statements.find(
      node =>
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression) &&
        node.expression.expression.getText(tree) === 'useEventListener'
    )
    const context = {
      mode: { value: label },
      state: { snapshot: { locked: false } },
      calls: [],
      menus: [],
      handlers: {},
      console,
      native: true,
      label,
      closeCount: 0,
      LogicalPosition: class {
        constructor(x, y) {
          this.x = x
          this.y = y
        }
      },
    }
    context.isTauri = () => context.native
    context.getCurrentWindow = () => ({
      label: context.label,
      close: async () => {
        context.closeCount++
      },
    })
    context.emitTo = async (...args) => {
      context.calls.push(args)
    }
    context.MenuItem = {
      new: async item => ({
        ...item,
        setText: async text => {
          item.text = text
        },
      }),
    }
    context.Menu = {
      new: async menu => {
        context.menus.push(menu)
        return {
          popup: async (...args) => {
            context.calls.push(['popup', ...args])
          },
        }
      },
    }
    context.useEventListener = (key, fn) => {
      context.handlers[key] = fn
    }
    vm.createContext(context)
    const output = ts.transpileModule(
      `let contextMenu, lockMenuItem, contextOpening = false;\n${functions}\n${keyBinding?.getText(tree) || ''}`,
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.None,
        },
      }
    ).outputText
    vm.runInContext(output, context)
    return context
  }
  for (const label of ['lyrics', 'mini', 'media', 'island']) {
    const harness = makeMenuHarness(
      label === 'island' ? island : desktop,
      label
    )
    await harness.openContextMenu({ clientX: 40, clientY: 52 })
    assert.equal(harness.menus.length, 1)
    const popup = harness.calls.find(call => call[0] === 'popup')
    assert.equal(popup[1].x, 40)
    assert.equal(popup[1].y, 52)
    assert.equal(popup[2].label, label)
    const items = harness.menus[0].items
    items.find(item => item.id === `${label}-close`).action()
    assert.equal(harness.closeCount, 1)
    assert.equal(
      harness.calls.filter(call => call[1] === 'player-action').length,
      0
    )
    items.find(item => item.id === `${label}-open-main`).action()
    assert.equal(harness.calls.at(-1)[0], 'main')
    assert.equal(harness.calls.at(-1)[1], 'player-action')
    assert.equal(harness.calls.at(-1)[2].type, 'focus')
    if (label === 'lyrics') {
      items.find(item => item.id === 'lyrics-lock').action()
      assert.equal(harness.state.snapshot.locked, true)
      assert.equal(harness.calls.at(-1)[1], 'desktop-lock')
    }
    if (label === 'mini') {
      harness.handlers.keydown({ key: 'Escape' })
      assert.equal(harness.closeCount, 2)
    }
    await harness.openContextMenu({ clientX: 60, clientY: 72 })
    assert.equal(harness.menus.length, 1, `${label}: 缓存菜单重开`)
  }
  const browser = makeMenuHarness(desktop, 'mini')
  browser.native = false
  await browser.openContextMenu({ clientX: 0, clientY: 0 })
  assert.equal(browser.menus.length, 0)
  const main = makeMenuHarness(desktop, 'main')
  await main.openContextMenu({ clientX: 0, clientY: 0 })
  assert.equal(main.menus.length, 0)

  // 逐项核对可见外壳和系统工作区的物理坐标，覆盖副屏、缩放和关闭吸附。
  const placement = makeMenuHarness(island, 'island')
  placement.PhysicalPosition = PhysicalPosition
  for (const scale of [1, 1.25, 1.5, 2]) {
    const monitor = { scaleFactor: scale, workArea: {
      position: { x: -1920, y: -1080 }, size: { width: 1920, height: 1040 },
    } }
    const left = -1920 - Math.round(32 * scale)
    const top = -1080 - Math.round(32 * scale)
    const right = left + 1920 - Math.round(320 * scale)
    const bottom = top + 1040 - Math.round(40 * scale)
    for (const [x, y, snap, expectedX, expectedY] of [
      [left + 10, top + 12, true, left, top],
      [right - 16, bottom - 8, true, right, bottom],
      [left + 10, top + 12, false, left + 10, top + 12],
      [left - 200, top - 100, false, left, top],
      [right - 100, top + 100, true, right - 100, top + 100],
    ]) {
      const point = placement.fitPosition(x, y, monitor, 40, snap)
      assert.deepEqual([point.x, point.y], [expectedX, expectedY])
    }
    const expanded = placement.fitPosition(right, bottom, monitor, 158, false)
    assert.equal(expanded.y, top + 1040 - Math.round(158 * scale))
  }
  console.log('PASS 桌面灵动岛四边吸附、自由拖动、负坐标工作区和四种屏幕缩放')

  // AccountMenu 只使用实际源码函数/事件注册及模板 AST；DOM、计时器、VueUse 生命周期是模拟边界。
  function elements(ast) {
    const found = []
    function visit(node) {
      if (!node) return
      if (node.type === 1) found.push(node)
      for (const child of node.children || []) visit(child)
      for (const branch of node.branches || []) visit(branch)
    }
    visit(ast)
    return found
  }
  const attribute = (element, name) =>
    element.props.find(prop => prop.type === 6 && prop.name === name)?.value
      ?.content
  const eventBinding = (element, name) =>
    element.props.find(
      prop =>
        prop.type === 7 && prop.name === 'on' && prop.arg?.content === name
    )
  function makeAccountHarness() {
    const { descriptor, errors } = parse(accountSource, {
      filename: path.join(root, 'src/components/player/AccountMenu.vue'),
    })
    assert.deepEqual(errors, [])
    const tree = ts.createSourceFile(
      'account-menu.ts',
      descriptor.scriptSetup.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    const declaration = name =>
      tree.statements.find(
        node =>
          ts.isVariableStatement(node) &&
          node.declarationList.declarations.some(
            value => value.name.getText(tree) === name
          )
      )
    const functions = tree.statements.filter(ts.isFunctionDeclaration)
    for (const name of ['show', 'hide', 'leave', 'select', 'keydown']) {
      assert(
        functions.some(node => node.name?.text === name),
        `AccountMenu source function: ${name}`
      )
    }
    const registrations = tree.statements.filter(
      node =>
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression) &&
        ['useEventListener', 'onBeforeUnmount'].includes(
          node.expression.expression.getText(tree)
        )
    )
    const nodes = elements(descriptor.template.ast)
    const control = nodes.find(node =>
      node.props.some(
        prop => prop.type === 6 && prop.name === 'data-account-menu'
      )
    )
    const avatar = nodes.find(
      node =>
        node.tag === 'button' && attribute(node, 'aria-haspopup') === 'menu'
    )
    assert(control && avatar, 'AccountMenu root and accessible trigger')
    const context = {
      tree,
      descriptor,
      nodes,
      control,
      avatar,
      items: [],
      focusCalls: [],
      emitted: [],
      events: [],
      unmountHooks: [],
      backgroundKeys: [],
      nextTicks: 0,
      timers: new Map(),
      clock: 0,
      timerId: 0,
      reactive: value => value,
    }
    function element(name, parent = null) {
      return {
        name,
        parent,
        contains(node) {
          for (let cursor = node; cursor; cursor = cursor.parent) {
            if (cursor === this) return true
          }
          return false
        },
        focus() {
          context.document.activeElement = this
          context.focusCalls.push(name)
        },
      }
    }
    context.outside = element('outside')
    context.document = { activeElement: context.outside }
    context.window = { name: 'window' }
    context.rootElement = element('account-root')
    context.rootElement.closest = () => null
    context.panel = { value: element('account-panel') }
    context.panel.value.querySelectorAll = selector =>
      selector === '[role="menuitem"]' && context.account.state.open
        ? context.items
        : []
    context.root = { value: context.rootElement }
    context.trigger = { value: element('avatar', context.rootElement) }
    context.nextTick = () => {
      context.nextTicks++
      return Promise.resolve()
    }
    context.emit = (...args) =>
      context.emitted.push({ args, open: context.account.state.open })
    context.setTimeout = (run, delay) => {
      const id = ++context.timerId
      context.timers.set(id, { run, at: context.clock + delay })
      return id
    }
    context.clearTimeout = id => context.timers.delete(id)
    context.useEventListener = (target, type, handler) => {
      const value = target && 'value' in target ? target.value : target
      context.events.push({ target: value, type, handler })
    }
    context.onBeforeUnmount = handler => context.unmountHooks.push(handler)
    const statements = [
      declaration('state'),
      declaration('platforms'),
      declaration('leaveTimer'),
      ...functions,
      ...registrations,
    ]
    assert(
      statements.every(Boolean),
      'AccountMenu source declarations must remain present'
    )
    const output = ts.transpileModule(
      statements.map(node => node.getText(tree)).join('\n') +
        '\nglobalThis.account = { state, platforms, show, hide, leave, select, keydown };',
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.None,
        },
      }
    ).outputText
    vm.createContext(context)
    vm.runInContext(output, context)
    context.items = Array.from(context.account.platforms, platform =>
      element(platform, context.panel.value)
    )
    context.innerChild = element('menuitem-child', context.items[0])
    context.tick = ms => {
      context.clock += ms
      for (const [id, timer] of [...context.timers].sort(
        (a, b) => a[1].at - b[1].at
      )) {
        if (timer.at <= context.clock) {
          context.timers.delete(id)
          timer.run()
        }
      }
    }
    context.dispatch = (target, type, event = {}) => {
      const handlers = context.events.filter(
        binding => binding.target === target && binding.type === type
      )
      assert(handlers.length > 0, `Actual source listener: ${type}`)
      for (const binding of handlers) binding.handler(event)
    }
    context.keyboardEvent = key => ({
      key,
      prevented: false,
      stopped: false,
      preventDefault() {
        this.prevented = true
      },
      stopPropagation() {
        this.stopped = true
      },
    })
    context.key = async key => {
      const event = context.keyboardEvent(key)
      await context.account[eventBinding(control, 'keydown').exp.content](event)
      if (!event.stopped) context.backgroundKeys.push(key)
      return event
    }
    context.pointer = type =>
      context.account[eventBinding(control, type).exp.content]()
    context.clickAvatar = () => {
      const binding = eventBinding(avatar, 'click'),
        event = context.keyboardEvent()
      for (const modifier of binding.modifiers) {
        if ((modifier.content || modifier) === 'stop') event.stopPropagation()
      }
      context.account[binding.exp.content]()
      return event
    }
    context.unmount = () => {
      for (const handler of context.unmountHooks) handler()
      // 模拟 VueUse 的作用域自动解绑，不声称测试了浏览器的实际 EventTarget。
      context.events.length = 0
    }
    return context
  }
  let accountChecks = 0
  async function checkAccount(name, test) {
    await test(makeAccountHarness())
    accountChecks++
    console.log(`PASS AccountMenu simulated behavior: ${name}`)
  }
  await checkAccount(
    'typed props/emits, accessible bindings and reduced-motion style compile',
    h => {
      const macro = name =>
        h.tree.statements
          .flatMap(node =>
            ts.isVariableStatement(node)
              ? Array.from(node.declarationList.declarations)
              : []
          )
          .find(
            node =>
              node.initializer &&
              ts.isCallExpression(node.initializer) &&
              node.initializer.expression.getText(h.tree) === name
          )?.initializer
      const props = macro('defineProps'),
        emits = macro('defineEmits')
      assert(props && emits)
      const profiles = props.typeArguments[0].members.find(
        member => member.name.getText(h.tree) === 'profiles'
      )
      assert(
        profiles && !profiles.questionToken,
        'profiles is a required readonly input contract'
      )
      const platform = emits.typeArguments[0].members.find(
        member => member.name.getText(h.tree) === 'platform'
      )
      assert(
        platform &&
          ts.isTupleTypeNode(platform.type) &&
          platform.type.elements.length === 1
      )
      const compiled = compileScript(h.descriptor, {
        id: 'account-contract-check',
      })
      for (const name of ['profiles', 'open', 'avatarFailed'])
        assert(Object.hasOwn(compiled.bindings, name))
      assert.equal(attribute(h.avatar, 'aria-haspopup'), 'menu')
      for (const name of ['aria-expanded', 'aria-controls']) {
        assert(
          h.avatar.props.some(
            prop =>
              prop.type === 7 &&
              prop.name === 'bind' &&
              prop.arg?.content === name
          )
        )
      }
      assert(h.nodes.some(node => attribute(node, 'role') === 'menu'))
      assert(h.nodes.some(node => attribute(node, 'role') === 'menuitem'))
      const styles = h.descriptor.styles.map(style =>
        compileStyle({
          id: 'account-contract-check',
          source: style.content,
          scoped: style.scoped,
        })
      )
      let reducedMotion = false
      for (const style of styles) {
        assert.deepEqual(style.errors, [])
        style.rawResult.root.walkAtRules('media', media => {
          if (
            media.params.includes('prefers-reduced-motion') &&
            media.params.includes('reduce')
          ) {
            media.walkDecls('transition', declaration => {
              if (declaration.value === 'none') reducedMotion = true
            })
          }
        })
      }
      assert(reducedMotion, 'Account bubble respects reduced motion')
    }
  )
  await checkAccount(
    'pointer/trigger opens and hover leave closes only after 140ms',
    h => {
      assert.equal(h.account.state.open, false)
      h.pointer('pointerenter')
      assert.equal(h.account.state.open, true)
      assert.equal(h.clickAvatar().stopped, true)
      h.pointer('pointerleave')
      assert.equal(h.timers.size, 1)
      h.tick(139)
      assert.equal(h.account.state.open, true)
      h.tick(1)
      assert.equal(h.account.state.open, false)
      assert.equal(h.timers.size, 0)
    }
  )
  await checkAccount('pointer re-entry cancels the old leave timer', h => {
    h.pointer('pointerenter')
    h.pointer('pointerleave')
    h.tick(100)
    h.pointer('pointerenter')
    assert.equal(h.timers.size, 0)
    h.tick(100)
    assert.equal(h.account.state.open, true)
    h.pointer('pointerleave')
    h.tick(140)
    assert.equal(h.account.state.open, false)
  })
  await checkAccount('hover leave preserves internal keyboard focus', h => {
    h.pointer('pointerenter')
    h.items[0].focus()
    h.pointer('pointerleave')
    h.tick(140)
    assert.equal(h.account.state.open, true)
    assert.equal(h.document.activeElement, h.items[0])
    assert.equal(h.timers.size, 0)
  })
  await checkAccount(
    'ArrowDown/ArrowUp wrap and Home/End focus endpoints without background shortcuts',
    async h => {
      assert.deepEqual(Array.from(h.account.platforms), [
        'netease',
        'kugou',
        'kuwo',
      ])
      h.trigger.value.focus()
      for (const [key, index] of [
        ['ArrowDown', 0],
        ['ArrowDown', 1],
        ['ArrowDown', 2],
        ['ArrowDown', 0],
        ['ArrowUp', 2],
        ['Home', 0],
        ['End', 2],
        ['ArrowUp', 1],
      ]) {
        const event = await h.key(key)
        assert.equal(event.prevented, true, key)
        assert.equal(event.stopped, true, key)
        assert.equal(h.account.state.open, true)
        assert.equal(h.document.activeElement, h.items[index], key)
      }
      h.trigger.value.focus()
      await h.key('ArrowUp')
      assert.equal(h.document.activeElement, h.items.at(-1))
      assert(h.nextTicks > 0)
      assert.equal(h.backgroundKeys.length, 0)
    }
  )
  await checkAccount(
    'Escape hides, cancels pending hover and returns focus without reaching background',
    async h => {
      await h.key('End')
      h.pointer('pointerleave')
      const event = await h.key('Escape')
      assert.equal(event.prevented, true)
      assert.equal(event.stopped, true)
      assert.equal(h.account.state.open, false)
      assert.equal(h.document.activeElement, h.trigger.value)
      assert.equal(h.timers.size, 0)
      assert.equal(h.backgroundKeys.length, 0)
    }
  )
  await checkAccount(
    'unrelated keys are untouched and missing refs/items do not throw',
    async h => {
      for (const key of ['Tab', 'Enter', ' ', 'Escape']) {
        const event = await h.key(key)
        assert.equal(event.prevented, false, key)
        assert.equal(event.stopped, false, key)
        assert.equal(h.account.state.open, false)
      }
      h.items = []
      await h.key('Home')
      assert.equal(h.focusCalls.length, 0)
      h.root.value = null
      h.trigger.value = null
      await h.key('ArrowDown')
      await h.key('Escape')
      assert.equal(h.account.state.open, false)
    }
  )
  await checkAccount(
    'focusout inside stays open, focusout outside or null closes',
    h => {
      h.account.show()
      h.dispatch(h.rootElement, 'focusout', { relatedTarget: h.items[1] })
      assert.equal(h.account.state.open, true)
      h.dispatch(h.rootElement, 'focusout', { relatedTarget: h.innerChild })
      assert.equal(h.account.state.open, true)
      h.dispatch(h.rootElement, 'focusout', { relatedTarget: h.trigger.value })
      assert.equal(h.account.state.open, true)
      for (const relatedTarget of [h.outside, null]) {
        h.account.show()
        h.account.leave()
        h.dispatch(h.rootElement, 'focusout', { relatedTarget })
        assert.equal(h.account.state.open, false)
        assert.equal(h.timers.size, 0)
      }
    }
  )
  await checkAccount(
    'inside pointerdown stays open, outside pointerdown hides and clears timer',
    h => {
      h.account.show()
      h.dispatch(h.document, 'pointerdown', { target: h.innerChild })
      assert.equal(h.account.state.open, true)
      h.account.leave()
      h.dispatch(h.document, 'pointerdown', { target: h.outside })
      assert.equal(h.account.state.open, false)
      assert.equal(h.timers.size, 0)
    }
  )
  await checkAccount(
    'window blur hides immediately and cancels hover closing',
    h => {
      h.account.show()
      h.account.leave()
      h.dispatch(h.window, 'blur')
      assert.equal(h.account.state.open, false)
      assert.equal(h.timers.size, 0)
      h.tick(200)
      assert.equal(h.account.state.open, false)
    }
  )
  await checkAccount(
    'unmount executes the source hide hook and clears its pending timer',
    h => {
      h.account.show()
      h.account.leave()
      assert.equal(h.unmountHooks.length, 1)
      h.unmount()
      assert.equal(h.account.state.open, false)
      assert.equal(h.timers.size, 0)
      h.tick(200)
      assert.equal(h.account.state.open, false)
    }
  )
  await checkAccount(
    'selection emits the chosen platform only after closing and clearing the timer',
    h => {
      for (const platform of h.account.platforms) {
        h.account.show()
        h.account.leave()
        h.account.select(platform)
        assert.equal(h.account.state.open, false)
        assert.equal(h.timers.size, 0)
        assert.deepEqual(h.emitted.at(-1), {
          args: ['platform', platform],
          open: false,
        })
      }
      assert.equal(h.emitted.length, 3)
    }
  )
  console.log(
    `AccountMenu checks passed (${accountChecks} simulated groups); ${newComponents.length} additional SFCs compiled.`
  )
  // 首次路由进入时 v-model 已经为 true：执行 Dialog 原始 setup 状态与全部 watch，而非检查 immediate 字符串。
  function makeDialogSetup(initialOpen, platform, initialMode) {
    const { descriptor, errors } = parse(
      read('src/components/player/PlatformConnectionDialog.vue')
    )
    assert.deepEqual(errors, [])
    const tree = ts.createSourceFile(
      'connection-dialog.ts',
      descriptor.scriptSetup.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    const declaration = name =>
      tree.statements.find(
        node =>
          ts.isVariableStatement(node) &&
          node.declarationList.declarations.some(
            value => value.name.getText(tree) === name
          )
      )
    const watches = tree.statements.filter(
      node =>
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression) &&
        node.expression.expression.getText(tree) === 'watch'
    )
    const statements = [
      declaration('state'),
      declaration('profileSupported'),
      ...watches,
    ]
    assert(
      statements.every(Boolean) && watches.length > 0,
      'Actual Dialog setup/watch statements'
    )
    const events = []
    const context = {
      computed,
      reactive,
      watch,
      nextTick,
      props: reactive({
        platform,
        initialMode,
        initialValue: `seed-${platform}`,
      }),
      open: shallowRef(initialOpen),
      profileField: shallowRef(null),
      emit: (...args) => events.push(args),
    }
    const output = ts.transpileModule(
      statements.map(node => node.getText(tree)).join('\n') +
        '\nglobalThis.dialog = { state };',
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.None,
        },
      }
    ).outputText
    const scope = effectScope()
    scope.run(() => vm.runInNewContext(output, context))
    return { ...context, events, dispose: () => scope.stop() }
  }
  for (const [platform, mode] of [
    ['kugou', 'login'],
    ['netease', 'login'],
    ['kuwo', 'profile'],
  ]) {
    const setup = makeDialogSetup(true, platform, mode)
    try {
      await nextTick()
      assert.equal(
        setup.dialog.state.mode,
        mode,
        `Initially-open ${platform} must initialize ${mode} on first setup`
      )
      assert.equal(setup.dialog.state.draft, setup.props.initialValue)
      assert(setup.events.some(([event]) => event === 'clearError'))
    } finally {
      setup.dispose()
    }
  }
  console.log(
    'PASS PlatformConnectionDialog actual Vue watch/setup: initially-open login/profile initializes on first mount'
  )
  const initiallyClosed = makeDialogSetup(false, 'kugou', 'login')
  try {
    await nextTick()
    assert.equal(initiallyClosed.dialog.state.mode, 'profile')
    assert.equal(initiallyClosed.dialog.state.draft, '')
    assert.equal(initiallyClosed.events.length, 0)
    initiallyClosed.open.value = true
    await nextTick()
    assert.equal(initiallyClosed.dialog.state.mode, 'login')
    assert.equal(
      initiallyClosed.dialog.state.draft,
      initiallyClosed.props.initialValue
    )
    assert(initiallyClosed.events.some(([event]) => event === 'clearError'))
  } finally {
    initiallyClosed.dispose()
  }
  console.log(
    'PASS PlatformConnectionDialog actual Vue watch/setup: closed setup stays untouched and initializes when opened'
  )
  console.log(
    'Desktop checks passed: original widths/radii, opaque glass, shadow padding, Vue SFC compile, mocked menu/Escape/cache, native tray/lifecycle wiring.'
  )
  console.log(
    'Runtime probe: run this script with --probe, then evaluate its output in the existing desktop WebView CDP target. No native blur/tray runtime verification is claimed.'
  )
}
