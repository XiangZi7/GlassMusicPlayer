import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '../..')
const scratch = join(root, '.tmp')
await mkdir(scratch, { recursive: true })
const profile = await mkdtemp(join(scratch, 'readme-edge-'))
const origin = 'http://127.0.0.1:' + (process.env.MIRAI_QA_PORT || '1420')
const browser = spawn(process.env.MIRAI_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--no-first-run', '--mute-audio', '--disable-background-networking',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
let socket
let id = 0
const pending = new Map()

// 所有操作限于新建的浏览器配置，等待真实加载条件后再取图。
async function wait(label, test) {
  for (let n = 0; n < 180; n++) {
    const value = await test()
    if (value) return value
    await delay(250)
  }
  const detail = socket?.readyState === WebSocket.OPEN
    ? await evaluate("JSON.stringify({ title: document.title, body: document.body.innerText.slice(0, 500), cards: document.querySelectorAll('[data-card-key]').length })")
    : ''
  throw Error('等待超时 ' + label + ' ' + detail)
}

// 把 DevTools 请求与响应配对，同时允许页面在后台继续加载。
function send(method, params = {}) {
  const seq = ++id
  return new Promise((ok, fail) => {
    const timer = setTimeout(() => { pending.delete(seq); fail(Error('超时 ' + method)) }, 60000)
    pending.set(seq, message => {
      clearTimeout(timer)
      if (message.error) fail(Error(message.error.message))
      else ok(message.result)
    })
    socket.send(JSON.stringify({ id: seq, method, params }))
  })
}

// 在当前预览页面读取 DOM 或操作已渲染的控件。
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  assert(!r.exceptionDetails, r.exceptionDetails?.exception?.description)
  return r.result.value
}

// 固定截图大小，每次切换保留相同的逻辑像素与字体比例。
async function resize(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
}

// 等待文字和窗口内容稳定后原尺寸保存，此处不修改界面或响应数据。
async function capture(name, condition) {
  await wait(name, () => evaluate(condition))
  await evaluate('document.fonts.ready.then(() => true)')
  await delay(850)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(import.meta.dirname, name + '.png'), Buffer.from(data, 'base64'))
  console.log(name)
}

try {
  const port = await wait('浏览器调试端口', async () => {
    try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0] }
    catch { return null }
  })
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail })
  socket.onmessage = event => {
    const packet = JSON.parse(event.data)
    pending.get(packet.id)?.(packet)
    pending.delete(packet.id)
  }
  await send('Page.enable')
  if (process.argv.includes('--hero')) {
    await resize(1600, 800)
    for (const language of ['zh', 'en']) {
      const url = pathToFileURL(join(import.meta.dirname, 'showcase.html'))
      url.searchParams.set('lang', language)
      await send('Page.navigate', { url: url.href })
      await capture('showcase-hero-' + language, 'document.documentElement.lang === ' + JSON.stringify(language) + ' && [...document.images].every(image => image.naturalWidth > 0)')
    }
  } else {
    await resize(1440, 900)
    await send('Page.navigate', { url: origin + '/#/' })
    await capture('feature-home', "document.querySelectorAll('.home-content [data-card-key]').length >= 4 && document.querySelector('[data-card-key=\"netease:3779629\"]')")
    await evaluate("document.querySelector('[data-card-key=\"netease:3779629\"]').click()")
    await capture('feature-playlist', "document.querySelector('[data-panel=discovery] [data-vue-tracklist]')")
    await evaluate("location.hash='/connect'")
    await capture('feature-platforms', "document.querySelector('[data-panel=connect]')?.getBoundingClientRect().height > 100")
    await resize(940, 730)
    await evaluate("location.hash='/settings'")
    await wait('设置', () => evaluate("!!document.querySelector('[data-slide-value=audio]')"))
    await evaluate("document.querySelector('[data-slide-value=audio]').click()")
    await capture('feature-equalizer', "!!document.querySelector('[aria-label=启用均衡器]')")
    await evaluate("document.querySelector('[data-slide-value=desktop]').click()")
    await capture('feature-desktop', "document.querySelector('main [role=region]')?.textContent.includes('灵动岛')")
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await Promise.race([send('Browser.close').catch(() => {}), delay(400)])
    socket.close()
  }
  if (browser.exitCode === null) browser.kill()
}
