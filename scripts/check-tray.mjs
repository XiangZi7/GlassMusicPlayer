import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { reactive, toRefs } from 'vue'
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

function loadTs(file, imports = {}, extra = {}) {
  const module = { exports: {} }
  const context = vm.createContext({
    module,
    exports: module.exports,
    console,
    Error,
    ...extra,
    require(name) {
      assert.ok(name in imports, `Unexpected runtime dependency: ${name}`)
      return imports[name]
    },
  })
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  })
  vm.runInContext(compiled.outputText, context, { filename: file })
  return module.exports
}
const helpers = loadTs('src/types/tray.ts')
const entries = [
  helpers.trayMainEntry,
  ...helpers.trayDesktopEntries,
  ...helpers.trayUtilityEntries,
]
assert.deepEqual(
  Array.from(entries, entry => entry.id),
  ['main', 'mini', 'lyrics', 'media', 'settings', 'exit']
)
assert.equal(new Set(entries.map(entry => entry.id)).size, 6)
for (const [key, index, count, shift, expected] of [
  ['ArrowDown', -1, 6, false, 0],
  ['ArrowUp', -1, 6, false, 5],
  ['ArrowDown', 5, 6, false, 0],
  ['ArrowUp', 0, 6, false, 5],
  ['Home', 4, 6, false, 0],
  ['End', 1, 6, false, 5],
  ['Tab', 5, 6, false, 0],
  ['Tab', 0, 6, true, 5],
  ['ArrowDown', 0, 0, false, -1],
])
  assert.equal(helpers.nextTrayFocus(key, index, count, shift), expected)
for (const height of [220, 440.5, 640])
  assert.equal(helpers.validTrayHeight(height), true)
for (const height of [NaN, Infinity, -1, 0, 219.9, 640.1, '440'])
  assert.equal(helpers.validTrayHeight(height), false)
assert.equal(helpers.canRunTrayAction('mini', null, false, true), false)
assert.equal(helpers.canRunTrayAction('toggle', null, true, false), false)
for (const entry of entries)
  assert.equal(helpers.canRunTrayAction(entry.id, 'main', true, true), false)
assert.equal(
  helpers.trayErrorMessage(new Error('native failed')),
  'native failed'
)
assert.equal(helpers.trayErrorMessage('').length > 0, true)
assert.equal(helpers.trayErrorMessage('x'.repeat(300)).length, 180)
console.log(
  'PASS tray entries, keyboard wrap, resize validation, duplicate/disabled guards'
)

const compiledStyles = new Map()
for (const file of [
  'src/pages/tray.vue',
  'src/components/tray/TrayMenu.vue',
  'src/components/tray/TrayMenuItem.vue',
  'src/components/tray/TrayNowPlaying.vue',
  'src/components/tray/TrayIcon.vue',
]) {
  const { descriptor, errors } = parse(read(file), {
    filename: path.join(root, file),
  })
  assert.deepEqual(errors, [], `${file}: parse`)
  const script = compileScript(descriptor, { id: file })
  const template = compileTemplate({
    id: file,
    filename: file,
    source: descriptor.template.content,
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [], `${file}: template`)
  let css = ''
  for (const style of descriptor.styles) {
    const compiled = compileStyle({
      id: `tray-check-${path.basename(file, '.vue')}`,
      filename: file,
      source: style.content,
      scoped: style.scoped,
    })
    assert.deepEqual(compiled.errors, [], `${file}: style`)
    css += compiled.code
  }
  compiledStyles.set(file, css)
  console.log(`PASS SFC script/template/style compile: ${file}`)
}
assert.match(
  compiledStyles.get('src/components/tray/TrayMenuItem.vue'),
  /\[data-tray-motion=['"]off['"]\]\s+\.tray-menu-item\s*\{\s*transition: none/
)
assert.match(
  compiledStyles.get('src/components/tray/TrayNowPlaying.vue'),
  /\[data-tray-motion=['"]off['"]\]\s+\.tray-toggle\s*\{\s*transition: none/
)
assert.match(read('src/components/tray/TrayMenu.vue'), /scrollHeight \+ 2/)
assert.match(read('src/components/tray/TrayMenu.vue'), /scrollIntoView/)
assert.match(
  read('src/components/tray/TrayNowPlaying.vue'),
  /referrerpolicy="no-referrer"/
)
assert.doesNotMatch(
  read('src/composables/useTrayMenu.ts'),
  /usePlayerStore|Audio\(|setInterval|emitTo\(/
)

function makeHarness({ native = true, late = false } = {}) {
  const harness = {
    calls: [],
    listeners: new Map(),
    mounted: [],
    unmounted: [],
    deferred: [],
    keys: new Map(),
    stops: 0,
    document: { documentElement: { dataset: {} } },
    behavior: async name => (name === 'start_tray_session' ? 1 : undefined),
  }
  const imports = {
    vue: {
      reactive,
      toRefs,
      onMounted: fn => harness.mounted.push(fn),
      onUnmounted: fn => harness.unmounted.push(fn),
    },
    '@vueuse/core': {
      useEventListener: (name, fn) => harness.keys.set(name, fn),
    },
    '@tauri-apps/api/core': {
      isTauri: () => native,
      invoke: async (name, args) => {
        harness.calls.push({
          name,
          args,
          listenerCount: harness.listeners.size,
        })
        return harness.behavior(name, args)
      },
    },
    '@tauri-apps/api/event': {
      listen: async (name, fn) => {
        harness.listeners.set(name, fn)
        const stop = () => {
          harness.stops++
          harness.listeners.delete(name)
        }
        if (!late) return stop
        return new Promise(resolve =>
          harness.deferred.push(() => resolve(stop))
        )
      },
    },
    '@/types/tray': helpers,
  }
  const module = loadTs('src/composables/useTrayMenu.ts', imports, {
    document: harness.document,
  })
  harness.api = module.useTrayMenu()
  harness.mount = () => Promise.all(harness.mounted.map(fn => fn()))
  harness.unmount = () => harness.unmounted.forEach(fn => fn())
  harness.receive = (name, payload) =>
    harness.listeners.get(name)?.({ payload })
  return harness
}
const snapshot = {
  track: {
    title: 'A real main-window snapshot',
    artist: 'Artist',
    album: 'Album',
    cover: '',
    dur: 240,
    q: '',
    glow: 'rgba(140,160,255,.5)',
  },
  playing: true,
  time: 42,
  volume: 70,
  liked: false,
  lyrics: [],
  lyricIndex: 0,
  motion: true,
  fontSize: 21,
  locked: false,
  index: 0,
  direction: 1,
}
const harness = makeHarness()
await harness.api.resize(480.25)
assert.equal(harness.calls.length, 0, 'No ready before subscriptions')
await harness.mount()
assert.equal(harness.document.documentElement.dataset.traySurface, 'true')
assert.equal(harness.calls[0].name, 'start_tray_session')
assert.equal(
  harness.calls[0].listenerCount,
  4,
  'Every event subscription exists before the session handshake'
)
assert.equal(harness.calls[1].name, 'resize_tray_menu')
assert.equal(
  harness.calls[1].listenerCount,
  4,
  'Every event subscription exists before ready'
)
assert.equal(harness.calls[1].args.contentHeight, 480.25)
assert.equal(harness.calls[1].args.generation, 1)
await harness.api.resize(480.25)
assert.equal(
  harness.calls.length,
  2,
  'Stable dimensions do not trigger resize loops'
)
for (const height of [0, NaN, Infinity, 200, 650])
  await harness.api.resize(height)
assert.equal(harness.calls.length, 2)
harness.receive('player-snapshot', snapshot)
assert.equal(harness.api.snapshot.value.track.title, snapshot.track.title)
harness.receive('settings-snapshot', {
  settings: { glassStyle: 'liquid', motion: false, trayMini: false },
})
assert.equal(harness.api.glassStyle.value, 'liquid')
assert.equal(harness.api.motion.value, false)
assert.equal(harness.api.miniEnabled.value, false)
await harness.api.run('mini')
assert.equal(harness.calls.length, 2, 'Disabled mini never submits an action')
harness.receive('tray-opened', true)
assert.equal(harness.api.opened.value, true)
assert.equal(harness.api.miniEnabled.value, true)
assert.equal(harness.api.cycle.value, 1)
harness.receive('tray-closed')
assert.equal(harness.api.opened.value, false)
harness.receive('tray-opened', true)
assert.equal(harness.api.cycle.value, 2)
assert.equal(
  harness.listeners.size,
  4,
  'Cached reopens do not register another listener group'
)
let complete
harness.behavior = name =>
  name === 'run_tray_action'
    ? new Promise(resolve => {
        complete = resolve
      })
    : Promise.resolve()
const first = harness.api.run('main')
assert.equal(harness.api.busy.value, 'main')
const beforeDuplicate = harness.calls.length
await harness.api.run('lyrics')
assert.equal(
  harness.calls.length,
  beforeDuplicate,
  'Duplicate native actions are blocked while pending'
)
complete()
await first
assert.equal(harness.api.busy.value, null)
harness.behavior = async () => {
  throw new Error('Native test failure')
}
await harness.api.run('settings')
assert.equal(harness.api.error.value, 'Native test failure')
assert.equal(harness.api.busy.value, null, 'Failure releases pending state')
harness.behavior = async () => undefined
harness.receive('tray-opened', false)
assert.equal(harness.api.error.value, '', 'Manual reopen clears stale errors')
await harness.api.run('toggle')
assert.equal(harness.calls.at(-1).args.action, 'toggle')
await harness.api.dismiss()
assert.equal(harness.calls.at(-1).name, 'dismiss_tray_menu')
assert.equal(harness.api.opened.value, false)
const keyEvent = {
  key: 'Escape',
  prevented: false,
  stopped: false,
  preventDefault() {
    this.prevented = true
  },
  stopPropagation() {
    this.stopped = true
  },
}
harness.keys.get('keydown')(keyEvent)
await Promise.resolve()
assert.equal(keyEvent.prevented, true)
assert.equal(keyEvent.stopped, true)
assert.equal(
  harness.calls.at(-1).name,
  'dismiss_tray_menu',
  'Escape does not call generic close/exit'
)
harness.unmount()
assert.equal(harness.stops, 4)
assert.equal(harness.listeners.size, 0)
assert.equal(harness.document.documentElement.dataset.traySurface, undefined)
console.log(
  'PASS real composable: snapshot/theme sync, ready ordering, cached reopens, busy/error guards, Escape and cleanup'
)

const late = makeHarness({ late: true })
await late.api.resize(480)
const mounting = late.mount()
assert.equal(late.deferred.length, 4)
late.unmount()
late.receive('player-snapshot', snapshot)
assert.equal(
  late.api.snapshot.value,
  null,
  'Unmounted instance ignores late events'
)
late.deferred.forEach(resolve => resolve())
await mounting
assert.equal(late.stops, 4)
assert.equal(late.calls.length, 0)
const browser = makeHarness({ native: false })
await browser.mount()
await browser.api.resize(480)
await browser.api.run('main')
await browser.api.dismiss()
assert.equal(browser.calls.length, 0)
assert.match(browser.api.error.value, /桌面客户端/)
browser.unmount()
const hidingPage = makeHarness()
await hidingPage.api.resize(480)
await hidingPage.mount()
const beforePageHide = hidingPage.calls.length
hidingPage.keys.get('pagehide')()
hidingPage.unmount()
await hidingPage.api.resize(500)
await hidingPage.api.run('main')
assert.equal(
  hidingPage.stops,
  4,
  'Pagehide and unmount dispose subscriptions only once'
)
assert.equal(hidingPage.calls.length, beforePageHide)
let completeSession, sessionStarted
const sessionSent = new Promise(resolve => {
  sessionStarted = resolve
})
const lateSession = makeHarness()
lateSession.behavior = name =>
  name === 'start_tray_session'
    ? new Promise(resolve => {
        completeSession = resolve
        sessionStarted()
      })
    : Promise.resolve()
await lateSession.api.resize(480)
const lateMounting = lateSession.mount()
await sessionSent
lateSession.unmount()
completeSession(1)
await lateMounting
assert.equal(
  lateSession.calls.length,
  1,
  'A late session response never submits ready for an unmounted page'
)
assert.equal(lateSession.stops, 4)
console.log(
  'PASS late listener/session disposal, pagehide cleanup and browser-only preview boundary'
)

const capability = JSON.parse(read('src-tauri/capabilities/tray.json'))
assert.deepEqual(capability.windows, ['tray'])
assert.deepEqual(capability.platforms, ['windows'])
assert.deepEqual(capability.permissions, [
  'core:event:allow-listen',
  'core:event:allow-unlisten',
])
assert.equal(
  JSON.parse(read('src-tauri/capabilities/default.json')).windows.includes(
    'tray'
  ),
  false
)
const native = read('src-tauri/src/desktop/tray_menu.rs')
const tray = read('src-tauri/src/desktop/tray.rs')
const app = read('src-tauri/src/app.rs')
for (const command of [
  'start_tray_session',
  'resize_tray_menu',
  'dismiss_tray_menu',
  'run_tray_action',
]) {
  assert.ok(app.includes(`tray_menu::${command}`))
  assert.match(
    native,
    new RegExp(
      `fn ${command}\\([\\s\\S]*?ensure_tray\\(window\\.label\\(\\)\\)\\?`
    )
  )
}
assert.match(native, /monitor\.work_area\(\)/)
assert.match(native, /icon\.set_menu\(None::<Menu<Wry>>\)/)
assert.match(native, /icon\.set_menu\(Some\(menu\)\)/)
assert.match(native, /\.visible\(false\)/)
assert.match(native, /\.focused\(false\)/)
assert.match(native, /PageLoadEvent::Started/)
assert.match(tray, /button_state != MouseButtonState::Up/)
assert.match(tray, /tray_menu::is_ready\(app\)/)
assert.match(tray, /\.menu\(&menu\)/)
assert.match(
  tray,
  /#\[cfg\(target_os = "windows"\)\]\s*if let Err\(error\) = super::tray_menu::create_window/
)
assert.match(read('src/router/index.ts'), /path: '\/desktop\/tray'/)
assert.match(
  read('src/layouts/player-layout.vue'),
  /emitTo\('tray', 'settings-snapshot', snapshot\)/
)
assert.match(
  read('src/layouts/player-layout.vue'),
  /if \(player\.value\) publishSnapshot\(player\.value\.getSnapshot\(\)\)/
)
console.log(
  'PASS native bridge wiring, minimal permissions, Windows warm-up, native fallback and shared snapshots'
)

if (process.argv.includes('--built')) {
  const assets = path.join(root, 'dist/assets')
  const styles = fs
    .readdirSync(assets)
    .filter(file => /^tray-.*\.css$/.test(file))
  assert.equal(styles.length, 1, 'Exactly one production tray stylesheet')
  const css = fs.readFileSync(path.join(assets, styles[0]), 'utf8')
  assert.match(
    css,
    /(?:^|[;{])backdrop-filter:\s*blur\(22px\)\s*saturate\((?:1\.25|125%)\)/
  )
  assert.match(css, /\.tray-menu-item/)
  assert.match(css, /\.tray-toggle/)
  console.log(
    'PASS built tray CSS: glass filter and interaction styles survive production minification'
  )
}
console.log(
  'Tray regression checks passed. Mocked IPC tests do not claim real tray or OS focus interaction.'
)
