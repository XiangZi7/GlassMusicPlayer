import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'vite'

// 独立、临时的组件验收：不启动播放器，不替换现有 GUI，不声称真实系统托盘交互。
const root = path.resolve(import.meta.dirname, '..')
const edge =
  process.env.MIRAI_EDGE_EXECUTABLE ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
assert.ok(
  fs.existsSync(edge),
  'Microsoft Edge is required for this optional Windows render check; no browser is installed automatically.'
)
const scratchRoot = path.join(root, '.tmp')
fs.mkdirSync(scratchRoot, { recursive: true })
const scratch = fs.mkdtempSync(path.join(scratchRoot, 'tray-render-'))
const profile = path.join(scratch, 'edge-profile')
fs.mkdirSync(profile)
const fixture = path.join(scratch, 'fixture.html')
fs.writeFileSync(
  fixture,
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tray component check</title><style>html,body{background:#ececea!important}.fixture-canvas{width:352px;max-width:100%;padding:32px;box-sizing:border-box}</style></head><body><div id="fixture" class="fixture-canvas"></div><script type="module">
import { createApp, h, reactive, nextTick } from 'vue'
import TrayMenu from '/src/components/tray/TrayMenu.vue'
import { tracks } from '/src/constants/music.ts'
import '@fontsource-variable/manrope'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/jetbrains-mono'
import '/src/styles/main.css'
const snapshot = { track: {...tracks[0], cover:''}, playing:false, time:42, volume:70, liked:false, lyrics:[], lyricIndex:0, motion:false, fontSize:21, locked:false, index:0, direction:1 }
const state = reactive({ snapshot, glassStyle:'frosted', motion:false, miniEnabled:true, busy:null, error:'', cycle:0, opened:true })
const events = [], sizes = []
createApp({render:()=>h(TrayMenu,{...state,onAction:action=>events.push(['action',action]),onToggle:()=>events.push(['toggle']),onDismiss:()=>events.push(['dismiss']),onResize:height=>sizes.push(height)})}).mount('#fixture')
window.trayFixture = {state,events,sizes,nextTick}
await document.fonts.ready
await nextTick()
window.trayFixtureReady = true
window.dispatchEvent(new Event('tray-fixture-ready'))
</script></body></html>`
)

let server, browser, socket
const pending = new Map()
const runtimeErrors = []
let sequence = 0
function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP timed out: ${method}; ${runtimeErrors.join('; ')}`))
    }, 30000)
    pending.set(id, {
      resolve: value => {
        clearTimeout(timer)
        resolve(value)
      },
      reject: error => {
        clearTimeout(timer)
        reject(error)
      },
    })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  assert.equal(
    response.exceptionDetails,
    undefined,
    JSON.stringify(response.exceptionDetails)
  )
  return response.result.value
}
async function key(name, code, modifiers = 0) {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: name,
    code: name,
    windowsVirtualKeyCode: code,
    modifiers,
    ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: name,
    code: name,
    windowsVirtualKeyCode: code,
    modifiers,
  })
  await evaluate(
    `new Promise(resolve=>requestAnimationFrame(()=>resolve(true)))`
  )
}
async function screenshot(name) {
  const bounds = await evaluate(
    `(()=>{const r=document.querySelector('.tray-menu').getBoundingClientRect();return {width:352,height:Math.ceil(r.bottom+32)}})()`
  )
  const image = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: bounds.width, height: bounds.height, scale: 1 },
  })
  const file = path.join(scratch, name)
  fs.writeFileSync(file, Buffer.from(image.data, 'base64'))
  console.log(`PREVIEW ${file}`)
}
try {
  server = await createServer({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      hmr: false,
      watch: null,
    },
    logLevel: 'error',
  })
  await server.listen()
  const port = server.httpServer.address().port
  const url = `http://127.0.0.1:${port}/${path.relative(root, fixture).split(path.sep).join('/')}`
  assert.equal((await fetch(url)).status, 200)
  console.log(`TEMPORARY COMPONENT CHECK ${url}`)
  browser = spawn(
    edge,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  )
  const debugPort = await new Promise((resolve, reject) => {
    const active = path.join(profile, 'DevToolsActivePort')
    const timer = setTimeout(() => {
      watcher.close()
      reject(new Error('Edge did not expose its isolated CDP port'))
    }, 30000)
    const check = () => {
      try {
        const port = Number(fs.readFileSync(active, 'utf8').split(/\r?\n/)[0])
        if (port > 0) {
          clearTimeout(timer)
          watcher.close()
          resolve(port)
        }
      } catch {}
    }
    const watcher = fs.watch(profile, check)
    browser.once('error', error => {
      clearTimeout(timer)
      watcher.close()
      reject(error)
    })
    browser.once('exit', code => {
      if (!fs.existsSync(active)) {
        clearTimeout(timer)
        watcher.close()
        reject(new Error(`Edge exited before CDP was ready: ${code}`))
      }
    })
    check()
  })
  const targets = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/list`)
  ).json()
  const target = targets.find(target => target.type === 'page')
  assert.ok(target?.webSocketDebuggerUrl)
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const entry = pending.get(message.id)
      if (entry) {
        pending.delete(message.id)
        message.error
          ? entry.reject(new Error(JSON.stringify(message.error)))
          : entry.resolve(message.result)
      }
    } else if (message.method === 'Runtime.exceptionThrown')
      runtimeErrors.push(message.params.exceptionDetails.text)
  })
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 352,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.navigate', { url })
  await evaluate(
    `new Promise(resolve=>{if(window.trayFixtureReady)resolve(true);else window.addEventListener('tray-fixture-ready',()=>resolve(true),{once:true})})`
  )
  const original = await evaluate(
    `(()=>{const e=document.querySelector('.tray-menu'),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{width:r.width,height:r.height,radius:s.borderRadius,filter:s.backdropFilter,overflow:e.scrollWidth>e.clientWidth,labels:[...document.querySelectorAll('[role="menuitem"]')].map(x=>x.textContent.trim()),title:trayFixture.state.snapshot.track.title,artist:trayFixture.state.snapshot.track.artist}})()`
  )
  assert.equal(original.width, 288)
  assert.equal(original.radius, '18px')
  assert.ok(original.filter.includes('blur(22px)'))
  assert.equal(original.overflow, false)
  assert.equal(original.labels.length, 6)
  assert.ok(original.height < 640)
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('.tray-menu-item')).transitionDuration`
    ),
    '0s'
  )
  await screenshot('tray-frosted.png')
  await evaluate(
    `(async()=>{trayFixture.state.glassStyle='liquid';await trayFixture.nextTick();return true})()`
  )
  assert.equal(
    await evaluate(`document.querySelector('.tray-menu').dataset.material`),
    'liquid'
  )
  await screenshot('tray-liquid.png')
  await evaluate(
    `(async()=>{trayFixture.state.snapshot.track.title='非常长的歌名'.repeat(30);trayFixture.state.snapshot.track.artist='非常长的歌手名'.repeat(20);await trayFixture.nextTick();return true})()`
  )
  const long = await evaluate(
    `(()=>{const t=document.querySelector('.tray-track-title'),p=document.querySelector('.tray-menu');return{ellipsis:getComputedStyle(t).textOverflow,clipped:t.scrollWidth>t.clientWidth,height:p.getBoundingClientRect().height,overflow:p.scrollWidth>p.clientWidth}})()`
  )
  assert.equal(long.ellipsis, 'ellipsis')
  assert.equal(long.clipped, true)
  assert.equal(long.height, original.height)
  assert.equal(long.overflow, false)
  await evaluate(
    `(async()=>{trayFixture.state.snapshot.track.title=${JSON.stringify(original.title)};trayFixture.state.snapshot.track.artist=${JSON.stringify(original.artist)};trayFixture.state.miniEnabled=false;await trayFixture.nextTick();document.querySelector('[data-tray-action="main"]').focus();return true})()`
  )
  assert.equal(
    await evaluate(
      `document.querySelector('[data-tray-action="mini"]').disabled`
    ),
    true
  )
  await key('ArrowDown', 40)
  assert.equal(
    await evaluate(`document.activeElement.dataset.trayAction`),
    'lyrics'
  )
  await key('End', 35)
  assert.equal(
    await evaluate(`document.activeElement.dataset.trayAction`),
    'exit'
  )
  await key('Tab', 9)
  assert.equal(
    await evaluate(`document.activeElement.classList.contains('tray-toggle')`),
    true
  )
  await key('Home', 36)
  assert.equal(
    await evaluate(`document.activeElement.dataset.trayAction`),
    'main'
  )
  await key('Enter', 13)
  assert.deepEqual(await evaluate(`trayFixture.events.at(-1)`), [
    'action',
    'main',
  ])
  await evaluate(
    `(async()=>{trayFixture.state.miniEnabled=true;await trayFixture.nextTick();trayFixture.events.length=0;document.querySelectorAll('[role="menuitem"]').forEach(button=>button.click());return true})()`
  )
  assert.deepEqual(await evaluate(`trayFixture.events.map(event=>event[1])`), [
    'main',
    'mini',
    'lyrics',
    'media',
    'settings',
    'exit',
  ])
  await evaluate(
    `(async()=>{document.querySelector('[data-tray-action="settings"]').focus();trayFixture.state.busy='settings';await trayFixture.nextTick();return true})()`
  )
  assert.equal(
    await evaluate(
      `document.querySelectorAll('[role="menuitem"]:disabled').length`
    ),
    6
  )
  assert.equal(
    await evaluate(
      `document.querySelector('[data-tray-action="settings"]').getAttribute('aria-busy')`
    ),
    'true'
  )
  await evaluate(
    `(async()=>{trayFixture.state.error='原生操作失败时保留菜单内反馈';trayFixture.state.busy=null;await trayFixture.nextTick();await trayFixture.nextTick();return true})()`
  )
  assert.equal(
    await evaluate(`document.activeElement.dataset.trayAction`),
    'settings'
  )
  assert.ok(
    await evaluate(
      `document.querySelector('[role="alert"]').textContent.includes('操作失败')`
    )
  )
  await evaluate(
    `(async()=>{trayFixture.state.error='';trayFixture.state.motion=true;await trayFixture.nextTick();return true})()`
  )
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await evaluate(
    `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`
  )
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('.tray-menu-item')).transitionDuration`
    ),
    '0s'
  )
  await send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 280,
    deviceScaleFactor: 1.5,
    mobile: false,
  })
  await evaluate(
    `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`
  )
  await evaluate(`document.querySelector('[data-tray-action="main"]').focus()`)
  await key('End', 35)
  const small = await evaluate(
    `(()=>{const p=document.querySelector('.tray-menu'),r=p.getBoundingClientRect(),x=document.querySelector('[data-tray-action="exit"]').getBoundingClientRect();return{height:r.height,scroll:p.scrollTop,overflow:p.scrollWidth>p.clientWidth,exitVisible:x.top>=r.top&&x.bottom<=r.bottom}})()`
  )
  assert.ok(small.height <= 216)
  assert.ok(small.scroll > 0)
  assert.equal(small.overflow, false)
  assert.equal(small.exitVisible, true)
  assert.equal(runtimeErrors.length, 0, JSON.stringify(runtimeErrors))
  console.log(
    `PASS real Edge render: ${JSON.stringify({ normal: original, small })}`
  )
  console.log(
    'PASS frosted/liquid, long-title ellipsis, disabled/busy states, six action emits, keyboard/Enter/Tab, focus recovery, reduced motion and small-viewport scrolling.'
  )
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await send('Browser.close')
    } catch {}
  }
  socket?.close()
  browser?.kill()
  await server?.close()
}
