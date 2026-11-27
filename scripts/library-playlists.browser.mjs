import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'

// 运行 node scripts/library-playlists.browser.mjs。MIRAI_TEST_BROWSER 可指定 Chromium 浏览器。
const platforms = { netease: '网易云音乐', kugou: '酷狗音乐', kuwo: '酷我音乐' }
const publicIds = { netease: ['3779629', '3778678'], kugou: ['9095716', '9183003'], kuwo: ['1082685104', '2952464073'] }
const popularIds = Object.fromEntries(Object.keys(platforms).map((platform, index) => [
  platform, Array.from({ length: 8 }, (_, cardIndex) => String(74101 + index * 100 + cardIndex)),
]))
const covers = ['pop-stage', 'pop-hero-pinkwave', 'pop-library', 'pop-hero-tealtwin',
  'pop-radio', 'pop-hero-mirai-blade', 'pop-hero-minttwin', 'pop-hero-whitehair']
const playlistNames = ['秋日逃离｜藏在街头的 Lo-Fi 回忆', '夜晚收音机',
  '风吹过海边之前｜适合黄昏、晚霞和散步的日系独立歌单', '日常听觉档案',
  '午后放空｜温柔爵士和氛围配乐', '城市漫游指南', '摇滚进行时', '假日电影配乐']
const hot = { value: 'hot', label: '热门' }
const browseFilters = {
  netease: { categoryOrders: true, orders: [hot],
    categories: [{ value: '民谣', label: '民谣' }, { value: '摇滚', label: '摇滚' }] },
  kuwo: { categoryOrders: false, orders: [hot, { value: 'new', label: '最新' }],
    categories: [{ value: '392', label: '民谣' }, { value: '389', label: '摇滚' }] },
  kugou: { categoryOrders: false, categories: [], orders: [
    { value: 'hot', label: '最热' }, { value: 'recommended', label: '推荐' },
    { value: 'collected', label: '热藏' }, { value: 'rising', label: '飙升' },
  ] },
}
const titles = new Map()
const requests = []
const slowSearch = Promise.withResolvers()
let failedSearch = false

// 测试接口使用真实分页和标识格式，跨平台的搜索结果可以使用相同 ID。
function playlist(platform, id, title, pageNum = 1, pageSize = 100) {
  const sourceUrl = 'https://example.test/' + platform + '/playlists/' + id
  return { platform, id, title, pageNum, pageSize, total: 1, coverUrl: null, sourceUrl,
    tracks: [{ platform, id: id + '1', title: '歌曲 ' + title, artists: ['测试歌手'], album: null,
      durationMs: 164000, coverUrl: null, sourceUrl }] }
}

// 模拟一次平台失败和一个可控的迟到响应，保留真实路由、Axios 和 Pinia。
async function mockPlatform(method, url) {
  const [, platform, api, first, last] = url.pathname.replace('/api/v1', '').split('/')
  if (method === 'OPTIONS') return [204]
  const pageNum = Number(url.searchParams.get('pageNum') || 1)
  const pageSize = Number(url.searchParams.get('pageSize') || 20)
  const query = url.searchParams.get('q')
  const category = url.searchParams.get('category')
  const order = url.searchParams.get('order') || 'hot'
  requests.push({ platform, api, first, pageNum, query, category, order })
  if (platform === 'platforms') return [200, Object.keys(platforms)]
  if (api === 'playlists' && first === 'filters') {
    return [200, { platform, ...browseFilters[platform] }]
  }
  if (api === 'search' && first === 'playlists') {
    if (query === '迟到') await slowSearch.promise
    if (query === '雨天' && !failedSearch) {
      failedSearch = true
      return [502, { detail: { code: 'upstream_error' } }]
    }
    const id = '81001'
    const title = platforms[platform] + ' ' + query + '测试结果'
    titles.set(platform + ':' + id, title)
    return [200, { platform, pageNum, pageSize, total: 1, playlists: [{ id, title, coverUrl: null, trackCount: 1 }] }]
  }
  if (api === 'playlists' && first === 'popular') {
    const selectedCategory = browseFilters[platform].categories.find(choice => choice.value === category)
    const selectedOrder = browseFilters[platform].orders.find(choice => choice.value === order)
    if (!selectedOrder || (category && !selectedCategory) || (platform === 'kuwo' && category && order !== 'hot')) {
      return [422, { detail: { code: 'unsupported_playlist_filters' } }]
    }
    const filtered = selectedCategory || order !== 'hot'
    const ids = filtered ? [popularIds[platform][0] + '3'] : pageNum === 1
      ? popularIds[platform].slice(0, pageSize) : [popularIds[platform][0] + '2']
    const playlists = ids.map((id, index) => {
      const title = filtered ? `${platforms[platform]}${selectedCategory?.label || '全部'}${selectedOrder.label}测试歌单`
        : pageNum === 1 ? playlistNames[index] : `${platforms[platform]}热门歌单 ${pageNum}-${index + 1}`
      titles.set(`${platform}:${id}`, title)
      return { id, title, coverUrl: `${origin}/images/${covers[index]}.webp`, trackCount: index === 3 ? null : 24 + index * 9 }
    })
    return [200, { platform, pageNum, pageSize, total: filtered ? 1 : null, hasMore: !filtered && pageNum === 1, playlists }]
  }
  if (api === 'playlists') {
    const title = titles.get(platform + ':' + first) ?? platforms[platform] + '公开歌单 ' + (publicIds[platform].indexOf(first) + 1)
    return [200, playlist(platform, first, title, pageNum, pageSize)]
  }
  if (api === 'tracks' && last === 'lyrics') return [200, { lrc: '', translatedLrc: '' }]
  return [404, { detail: 'Not Found' }]
}

let server
let browser
let exited
let launchError
let origin = 'http://127.0.0.1:1420'
let nextId = 0
const pending = new Map()
const interceptors = new Map()
const errors = []

// Chromium 的调试管道用 NUL 分隔消息，超时时告知正在运行的命令。
function send(method, params = {}, sessionId) {
  if (launchError) throw launchError
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error(method + ' 超时')), 35000)
    pending.set(id, ({ error, result }) => {
      clearTimeout(timeout)
      pending.delete(id)
      if (error) reject(Error(error.message))
      else resolve(result)
    })
    browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0')
  })
}


// 使用独立浏览器上下文，测试数据通过应用已有的存储入口载入。
async function open(width, height, theme, profiles) {
  const { browserContextId } = await send('Target.createBrowserContext')
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params) => send(method, params, sessionId)
  interceptors.set(sessionId, async ({ requestId, request }) => {
    try {
      const [responseCode, body] = await mockPlatform(request.method, new URL(request.url))
      await call('Fetch.fulfillRequest', {
        requestId, responseCode,
        responseHeaders: Object.entries({ 'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'accept, authorization', 'content-type': 'application/json' })
          .map(([name, value]) => ({ name, value })),
        body: body === undefined ? undefined : Buffer.from(JSON.stringify(body)).toString('base64'),
      })
    } catch (error) {
      // Axios 取消旧请求后，Chromium 允许已拦截的请求失效。
      if (!/Invalid InterceptionId|No resource with given identifier|Invalid state/.test(error.message))
        errors.push(error.message)
    }
  })
  await call('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] })
  await call('Runtime.enable')
  await call('Page.enable')
  await call('Page.bringToFront')
  // 同一浏览上下文缩放时保留路由和筛选状态。
  function resize(width, height) {
    return call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  }
  await resize(width, height)
  // 从浏览器模拟系统减少动态效果，应用中的动效开关继续使用已保存值。
  function reduceMotion() {
    return call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  }
  const setup = {
    'miraiMusic.preferences.v1': { version: 1, settings: { glassStyle: theme, autoUpdate: false, weather: false } },
    'miraiMusic.publicPlatformProfiles.v1': profiles,
    'miraiMusic.publicPlaylists.v1': [playlist('kuwo', '660', '本地导入样本')],
  }
  const source = "if (location.hostname === '127.0.0.1') { for (const [name, data] of Object.entries(" +
    JSON.stringify(setup) + ")) if (!localStorage.getItem(name)) localStorage.setItem(name, JSON.stringify(data)); }"
  await call('Page.addScriptToEvaluateOnNewDocument', { source })
  await call('Page.navigate', { url: origin + '/#/' })

  // 页面断言使用已挂载的真实应用，测试点击通过浏览器输入协议派发。
  async function evaluate(expression) {
    const { result, exceptionDetails } = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (exceptionDetails) throw Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }
  async function wait(label, expression) {
    for (const end = Date.now() + 15000; Date.now() < end;) {
      if (await evaluate(expression)) return
      await delay(50)
    }
    throw Error(label + '：' + await evaluate('location.hash + " / " + document.body.innerText.slice(-950)'))
  }
  async function click(expression) {
    await wait('等待控件', '!!(' + expression + ')')
    await evaluate('(' + expression + ').scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" })')
    const inspectPoint = '(() => { const element = ' + expression + '; if (!element) return {};' +
      'const rect = element.getBoundingClientRect(); const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;' +
      'const hit = document.elementFromPoint(x, y); return { x, y, ready: element.contains(hit), ' +
      'hit: hit?.outerHTML.slice(0, 150), target: element.textContent.trim() }; })()'
    let previous
    let point
    let ready = false
    // 首屏横幅会随滚动收起，连续两次命中同一坐标后才发送鼠标事件。
    for (const end = Date.now() + 3500; Date.now() < end;) {
      point = await evaluate(inspectPoint)
      ready = point.ready && previous?.ready &&
        Math.abs(previous.x - point.x) < 0.5 && Math.abs(previous.y - point.y) < 0.5
      if (ready) break
      previous = point
      await delay(65)
    }
    assert.ok(ready, '控件无法点击：' + JSON.stringify(point))
    const button = { x: point.x, y: point.y, button: 'left', clickCount: 1 }
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...button })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...button })
  }
  async function search(query) {
    await evaluate('{ const input = document.querySelector(\'[aria-label="筛选歌单"]\');' +
      'input.focus(); input.value = ' + JSON.stringify(query) + '; input.dispatchEvent(new InputEvent("input", { bubbles: true })); }')
  }

  // 用浏览器键盘事件验证默认按钮行为和菜单焦点，不直接修改页面选择。
  async function key(name) {
    const keyCode = { Enter: 13, Escape: 27, End: 35 }[name]
    const event = { key: name, code: name, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }
    const character = name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}
    await call('Input.dispatchKeyEvent', { type: 'keyDown', ...event, ...character })
    await call('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
  }

  // 截图前等当前可见歌单有实际封面，避免截到占位图或进入过渡。
  async function screenshot(name) {
    await wait('等待歌单封面', cards + '.some(card => card.querySelector("img")?.naturalWidth > 0)')
    await delay(240)
    const { data } = await call('Page.captureScreenshot', { fromSurface: true })
    await writeFile(resolve('.tmp', `library-playlists-${name}.png`), Buffer.from(data, 'base64'))
  }
  return { evaluate, wait, click, search, key, screenshot, resize, reduceMotion }
}

const select = selector => 'document.querySelector(' + JSON.stringify(selector) + ')'
const control = (label, scope = 'document') => '[...((' + scope + ')?.querySelectorAll("button, a") ?? [])].find(element => ' +
  '(element.getAttribute("aria-label") || element.textContent).trim() === ' + JSON.stringify(label) + ')'
const panel = select('[data-panel="playlists"]')
const platformButton = value => select('[aria-label="歌单平台"] [data-slide-value="' + value + '"]')
const homeCards = '[...document.querySelectorAll("#home-recommend-albums [data-card-key]")].map(card => card.dataset.cardKey)'
const cards = '[...document.querySelectorAll(\'[data-panel="playlists"] [aria-label="歌单列表"] .playlist-card\')]'
const hasCard = title => cards + '.some(card => card.textContent.includes(' + JSON.stringify(title) + '))'
const card = title => cards + '.find(card => card.textContent.includes(' + JSON.stringify(title) + '))'
const hasPlaylist = (platform, index = 0) => `!!${select(`[data-panel="playlists"] [data-library-playlist="${popularIds[platform][index]}"]`)}`
const more = select('button[data-card-key="more-playlists"]')
const categoryTrigger = select('[data-panel="playlists"] button[aria-label^="歌单分类"]')
const orderTrigger = select('[data-panel="playlists"] button[aria-label^="歌单排序"]')
const popup = select('[role="listbox"]:not([inert])')
const option = value => select(`[role="listbox"]:not([inert]) [data-choice="${value}"]`)
const reset = control('重置筛选', panel)
const noOverflow = panel + '.scrollWidth <= ' + panel + '.clientWidth + 1'
const list = select('[data-panel="playlists"] [aria-label="歌单列表"]')


try {
  if (!await fetch(origin + '/@vite/client', { signal: AbortSignal.timeout(1500) }).then(response => response.ok, () => false)) {
    server = await createServer({ configLoader: 'runner', cacheDir: '.tmp/library-playlists-vite-cache',
      server: { port: 0, hmr: false } })
    await server.listen(0)
    origin = 'http://127.0.0.1:' + server.httpServer.address().port
  }
  await mkdir(resolve('.tmp'), { recursive: true })
  const profile = await mkdtemp(resolve('.tmp/library-playlists-edge-'))
  browser = spawn(process.env.MIRAI_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
    '--headless=new', '--no-first-run', '--disable-background-networking', '--disable-gpu',
    '--disable-features=SpareRendererForSitePerProcess', '--remote-debugging-pipe',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] })
  exited = once(browser, 'exit').catch(error => { launchError = error })
  let rest = ''
  browser.stdio[4].setEncoding('utf8').on('data', data => {
    const packets = (rest + data).split('\0')
    rest = packets.pop()
    for (const raw of packets) {
      const packet = JSON.parse(raw)
      pending.get(packet.id)?.(packet)
      if (packet.method === 'Fetch.requestPaused') void interceptors.get(packet.sessionId)?.(packet.params)
      if (packet.method === 'Runtime.exceptionThrown')
        errors.push(packet.params.exceptionDetails.exception?.description ?? packet.params.exceptionDetails.text)
    }
  })

  const guest = await open(1360, 860, 'frosted', {})
  await guest.wait('游客首页的发现歌单', homeCards + '.length >= 2')
  assert.deepEqual(await guest.evaluate(homeCards), popularIds.netease.map(id => 'netease:' + id))
  await guest.click(more)
  await guest.wait('进入音乐库歌单页', `location.hash.startsWith("#/playlists") && ${hasPlaylist('netease')}`)
  await guest.wait('网易云提供分类条件', `${categoryTrigger}?.disabled === false && !${orderTrigger}`)
  assert.equal(await guest.evaluate(noOverflow), true)
  await guest.screenshot('frosted')
  await guest.click(categoryTrigger)
  await guest.screenshot('frosted-menu')
  const frostedMenuPaint = await guest.evaluate(`getComputedStyle(${popup}).backgroundImage`)
  await guest.click(option('民谣'))
  await guest.wait('选择民谣分类后只留下该分类的歌单', `${hasCard('网易云音乐民谣热门测试歌单')} && ${cards}.length === 1`)
  assert.ok(requests.some(request => request.platform === 'netease' && request.first === 'popular' && request.category === '民谣' && request.order === 'hot'))
  assert.equal(await guest.evaluate(`document.activeElement === ${categoryTrigger}`), true)

  await guest.click(categoryTrigger)
  await guest.wait('分类菜单保留已选值', `${option('民谣')}?.getAttribute('aria-selected') === 'true'`)
  await guest.key('Escape')
  await guest.wait('Escape 关闭分类并移回焦点', `!${popup} && document.activeElement === ${categoryTrigger}`)
  await guest.click(reset)
  await guest.wait('重置筛选后恢复热门目录首屏', `${hasPlaylist('netease')} && !(${hasCard('民谣热门测试歌单')})`)

  await guest.click(platformButton('kuwo'))
  await guest.wait('切换到酷我热门歌单', hasPlaylist('kuwo'))
  assert.equal(await guest.evaluate(hasPlaylist('netease')), false)
  assert.equal(requests.some(request => request.api === 'users'), false)
  await guest.wait('酷我分类和排序均可用', `${categoryTrigger}?.disabled === false && ${orderTrigger}?.disabled === false`)
  await guest.screenshot('kuwo-frosted')
  await guest.evaluate(`${orderTrigger}.focus()`)
  await guest.key('End')
  await guest.wait('键盘打开酷我排序并聚焦最新', 'document.activeElement.dataset.choice === "new"')
  await guest.key('Enter')
  await guest.wait('酷我最新排序生效', hasCard('酷我音乐全部最新测试歌单'))
  assert.ok(requests.some(request => request.platform === 'kuwo' && request.first === 'popular' && request.category === null && request.order === 'new'))
  assert.equal(await guest.evaluate(`document.activeElement === ${orderTrigger}`), true)
  await guest.click(categoryTrigger)
  await guest.click(option('392'))
  await guest.wait('酷我分类保留平台固定顺序', `${hasCard('酷我音乐民谣热门测试歌单')} && ${orderTrigger}?.disabled === true`)
  assert.ok(requests.some(request => request.platform === 'kuwo' && request.first === 'popular' && request.category === '392' && request.order === 'hot'))

  await guest.search('迟到')
  await guest.wait('公开搜索期间停用热门歌单筛选', `${categoryTrigger}?.disabled === true && ${orderTrigger}?.disabled === true`)
  for (const end = Date.now() + 8000; !requests.some(request => request.query === '迟到') && Date.now() < end;)
    await delay(50)
  assert.ok(requests.some(request => request.platform === 'kuwo' && request.query === '迟到'))
  await guest.click(platformButton('kugou'))
  await guest.search('雨天')
  slowSearch.resolve()
  const retry = control('重试加载歌单', panel)
  await guest.wait('平台搜索失败显示重试', '!!' + retry)
  await guest.click(retry)
  const match = '酷狗音乐 雨天测试结果'
  await guest.wait('重试显示酷狗搜索结果', hasCard(match))
  assert.equal(await guest.evaluate(hasCard('迟到测试结果')), false)
  assert.equal(requests.filter(request => request.query === '雨天' && request.platform === 'kugou').length, 2)
  assert.equal(requests.some(request => request.query && request.category), false)
  await guest.click(card(match))
  await guest.wait('打开正确平台与 ID 的详情',
    'location.hash === "#/discovery/kugou/81001" && ' + select('[data-panel="discovery"] [data-pl-name]') + '?.textContent.includes("雨天测试结果")')
  await guest.click(control('后退'))
  await guest.wait('返回后保留歌单来源和搜索结果',
    'location.hash.startsWith("#/playlists") && ' + hasCard(match) + ' && document.activeElement === (' + card(match) + ')')
  await guest.click(reset)
  await guest.wait('酷狗显示平台频道', `${hasPlaylist('kugou')} && ${orderTrigger}?.disabled === false && !${categoryTrigger}`)
  await guest.click(orderTrigger)
  await guest.click(option('rising'))
  await guest.wait('酷狗飙升频道查询生效', hasCard('酷狗音乐全部飙升测试歌单'))
  assert.ok(requests.some(request => request.platform === 'kugou' && request.first === 'popular' && request.category === null && request.order === 'rising'))
  console.log('通过游客首页、三平台真实查询条件、键盘与重置、取消旧搜索、失败重试和详情返回')

  const member = await open(900, 620, 'liquid', {
    // 附带旧关联的公开头像，标题栏无需额外发起头像补齐请求。
    netease: { userId: '801', syncedAt: 1, displayName: '网易云账号', avatarUrl: 'https://img.example.test/avatar.png' },
    kuwo: { userId: '907', syncedAt: 2, displayName: '酷我账号' },
  })
  await member.wait('已关联酷我首页热门歌单', homeCards + '.length >= 2')
  assert.deepEqual(await member.evaluate(homeCards), popularIds.kuwo.map(id => 'kuwo:' + id))
  await member.click(more)
  await member.wait('酷我热门歌单第一页', hasPlaylist('kuwo'))
  await member.evaluate(`${list}.scrollTop = ${list}.scrollHeight`)
  await member.wait('窄窗列表末行可滚到', `(() => {
    const viewport = ${list}; const last = ${cards}.at(-1)
    return viewport.scrollTop > 0 && last.getBoundingClientRect().bottom <= viewport.getBoundingClientRect().bottom + 1
  })()`)
  await member.click(control('下一页', panel))
  await member.wait('酷我热门歌单下一页', hasCard('酷我音乐热门歌单 2-1'))
  assert.ok(requests.some(request => request.platform === 'kuwo' && request.first === 'popular' && request.pageNum === 2))
  assert.equal(await member.evaluate('!!' + select('.liquid-win') + ' && ' + noOverflow), true)
  assert.equal(await member.evaluate(hasCard('本地导入样本')), false)
  assert.match(await member.evaluate('document.body.innerText'), /本地导入样本/)
  // 从已核验播放身份模块注入一份公开资料，确认活跃登录优先于较新的公开关联。
  await member.evaluate("(async () => { const session = await import('/src/services/player/playback-session.ts');" +
    "session.playbackAccount.value = { userId: '801', displayName: '网易云验证账号', favorites: false }; })()")
  await member.wait('已核验网易云身份切换默认热门平台', hasPlaylist('netease'))
  await member.click(select('[data-nav="home"]'))
  await member.wait('首页同步网易云账号平台', homeCards + '.every(key => key.startsWith("netease:")) && ' + homeCards + `.length === ${popularIds.netease.length}`)
  await member.click(more)
  await member.wait('更多歌单保留主动登录平台', hasPlaylist('netease', 1))
  await member.wait('窄窗分类可用', `${categoryTrigger}?.disabled === false`)
  await member.click(categoryTrigger)
  await member.wait('窄窗菜单在视口内', `!!${popup} && (() => {
    const { top, right, bottom, left } = ${popup}.getBoundingClientRect()
    return top >= 0 && right <= innerWidth && bottom <= innerHeight && left >= 0
  })()`)
  await member.screenshot('liquid-narrow')
  await member.key('Escape')
  await member.resize(1360, 860)
  assert.equal(await member.evaluate(noOverflow), true)
  await member.screenshot('liquid')
  await member.click(categoryTrigger)
  await member.screenshot('liquid-menu')
  assert.notEqual(await member.evaluate(`getComputedStyle(${popup}).backgroundImage`), frostedMenuPaint)
  await member.key('Escape')
  await member.reduceMotion()
  await member.click(categoryTrigger)
  await member.wait('减少动态效果时分类菜单仍即时可用', `${popup} && parseFloat(getComputedStyle(${popup}).transitionDuration) === 0`)
  await member.key('Escape')
  assert.equal(requests.some(request => request.api === 'users'), false)
  assert.deepEqual(errors, [])
  console.log('通过登录平台优先级、热门歌单分页、排除个人歌单和液态玻璃最小窗口')
} finally {
  slowSearch.resolve()
  if (browser && !browser.killed && browser.exitCode === null && !launchError) {
    await Promise.race([send('Browser.close').catch(() => {}), delay(250)])
    await Promise.race([exited, delay(1200)])
    if (browser.exitCode === null) browser.kill()
  }
  await server?.close()
}
