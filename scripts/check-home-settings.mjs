import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// 使用现有开发服务器和独立 Edge 配置，只在测试浏览器内写入歌单样本。
const origin = 'http://127.0.0.1:' + (process.env.MIRAI_QA_PORT || '1420')
const favoritesTitle = '喜欢的音乐'
const edge =
  process.env.MIRAI_EDGE_EXECUTABLE ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
assert((await fetch(origin)).ok, '需要已运行的 MiraiPlayer 开发服务器')
assert(existsSync(edge), '需要 Microsoft Edge')
const scratch = resolve(import.meta.dirname, '../.tmp')
mkdirSync(scratch, { recursive: true })
const profile = mkdtempSync(join(scratch, 'home-settings-edge-'))
const portFile = join(profile, 'DevToolsActivePort')
const browser = spawn(
  edge,
  [
    '--headless=new',
    '--no-first-run',
    '--mute-audio',
    '--disable-background-networking',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' }
)

// 用实际渲染条件等待异步路由、过渡或控件更新。
async function until(label, condition) {
  for (let attempt = 0; attempt < 180; attempt++) {
    const result = await condition()
    if (result) return result
    await delay(50)
  }
  assert.fail(`超时：${label}`)
}

// 生成只供浏览器测试使用的短 WAV，用实际媒体元素驱动两处频谱。
function spectrumAudio(longLyrics = false) {
  const rate = longLyrics ? 8000 : 16000
  const samples = rate * (longLyrics ? 240 : 12)
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(samples * 2, 40)
  const tones = [94, 135, 220, 380, 660, 1000, 2200, 4200]
  for (let index = 0; index < samples; index++) {
    const time = index / rate
    const value = tones.reduce(
      (sum, tone, band) =>
        sum +
        Math.sin(2 * Math.PI * time * tone) *
          (0.7 + 0.3 * Math.sin(time * (band + 3))),
      0
    )
    wav.writeInt16LE(Math.round(value * 1150), 44 + index * 2)
  }
  return wav
}
const stagePerformance = process.argv.includes('--stage-performance')
const wav = spectrumAudio(stagePerformance)

let releasePlayback
const pendingPlayback = new Promise(resolve => { releasePlayback = resolve })
const requestedQualities = []
// 每日曲单的首曲随本地日期变化，给实际选出的那一首提供测试音源。
let dailyAudioId
let publicFeed = 'partial'
let retryDailyAttempts = 0
let stageAttempts = 0
let heldStageRequest
let heldEqualizerRequest
let delayEqualizer = true
let failStorageOnce = true
let socket
let send
let releasePlaylistResponse
const playlistResponse = new Promise(resolve => {
  releasePlaylistResponse = resolve
})
// 按命令运行完整界面回归或独立加载专项，共用隔离浏览器和样本接口。
async function runBrowserChecks() {
  const port = await until('Edge 调试端口', () => {
    try {
      return readFileSync(portFile, 'utf8').match(/^\d+(?=\r?\n)/)?.[0]
    } catch (error) {
      if (!['ENOENT', 'EBUSY'].includes(error.code)) throw error
      return null
    }
  })
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const tab = tabs.find(item => item.type === 'page')
  assert(tab)
  socket = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((opened, failed) => {
    socket.addEventListener('open', opened, { once: true })
    socket.addEventListener('error', failed, { once: true })
  })
  let sequence = 0
  const pending = new Map()
  const errors = []
  // 故意让一次第二页失败，确保详情和快捷播放均不会使用半份歌单。
  let failPlaylistPage = ''
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(
        message.params.exceptionDetails.exception?.description ||
          message.params.exceptionDetails.text
      )
    if (message.method === 'Fetch.requestPaused') {
      void respondToFixture(message.params).catch(() => {})
    }
    const callback = pending.get(message.id)
    if (!callback) return
    pending.delete(message.id)
    callback(message)
  })
  send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(
        () => reject(new Error(`${method} ${params.url ?? ''} 未返回`)),
        40_000
      )
      pending.set(id, message => {
        clearTimeout(timer)
        if (message.error) reject(new Error(message.error.message))
        else resolve(message.result)
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
  // 只有隔离浏览器的指定样本接口返回数据，其余外部音源请求快速失败。
  async function respondToFixture({ requestId, request }) {
    const path = new URL(request.url).pathname
    if (stagePerformance && path.endsWith('/PlayerFullscreen.vue')) {
      if (!new URL(request.url).searchParams.has('type')) {
        stageAttempts++
        if (stageAttempts === 1) return send('Fetch.failRequest', { requestId, errorReason: 'Failed' })
        if (stageAttempts === 2) {
          heldStageRequest = requestId
          return
        }
      }
      return send('Fetch.continueRequest', { requestId })
    }
    if (path.endsWith('/equalizer-panel.vue') || path.endsWith('/storage-panel.vue')) {
      if (!new URL(request.url).searchParams.has('type')) {
        if (path.endsWith('/equalizer-panel.vue') && delayEqualizer) {
          heldEqualizerRequest = requestId
          return
        }
        if (path.endsWith('/storage-panel.vue') && failStorageOnce) {
          failStorageOnce = false
          return send('Fetch.failRequest', { requestId, errorReason: 'Failed' })
        }
      }
      return send('Fetch.continueRequest', { requestId })
    }
    const headers = [{ name: 'Access-Control-Allow-Origin', value: origin }]
    let data
    if (path === '/v1/forecast' && new URL(request.url).hostname === 'api.open-meteo.com') {
      data = { current_units: { time: 'unixtime', temperature_2m: '°C' },
        current: { time: Math.floor(Date.now() / 1000), temperature_2m: 23, weather_code: 51, is_day: 1 } }
    } else if (path === '/api/v1/netease/auth/recommendations/daily') {
      headers.push({ name: 'Access-Control-Allow-Headers', value: 'Authorization' })
      if (request.method === 'OPTIONS') return send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: headers })
      const token = request.headers.Authorization ?? request.headers.authorization
      const retryAccount = token === 'Bearer ' + 'c'.repeat(43)
      if (retryAccount && retryDailyAttempts++ === 0)
        return send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: headers })
      const accountId = Object.entries({ a: '11', b: '22', c: '33', d: '44' })
        .find(([key]) => token === 'Bearer ' + key.repeat(43))?.[1]
      if (!accountId) return send('Fetch.fulfillRequest', { requestId, responseCode: 401, responseHeaders: headers })
      const order = accountId === '44' ? [] : accountId === '22' ? Array.from({ length: 36 }, (_, index) => 36 - index) : [2, 1]
      data = order.map(i => ({ platform: 'netease', id: accountId + i, title: '账号' + accountId + '推荐' + i,
        artists: ['歌手 ' + (i % 4 + 1)], album: '专辑 ' + (i % 3 + 1),
        coverUrl: origin + '/images/' + ['featured-singer.webp', 'ginkgo-station.webp', 'featured-soundwing.webp'][i % 3],
        durationMs: 90000 + i * 1000, sourceUrl: '' }))
    } else if (path === '/mirai-avatar-fixture.svg') {
      return send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }],
        body: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#e59173"/></svg>'
        ).toString('base64'),
      })
    } else if (/\/playlists\/(3779629|9095716|1082685104|3778678|9183003|2952464073)$/.test(path)) {
      if (process.argv.includes('--live-discovery')) return send('Fetch.continueRequest', { requestId })
      const [, , , platform, , id] = path.split('/')
      if (publicFeed === 'offline' || publicFeed === 'partial' && platform === 'kuwo')
        return send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: headers, body: '' })
      const params = new URL(request.url).searchParams
      const pageSize = Number(params.get('pageSize'))
      const pageNum = Number(params.get('pageNum'))
      const total = { netease: 137, kugou: 126, kuwo: 111 }[platform]
      if (pageNum === 2 && failPlaylistPage === platform) {
        failPlaylistPage = ''
        return send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: headers, body: '' })
      }
      const offset = (pageNum - 1) * pageSize
      data = { platform, id, title: platform + ' ' + id, pageNum, pageSize, total: platform === 'kuwo' ? null : total, coverUrl: null,
        tracks: Array.from({length: Math.max(0, Math.min(pageSize, total - offset))}, (_, position) => position + offset)
          .map(i => ({platform, id: id + i, title: platform + id + i, artists: [platform],
          album: '公开专辑', durationMs: 120000, sourceUrl: '', coverUrl: null})) }
    } else if (path === '/api/v1/netease/users/123/playlists') {
      data = {
        platform: 'netease',
        userId: '123',
        displayName: '验证账号',
        avatarUrl: 'http://p1.music.126.net/mirai-avatar-fixture.svg',
        pageNum: 1,
        pageSize: 20,
        hasMore: false,
        playlists: Array.from({ length: 10 }, (_, index) => ({
          id: String(101 + index),
          title: index === 0 ? favoritesTitle : `歌单 ${index + 1}`,
          coverUrl: null,
          trackCount: 0,
        })),
      }
    } else if (path === '/api/v1/netease/playlists/101') {
      await playlistResponse
      data = {
        platform: 'netease',
        id: '101',
        title: favoritesTitle,
        coverUrl: null,
        sourceUrl: 'https://music.163.com/playlist?id=101',
        pageNum: 1,
        pageSize: 100,
        total: 0,
        tracks: [],
      }
    } else if (['1', dailyAudioId].some(id => path === `/api/v1/netease/tracks/${id}/playback`)) {
      requestedQualities.push(new URL(request.url).searchParams.get('quality'))
      await pendingPlayback
      data = {
        status: 'full',
        url: new URL('audio', request.url).href,
      }
    } else if (/^\/api\/v1\/netease\/tracks\/\d+\/playback$/.test(path)) {
      data = { status: 'unavailable', url: null }
    } else if (['1', dailyAudioId].some(id => path === `/api/v1/netease/tracks/${id}/lyrics`)) {
      data = {
        lrc: '[00:00.00]街灯落在静水上\n[00:04.00]夜色穿过城市\n[00:08.00]The sky opens up again',
        translatedLrc:
          '[00:00.00]Streetlights settle on the still water\n[00:04.00]Evening moves through the city',
        yrc: '[0,3800](0,800,0)街灯(800,1200,0)落在(2000,1800,0)静水上\n[4000,3800](4000,1000,0)夜色(5000,1000,0)穿过(6000,1800,0)城市',
        ytlrc:
          '[0,3800](0,600,0)Streetlights (600,1500,0)settle on (2200,1500,0)the still water\n[00:04.00]Evening moves through the city',
      }
    } else if (['1', dailyAudioId].some(id => path === `/api/v1/netease/tracks/${id}/audio`)) {
      const range = Object.entries(request.headers).find(
        ([name]) => name.toLowerCase() === 'range'
      )?.[1]
      const requested = /^bytes=(\d+)-(\d*)$/.exec(range || '')
      const start = Number(requested?.[1] ?? 0)
      const end = Math.min(
        requested?.[2] ? Number(requested[2]) : wav.length - 1,
        wav.length - 1
      )
      return send('Fetch.fulfillRequest', {
        requestId,
        responseCode: requested ? 206 : 200,
        responseHeaders: [
          ...headers,
          { name: 'Content-Type', value: 'audio/wav' },
          { name: 'Accept-Ranges', value: 'bytes' },
          { name: 'Content-Length', value: String(end - start + 1) },
          ...(requested
            ? [
                {
                  name: 'Content-Range',
                  value: `bytes ${start}-${end}/${wav.length}`,
                },
              ]
            : []),
        ],
        body: wav.subarray(start, end + 1).toString('base64'),
      })
    }
    if (stagePerformance && path === '/api/v1/netease/tracks/1/lyrics') {
      data = {
        lrc: '', translatedLrc: '',
        yrc: Array.from({ length: 480 }, (_, i) => {
          const start = i * 500
          const extra = i > 12 && i % 7 === 0 ? ' 长句在窄窗中自然换行'.repeat(5) : ''
          return `[${start},500](${start},200,0)第(${start + 200},300,0)${i}句${extra}`
        }).join('\n'),
        ytlrc: Array.from({ length: 240 }, (_, i) => {
          const seconds = i % 60
          return `[${Math.floor(i / 60)}:${String(seconds).padStart(2, '0')}.00]Translation for line ${i * 2}`
        }).join('\n'),
      }
    }
    if (!data) {
      return send('Fetch.failRequest', { requestId, errorReason: 'Failed' })
    }
    return send('Fetch.fulfillRequest', {
      requestId,
      responseCode: 200,
      responseHeaders: [
        ...headers,
        { name: 'Content-Type', value: 'application/json' },
      ],
      body: Buffer.from(JSON.stringify(data)).toString('base64'),
    })
  }
  // 从浏览器读取页面状态和实际布局。
  async function evaluate(expression, userGesture = false) {
    const response = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture,
    })
    assert(
      !response.exceptionDetails,
      response.exceptionDetails?.exception?.description
    )
    return response.result.value
  }
  // 通过浏览器键盘事件触发原生按钮、滚动和滑杆。
  async function key(name, code) {
    const event = { key: name, code: name, windowsVirtualKeyCode: code }
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      ...event,
      ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
    })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
  }
  // 测试默认尺寸和原生设置窗允许的最小尺寸。
  async function resize(width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      mobile: false,
      deviceScaleFactor: 1,
    })
  }
  // 超时时保留浏览器异常，让加载失败与交互断言可以分别定位。
  const waitFor = (label, expression) => until(label, () => evaluate(expression)).catch(error => {
    if (errors.length) throw new Error(errors.join('\n'), { cause: error })
    throw error
  })
  const panelLoaded = name => `performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname.endsWith('/${name}-panel.vue'))`

  // 验证通用设置的加载边界、慢请求切换与重新进入。
  async function checkDeferredEqualizer() {
    assert.equal(await evaluate(panelLoaded('equalizer')), false)
    assert.equal(await evaluate(panelLoaded('storage')), false)
    await evaluate(`document.querySelector('[data-slide-value="audio"]').click()`)
    await until('拦截首次均衡器模块', () => heldEqualizerRequest)
    await waitFor('慢加载期间反馈', `document.querySelector('main [role="status"]')?.textContent.includes('正在加载设置')`)
    await evaluate(`document.querySelector('[data-slide-value="general"]').click()`)
    await waitFor('回到通用设置', `document.querySelector('[data-panel="settings"]')?.textContent.includes('关闭主窗口') && !document.querySelector('main [role="status"]')`)
    delayEqualizer = false
    await send('Fetch.continueRequest', { requestId: heldEqualizerRequest })
    await waitFor('迟到的模块已返回', panelLoaded('equalizer'))
    assert.equal(await evaluate(`document.querySelectorAll('.eq-band').length`), 0)
    await evaluate(`document.querySelector('[data-slide-value="audio"]').click()`)
    await waitFor('十频段', `document.querySelectorAll('.eq-band').length === 10`)
    assert.equal(await evaluate(panelLoaded('equalizer')), true)
    assert.equal(await evaluate(panelLoaded('storage')), false)
  }

  // 在独立浏览器拦截一次模块，验证错误反馈与重试。
  async function checkDeferredStorage() {
    await evaluate(`document.querySelector('[data-slide-value="storage"]').click()`)
    const retryPanel = `[...document.querySelectorAll('main button')].find(button => button.textContent.trim() === '重新加载')`
    await waitFor('存储模块读取失败后可重试', `!!(${retryPanel})`)
    await evaluate(`(${retryPanel}).click()`)
    await waitFor('存储重试后就绪', `!!document.querySelector('#cache-directory')`)
    assert.equal(await evaluate(panelLoaded('storage')), true)
  }

  // 向隔离浏览器注册独立专辑和歌手，并设置一条 777 首的队列。
  async function seedLargeLibrary() {
    await evaluate(`(async () => {
      const {usePlayerStore} = await import('/src/stores/player.ts')
      const store = usePlayerStore()
      window.fixturePlayer = store
      store.state.queue = store.registerCatalogTracks(Array.from({ length: 777 }, (_, i) => ({
        platform: 'netease', id: String(10000+i), title: '队列 ' + i, artists: ['样本 ' + i], album: '队列验证 ' + i,
        durationMs: 120000, coverUrl: null, sourceUrl: 'https://music.163.com/song?id=' + (10000+i)
      })))
      store.state.idx = store.state.queue[420]
    })()`)
  }

  // 验证长队列的可见行数、键盘、拖放与关闭后的焦点。
  async function checkVirtualQueue() {
    const queueButton = `document.querySelector('.win-bottom button[aria-label="播放队列"]')`
    const queue = `document.querySelector('.main-queue')`
    await evaluate(`${queueButton}.click()`)
    await waitFor('长队列打开并定位当前歌曲', `${queue}?.querySelector('[aria-current=true]')?.dataset.qpos === '420'`)
    const mountedRows = await evaluate(`${queue}.querySelectorAll('.qrow').length`)
    assert(mountedRows > 0 && mountedRows < 35, String(mountedRows))
    const current = `${queue}.querySelector('[aria-current=true]')`
    const neighbour = `${queue}.querySelector('[data-qpos="419"]')`
    // 在两个材质下实际悬停相邻行，比较播放行底色，并确认只有当前曲目显示三条指示。
    for (const material of ['glass', 'liquid']) {
      await evaluate(`fixturePlayer.state.settings.glassStyle = '${material}'`)
      await evaluate(`${neighbour}.scrollIntoView({ block: 'nearest' })`)
      await waitFor('队列展开过渡完成', `!${queue}.getAnimations().length`)
      const point = await evaluate(`(() => {
        const rect = ${neighbour}.getBoundingClientRect()
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      })()`)
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
      await waitFor(material + ' 队列高亮与悬停一致', `(() => {
        const active = getComputedStyle(${current}), hover = getComputedStyle(${neighbour})
        return ${neighbour}.matches(':hover') && active.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
          active.backgroundColor === hover.backgroundColor && active.backgroundImage === 'none' &&
          active.boxShadow === 'none' && active.outlineStyle === 'none' &&
          ${current}.querySelectorAll('.bars i').length === 3 && !${neighbour}.querySelector('.bars i')
      })()`)
    }
    await key('End', 35)
    await waitFor('虚拟队列定位末行', `document.activeElement?.dataset.qpos === '776'`)
    await evaluate(`(() => {
      const before = ${queue}.querySelector('[data-qpos="775"]'), after = ${queue}.querySelector('[data-qpos="776"]')
      const dataTransfer = new DataTransfer()
      before.dispatchEvent(new DragEvent('dragstart',{bubbles:true, dataTransfer}))
      const options = {bubbles:true,cancelable:true,dataTransfer,clientY:after.getBoundingClientRect().bottom-1}
      after.dispatchEvent(new DragEvent('dragover',options))
      after.dispatchEvent(new DragEvent('drop',options))
    })()`)
    await waitFor('拖放按绝对位置移动', `${queue}.querySelector('[data-qpos="776"] .qt b').textContent === '队列 775'`)
    assert(await evaluate(`[...${queue}.querySelectorAll('img')].every(img => img.loading === 'lazy' && img.decoding === 'async')`))
    await key('Escape', 27)
    await waitFor('关闭队列恢复焦点', `!${queue} && document.activeElement === ${queueButton}`)
    return mountedRows
  }

  // 验证播放进度的五秒保存粒度与关闭时的精确位置。
  async function checkSavedProgress() {
    // 在暂停状态模拟媒体时间更新，区分同一五秒区间、跨区间与退出前的精确保存。
    const savedTime = `JSON.parse(localStorage.getItem('miraiMusic.preferences.v1'))?.current?.time`
    await evaluate('fixturePlayer.state.t = 70')
    await waitFor('进度进入新区间后保存', `${savedTime} === 70`)
    await evaluate('fixturePlayer.state.t = 71.25')
    await delay(1600)
    assert.equal(await evaluate(savedTime), 70)
    await evaluate('fixturePlayer.state.t = 75')
    await waitFor('五秒区间更新', `${savedTime} === 75`)
    await evaluate(`fixturePlayer.state.t = 76.5; window.dispatchEvent(new Event('pagehide'))`)
    assert.equal(await evaluate(savedTime), 76.5)
  }

  // 验证两种玻璃材质、响应式列数及虚拟卡片的绝对位置。
  async function checkCollectionGrids() {
    // 同一批曲库数据覆盖两种材质和列数，核对滚动末端的真实详情索引。
    for (const [page, kind, material] of [['albums', 'album', 'glass'], ['artists', 'artist', 'liquid']]) {
      await resize(1240, 820)
      await evaluate(`fixturePlayer.state.settings.glassStyle = '${material}'; location.hash = '#/${page}'`)
      const grid = `document.querySelector('[data-panel="${page}"].active .collection-viewport')`
      const cards = `${grid}.querySelectorAll('[data-position]')`
      await waitFor(page, `${grid}?.querySelector('[data-position="0"]')`)
      assert.deepEqual(await evaluate(`(() => {
        const style = getComputedStyle(${grid})
        return [style.colorScheme, style.scrollbarWidth, style.scrollbarColor, style.scrollbarGutter]
      })()`), ['dark', 'thin', 'rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0)', 'stable'])
      const count = await evaluate(`${cards}.length`)
      assert(count > 0 && count < 60)
      await evaluate(`${cards}[0].focus()`)
      const lastTitle = kind === 'album' ? '队列验证 776' : '样本 776'
      for (let jump = 0; jump < 4; jump++) {
        await key('End', 35)
        await waitFor('末行键盘焦点', `document.activeElement.matches('button[data-position]') && document.activeElement.querySelector('b')?.textContent === '${lastTitle}'`)
        await key('Home', 36)
        await waitFor('首张卡片', `document.activeElement.dataset.position === '0'`)
      }
      await resize(620, 740)
      await waitFor('窄窗重新分列', `getComputedStyle(${grid}.firstElementChild).gridTemplateColumns.split(' ').length === 2`)
      await key('ArrowDown', 40)
      await waitFor('两列网格的下一行', `document.activeElement.dataset.position === '2'`)
      await evaluate(`${grid}.scrollTop = ${grid}.scrollHeight`)
      await waitFor('滚动到末行并保留原焦点', `[...${cards}].at(-1).querySelector('b').textContent === '${lastTitle}' && document.activeElement.dataset.position === '2'`)
      assert(await evaluate(`Math.abs([...${cards}].at(-1).getBoundingClientRect().bottom - ${grid}.getBoundingClientRect().bottom) < 2`))
      assert(await evaluate(`[...${cards}].every(card => card.querySelector('img').loading === 'lazy')`))
      await evaluate(`[...${cards}].at(-1).click()`)
      await waitFor('实际曲库索引', `location.hash.startsWith('#/${kind}?') && fixturePlayer.tracks[fixturePlayer.state.playlistIdx]['${kind}'] === '${lastTitle}'`)
      await resize(1240, 820)
      const detail = `document.querySelector('[data-panel="${kind}"].active')`
      const toggle = "document.querySelector('.win-body > .np-toggle')"
      // 展开与收起面板时都测量实际中心线，保证导航、按钮和资料区互不挤占。
      for (let cycle = 0; cycle < 2; cycle++) {
        await waitFor(kind + ' 顶栏对齐', `(() => {
          const tabs = ${detail}?.querySelector('.pg-tabs')?.getBoundingClientRect()
          const head = ${detail}?.querySelector('.pl-head')?.getBoundingClientRect()
          const button = ${toggle}.getBoundingClientRect()
          return tabs && head && button.height > 0 && tabs.right < button.left &&
            Math.abs(tabs.top + tabs.height / 2 - button.top - button.height / 2) < 1 &&
            head.top - tabs.bottom >= 15
        })()`)
        const before = await evaluate(`${toggle}.getAttribute('aria-expanded')`)
        await evaluate(`${toggle}.click()`)
        await waitFor('面板切换', `${toggle}.getAttribute('aria-expanded') !== '${before}'`)
      }
      console.log(`PASS ${page} 宽窗挂载 ${count} 张卡片，窄窗首末行、焦点和详情入口正常`)
    }
    await resize(1240, 820)
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Fetch.enable', {
    patterns: [
      { urlPattern: '*/api/v1/*' },
      { urlPattern: '*/components/equalizer-panel.vue*' },
      { urlPattern: '*/components/storage-panel.vue*' },
      ...(stagePerformance ? [{ urlPattern: '*/player/PlayerFullscreen.vue*' }] : []),
      { urlPattern: 'https://api.open-meteo.com/*' },
      { urlPattern: '*/*missing-banner-cover.webp' },
      { urlPattern: 'https://p1.music.126.net/mirai-avatar-fixture.svg' },
    ],
  })
  await resize(1240, 820)
  await send('Browser.grantPermissions', { permissions: ['geolocation'], origin })
  await send('Emulation.setGeolocationOverride', { latitude: 30.29365, longitude: 120.16142, accuracy: 50 })
  await send('Page.navigate', { url: origin })
  if (process.argv.includes('--about')) {
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
    await send('Page.navigate', { url: origin + '/#/settings' })
    await resize(760, 520)
    for (const [setting, material] of [['frosted', 'glass-win'], ['liquid', 'liquid-win']]) {
      await waitFor('外观设置入口', "!!document.querySelector('[data-slide-value=appearance]')")
      await evaluate("document.querySelector('[data-slide-value=appearance]').click()")
      await waitFor('玻璃材质选项', `!!document.querySelector('[data-slide-value="${setting}"]')`)
      await evaluate(`document.querySelector('[data-slide-value="${setting}"]').click()`)
      await evaluate("document.querySelector('[data-slide-value=about]').focus()")
      await key('Enter', 13)
      const card = `document.querySelector('.${material} .about-val')`
      await waitFor('关于页显示当前发行版本', `${card}?.textContent.trim() === ${JSON.stringify('v' + pkg.version)}`)
      const link = await evaluate(`(() => {
        const node = ${card}.closest('.set-card').querySelector('a')
        node.focus()
        const rect = node.getBoundingClientRect()
        return [node.href, node === document.activeElement, rect.left >= 0 && rect.right <= innerWidth]
      })()`)
      assert.deepEqual(link, [pkg.homepage, true, true])
      console.log('PASS ' + material + ' 关于页版本、项目链接及键盘焦点')
    }
    assert.deepEqual(errors, [])
    return
  }
  // 记录匿名首页在两种材质下的真实布局，覆盖横幅、发现歌单和选听区域。
  async function captureHomeLayout() {
    await resize(1540, 960)
    await evaluate("document.fonts.ready.then(() => true)")
    const drawer = "document.querySelector('[data-np-toggle]')"
    const wasExpanded = await evaluate(`${drawer}.getAttribute('aria-expanded') === 'true'`)
    if (wasExpanded) await evaluate(`${drawer}.click()`)
    await waitFor('首页侧栏收起完成', "parseFloat(getComputedStyle(document.querySelector('.win-body')).gridTemplateColumns.split(' ').at(-1)) === 0")
    for (const style of ['glass', 'liquid']) {
      await evaluate(`(async () => { (await import('/src/stores/player.ts')).usePlayerStore().state.settings.glassStyle = '${style}' })()`)
      await waitFor('首页材质 ' + style, `document.querySelector('.${style}-win .home-artists .artist-pick') &&
        document.querySelector('.home-content').firstElementChild.matches('[data-banner]')`)
      const clip = await evaluate(`(() => {
        const r = document.querySelector('.main').getBoundingClientRect()
        return { x: r.left, y: r.top, width: r.width, height: r.height, scale: 1 }
      })()`)
      const capture = await send('Page.captureScreenshot', { format: 'png', clip })
      const path = join(profile, 'home-' + style + '.png')
      writeFileSync(path, Buffer.from(capture.data, 'base64'))
      console.log(path)
    }
    if (wasExpanded) {
      await evaluate(`${drawer}.click()`)
      await waitFor('恢复右栏实际宽度', "parseFloat(getComputedStyle(document.querySelector('.win-body')).gridTemplateColumns.split(' ').at(-1)) === 296")
    }
    await resize(1240, 820)
  }
  if (process.argv.includes('--live-discovery')) {
    await waitFor('匿名首页开始渲染', "!!document.querySelector('.home-content')")
    const titles = await evaluate(`(async () => {
      const section = document.querySelector('#home-recommend-albums')
      for (let i = 0; i < 300 && !section?.querySelector('.feat, .recommend-link'); i++)
        await new Promise(resolve => setTimeout(resolve, 100))
      return [...document.querySelectorAll('#home-recommend-albums .feat')].map(card => card.title)
    })()`)
    assert.equal(titles.length, 6, JSON.stringify(titles))
    for (const platform of ['网易云音乐', '酷狗音乐', '酷我音乐']) assert(titles.some(title => title.includes(platform)))
    if (process.argv.includes('--screenshots')) await captureHomeLayout()
    if (process.argv.includes('--full-playlists')) {
      for (const [platform, id] of [['netease','3779629'], ['kugou','9095716'], ['kuwo','1082685104']]) {
        const card = `document.querySelector('[data-card-key="${platform}:${id}"]')`
        await evaluate(`${card}.click()`)
        let count = 0
        for (let attempt = 0; attempt < 120 && !count; attempt++) {
          count = await evaluate("document.querySelector('[data-panel=discovery] [data-vue-tracklist]') ? Number(document.querySelector('[data-panel=discovery] [data-pl-meta]').textContent.match(/[0-9]+/)[0]) : 0")
          if (!count) await delay(500)
        }
        assert(count > 12, platform + ' 实际完整歌单应超过首页预览')
        console.log('PASS 实际读取 ' + platform + ' 歌单 ' + id + '，共 ' + count + ' 首')
        await evaluate("document.querySelector('[data-nav-back]').click()")
        await waitFor('回到发现歌单', `!!${card}`)
      }
    }
    console.log('PASS 匿名浏览器实际读取三平台六份公开歌单')
    return
  }
  if (process.argv.includes('--playlist-order')) {
    const lists = 'miraiMusic.publicPlaylists.v1'
    const sidebarIds = "Array.from(document.querySelectorAll('.plist[data-custom]'), item => item.dataset.custom).join(',')"
    await waitFor('侧栏已挂载', "!!document.querySelector('[data-sidebar-lists]')")
    await evaluate(`localStorage.setItem('${lists}', JSON.stringify(['102','103','101'].map(id => ({
      platform: 'netease', id, title: id === '101' ? '喜欢的音乐' : '歌单 ' + id, tracks: []
    })))); localStorage.setItem('miraiMusic.publicPlatformProfiles.v1', JSON.stringify({
      netease: { userId: '123', displayName: '验证账号', syncedAt: Date.now() }
    })); location.hash = '#/connect'`)
    await send('Page.reload')
    const button = "document.querySelector('[data-plat-card=netease] .plat-btn')"
    await waitFor('加载旧歌单顺序', `${sidebarIds} === 'netease:102,netease:103,netease:101' && ${button}?.textContent.includes('查看歌单')`)
    await evaluate(`${button}.click()`)
    await waitFor('读取来源列表自动校正已导入歌单位置', `${sidebarIds} === 'netease:101,netease:102,netease:103'`)
    await send('Page.reload')
    await waitFor('重启恢复同一侧栏顺序', `${sidebarIds} === 'netease:101,netease:102,netease:103'`)
    assert.deepEqual(errors, [])
    console.log('PASS 真实侧栏从旧顺序校正到来源顺序，刷新后保持且没有重复歌单')
    return
  }
  if (process.argv.includes('--island-position')) {
    const island = "document.querySelector('.lyric-capsule')"
    await waitFor('灵动岛已显示', `${island}?.clientHeight > 0`).catch(async error => {
      assert.fail(JSON.stringify({ error: error.message, errors, page: await evaluate('document.body.innerText.slice(0, 400)') }))
    })
    const center = `(() => {
      const rect = ${island}.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })()`
    await waitFor('首页加载后胶囊能接收指针', `(() => {
      const element = ${island}, point = ${center}
      return document.querySelector('.home-content .feat') && document.fonts.status === 'loaded' &&
        element.contains(document.elementFromPoint(point.x, point.y))
    })()`)
    const initial = await evaluate(center)
    const moved = { x: initial.x - 172, y: initial.y - 264 }
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...initial })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, ...moved })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...moved })
    await waitFor('拖动落点保存', "!!localStorage.getItem('miraiMusic.lyricIsland.center.v1')")
    assert.equal(await evaluate(`getComputedStyle(${island}).outlineStyle`), 'none')
    const saved = await evaluate(center)
    assert(Math.hypot(saved.x - moved.x, saved.y - moved.y) < 2)
    await send('Page.navigate', { url: origin + '/?island-position-reload' })
    await waitFor('重新挂载后回到拖动位置', `${island} && Math.hypot(${center}.x - ${saved.x}, ${center}.y - ${saved.y}) < 2`)
    await resize(620, 540)
    await waitFor('小窗内保持可见', `(() => {
      const r = ${island}.getBoundingClientRect()
      return innerWidth === 620 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
    })()`)
    await resize(1240, 820)
    await waitFor('恢复窗口大小后回到原位', `Math.hypot(${center}.x - ${saved.x}, ${center}.y - ${saved.y}) < 2`)
    console.log('PASS 歌词灵动岛真实拖动、刷新和窗口缩放恢复')
    const cover = `${island}.querySelector('img')`
    const art = '/images/featured-singer.webp'
    const broken = 'data:image/png;base64,AA=='
    await evaluate(`(async () => {
      window.fixturePlayer = (await import('/src/stores/player.ts')).usePlayerStore()
      window.islandTracks = fixturePlayer.registerCatalogTracks([${JSON.stringify(art)}, ${JSON.stringify(broken)}].map((coverUrl, i) => ({
        platform: 'netease', id: String(i + 1), title: '灵动岛测试 ' + i, artists: ['样本歌手'], album: '',
        durationMs: 60000, sourceUrl: '', coverUrl
      })))
      fixturePlayer.state.idx = islandTracks[0]
      fixturePlayer.state.queue = islandTracks.slice()
    })()`)
    await resize(620, 540)
    const panel = "document.querySelector('#island-player')"
    const control = label => `${panel}.querySelector('[aria-label="${label}"]')`
    for (const material of ['glass', 'liquid']) {
      await evaluate(`fixturePlayer.state.settings.glassStyle = '${material}'; fixturePlayer.state.capsuleLyric = '长句歌词'.repeat(40)`)
      await waitFor(material + ' 封面与长句并排', `(() => {
        const img = ${cover}, line = ${island}.querySelector('[data-capsule-text]')
        return !!${island}.closest('.${material}-win') && img?.naturalWidth > 0 && getComputedStyle(img).opacity === '1' &&
          img.clientWidth === 26 && line.scrollWidth > line.clientWidth && ${island}.scrollWidth <= ${island}.clientWidth
      })()`)
      await evaluate(`${island}.click()`)
      await waitFor(material + ' 就地展开并位于窗口内', `(() => {
        const player = ${panel}, rect = player?.getBoundingClientRect()
        return rect && !fixturePlayer.state.stage && !player.getAnimations().length &&
          rect.width === 320 && rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight &&
          getComputedStyle(player).backdropFilter.includes('${material === 'liquid' ? '14px' : '16px'}')
      })()`)
      await key('Escape', 27)
      await waitFor('收起后恢复胶囊焦点', `!${panel} && document.activeElement === ${island}`)
    }
    await evaluate('fixturePlayer.state.idx = islandTracks[1]')
    await waitFor('坏图露出同尺寸本地音符', `(() => {
      const img = ${cover}
      return img?.getAttribute('src') === ${JSON.stringify(broken)} && img.complete && !img.naturalWidth &&
        getComputedStyle(img).opacity === '0' && getComputedStyle(img.parentElement).backgroundImage.includes('music-placeholder.svg')
    })()`)
    await evaluate('fixturePlayer.state.idx = islandTracks[0]')
    await waitFor('切回歌曲重新显示封面', `${cover}?.naturalWidth > 0 && getComputedStyle(${cover}).opacity === '1'`)
    await evaluate('fixturePlayer.state.settings.motion = false')
    await waitFor('关闭动效后封面静态显示', `getComputedStyle(${cover}).transitionDuration === '0s'`)
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await evaluate('fixturePlayer.state.settings.motion = true')
    await waitFor('系统减少动态效果时封面静态显示', `getComputedStyle(${cover}).transitionDuration === '0s'`)
    await evaluate(`${island}.focus()`)
    await key('Enter', 13)
    await waitFor('键盘打开迷你播放器', `document.activeElement === ${control('收起灵动岛')}`)
    await evaluate(`${control('播放')}.click()`, true)
    await waitFor('迷你播放器显示取源等待', `${control('取消加载')}?.getAttribute('aria-busy') === 'true'`)
    await evaluate(`${control('取消加载')}.click()`)
    await waitFor('取消后恢复播放按钮', `!!${control('播放')}`)
    releasePlayback()
    await evaluate(`${control('播放')}.click()`, true)
    await waitFor('主播放器实际开始播放样本音频', `!!${control('暂停')} && document.querySelector('audio').currentTime > 0`)
    await evaluate(`${control('暂停')}.click()`)
    await waitFor('共享音频暂停', "document.querySelector('audio').paused")
    await evaluate(`${control('播放进度')}.value = 5; ${control('播放进度')}.dispatchEvent(new Event('input'))`)
    await waitFor('定位更新真实音频', "Math.abs(document.querySelector('audio').currentTime - 5) < 0.25")
    await evaluate(`${control('下一首')}.click()`)
    await waitFor('面板跟随队列换曲', `${panel}.querySelector('strong').textContent === '灵动岛测试 1'`)
    await evaluate(`${control('上一首')}.click()`)
    await waitFor('返回上一首', `${panel}.querySelector('strong').textContent === '灵动岛测试 0'`)
    await evaluate(`${control('打开全屏播放')}.click()`)
    await waitFor('从灵动岛键盘打开全屏', 'fixturePlayer.state.stage === true')
    await key('Escape', 27)
    await waitFor('退出全屏恢复胶囊焦点', `!fixturePlayer.state.stage && document.activeElement === ${island}`)

    // 在独立小窗的实际路由用 Tauri 事件模拟器投递播放快照。
    await resize(384, 104)
    await evaluate(`(async () => {
      const { mockIPC, mockWindows } = await import('/node_modules/@tauri-apps/api/mocks.js')
      mockWindows('island')
      window.islandCalls = []
      const screenBounds = {position: {x: -1920, y: -1080}, size: {width: 1920, height: 1080}}
      window.dragMonitor = {name: '模拟副屏', scaleFactor: 1.5, ...screenBounds, workArea: screenBounds}
      mockIPC((cmd, args) => {
        if (cmd === 'plugin:window|cursor_position') return window.dragCursor
        if (cmd === 'plugin:window|monitor_from_point') return window.dragMonitor
        if (cmd === 'plugin:window|outer_position') return { x: 12, y: 640 }
        if (cmd === 'plugin:window|current_monitor') return {
          scaleFactor: 1, position: { x: 0, y: 0 }, size: { width: 1280, height: 768 },
          workArea: { position: { x: 0, y: 0 }, size: { width: 1280, height: 720 } }
        }
        if (cmd === 'plugin:window|set_size') islandCalls.push(['height', args.value.size.height])
        if (cmd === 'plugin:window|set_position') islandCalls.push(['top', args.value.position.y, args.value.position.x])
      }, { shouldMockEvents: true })
      window.isTauri = true
      location.hash = '#/desktop/island'
    })()`)
    await waitFor('独立灵动岛等待快照', "document.body.classList.contains('desktop-island')")
    await evaluate(`window.__TAURI_INTERNALS__.invoke('plugin:event|emit', { event: 'player-snapshot', payload: {
      track: { title: '长歌名'.repeat(50), artist: '桌面歌手', cover: ${JSON.stringify(art)}, dur: 210 },
      playing: false, playable: true, time: 65, motion: false
    } })`)
    await waitFor('桌面封面、拖动区和返回按钮共用固定尺寸', `(() => {
      const surface = document.querySelector('.island-surface'), img = surface?.querySelector('img')
      const line = surface?.querySelector('[title]')
      if (!img?.naturalWidth || getComputedStyle(img).opacity !== '1') return false
      const {width, height} = surface.getBoundingClientRect(), rect = img.getBoundingClientRect()
      const trigger = surface.querySelector('.island-trigger')
      return width === 320 && height === 40 && line.scrollWidth > line.clientWidth && Math.abs(rect.width - 26) < .1 &&
        document.elementFromPoint(rect.x + 13, rect.y + 13) === trigger &&
        document.elementFromPoint(trigger.getBoundingClientRect().right - 14, rect.y + 13) === trigger
    })()`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: 333, y: 52 })
    const surfaceOutline = "getComputedStyle(document.querySelector('.island-surface')).outlineStyle"
    assert.equal(await evaluate(surfaceOutline), 'none')
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: 333, y: 52 })
    await waitFor('贴底桌面小窗请求腾出空间', "islandCalls.some(call => call[0] === 'height' && call[1] === 222)")
    await resize(384, 222)
    assert.deepEqual(await evaluate('islandCalls.slice(0, 2)'), [['height', 222], ['top', 530, 12]])
    await waitFor('桌面小窗播放信息来自同一快照', `${control('播放进度')}.value === '65' && ${panel}.offsetHeight === 158`)
    assert.equal(await evaluate(`getComputedStyle(${control('收起灵动岛')}).outlineStyle`), 'none')
    const closePoint = await evaluate(`(() => {
      const rect = ${control('收起灵动岛')}.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })()`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...closePoint })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...closePoint })
    await waitFor('鼠标收起后胶囊没有白圈', `document.activeElement.matches('.island-trigger') && ${surfaceOutline} === 'none' && islandCalls.at(-1)?.[1] === 104`)
    await key('Enter', 13)
    await waitFor('仍可用键盘打开桌面胶囊', `document.activeElement === ${control('收起灵动岛')} && ${panel}.offsetHeight === 158`)
    await key('Escape', 27)
    await waitFor('桌面小窗收起并恢复原始落点', "islandCalls.at(-2)?.[1] === 640 && islandCalls.at(-1)?.[1] === 104")
    await waitFor('键盘收起后可见焦点', `${surfaceOutline} === 'solid' && document.activeElement.matches('.island-trigger')`)
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    await evaluate(`window.__TAURI_INTERNALS__.invoke('plugin:event|emit', { event: 'player-snapshot', payload: {
      track: { title: '连续开合', cover: ${JSON.stringify(art)}, dur: 210 }, motion: true, playing: false, time: 65
    } })`)
    await waitFor('系统与窗口均启用灵动岛动效', "document.querySelector('.island-surface')?.classList.contains('animated')")
    const samples = await evaluate(`(async () => {
      const shell = document.querySelector('.island-surface'), cover = shell.querySelector('img')
      const trigger = shell.querySelector('.island-trigger'), close = shell.querySelector('[aria-label="收起灵动岛"]')
      const frames = []
      trigger.click()
      for (const target of [true, false, true, false]) {
        if (!target) close.click()
        else if (frames.length) trigger.click()
        const start = performance.now(), span = frames.length < 2 ? 100 : 340
        const phase = []
        do {
          await new Promise(requestAnimationFrame)
          phase.push([shell.offsetHeight, cover.getBoundingClientRect().width])
        } while (performance.now() - start < span)
        frames.push(phase)
      }
      return { frames, oneCover: shell.querySelectorAll('img').length === 1 && shell.querySelector('img') === cover }
    })()`)
    assert(samples.oneCover)
    assert(samples.frames[0].some(([height, width]) => height > 40 && height < 158 && width > 26 && width < 48), JSON.stringify(samples.frames))
    assert(samples.frames[1].at(-1)[0] < samples.frames[0].at(-1)[0])
    assert.equal(samples.frames[2].at(-1)[0], 158)
    assert.equal(samples.frames[3].at(-1)[0], 40)
    // 以 150% 缩放的负坐标屏幕测试可见边缘，而非透明窗口的外框。
    for (const [snap, x, y, left, top] of [
      [true, -1680, -1035, -1905, -1128],
      [false, -1680, -1035, -1905, -1113],
      [true, -1740, -1035, -1968, -1128],
      [true, -316, -45, -528, -108],
    ]) {
      await evaluate(`window.dragCursor = {x:${x}, y:${y}}; window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {event:'player-snapshot',
        payload:{track:{title:'测试',cover:${JSON.stringify(art)},dur:210}, motion:false, lyricIslandSnap:${snap}, playing:false, time:0}})`)
      await send('Input.dispatchMouseEvent', {type:'mousePressed', button:'left', buttons:1, x:150, y:52, clickCount:1})
      await waitFor('鼠标重新拖动立即隐藏键盘白圈', `${surfaceOutline} === 'none' && getComputedStyle(document.querySelector('.island-trigger')).outlineStyle === 'none'`)
      await send('Input.dispatchMouseEvent', {type:'mouseMoved', buttons:1, x:160, y:52})
      await send('Input.dispatchMouseEvent', {type:'mouseReleased', button:'left', buttons:0, x:160, y:52, clickCount:1})
      await waitFor('吸附与自由拖动 ' + [snap,x,y], `islandCalls.at(-1)?.[1] === ${top} && islandCalls.at(-1)?.[2] === ${left} && !document.querySelector('.island-surface.expanded')`).catch(async error => {
        assert.fail(JSON.stringify({ error: error.message, calls: await evaluate('islandCalls.slice(-6)'), target: await evaluate('document.elementFromPoint(150,52)?.className'), messages: await evaluate('document.querySelector(".island-notification")?.textContent') }))
      })
    }
    console.log('PASS 灵动岛双材质、封面回退、键盘与真实媒体控制，桌面快照和窗口尺寸模拟')
    return
  }
  if (stagePerformance) {
    releasePlayback()
    const { checkStagePerformance } = await import('./check-stage-performance.mjs')
    await checkStagePerformance({
      evaluate, waitFor, key, resize,
      waitForStageRequest: () => until('等待舞台模块', () => heldStageRequest),
      releaseStage: () => send('Fetch.continueRequest', { requestId: heldStageRequest }),
    })
    assert.deepEqual(errors, [])
    return
  }
  await waitFor('模拟位置离线匹配，主窗口显示杭州附近', `document.querySelector('.win-chrome .weather-place')?.textContent === '杭州附近'`)
  await waitFor(
    '空曲库首页',
    `document.querySelector('.win-bottom [data-play]')?.disabled`
  )
  const axiosLoaded = `performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname.endsWith('/axios.js'))`
  await waitFor('游客发现公开歌单', "document.querySelectorAll('.home-content .feat').length === 4")
  assert.equal(await evaluate(axiosLoaded), true, '首页按需请求公开发现内容')
  assert.equal(await evaluate(`(async () => (await import('/src/stores/player.ts')).usePlayerStore().tracks.length)()`), 0)
  publicFeed = 'all'
  await evaluate("document.querySelector('.feat-head .recommend-link').click()")
  await waitFor('酷我恢复后补齐三平台六份歌单', "document.querySelectorAll('.home-content .feat').length === 6 && !document.querySelector('.feat-head .recommend-link')")
  assert(await evaluate("['netease','kugou','kuwo'].every(p => [...document.querySelectorAll('.home-picks .tt b')].some(row => row.textContent.startsWith(p)))"))
  if (process.argv.includes('--discovery-playlists')) {
    const panel = "document.querySelector('[data-panel=discovery]')"
    const queue = "(async () => { const store = (await import('/src/stores/player.ts')).usePlayerStore(); return (store.state.queue ?? []).map(index => store.tracks[index].catalog?.id) })()"
    const station = "document.querySelector('.platform-picks .station')"
    const row = `${station}.querySelectorAll('.station-track')[2]`
    assert(await evaluate(`${row}.querySelector('.station-duration').textContent === '2:00' && !${row}.querySelector('svg') && !!${station}.querySelector('.station-action')`))
    await evaluate(`${row}.scrollIntoView({block:'center'})`)
    await delay(350)
    const point = await evaluate(`(() => { const r=${row}.getBoundingClientRect(); return { x:r.left+24, y:r.top+r.height/2 } })()`)
    const originalQueue = await evaluate(queue)
    // 发送真实鼠标事件，验证第一次点击不播放，第二次点击构成双击时开始。
    for (const clickCount of [1, 2]) {
      for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...point, button:'left', clickCount })
      if (clickCount === 1) assert.deepEqual(await evaluate(queue), originalQueue)
    }
    await waitFor('双击从第三首建立本站五首队列', `${row}.getAttribute('aria-current') === 'true'`)
    await evaluate(`${station}.querySelector('.station-track').focus()`)
    await key('Enter', 13)
    await waitFor('键盘仍可播放分站单曲', `${station}.querySelector('.station-track').getAttribute('aria-current') === 'true'`)
    await evaluate("document.querySelector('.main').scrollTop = 0")
    for (const [platform, id, count] of [['netease','3779629',137], ['kugou','9095716',126], ['kuwo','1082685104',111]]) {
      const card = `document.querySelector('[data-card-key="${platform}:${id}"]')`
      const quick = `${card}.nextElementSibling`
      const previous = await evaluate(queue)
      if (platform === 'netease') failPlaylistPage = platform
      await evaluate(`${card}.focus()`)
      await key('Enter', 13)
      await waitFor('打开对应平台歌单路由', `location.hash === '#/discovery/${platform}/${id}' && !!${panel}`)
      if (platform === 'netease') {
        await waitFor('中途失败保留原队列并允许重试', `${panel}.querySelector('[role=status] + button') && ${panel}.querySelector('.banner-play').disabled`)
        assert.deepEqual(await evaluate(queue), previous)
        await evaluate(`${panel}.querySelector('[role=status] + button').click()`)
      }
      const lastButton = `${panel}.querySelector('[data-vue-pager=discovery] [data-slide-value="${Math.ceil(count / 10)}"]')`
      await waitFor('完整曲目进入原有分页列表 ' + platform, `${panel}.querySelector('.pl-head [data-pl-meta]').textContent === '共 ${count} 首' && !!${lastButton}`).catch(async error => {
        console.log(await evaluate(`${panel}.innerText.slice(-450)`))
        console.log(await evaluate(`[...${panel}.querySelectorAll('.pg-btn')].map(button => [button.dataset.slideValue,button.getAttribute('aria-label')])`))
        throw error
      })
      assert.deepEqual(await evaluate(queue), previous, '查看详情不切换播放队列')
      await evaluate(`${lastButton}.click()`)
      await waitFor('末页包含真实最后一首', `[...${panel}.querySelectorAll('.trow .tt b')].at(-1)?.textContent === '${platform}${id}${count-1}'`)
      await evaluate(`[...${panel}.querySelectorAll('.trow')].at(-1).click()`)
      const orderedIds = Array.from({ length: count }, (_, index) => id + index)
      assert.deepEqual(await evaluate(queue), orderedIds)
      await evaluate("document.querySelector('[data-nav-back]').click()")
      await waitFor('返回时焦点落在原歌单', `document.activeElement === ${card}`)
      await evaluate("document.querySelector('[data-nav-fwd]').click()")
      await waitFor('前进恢复同一歌单地址', `location.hash === '#/discovery/${platform}/${id}' && !!${panel}?.querySelector('.trow')`)
      await evaluate("document.querySelector('[data-nav-back]').click()")
      await waitFor('再次返回歌单卡', `!!${card}`)
      await evaluate(`${card}.scrollIntoView({ block: 'center' })`)
      const point = await evaluate(`(() => { const r = ${card}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
      await waitFor('悬停显示独立播放按钮', `Number(getComputedStyle(${quick}).opacity) === 1`)
      await evaluate(`${quick}.focus()`)
      await key('Enter', 13)
      await waitFor('快捷播放留在首页并从首曲开始', `(async () => { const store = (await import('/src/stores/player.ts')).usePlayerStore(); return location.hash === '#/' && store.tracks[store.state.idx]?.catalog?.id === '${id}0' })()`)
      assert.deepEqual(await evaluate(queue), orderedIds)
    }
    // 未打开过的卡片也必须补齐第二页，读取失败不能替换当前队列。
    const previous = await evaluate(queue)
    failPlaylistPage = 'netease'
    const button = "document.querySelector('[data-card-key=\"netease:3778678\"]').nextElementSibling"
    await evaluate(`${button}.click()`)
    await waitFor('快捷播放的后续页错误提供通知', `!${button}.disabled && !!document.querySelector('.notification-toast')`)
    assert.deepEqual(await evaluate(queue), previous)
    await evaluate(`${button}.click()`)
    await waitFor('快捷播放重试提交完整队列', `(async () => (await ${queue}).at(-1) === '3778678136')()`)
    assert.deepEqual(errors, [])
    console.log('PASS 网易云 137 首、酷狗 126 首、酷我 111 首的完整分页、独立快捷播放、失败重试和前进后退')
    return
  }
  if (process.argv.includes('--public-discovery')) {
    const artists = "document.querySelectorAll('.home-artists .artist-pick')"
    const isHeroFirst = "document.querySelector('.home-content')?.firstElementChild?.matches('[data-banner]') && !document.querySelector('.home-content .main-top')"
    await waitFor('横幅首排且三平台的歌手选听可见', `${isHeroFirst} && ${artists}.length === 3`)
    if (process.argv.includes('--screenshots')) await captureHomeLayout()
    assert(await evaluate("!document.querySelector('#home-recommend-title').parentElement.textContent.includes('选听 12 首') && document.querySelectorAll('.platform-picks .station').length === 3"))
    await resize(620, 740)
    await waitFor('窄窗按阅读顺序堆叠，没有横向溢出', `document.querySelector('.home-artists').getBoundingClientRect().top >= document.querySelector('.home-picks').getBoundingClientRect().bottom - 1 &&
      document.querySelector('.main').scrollWidth <= document.querySelector('.main').clientWidth + 1`)
    // 在只溢出 100px 的真实布局中滚到末行，再缩小窗口验证长页面仍能折叠。
    const scroller = "document.querySelector('.main')"
    await resize(1350, 520)
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    await waitFor('侧栏在宽窗完成重排', "!document.querySelector('.win-body').getAnimations().length")
    await waitFor('宽窗曲目和歌手并排', `document.querySelector('.home-artists').getBoundingClientRect().left >= document.querySelector('.home-picks').getBoundingClientRect().right`)
    await waitFor('首页紧凑窗口完成布局', `innerHeight === 520 && ${scroller}.scrollHeight - ${scroller}.clientHeight > 100`)
    const overflow = await evaluate(`${scroller}.scrollHeight - ${scroller}.clientHeight`)
    await resize(1350, 520 + overflow - 100)
    await waitFor('首页滚动范围接近一屏', `Math.abs(${scroller}.scrollHeight - ${scroller}.clientHeight - 100) < 3`)
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 680, y: 400, deltaX: 0, deltaY: 460 })
    await waitFor('能滚到今日曲目的最后一行', `${scroller}.scrollTop >= 98 && !${scroller}.classList.contains('compact')`)
    await delay(450)
    assert(await evaluate(`document.querySelector('.platform-picks .station:last-child .shelf-track:last-child').getBoundingClientRect().bottom <= ${scroller}.getBoundingClientRect().bottom &&
      !${scroller}.classList.contains('compact') && ${scroller}.scrollTop >= 98`))
    await resize(1350, 520)
    await evaluate(`${scroller}.scrollTop = 150`)
    await waitFor('滚动空间足够时横幅稳定收起', `${scroller}.classList.contains('compact') && document.querySelector('[data-banner]').offsetHeight === 58`)
    await evaluate(`${scroller}.scrollTop = ${scroller}.scrollHeight`)
    await delay(350)
    assert(await evaluate(`${scroller}.classList.contains('compact') && Math.abs(${scroller}.scrollHeight - ${scroller}.clientHeight - ${scroller}.scrollTop) < 2`))
    await evaluate(`${scroller}.scrollTop = 0`)
    await waitFor('回到顶部后还原每日推荐', `!${scroller}.classList.contains('compact')`)
    await resize(1240, 820)
    console.log('PASS 首页短滚动范围可到达末行，长页面收起及返回顶部展开')
    // 在同一个浏览器会话内切换账号，横幅和每一行都必须跟随当前身份。
    const signIn = (uid, token) => evaluate(`(async () => {
      const { acceptPlaybackGrant } = await import('/src/services/player/playback-session.ts')
      await acceptPlaybackGrant({ displayName: '账户气泡验证', userId: '${uid}', avatarUrl: null },
        { token: '${token}'.repeat(43), expiresAt: new Date(Date.now() + 3600000).toISOString(), isVip: true, vipLevel: 4 })
    })()`)
    const songTitles = "[...document.querySelectorAll('.home-picks .tt b')].map(row => row.textContent).join(',')"
    const longPlaylist = Array.from({ length: 36 }, (_, index) => '账号22推荐' + (36 - index))
    for (const [uid, token] of [['11','a'], ['22','b']]) {
      await signIn(uid, token)
      const preview = uid === '22' ? longPlaylist.slice(0, 8).join(',') : '账号11推荐2,账号11推荐1'
      await waitFor('每日推荐使用当前授权和平台顺序', `document.querySelector('[data-banner-title]').textContent === '每日推荐' &&
        document.querySelector('[data-banner-sub]').textContent.includes('网易云音乐 · 账号推荐') &&
        ${songTitles} === ${JSON.stringify(preview)}`)
    }
    assert.deepEqual(await evaluate(`(async () => {
      const { neteaseRecommendationDate } = await import('/src/pages/index/public-playlists.ts')
      return ['2026-12-31T21:59:59Z', '2026-12-31T22:00:00Z'].map(instant => neteaseRecommendationDate(new Date(instant)))
    })()`), ['2026-12-31', '2027-01-01'])
    const openDaily = "document.querySelector('[data-open-daily]')"
    await evaluate(`${openDaily}.focus()`)
    await key('Enter', 13)
    const detailRows = "document.querySelectorAll('.daily-playlist ol .trow')"
    const dailyPlay = "document.querySelector('.daily-playlist .pl-actions .banner-play')"
    await waitFor('键盘打开 36 首的完整歌单', `location.hash === '#/daily' && ${detailRows}.length === 36 && document.activeElement.matches('[data-pl-name]')`)
    await waitFor('共用歌单封面和摘要', `document.querySelector('.daily-playlist .pl-head img')?.naturalWidth > 0 &&
      document.querySelector('.daily-playlist [data-pl-meta]').textContent === '共 36 首' &&
      document.querySelector('.daily-playlist [data-pl-desc]').textContent.includes('06:00')`)
    assert.deepEqual(await evaluate(`[...${detailRows}].map(row => row.querySelector('.tt b').textContent)`), longPlaylist)
    if (process.argv.includes('--screenshots')) {
      for (const style of ['glass', 'liquid']) {
        await evaluate(`(async () => { (await import('/src/stores/player.ts')).usePlayerStore().state.settings.glassStyle = '${style}' })()`)
        await waitFor(style + ' 每日推荐详情', `!!document.querySelector('.${style}-win .daily-playlist')`)
        const clip = await evaluate(`(() => {
          const r = document.querySelector('.daily-playlist').getBoundingClientRect()
          return { x: r.left, y: r.top, width: r.width, height: 480, scale: 1 }
        })()`)
        const capture = await send('Page.captureScreenshot', {format: 'png', clip})
        const path = join(profile, 'daily-' + style + '.png')
        writeFileSync(path, Buffer.from(capture.data, 'base64'))
        console.log(path)
      }
    }
    await resize(620, 740)
    await waitFor('窄窗歌单保留播放和排序并收起专辑列', `getComputedStyle(${detailRows}[0].querySelector('.alb')).display === 'none' &&
      document.querySelector('.daily-playlist .sortbar').getBoundingClientRect().right <= 620 &&
      ${dailyPlay}.getBoundingClientRect().width > 0`)
    await evaluate(`${detailRows}[35].scrollIntoView({ block: 'end' })`)
    await waitFor('窄窗可滚到日推末曲', `${detailRows}[35].getBoundingClientRect().bottom <= ${scroller}.getBoundingClientRect().bottom + 1`)
    await evaluate(`${scroller}.scrollTop = 0`)
    await resize(1240, 820)
    // 用户指定的排序作用于整个日推队列，恢复默认后保留平台原始顺序。
    await evaluate("document.querySelector('[data-slide-value=\"daily:dur\"]').click()")
    const ascending = [...longPlaylist].reverse()
    await waitFor('每日推荐按时长排序', `${detailRows}[0].querySelector('.tt b').textContent === ${JSON.stringify(ascending[0])}`)
    await evaluate(`${dailyPlay}.click()`)
    const queueTitles = `(async () => {
      const store = (await import('/src/stores/player.ts')).usePlayerStore()
      return store.state.queue?.map(index => store.tracks[index].title)
    })()`
    assert.deepEqual(await evaluate(queueTitles), ascending)
    await evaluate("document.querySelector('[data-slide-value=\"daily:def\"]').click()")
    await evaluate(`${dailyPlay}.click()`)
    const queueCheck = title => `(async () => {
      const store = (await import('/src/stores/player.ts')).usePlayerStore()
      return store.state.queue?.length === 36 && store.tracks[store.state.idx]?.title === ${JSON.stringify(title)}
    })()`
    await waitFor('播放全部从首曲开始', queueCheck(longPlaylist[0]))
    await evaluate(`${detailRows}[35].click()`)
    await waitFor('可从末曲点播并保留完整队列', queueCheck(longPlaylist[35]))
    await evaluate("document.querySelector('[data-nav-back]').click()")
    await waitFor('从详情返回首页入口', `location.hash === '#/' && document.activeElement === ${openDaily}`)
    const avatar = "document.querySelector('.account-avatar')"
    await evaluate(`${avatar}.focus()`)
    await key('Enter', 13)
    const bubble = "document.querySelector('.account-bubble')"
    for (const style of ['glass', 'liquid']) {
      await evaluate(`(async () => { (await import('/src/stores/player.ts')).usePlayerStore().state.settings.glassStyle = '${style}' })()`)
      await waitFor(style + ' 账户气泡、平台图标与键盘焦点', `(() => {
        const panel = ${bubble}
        return panel?.parentElement.hasAttribute('data-player') && panel.querySelectorAll('.plat-logo').length === 3 &&
          panel.querySelectorAll('.account-status svg').length === 3 && panel.contains(document.activeElement) &&
          panel.querySelector('.account-identity b').textContent === '账户气泡验证' &&
          !document.querySelector('.account-avatar .account-level') &&
          panel.querySelector('.account-identity .account-level')?.textContent.trim() === 'VIP 4' &&
          panel.querySelector('.account-level').getBoundingClientRect().left > panel.querySelector('.account-identity b').getBoundingClientRect().right &&
          getComputedStyle(panel).backdropFilter.includes('${style === 'glass' ? '18px' : 'saturate'}')
      })()`)
      if (process.env.MIRAI_QA_SCREENSHOTS === '1' || process.argv.includes('--screenshots')) {
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        await waitFor(style + ' 气泡淡入完成', `getComputedStyle(${bubble}).opacity === '1' && !${bubble}.getAnimations().length`)
        const rect = await evaluate(`(() => { const r = ${bubble}.getBoundingClientRect(); return { x: r.left - 8, y: 0, width: r.width + 18, height: r.bottom + 12, scale: 1 } })()`)
        const capture = await send('Page.captureScreenshot', { format: 'png', clip: rect })
        const path = join(profile, 'account-' + style + '.png')
        writeFileSync(path, Buffer.from(capture.data, 'base64'))
        console.log(path)
      }
    }
    await key('Escape', 27)
    await waitFor('账户气泡关闭恢复头像焦点', `!${bubble} && document.activeElement === ${avatar}`)
    await signIn('33', 'c')
    const retryPersonal = "document.querySelector('[data-banner-sub] button')"
    await waitFor('账号日推失败时保留重试，不填入八首本机选曲', `${retryPersonal} && document.querySelector('[data-banner-sub]').textContent.includes('暂不可用') && !${songTitles}`)
    await evaluate(`${openDaily}.click()`)
    await waitFor('详情加载失败时可以重试', `${dailyPlay}?.disabled && document.querySelector('.daily-playlist [role="status"]')?.textContent.includes('暂时无法')`)
    await evaluate("document.querySelector('.daily-playlist [role=status] + button').click()")
    await waitFor('重试只刷新当前账户的每日推荐', `${detailRows}.length === 2 && ${detailRows}[0].querySelector('.tt b').textContent === '账号33推荐2'`)
    await signIn('44', 'd')
    await waitFor('上游返回空歌单时展示空态和禁用的播放按钮', `${detailRows}.length === 0 && ${dailyPlay}.disabled &&
      document.querySelector('.daily-playlist [role="status"]')?.textContent === '今天暂无推荐曲目'`)
    await evaluate("document.querySelector('[data-nav-back]').click()")
    await waitFor('空歌单仍可返回首页', `location.hash === '#/' && !!${openDaily}`)
    await evaluate("(async () => (await import('/src/services/player/playback-session.ts')).clearPlaybackGrant())()")
    await waitFor('退出后恢复游客曲目', `document.querySelectorAll('.home-picks .trow').length === 8 && !${songTitles}.includes('账号33')`)
    for (const platform of ['kugou', 'kuwo']) {
      const setProfile = uid => evaluate(`(async () => {
        const store = (await import('/src/stores/player.ts')).usePlayerStore()
        store.setLinkedProfile('${platform}', ${uid ? JSON.stringify({userId: uid, displayName: '测试', syncedAt: Date.now()}) : 'null'})
      })()`)
      await setProfile('51')
      const first = await evaluate(songTitles)
      await setProfile('52')
      await waitFor(platform + ' 公开资料按账号区分本机选曲', `${songTitles} !== ${JSON.stringify(first)} &&
        document.querySelector('[data-banner-sub]').textContent.includes('本机选曲')`)
      await setProfile('51')
      await waitFor('同账号当天推荐稳定', `${songTitles} === ${JSON.stringify(first)}`)
      await setProfile(null)
    }
    await evaluate("document.querySelector('.home-picks .trow').click()")
    await waitFor('点播公共歌曲使用同一份八首队列', `(async () => (await import('/src/stores/player.ts')).usePlayerStore().state.queue?.length === 8)()`)
    const previewTitles = await evaluate(songTitles)
    const artistName = await evaluate(`${artists}[0].querySelector('b').textContent`)
    const pickLabel = await evaluate(`${artists}[0].getAttribute('aria-label')`)
    const pickCount = Number(pickLabel.match(/(\d+) 首歌曲$/)[1])
    await evaluate(`${artists}[0].focus()`)
    await key('Enter', 13)
    await waitFor('键盘点播整组歌手曲目并跳过首页日推预览', `(async () => {
      const store = (await import('/src/stores/player.ts')).usePlayerStore()
      const songs = store.state.queue?.map(index => store.tracks[index])
      const preview = ${JSON.stringify(previewTitles.split(','))}
      return songs?.length === ${pickCount} && songs.every(song => song.artist === ${JSON.stringify(artistName)} && !preview.includes(song.title))
    })()`)
    await evaluate("location.hash = '#/settings'")
    const desktopTab = "document.querySelector('[data-slide-value=\"desktop\"]')"
    const detached = "document.querySelector('[aria-label=\"在桌面显示灵动岛\"]')"
    const snap = "document.querySelector('[aria-label=\"桌面灵动岛贴边吸附\"]')"
    const storedSnap = "JSON.parse(localStorage.getItem('miraiMusic.lyricIsland'))?.lyricIslandSnap"
    const action = text => `[...document.querySelectorAll('main .panel-actions button')].find(button => button.textContent.trim() === '${text}')`
    await waitFor('桌面设置可打开', `!!${desktopTab}`)
    await evaluate(`${desktopTab}.click()`)
    await waitFor('默认启用吸附，随桌面灵动岛开放编辑', `${snap}?.disabled && ${snap}.getAttribute('aria-checked') === 'true'`)
    await evaluate(`${detached}.click()`)
    await waitFor('桌面显示后可以关闭吸附', `!${snap}.disabled`)
    await evaluate(`${snap}.click()`)
    await evaluate(`${action('应用')}.click()`)
    await waitFor('应用持久保存吸附偏好', `${storedSnap} === false`)
    await evaluate(`${snap}.click()`)
    await evaluate(`${action('取消')}.click()`)
    await waitFor('取消保留已应用的偏好', `document.querySelector('.home-content') && ${storedSnap} === false`)
    console.log('PASS 游客发现、跨账号每日推荐与失败重试、双材质气泡会员标记及桌面吸附偏好')
    return
  }
  publicFeed = 'offline'
  await send('Page.reload')
  await waitFor('游客断网可重试', "document.querySelector('.home-content')?.textContent.includes('暂时无法获取公开歌单')")
  if (process.argv.includes('--loading')) {
    await evaluate(`(async () => {
      const api = await import('/src/api/index.ts')
      await api.getPublicUserPlaylists('netease', '123', 1, 1)
    })()`)
    assert.equal(await evaluate(axiosLoaded), true)
    await seedLargeLibrary()
    const rows = await checkVirtualQueue()
    await checkSavedProgress()
    await checkCollectionGrids()
    await evaluate(`location.hash = '#/settings'`)
    await waitFor('打开设置', `!!document.querySelector('[data-slide-value="audio"]')`)
    await checkDeferredEqualizer()
    await checkDeferredStorage()
    assert.deepEqual(errors, [])
    console.log(`PASS 音乐请求按需加载、777 首队列挂载 ${rows} 行、五秒保存、设置切换与失败重试`)
    return
  }
  assert(
    await evaluate(
      `document.querySelector('.home-content').textContent.includes('暂时无法获取公开歌单')`
    )
  )
  assert.equal(
    await evaluate(
      `document.querySelectorAll('.sidebar .plist, .home-content .feat').length`
    ),
    0
  )
  for (const route of ['radio', 'playlist', 'album', 'artist']) {
    await evaluate(`location.hash = '#/${route}'`)
    await waitFor(
      route,
      `!!document.querySelector('[data-panel="${route}"].active')`
    )
  }
  assert.equal(await evaluate(`document.querySelector('.banner')`), null)
  await evaluate(`location.hash = '#/upload'`)
  await waitFor(
    '资料登记页',
    `!!document.querySelector('[data-panel="upload"].active')`
  )
  await evaluate(
    `document.querySelector('[data-up-title]').value = '登记用曲目'; document.querySelector('[data-up-add]').click()`
  )
  await waitFor(
    '登记资料',
    `document.querySelector('[data-panel="upload"] .trow')?.textContent.includes('登记用曲目')`
  )
  assert(
    await evaluate(
      `document.querySelector('[data-panel="upload"] .trow').disabled`
    )
  )
  assert.equal(
    await evaluate(
      `document.querySelector('[data-panel="upload"] .trow .dur').textContent`
    ),
    '—'
  )
  await evaluate(`location.hash = '#/';`)
  await waitFor('回到首页', `!!document.querySelector('.home-content')`)
  await waitFor('离线空曲库保留首排海报和禁用的播放入口', `document.querySelector('.home-content').firstElementChild.matches('[data-banner]') &&
    document.querySelector('.banner-content [data-banner-play]').disabled && !document.querySelector('.home-artists')`)
  await evaluate(`(async () => {
    const { usePlayerStore } = await import('/src/stores/player.ts')
    usePlayerStore().registerCatalogTracks([{
      platform: 'netease', id: '99', title: '首次导入', artists: ['歌手'],
      album: '首次导入', durationMs: 120000, coverUrl: null,
      sourceUrl: 'https://music.163.com/song?id=99',
    }])
  })()`)
  await waitFor(
    '空曲库补入第一首歌后立即展示横幅',
    `document.querySelector('[data-banner-title]')?.textContent === '每日推荐' &&
    document.querySelector('[data-banner-sub]')?.textContent.includes('1 首歌') &&
    document.querySelector('.home-picks .tt b')?.textContent === '首次导入' &&
    !document.querySelector('.home-content .main-top')`
  )
  await evaluate(`(async () => {
    const store = (await import('/src/stores/player.ts')).usePlayerStore()
    for (const platform of ['kugou', 'kuwo']) {
      store.registerCatalogTracks([{ platform, id: '100', title: platform, artists: ['测试'],
        album: null, durationMs: null, coverUrl: null, sourceUrl: '' }])
    }
    store.state.idx = store.tracks.findIndex(track => track.catalog?.platform === 'kuwo')
  })()`)
  await waitFor('三平台曲库共用推荐，未知时长不计总数', `document.querySelectorAll('.home-picks .trow').length === 3 &&
    !document.querySelector('[data-banner-meta]') && document.querySelector('.choice-trigger').disabled &&
    document.querySelector('.choice-trigger').textContent.trim() === '自动'`)
  for (const platform of ['kugou', 'kuwo']) {
    await evaluate(`(async () => {
      const store = (await import('/src/stores/player.ts')).usePlayerStore()
      store.state.idx = store.tracks.findIndex(track => track.catalog?.platform === '${platform}')
      await Promise.resolve()
      store.state.actualQuality = '320 kbps'
    })()`)
    await waitFor(platform + ' 显示返回码率', `document.querySelector('.choice-trigger').disabled &&
      document.querySelector('.choice-trigger').textContent.trim() === '320 kbps'`)
  }
  console.log('PASS 空曲库、资料登记、直接进入详情和动态挂载横幅')

  assert.equal(await evaluate(`!!document.querySelector('[data-fs]')`), false)
  await evaluate(`localStorage.setItem('miraiMusic.lyricTheme', 'glow');
    localStorage.setItem('miraiMusic.publicPlatformProfiles.v1', JSON.stringify({
    netease: { userId: '123', displayName: '原有关联', syncedAt: 1 },
  })); localStorage.setItem('miraiMusic.publicPlaylists.v1', JSON.stringify([{
    platform: 'netease', id: '100', title: '浏览器验证歌单', coverUrl: null,
    tracks: Array.from({ length: 13 }, (_, i) => ({
      platform: 'netease', id: String(i + 1), title: '曲目 ' + (i + 1),
      artists: ['歌手 ' + (i + 1)], album: '专辑 ' + (i + 1), durationMs: 120000,
      coverUrl: i === 0 ? location.origin + '/images/featured-singer.webp'
        : i === 4 || i === 6 ? location.origin + '/missing-banner-cover.webp' : null,
      sourceUrl: 'https://music.163.com/song?id=' + (i + 1),
    })),
  }])); location.hash = '#/'`)
  await send('Page.reload')
  await waitFor(
    '旧关联补齐并加载网易云 HTTPS 头像',
    `(() => {
    const avatar = document.querySelector('[data-account-menu] .account-avatar img')
    const stored = JSON.parse(localStorage.getItem('miraiMusic.publicPlatformProfiles.v1')).netease
    return avatar?.src === 'https://p1.music.126.net/mirai-avatar-fixture.svg' &&
      avatar.naturalWidth > 0 && stored.avatarUrl === avatar.src && stored.syncedAt === 1
  })()`
  )
  assert.equal(await evaluate(axiosLoaded), true, '首次音乐服务请求应加载 Axios')
  await evaluate(`(async () => {
    const { usePlayerStore } = await import('/src/stores/player.ts')
    usePlayerStore().setLinkedProfile('netease', null)
  })()`)
  console.log('PASS 旧网易云关联补齐公开头像并保留关联时间')
  const firstCard = `document.querySelector('.home-content .feat b')?.textContent`
  const prev = `document.querySelector('[aria-label="上一页推荐"]')`
  const next = `document.querySelector('[aria-label="下一页推荐"]')`
  await waitFor('恢复已导入歌单', `${firstCard} === '专辑 1'`)
  dailyAudioId = await evaluate(`(async () => {
    const store = (await import('/src/stores/player.ts')).usePlayerStore()
    const rows = [...document.querySelectorAll('.home-picks .tt b')]
    if (rows.length !== 8 || new Set(rows.map(el => el.textContent)).size !== 8) throw Error('每日曲单应有 8 首不同的歌')
    window.bannerFixtureTrack = store.tracks.find(t => t.title === rows[0].textContent)
    window.bannerFixtureCover = location.origin + '/images/featured-singer.webp'
    bannerFixtureTrack.cover = bannerFixtureCover
    return bannerFixtureTrack.catalog.id
  })()`)
  await waitFor(
    '主打封面颜色和标题',
    `
    document.querySelector('[data-banner-title]')?.textContent === '每日推荐' &&
    document.querySelector('[data-banner-sub]')?.textContent.includes('8 首歌') &&
    document.querySelector('[data-banner-meta]')?.textContent === '共 16:00' &&
    document.querySelector('[data-banner-mini-cover]')?.naturalWidth > 0 &&
    document.querySelector('.banner-landscape')?.naturalWidth > 1000 &&
    !!document.querySelector('[data-banner-bg]')?.style.getPropertyValue('--banner-accent')
  `
  )
  const landscape = "document.querySelector('.banner-landscape')"
  // 依据原画中两人的轮廓范围，检查实际 cover 裁切后头顶、鞋子与长椅仍在画面内。
  const bothFiguresVisible = `(() => {
    const image = ${landscape}
    const rect = image.getBoundingClientRect()
    const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
    const w = scale * image.naturalWidth
    const h = scale * image.naturalHeight
    const [x, y] = getComputedStyle(image).objectPosition.split(' ').map(percent => parseFloat(percent) / 100)
    const left = (rect.width - w) * x
    const top = (rect.height - h) * y
    return left + 0.39 * w >= 0 && left + 0.81 * w <= rect.width &&
      top + 0.28 * h >= 0 && top + 0.94 * h <= rect.height
  })()`
  for (const material of ['glass', 'liquid']) {
    await evaluate(`(async () => {
      const { usePlayerStore } = await import('/src/stores/player.ts')
      usePlayerStore().state.settings.glassStyle = '${material}'
    })()`)
    await waitFor(material + ' 海报材质和独立文字层', `(() => {
      const banner = document.querySelector('[data-banner]')
      const landscape = banner.querySelector('.banner-landscape')
      const light = getComputedStyle(banner, '::after').backgroundImage
      return banner.closest('.${material}-win') && landscape.naturalWidth / landscape.naturalHeight > 2 &&
        landscape.currentSrc.endsWith('/ginkgo-station.webp') &&
        banner.querySelector('[data-banner-bg]').childElementCount === 1 &&
        getComputedStyle(landscape).transform === 'none' &&
        (light.includes('radial-gradient') === ${material === 'liquid'}) &&
        getComputedStyle(banner.querySelector('.banner-content')).zIndex === '2'
    })()`)
  }
  await evaluate(`(async () => {
    const { usePlayerStore } = await import('/src/stores/player.ts')
    const store = usePlayerStore()
    store.state.settings.glassStyle = 'glass'
  })()`)
  await resize(898, 851)
  await waitFor('窄窗保留画中两人', bothFiguresVisible)
  await waitFor('截图尺寸下主内容区直接接底栏', `(() => {
    const bounds = selector => document.querySelector(selector).getBoundingClientRect()
    return bounds('.win-body > .right').height === 0 && bounds('.win-body > .np-toggle').height === 0 &&
      Math.abs(bounds('.main').bottom - bounds('.win-bottom').top) <= 2
  })()`)
  await evaluate("document.querySelector('[data-bottom-queue-toggle]').click()")
  await waitFor('窄窗底栏仍可打开队列', "document.querySelector('.main-queue')?.getBoundingClientRect().height > 0")
  await key('Escape', 27)
  await waitFor('窄窗关闭队列', "!document.querySelector('.main-queue')?.getBoundingClientRect().height")
  if (process.env.MIRAI_QA_SCREENSHOTS === '1') {
    const capture = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(profile, 'home-898.png'), Buffer.from(capture.data, 'base64'))
  }
  for (const width of [1020, 1021]) {
    await resize(width, 851)
    await waitFor('侧栏断点 ' + width, `(document.querySelector('.np-toggle').getBoundingClientRect().width > 0) === ${width > 1020}`)
  }
  for (const width of [390, 650, 1620, 2240, 1240]) {
    await resize(width, 820)
    await waitFor('不同窗口裁切保留两人全身 ' + width, bothFiguresVisible)
  }
  const pointer = await evaluate(`(() => {
    const r = document.querySelector('[data-banner]').getBoundingClientRect()
    return { x: r.left + r.width * 0.92, y: r.top + r.height * 0.25 }
  })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...pointer })
  await waitFor('指针经过时整幅插画仍静止', `getComputedStyle(${landscape}).transform === 'none' &&
    !${landscape}.parentElement.querySelector('canvas')`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })
  const sampledGradients = []
  for (const [hex, rgb] of [['e65070', '230 80 112'], ['468abd', '70 138 189']]) {
    await evaluate(`bannerFixtureTrack.cover = 'data:image/svg+xml;base64,' +
      btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#${hex}"/></svg>')`)
    await waitFor('封面取色 ' + hex, `document.querySelector('[data-banner-bg]').style.getPropertyValue('--banner-accent') === 'rgb(${rgb})'`)
    await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
    await waitFor('封面色过渡结束', `!document.querySelector('[data-banner-bg]').getAnimations().some(a => a.playState === 'running')`)
    sampledGradients.push(await evaluate(`getComputedStyle(document.querySelector('[data-banner-bg]')).backgroundImage`))
  }
  assert.notEqual(sampledGradients[0], sampledGradients[1], '暖色与冷色封面应生成不同渐变')
  await evaluate(`bannerFixtureTrack.cover = bannerFixtureCover`)
  const bannerSpectrum = `document.querySelector('[data-banner-spectrum]')`
  const bottomSpectrum = `document.querySelector('[data-spectrum]')`
  await waitFor(
    '横幅频谱挂载',
    `${bannerSpectrum}?.dataset.spectrumMode === 'static'`
  )
  const bannerPlay = `document.querySelector('.banner-content [data-banner-play]')`
  const expandedHeight = await evaluate(`document.querySelector('[data-banner]').getBoundingClientRect().height`)
  // 频谱、来源与时长共用右下区域，避免与主操作重叠。
  const spectrumLayout = await evaluate(`(() => {
    const canvas = ${bannerSpectrum}.getBoundingClientRect()
    const caption = document.querySelector('.banner-caption').getBoundingClientRect()
    const meta = document.querySelector('[data-banner-meta]').getBoundingClientRect()
    const banner = document.querySelector('[data-banner]').getBoundingClientRect()
    const play = ${bannerPlay}.getBoundingClientRect()
    return canvas.width >= 64 && canvas.height >= 20 && canvas.top >= meta.bottom &&
      Math.abs(canvas.right - meta.right) < 1 &&
      caption.left > play.right && caption.right < banner.right && caption.bottom < banner.bottom
  })()`)
  assert(spectrumLayout, '频谱与来源在海报边界内完整显示')
  await resize(760, 740)
  await waitFor(
    '窄窗口保留完整曲名与播放按钮',
    `(() => {
    const bounds = document.querySelector('[data-banner]').getBoundingClientRect()
    const title = document.querySelector('[data-banner-title]')
    const action = ${bannerPlay}.getBoundingClientRect()
    return bounds.width < 560 && title.scrollWidth === title.clientWidth &&
      action.left >= bounds.left && action.right <= bounds.right && action.bottom < bounds.bottom
  })()`
  )
  await evaluate(`window.bannerFixtureTitle = bannerFixtureTrack.title; bannerFixtureTrack.title = '很长的曲名'.repeat(20)`)
  await waitFor('窄窗长曲名在歌曲行截断，海报保持曲单标题', `(() => {
    const title = document.querySelector('.home-picks .tt b')
    return title.textContent === bannerFixtureTrack.title && title.scrollWidth > title.clientWidth &&
      getComputedStyle(title).textOverflow === 'ellipsis' && document.querySelector('[data-banner-title]').textContent === '每日推荐'
  })()`)
  await evaluate(`bannerFixtureTrack.title = bannerFixtureTitle`)
  await resize(1240, 820)
  await evaluate(`${bannerPlay}.focus()`)
  await key('Enter', 13)
  const playButton = `document.querySelector('.win-bottom [data-play]')`
  await waitFor('原位显示等待中的播放按钮', `${playButton}.getAttribute('aria-busy') === 'true'`)
  await waitFor('主打入口显示取消加载', `${bannerPlay}.getAttribute('aria-busy') === 'true' && ${bannerPlay}.textContent.includes('取消加载')`)
  assert(await evaluate(`(async () => {
    const store = (await import('/src/stores/player.ts')).usePlayerStore()
    return JSON.stringify(store.state.queue.map(i => store.tracks[i].title)) ===
      JSON.stringify([...document.querySelectorAll('.home-picks .tt b')].map(el => el.textContent))
  })()`), '播放队列应当与首页曲单顺序完全一致')
  await evaluate(`${bannerPlay}.click()`)
  await waitFor('点击加载按钮取消点播', `${playButton}.getAttribute('aria-busy') === 'false'`)
  await evaluate(`${playButton}.click()`)
  await waitFor('再次点击开始获取', `${playButton}.getAttribute('aria-busy') === 'true'`)
  releasePlayback()
  const trackBars = `document.querySelectorAll('.home-content .trow[aria-current=true] .bars i')`
  await waitFor('当前歌曲的三条播放指示交错跳动', `${trackBars}.length === 3 &&
    [...${trackBars}].every(bar => getComputedStyle(bar).animationName === 'eq') &&
    new Set([...${trackBars}].map(bar => getComputedStyle(bar).animationDelay)).size === 3`)
  await evaluate("document.querySelector('[data-bottom-queue-toggle]').click()")
  await waitFor('底栏队列的当前歌曲同步跳动', `(() => {
    const bars = document.querySelectorAll('.main-queue [aria-current=true] .bars i')
    return bars.length === 3 && [...bars].every(bar => bar.clientWidth > 0 && getComputedStyle(bar).animationName === 'eq')
  })()`)
  await key('Escape', 27)
  await waitFor(
    '横幅与底栏显示实频',
    `
    ${bannerSpectrum}.dataset.spectrumMode === 'live' && ${bottomSpectrum}.dataset.spectrumMode === 'live' && !document.querySelector('audio').paused
  `
  )
  await waitFor(
    '实频能量超出静态轮廓',
    `(() => {
    const canvas = ${bannerSpectrum}
    const context = canvas.getContext('2d')
    const row = context.getImageData(0, Math.floor(canvas.height * .32), canvas.width, 1).data
    const half = Math.floor(canvas.width / 2) * 4
    const hasEnergy = part => part.some((value, index) => index % 4 === 3 && value > 0)
    return hasEnergy(row.subarray(0, half)) && hasEnergy(row.subarray(half))
  })()`
  )
  if (process.env.MIRAI_QA_SCREENSHOTS === '1') {
    await evaluate(`${bannerPlay}.blur()`)
    await resize(1620, 820)
    await evaluate('document.fonts.ready.then(() => true)')
    await delay(250)
    const rect = await evaluate(`(() => {
      const { x, y, width, height } = document.querySelector('[data-banner]').getBoundingClientRect()
      return { x, y, width, height, scale: 1 }
    })()`)
    const file = join(profile, 'featured-banner.png')
    const image = await send('Page.captureScreenshot', {
      format: 'png',
      clip: rect,
    })
    writeFileSync(file, Buffer.from(image.data, 'base64'))
    console.log(file)
    await resize(1240, 820)
  }
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await waitFor(
    '减少动态效果时频谱静止，歌曲继续播',
    `
    ${bannerSpectrum}.dataset.spectrumMode === 'static' && !document.querySelector('audio').paused &&
    getComputedStyle(${landscape}).transform === 'none' &&
    [...${trackBars}].every(bar => getComputedStyle(bar).animationName === 'none')
  `
  )
  await send('Emulation.setEmulatedMedia', { features: [] })
  await waitFor(
    '恢复正常动效后重新显示实频',
    `${bannerSpectrum}.dataset.spectrumMode === 'live'`
  )
  await evaluate(`${bannerPlay}.click()`)
  await waitFor(
    '暂停时保留静态频谱',
    `${bannerSpectrum}.dataset.spectrumMode === 'static' && document.querySelector('audio').paused &&
      ${trackBars}.length === 3 && [...${trackBars}].every(bar => getComputedStyle(bar).animationName === 'none')`
  )
  const capsule = `document.querySelector('.lyric-capsule')`
  const capsuleLine = `${capsule}.querySelector('[data-capsule-text]')`
  await evaluate(`document.querySelector('audio').currentTime = 0.2`)
  await waitFor('胶囊显示首句', `${capsuleLine}?.textContent === '街灯落在静水上' && !${capsule}.querySelector('[class*="capsule-line-"]')`)
  const shortWidth = await evaluate(`${capsule}.getBoundingClientRect().width`)
  await evaluate(`(() => {
    const island = ${capsule}
    window.capsuleTransitions = []
    island.addEventListener('transitionrun', event => {
      if (['opacity', 'width'].includes(event.propertyName))
        capsuleTransitions.push([event.propertyName, event.target.textContent, getComputedStyle(event.target).transitionDuration])
    })
    document.querySelector('audio').currentTime = 8.1
  })()`)
  await waitFor('旧句淡出、新句淡入，胶囊宽度随长句过渡', `(() => {
    const fades = capsuleTransitions.filter(([property]) => property === 'opacity')
    return fades[0]?.[1] === '街灯落在静水上' && fades[1]?.[1] === 'The sky opens up again' &&
      parseFloat(fades[0][2]) + parseFloat(fades[1][2]) <= 0.2 && capsuleTransitions.some(([property]) => property === 'width') &&
      !${capsule}.querySelector('[class*="capsule-line-"]') &&
      ${capsule}.getBoundingClientRect().width > ${shortWidth}
  })()`)
  await evaluate(`${capsuleLine}.addEventListener('transitionrun', () => {
    document.querySelector('audio').currentTime = 0.2
  }, { once: true }); document.querySelector('audio').currentTime = 4.1`)
  await waitFor('连续定位后停在最新歌词和宽度', `${capsuleLine}?.textContent === '街灯落在静水上' &&
    Math.abs(${capsule}.getBoundingClientRect().width - ${shortWidth}) < 1 && !${capsule}.querySelector('[class*="capsule-line-"]')`)
  for (const preference of ['system', 'player']) {
    if (preference === 'system') {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    } else {
      await evaluate(`(async () => { (await import('/src/stores/player.ts')).usePlayerStore().state.settings.motion = false })()`)
    }
    await waitFor(preference + ' 关闭胶囊宽度动效', `getComputedStyle(${capsuleLine}.parentElement).transitionDuration === '0s'`)
    await evaluate(`capsuleTransitions.length = 0; document.querySelector('audio').currentTime = 8.1`)
    await waitFor(preference + ' 静态长句', `${capsuleLine}?.textContent === 'The sky opens up again' && !${capsule}.querySelector('[class*="capsule-line-"]')`)
    assert.deepEqual(await evaluate('capsuleTransitions'), [])
    await evaluate(`document.querySelector('audio').currentTime = 0.2`)
    await waitFor('静态短句恢复', `${capsuleLine}?.textContent === '街灯落在静水上'`)
    if (preference === 'system') await send('Emulation.setEmulatedMedia', { features: [] })
    else await evaluate(`(async () => { (await import('/src/stores/player.ts')).usePlayerStore().state.settings.motion = true })()`)
  }
  console.log('PASS 歌词胶囊随媒体时间快速淡出淡入、伸缩，覆盖连续跳句与两种少动效设置')
  await evaluate(
    `document.querySelector('.win-bottom [data-stage-toggle]').click()`
  )
  const lyrics = `document.querySelector('.fs-open [data-fs-lyrics]')`
  const reading = `document.querySelector('[aria-label="歌词阅读模式"]')`
  await waitFor(
    '全屏大字歌词接近中央，亮句与译文融入舞台',
    `(() => {
    const viewport = ${lyrics}
    const current = viewport?.querySelector('.fl-line.on')
    if (!current?.querySelector('.fl-tr')) return false
    const column = viewport.closest('.fs-lyrcol')
    const stage = column.closest('.fs')
    const frame = stage.getBoundingClientRect()
    const bounds = viewport.getBoundingClientRect()
    return bounds.left - frame.left < frame.width * 0.62 && bounds.width > frame.width * 0.34 &&
      getComputedStyle(column).borderLeftWidth === '0px' &&
      getComputedStyle(stage).backgroundColor === 'rgb(20, 22, 32)' &&
      getComputedStyle(viewport).maskImage.includes('linear-gradient') &&
      parseFloat(getComputedStyle(current.querySelector('.fl-o')).fontSize) > 30 &&
      Number(getComputedStyle(current.nextElementSibling).opacity) < Number(getComputedStyle(current).opacity)
  })()`
  )
  const wordFills = `Array.from(${lyrics}.querySelectorAll('.fl-line.on .fl-o .fl-word'), word =>
    parseFloat(word.style.getPropertyValue('--sung')))`
  await evaluate(`document.querySelector('audio').currentTime = 1.2`)
  await waitFor(
    '实际媒体已定位',
    `Math.abs(document.querySelector('audio').currentTime - 1.2) < 0.01 && !document.querySelector('audio').seeking`
  )
  const wordPositions = await evaluate(`(() => ({
    fills: ${wordFills},
    time: document.querySelector('audio').currentTime,
    lyric: ${lyrics}.querySelector('.fl-line.on')?.innerHTML,
  }))()`)
  assert.deepEqual(
    wordPositions.fills,
    [100, 33, 0],
    JSON.stringify(wordPositions)
  )
  assert.deepEqual(
    await evaluate(`Array.from(${lyrics}.querySelectorAll('.fl-line.on .fl-tr .fl-word'), word =>
    parseFloat(word.style.getPropertyValue('--sung')))`),
    [100, 40, 0]
  )
  const stagePlay = `document.querySelector('.fs-dock [data-play]')`
  const artwork = "document.querySelector('.fs-artwork')"
  const artworkFloating = `${artwork}.getAnimations().some(animation => animation.playState === 'running' && animation.animationName?.includes('artwork-float'))`
  const coverFrameIsStill = `(() => {
    const frame = document.querySelector('.fs-coverwrap')
    const inner = frame.querySelector('.fs-coverkb')
    return getComputedStyle(inner).animationName === 'none' &&
      getComputedStyle(inner).transform === 'none' &&
      getComputedStyle(frame, '::before').animationName === 'none'
  })()`
  const aurora = `getComputedStyle(document.querySelector(".fs-scenery[data-scene='magazine'] .first"))`
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.fs-theme-seg button'), el => el.dataset.slideValue)`),
    ['magazine', 'ink', 'cinema', 'chat'])
  assert.equal(await evaluate(`localStorage.getItem('miraiMusic.lyricTheme')`), 'magazine')
  await evaluate(`${stagePlay}.click()`)
  await waitFor(
    '继续播放时逐字进度随真实媒体时钟前进',
    `${wordFills}[1] > 33 && !document.querySelector('audio').paused`
  )
  await waitFor('时尚播放时极光和整组封面浮动', `${aurora}.display !== 'none' && ${aurora}.backgroundImage.includes('radial-gradient') && ${aurora}.animationName.includes('scenery-drift') && ${artworkFloating} && ${coverFrameIsStill}`)
  await evaluate("document.querySelector('.fs-top [data-fsq-toggle]').click()")
  await waitFor('全屏队列的当前歌曲同步跳动', `(() => {
    const bars = document.querySelectorAll('.fs-queue:not([inert]) [aria-current=true] .bars i')
    return bars.length === 3 && [...bars].every(bar => bar.clientWidth > 0 && getComputedStyle(bar).animationName === 'eq')
  })()`)
  await evaluate("document.querySelector('.fs-queue [data-fsq-toggle]').click()")
  await evaluate(`${stagePlay}.click()`)
  await waitFor('暂停媒体', `document.querySelector('audio').paused`)
  await waitFor('暂停时封面组继续浮动，极光静止', `${aurora}.animationName === 'none' && ${artworkFloating} && ${coverFrameIsStill}`)
  // 在同一动画的两个相位测量整组实际位移，同时检查歌词和控制栏的位置。
  async function measureArtworkTravel() {
    return evaluate(`(() => {
      const animation = ${artwork}.getAnimations()[0]
      const start = animation.currentTime
      const selectors = ['.fs-cover', '.fs-titleblock h4', '.fs-titleblock p', '.fs-titleactions', '.fs-reflect', '.fs-lyrics', '.fs-dock']
      const positions = () => selectors.map(selector => {
        const element = document.querySelector(selector)
        return element.getClientRects().length ? element.getBoundingClientRect().top : null
      })
      try {
        animation.currentTime = 0
        const before = positions()
        animation.currentTime = animation.effect.getTiming().duration * 0.7
        return positions().map((y, i) => y === null ? null : before[i] - y)
      } finally {
        animation.currentTime = start
      }
    })()`)
  }
  const wideTravel = await measureArtworkTravel()
  assert(wideTravel[0] > 8 && wideTravel.slice(0, 5).every(y => Math.abs(y - wideTravel[0]) < 0.1))
  assert.deepEqual(wideTravel.slice(5), [0, 0])
  for (const motion of [false, true]) {
    await evaluate(`(async () => { (await import('/src/stores/player.ts')).usePlayerStore().state.settings.motion = ${motion} })()`)
    await waitFor('全屏浮动跟随动效设置', `(${artworkFloating}) === ${motion}`)
  }
  await evaluate(`document.querySelector('audio').currentTime = 0.32`)
  await waitFor('后跳后重新填色', `JSON.stringify(${wordFills}) === '[40,0,0]'`)
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await waitFor(
    '少动效时按词段边界高亮',
    `JSON.stringify(${wordFills}) === '[100,0,0]' && !${artworkFloating} && getComputedStyle(${artwork}).transform === 'none'`
  )
  await send('Emulation.setEmulatedMedia', { features: [] })
  await evaluate(`document.querySelector('audio').currentTime = 8.1`)
  await waitFor(
    '只有 LRC 的句子继续整句高亮',
    `${lyrics}.querySelector('.fl-line.on .fl-o')?.textContent === 'The sky opens up again' &&
      getComputedStyle(${lyrics}.querySelector('.fl-line.on .fl-o')).color === 'rgb(255, 255, 255)' &&
      ${wordFills}.length === 0`
  )
  await evaluate(`document.querySelector('audio').currentTime = 1.2`)
  await waitFor('恢复逐字高亮', `JSON.stringify(${wordFills}) === '[100,33,0]'`)
  if (process.env.MIRAI_QA_SCREENSHOTS === '1') {
    await delay(550)
    const file = join(profile, 'fullscreen-lyrics.png')
    const image = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(file, Buffer.from(image.data, 'base64'))
    console.log(file)
  }
  const coverSize = `(() => { const cover = document.querySelector('.fs-cover'); return [cover.offsetWidth, cover.offsetHeight] })()`
  await delay(350)
  const magazineDesktop = await evaluate(coverSize)
  await waitFor('全屏与主界面共享地名', `document.querySelector('.fs .weather-place')?.textContent === '杭州附近'`)
  const coverBox = `document.querySelector('.fs .fs-cover').getBoundingClientRect()`
  const titleBox = `document.querySelector('.fs .fs-titleblock').getBoundingClientRect()`
  const coverLayout = `(() => {
    const bounds = selector => {
      const el = document.querySelector('.fs ' + selector)
      return [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]
    }
    return {
      cover: bounds('.fs-coverwrap'), title: bounds('.fs-titleblock'), artist: bounds('[data-artist]'),
      titleSize: getComputedStyle(document.querySelector('.fs-titleblock h4')).fontSize,
      reflection: getComputedStyle(document.querySelector('.fs-reflect')).display,
    }
  })()`
  const magazineDesktopLayout = await evaluate(coverLayout)
  assert.notEqual(magazineDesktopLayout.reflection, 'none')
  assert(await evaluate(`${titleBox}.left < ${coverBox}.right && ${titleBox}.top < ${coverBox}.bottom`))
  assert(await evaluate(coverFrameIsStill))
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1180, y: 760 })
  await delay(300)
  assert(await evaluate(`(() => { const cover = getComputedStyle(document.querySelector('.fs-coverwrap')); return cover.transform === 'none' && cover.translate === 'none' })()`))
  await resize(620, 740)
  await delay(200)
  const magazineNarrow = await evaluate(coverSize)
  const magazineNarrowLayout = await evaluate(coverLayout)
  const narrowTravel = await measureArtworkTravel()
  assert(narrowTravel[0] > 0 && narrowTravel[0] < wideTravel[0])
  assert(narrowTravel.slice(0, 4).every(y => Math.abs(y - narrowTravel[0]) < 0.1))
  assert.deepEqual(narrowTravel.slice(4), [null, 0, 0])
  await resize(1240, 820)
  const themeTabs = 'document.querySelector(".fs-theme-seg")'
  const activeTheme = `${lyrics}.closest('[data-lyric-theme]').dataset.lyricTheme`
  // 从实际的滑动胶囊切换主题，焦点移动不提前提交选择。
  async function chooseTheme(theme) {
    await evaluate(`${themeTabs}.querySelector('[data-slide-value="${theme}"]').click()`)
  }
  await evaluate(`${themeTabs}.querySelector('button').focus()`)
  await key('End', 35)
  await waitFor('键盘定位到末尾主题', `document.activeElement?.dataset.slideValue === 'chat' && ${activeTheme} === 'magazine'`)
  await key('Enter', 13)
  await waitFor('键盘确认对话主题', `${activeTheme} === 'chat'`)
  await delay(450)
  const chatLayout = await evaluate(`(() => {
    const rows = ${lyrics}.querySelectorAll('.fl-line')
    return { scene: document.querySelector('.fs-scenery').dataset.scene, gap: getComputedStyle(${lyrics}).rowGap,
      left: [...rows].slice(0, 2).map(row => row.getBoundingClientRect().left),
      right: [...rows].slice(0, 2).map(row => row.getBoundingClientRect().right) }
  })()`)
  assert.equal(chatLayout.scene, 'chat')
  assert(chatLayout.left[0] < chatLayout.left[1] && chatLayout.right[1] > chatLayout.right[0], JSON.stringify(chatLayout))
  assert(parseFloat(chatLayout.gap) >= 14)
  await evaluate(`document.querySelector('audio').currentTime = 1.5`)
  await waitFor('对话逐字填色', `${wordFills}[1] === 58 && getComputedStyle(${lyrics}.querySelector('.fl-line.on .fl-word')).backgroundImage.includes('linear-gradient')`)
  await evaluate(`document.querySelector('audio').currentTime = 1.2`)
  const stageShape = `document.querySelector('.fs-scenery .first')`
  // 在暂停预览时测量两次实际位置，减少动态效果时应停止动画。
  async function verifyAmbient() {
    const before = await evaluate(`getComputedStyle(${stageShape}).transform`)
    await delay(250)
    assert.notEqual(await evaluate(`getComputedStyle(${stageShape}).transform`), before)
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await waitFor('减少动态效果停用背景动画', `getComputedStyle(${stageShape}).animationName === 'none'`)
    assert(await evaluate(`!${artworkFloating} && ${coverFrameIsStill}`))
    await send('Emulation.setEmulatedMedia', { features: [] })
  }
  await verifyAmbient()
  assert.deepEqual(await evaluate(coverSize), magazineDesktop)
  await resize(620, 740)
  await delay(220)
  assert.deepEqual(await evaluate(coverSize), magazineNarrow)
  await resize(1240, 820)
  // 用真实主题和字体渲染生成预览。
  async function captureLyricsTheme(name) {
    if (process.env.MIRAI_QA_SCREENSHOTS !== '1') return
    await delay(300)
    const file = join(profile, `fullscreen-lyrics-${name}.png`)
    const image = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(file, Buffer.from(image.data, 'base64'))
    console.log(file)
  }
  await chooseTheme('ink')
  await waitFor(
    '应用手书主题并保存选择',
    `${activeTheme} === 'ink' &&
      getComputedStyle(${lyrics}.querySelector('.fl-line.on .fl-o')).fontFamily.includes('Ma Shan Zheng') &&
      localStorage.getItem('miraiMusic.lyricTheme') === 'ink'`
  )
  assert.equal(
    await evaluate(
      `document.fonts.load('400 34px "Ma Shan Zheng"', '街灯').then(faces => faces.length)`
    ),
    1
  )
  await verifyAmbient()
  await captureLyricsTheme('ink')
  await chooseTheme('magazine')
  await waitFor('时尚版式与逐字时钟共存', `${activeTheme} === 'magazine' && ${wordFills}[1] === 33 && parseFloat(getComputedStyle(${lyrics}.querySelector('.fl-line.on .fl-o')).fontSize) > 30`)
  await waitFor('时尚标题横跨封面', `${titleBox}.left < ${coverBox}.right && ${titleBox}.top < ${coverBox}.bottom`)
  assert.deepEqual(await evaluate(coverLayout), magazineDesktopLayout)
  await waitFor('时尚当前句与译文以不透明白色高亮', `(() => {
    const row = ${lyrics}.querySelector('.fl-line.on')
    return getComputedStyle(row).opacity === '1' &&
      ['.fl-o', '.fl-tr'].every(selector => {
        const style = getComputedStyle(row.querySelector(selector))
        return style.color === 'rgb(255, 255, 255)' && style.opacity === '1'
      }) && getComputedStyle(row.querySelector('.fl-word')).backgroundImage.includes('rgb(255, 255, 255)')
  })()`)
  await resize(620, 740)
  assert.deepEqual(await evaluate(coverLayout), magazineNarrowLayout)
  await resize(1240, 820)
  await chooseTheme('chat')
  await chooseTheme('cinema')
  await waitFor(
    '连续切换以字幕主题为准，歌词居中且保留词段进度',
    `${activeTheme} === 'cinema' &&
      getComputedStyle(${lyrics}.querySelector('.fl-line.on')).textAlign === 'center' &&
      JSON.stringify(${wordFills}) === '[100,33,0]'`
  )
  await captureLyricsTheme('cinema')
  await chooseTheme('magazine')
  await waitFor('恢复时尚排版', `${activeTheme} === 'magazine'`)
  console.log('PASS 四种歌词主题与媒体时钟，封面、倒影和曲目信息同幅浮动，窄窗减幅与少动效静止')
  await evaluate(`${reading}.click()`)
  await waitFor(
    '阅读模式居中且沿用当前句',
    `(() => {
    const viewport = ${lyrics}
    if (!viewport?.closest('.fs-reading') || ${reading}.getAttribute('aria-pressed') !== 'true') return false
    const bounds = viewport.getBoundingClientRect()
    const win = viewport.closest('.fs').getBoundingClientRect()
    return Math.abs(bounds.left + bounds.width / 2 - (win.left + win.width / 2)) < 10 &&
      !!viewport.querySelector('.fl-line.on') && !${artworkFloating} && !${artwork}.getClientRects().length
  })()`
  )
  await evaluate(`${reading}.click()`)
  await waitFor(
    '退出阅读模式',
    `${reading}.getAttribute('aria-pressed') === 'false'`
  )
  await resize(620, 740)
  await delay(220)
  const narrowStage = await evaluate(`(() => {
    const stage = document.querySelector('.fs-open .fs')
    const cover = stage.querySelector('.fs-coverwrap').getBoundingClientRect()
    const dock = stage.querySelector('.fs-dock').getBoundingClientRect()
    const bounds = ${lyrics}.getBoundingClientRect()
    return { width: bounds.width, height: bounds.height,
      coverGap: bounds.top - cover.bottom, dockGap: dock.top - bounds.bottom }
  })()`)
  assert(
    narrowStage.width > 500 &&
      narrowStage.height > 90 &&
      narrowStage.coverGap > 0 &&
      narrowStage.dockGap >= 0,
    `窄窗口歌词位于封面和控制栏之间 ${JSON.stringify(narrowStage)}`
  )
  await resize(1240, 820)
  await evaluate(
    `document.querySelector('.fs-top [data-stage-toggle]').click()`
  )
  await resize(1240, 520)
  await evaluate(`document.querySelector('.main').scrollTop = 110`)
  await waitFor(
    '滚动时折叠横幅',
    `
    getComputedStyle(document.querySelector('.banner-mini')).display === 'flex' &&
    document.querySelector('[data-banner-mini-cover]')?.naturalWidth > 0 &&
    getComputedStyle(${bannerSpectrum}).display === 'none'
  `
  )
  await evaluate(`document.querySelector('.main').scrollTop = 0`)
  await resize(1240, 820)
  await waitFor(
    '重新展开横幅',
    `(() => {
      const banner = document.querySelector('[data-banner]')
      return banner.getBoundingClientRect().height === ${expandedHeight} &&
        !banner.getAnimations().some(animation => animation.playState === 'running')
    })()`
  )
  assert.equal(await evaluate(`${prev}.getAttribute('aria-disabled')`), 'true')
  const pageSize = await evaluate(
    `getComputedStyle(document.querySelector('#home-recommend-albums > .grid')).gridTemplateColumns.split(' ').length`
  )
  assert.equal(
    await evaluate(`document.querySelectorAll('.home-content .feat').length`),
    pageSize
  )
  const secondAlbum = `专辑 ${pageSize + 1}`
  const failureCardIndex = String(pageSize + 1) === dailyAudioId ? 1 : 0
  const secondTrack = `曲目 ${pageSize + failureCardIndex + 1}`
  const tableTop = await evaluate(
    `document.querySelector('.home-picks').getBoundingClientRect().top`
  )
  await evaluate(`${next}.focus()`)
  assert.equal(await evaluate(`document.activeElement === ${next}`), true)
  await key('Enter', 13)
  assert.equal(await evaluate(`${prev}.getAttribute('aria-disabled')`), 'false')
  await waitFor('键盘翻页', `${firstCard} === ${JSON.stringify(secondAlbum)}`)
  await evaluate(`${next}.click(); ${prev}.click(); ${next}.click()`)
  await waitFor('快速操作最终页', `${firstCard} === '专辑 13'`)
  assert.equal(await evaluate(`document.activeElement === ${next}`), true)
  assert.equal(await evaluate(`${next}.getAttribute('aria-disabled')`), 'true')
  assert(
    Math.abs(
      (await evaluate(
        `document.querySelector('.home-picks').getBoundingClientRect().top`
      )) - tableTop
    ) < 1
  )
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await evaluate(`${prev}.click()`)
  await waitFor(
    '减少动态效果',
    `${firstCard} === ${JSON.stringify(secondAlbum)} && !document.querySelector('[class*="recommend-page-"]')`
  )
  await evaluate(`document.querySelectorAll('.home-content .feat')[${failureCardIndex}].click()`)
  await waitFor(
    '点选真实曲目',
    `document.querySelector('.win-bottom [data-title]')?.textContent === ${JSON.stringify(secondTrack)}`
  )
  // 点播其他专辑仍保留今日曲单，再模拟曲单封面加载失败。
  assert(await evaluate(`${bannerPlay}.textContent.trim() === '播放歌单' &&
    document.querySelector('[data-banner-mini-cover]').src === bannerFixtureCover`))
  await evaluate(`bannerFixtureTrack.cover = location.origin + '/missing-banner-cover.webp'; document.querySelector('.main').scrollTop = 110`)
  await waitFor(
    '切换到封面加载失败的曲目',
    `(() => {
    const img = document.querySelector('[data-banner-mini-cover]')
    const bg = document.querySelector('[data-banner-bg]')
    return document.querySelector('[data-banner-title]')?.textContent === '每日推荐' &&
      img?.getAttribute('src') === '/images/music-placeholder.svg' && img.naturalWidth > 0 &&
      !bg.style.getPropertyValue('--banner-accent') && getComputedStyle(bg).transitionDuration === '0s'
  })()`
  )
  const toast = `document.querySelector('.notification-toast')`
  const toastText = '当前曲目没有可用的播放地址，可在原平台打开。'
  await waitFor(
    '首页播放失败时显示毛玻璃提示并让出歌词与控件',
    `(() => {
    const notice = ${toast}
    const capsule = document.querySelector('.lyric-capsule')
    if (notice?.textContent.trim() !== ${JSON.stringify(toastText)}) return false
    const css = getComputedStyle(notice)
    return notice.closest('.glass-win') && css.backdropFilter.includes('blur(') &&
      css.backgroundImage === 'none' && css.pointerEvents === 'none' &&
      notice.getBoundingClientRect().bottom < capsule.getBoundingClientRect().top
  })()`
  )
  await evaluate(`(async () => {
    const { usePlayerStore } = await import('/src/stores/player.ts')
    usePlayerStore().state.settings.glassStyle = 'liquid'
    document.querySelector('.win-bottom [data-stage-toggle]').click()
  })()`)
  await waitFor(
    '全屏沿用提示位置并切换为液态玻璃',
    `(() => {
    const notice = ${toast}
    const stage = document.querySelector('.fs-open .fs-dock')
    if (!notice?.closest('.liquid-win') || !stage) return false
    const css = getComputedStyle(notice)
    return css.backgroundImage.includes('linear-gradient') && css.boxShadow.includes('inset') &&
      notice.getBoundingClientRect().top > document.querySelector('.fs-top').getBoundingClientRect().bottom &&
      notice.getBoundingClientRect().bottom < stage.getBoundingClientRect().top
  })()`
  )
  if (process.env.MIRAI_QA_SCREENSHOTS === '1') {
    const file = join(profile, 'fullscreen-notification.png')
    const image = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(file, Buffer.from(image.data, 'base64'))
    console.log(file)
  }
  await evaluate(`(async () => {
    document.querySelector('.fs-top [data-stage-toggle]').click()
    const { usePlayerStore } = await import('/src/stores/player.ts')
    usePlayerStore().state.settings.glassStyle = 'match'
  })()`)
  console.log('PASS 首页和全屏播放失败提示位置及玻璃样式')
  await evaluate(`location.hash = '#/recent'`)
  await waitFor(
    '播放失败不会伪造最近播放',
    `
    !!document.querySelector('[data-panel="recent"].active') &&
    document.querySelectorAll('[data-panel="recent"] .trow').length === 1 &&
    document.querySelector('[data-panel="recent"] .trow .tt b').textContent === ${JSON.stringify('曲目 ' + dailyAudioId)}
  `
  )
  assert.equal(
    await evaluate(
      `document.querySelectorAll('.sidebar [data-custom]').length`
    ),
    1
  )
  await evaluate(`document.querySelector('[data-newpl]').click()`)
  await waitFor(
    '新建歌单从空列表开始',
    `document.querySelector('[data-pl-meta]')?.textContent.includes('共 0 首')`
  )
  await evaluate(`location.hash = '#/smart'`)
  await waitFor(
    '智能歌单使用实际曲库',
    `document.querySelector('.smart-meta')?.textContent.trim() === '8 首'`
  )
  assert(
    await evaluate(
      `!document.querySelector('[data-panel="smart"]').textContent.includes('循环最多')`
    )
  )
  console.log('PASS 海报取色与双材质、长曲名、真实频谱、减少动效、键盘播放与折叠恢复')

  await resize(860, 740)
  await evaluate(`location.hash = '#/settings'`)
  await send('Page.reload')
  await waitFor(
    '设置页',
    `!!document.querySelector('[data-slide-value="audio"]')`
  )
  await checkDeferredEqualizer()
  await evaluate('document.fonts.ready.then(() => true)')
  const metrics = await evaluate(`(() => {
    const scroll = document.querySelector('main .panel-scroll')
    const footer = document.querySelector('main .panel-actions')
    const curve = document.querySelector('.eq-bands').closest('.set-card')
    const style = getComputedStyle(scroll)
    return {
      bottom: scroll.getBoundingClientRect().bottom,
      footer: footer.getBoundingClientRect().top,
      curve: curve.getBoundingClientRect().bottom,
      scrollbar: style.scrollbarWidth,
      scrollbarColor: style.scrollbarColor,
      gutter: style.scrollbarGutter,
      line: getComputedStyle(footer).borderTopColor,
      sidebar: getComputedStyle(document.querySelector('.sidebar')).borderRightColor
    }
  })()`)
  assert.equal(metrics.bottom, metrics.footer)
  assert.equal(metrics.scrollbar, 'thin')
  assert.equal(metrics.line, metrics.sidebar)
  assert(metrics.curve <= metrics.bottom, JSON.stringify(metrics))
  const band = `document.querySelector('.eq-band')`
  await evaluate(`${band}.focus()`)
  await key('ArrowUp', 38)
  assert.equal(await evaluate(`${band}.valueAsNumber`), 0.5)
  assert(
    await evaluate(
      `parseFloat(${band}.style.getPropertyValue('--eq-fill-start')) < 50`
    )
  )
  await key('ArrowDown', 40)
  await key('ArrowDown', 40)
  assert.equal(await evaluate(`${band}.valueAsNumber`), -0.5)
  assert(
    await evaluate(
      `parseFloat(${band}.style.getPropertyValue('--eq-fill-end')) > 50`
    )
  )
  if (process.env.MIRAI_QA_SCREENSHOTS === '1') {
    await evaluate(`${band}.blur()`)
    const file = join(profile, 'equalizer.png')
    const image = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(file, Buffer.from(image.data, 'base64'))
    console.log(file)
  }
  await evaluate(
    `${band}.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`
  )
  assert.equal(await evaluate(`${band}.valueAsNumber`), 0)
  const bounds = await evaluate(`(() => {
    const { x, y, width, height } = ${band}.getBoundingClientRect()
    return { x: x + width / 2, y: y + height / 2, target: y + height / 4 }
  })()`)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    buttons: 1,
    x: bounds.x,
    y: bounds.y,
    clickCount: 1,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    button: 'left',
    buttons: 1,
    x: bounds.x,
    y: bounds.target,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    buttons: 0,
    x: bounds.x,
    y: bounds.target,
    clickCount: 1,
  })
  assert(await evaluate(`${band}.valueAsNumber > 0`))
  await resize(680, 520)
  await evaluate(`document.querySelector('main .panel-scroll').focus()`)
  await key('End', 35)
  await waitFor(
    '设置最底部可以滚到',
    `(() => {
    const scroll = document.querySelector('main .panel-scroll')
    const last = [...scroll.querySelectorAll('button')].find(button => button.textContent.trim() === '保存预设')
    return last.getBoundingClientRect().bottom < scroll.getBoundingClientRect().bottom &&
      scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1
  })()`
  )
  assert.equal(
    await evaluate(
      `document.querySelector('main .panel-actions').getBoundingClientRect().bottom`
    ),
    520
  )
  await evaluate(
    `document.querySelector('[data-slide-value="general"]').click()`
  )
  await waitFor(
    '切换后回到顶部',
    `!document.querySelector('.eq-band') && document.querySelector('main .panel-scroll').scrollTop === 0`
  )
  await checkDeferredStorage()
  await evaluate(`[...document.querySelectorAll('main .panel-actions button')]
    .find(button => button.textContent.trim() === '取消').click()`)
  await waitFor('取消返回首页', `!!document.querySelector('.home-content')`)
  console.log('PASS 设置正文和底栏、滚动到底、EQ 正负增益、键盘与复位')

  await resize(860, 550)
  await evaluate(`localStorage.setItem('miraiMusic.publicPlatformProfiles.v1', JSON.stringify({
    netease: { userId: '123', displayName: '验证账号', syncedAt: Date.now() }
  })); location.hash = '#/connect'`)
  await send('Page.reload')
  const button = `document.querySelector('[data-plat-card="netease"] .plat-btn')`
  const dialog = `document.querySelector('.playlist-dialog')`
  const scroll = `${dialog}.querySelector('.panel-scroll')`
  await waitFor('关联账号按钮', `${button}?.textContent.includes('查看歌单')`)
  await evaluate(`${button}.click()`)
  await waitFor(
    '打开公开歌单选择弹窗',
    `${dialog}?.open && ${dialog}.querySelectorAll('.playlist-pick').length === 10`
  )
  const modalStyles = await evaluate(`(() => {
    const dialog = ${dialog}, list = ${scroll}, footer = dialog.querySelector('footer')
    const style = getComputedStyle(list)
    return {
      scrollbar: style.scrollbarWidth, scrollbarColor: style.scrollbarColor, gutter: style.scrollbarGutter,
      line: getComputedStyle(footer).borderTopColor,
      gap: footer.getBoundingClientRect().top - list.getBoundingClientRect().bottom,
      canScroll: list.scrollHeight > list.clientHeight,
      footerVisible: footer.getBoundingClientRect().bottom <= innerHeight,
    }
  })()`)
  assert.equal(modalStyles.scrollbar, metrics.scrollbar)
  assert.equal(modalStyles.scrollbarColor, metrics.scrollbarColor)
  assert.equal(modalStyles.gutter, metrics.gutter)
  assert.equal(modalStyles.line, metrics.line)
  assert.equal(modalStyles.gap, 0)
  assert(modalStyles.canScroll && modalStyles.footerVisible)
  await evaluate(`${scroll}.focus()`)
  await key('End', 35)
  await waitFor(
    '较矮窗口能滚到最后一个歌单',
    `(() => {
    const list = ${scroll}, row = list.querySelector('.playlist-pick:last-child')
    return list.scrollTop > 0 && row.getBoundingClientRect().bottom < list.getBoundingClientRect().bottom
  })()`
  )
  await key('Escape', 27)
  await waitFor('Escape 关闭歌单弹窗', `!${dialog}.open`)
  await evaluate(`${button}.click()`)
  await waitFor(
    '重新打开后能选择喜欢歌单',
    `${dialog}.open && !!${dialog}.querySelector('[aria-label="选择导入 喜欢的音乐"]')`
  )
  await evaluate(
    `${dialog}.querySelector('[aria-label="选择导入 喜欢的音乐"]').click()`
  )
  const confirmImport = `${dialog}.querySelector('footer .banner-play')`
  await waitFor('选择后可以导入', `!${confirmImport}.disabled`)
  const buttonSize = `(() => {
    const { width, height } = ${confirmImport}.getBoundingClientRect()
    return { width, height }
  })()`
  const idleSize = await evaluate(buttonSize)
  await evaluate(`${confirmImport}.click()`)
  await waitFor(
    '显示导入按钮的加载态',
    `${confirmImport}.getAttribute('aria-busy') === 'true'`
  )
  assert.deepEqual(await evaluate(buttonSize), idleSize)
  const spinnerLayout = await evaluate(`(() => {
    const button = ${confirmImport}
    const spinner = button.querySelector('.base-button-spinner')
    const text = button.lastElementChild
    const outer = button.getBoundingClientRect()
    const icon = spinner.getBoundingClientRect(), label = text.getBoundingClientRect()
    return {
      label: text.textContent.trim(), disabled: button.disabled,
      centerDifference: Math.abs((icon.top + icon.bottom - label.top - label.bottom) / 2),
      groupOffset: Math.abs((icon.left + label.right - outer.left - outer.right) / 2),
      gap: label.left - icon.right,
      reduced: getComputedStyle(spinner).animationName === 'none',
    }
  })()`)
  assert.equal(spinnerLayout.label, '正在导入…')
  assert(spinnerLayout.disabled && spinnerLayout.reduced)
  assert(spinnerLayout.centerDifference < 0.5 && spinnerLayout.groupOffset < 1)
  assert.equal(spinnerLayout.gap, 6)
  await send('Emulation.setEmulatedMedia', { features: [] })
  await waitFor(
    '正常动效显示转圈',
    `getComputedStyle(${confirmImport}.querySelector('svg')).animationName === 'spin'`
  )
  await evaluate(`document.body.classList.add('calm')`)
  assert.equal(
    await evaluate(
      `getComputedStyle(${confirmImport}.querySelector('svg')).animationName`
    ),
    'none'
  )
  await evaluate(`document.body.classList.remove('calm')`)
  await evaluate(
    `[...${dialog}.querySelectorAll('footer button')].find(button => button.textContent.trim() === '停止').click()`
  )
  await waitFor(
    '停止后恢复按钮',
    `!${confirmImport}.disabled && !${confirmImport}.querySelector('svg')`
  )
  assert.deepEqual(await evaluate(buttonSize), idleSize)
  await evaluate(`${confirmImport}.click()`)
  await waitFor(
    '重新导入再次显示加载态',
    `${confirmImport}.getAttribute('aria-busy') === 'true'`
  )
  releasePlaylistResponse()
  await waitFor(
    '喜欢歌单正常导入',
    `
    JSON.parse(localStorage.getItem('miraiMusic.publicPlaylists.v1')).some(playlist => playlist.id === '101' && playlist.title === '喜欢的音乐')
  `
  )
  console.log('PASS 歌单弹窗样式、加载态对齐与尺寸、动效设置、停止和重新导入')

  await evaluate(`location.hash = '#/'`)
  await waitFor('回首页验证长队列', `!!document.querySelector('.home-content')`)
  await seedLargeLibrary()
  const mountedRows = await checkVirtualQueue()
  await checkSavedProgress()
  const quality = `document.querySelector('.win-bottom .choice-trigger')`
  await evaluate(`fixturePlayer.state.settings.glassStyle='glass'; ${quality}.click()`)
  const panel = `document.querySelector('.choice-panel')`
  await waitFor('毛玻璃音质菜单', `${panel}?.parentElement.hasAttribute('data-player') && getComputedStyle(${panel}).backdropFilter.includes('16px')`)
  const qualityIcons = await evaluate(`Array.from(${panel}.querySelectorAll('[data-choice]'), row =>
    row.querySelector('svg[viewBox="0 0 24 24"][aria-hidden="true"] path')?.getAttribute('d'))`)
  assert(qualityIcons.every(Boolean) && new Set(qualityIcons).size === 5)
  await evaluate(`fixturePlayer.state.settings.glassStyle='liquid'`)
  await waitFor('液态玻璃菜单实时切换', `getComputedStyle(${panel}).backgroundImage.includes('gradient') && getComputedStyle(${panel}).backdropFilter.includes('saturate')`)
  const losslessIcon = await evaluate(`${panel}.querySelector('[data-choice="lossless"] path').getAttribute('d')`)
  await evaluate(`${panel}.querySelector('[data-choice="lossless"]').click()`)
  await waitFor('音质仅显示档位，选择后恢复入口焦点', `!${panel} && document.activeElement === ${quality} &&
    ${quality}.textContent.trim() === '无损' && ${quality}.getAttribute('aria-label') === '音质，无损'`)
  assert.equal(await evaluate(`${quality}.querySelector('svg path').getAttribute('d')`), losslessIcon)
  await evaluate(`fixturePlayer.state.idx = 0; ${playButton}.click()`)
  await until('点播携带所选的无损音质', () => requestedQualities.includes('lossless'))
  await evaluate(`fixturePlayer.state.settings.bottomSpectrum = false`)
  await waitFor('关闭底栏频谱后横幅仍可见', `getComputedStyle(${bottomSpectrum}).display === 'none' && ${bannerSpectrum}.clientHeight > 0`)
  console.log(`PASS 777 首队列挂载 ${mountedRows} 行，覆盖当前歌曲、键盘、拖放、图片懒加载、双材质及音质请求`)
  await checkCollectionGrids()
  const nativeSource = readFileSync(
    resolve(import.meta.dirname, '../src-tauri/src/desktop/appearance.rs'),
    'utf8'
  )
  const inset = Number(nativeSource.match(/SHADOW_INSET: f64 = ([\d.]+)/)[1])
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__MIRAI_WINDOW_FRAME__ = { custom: true, inset: ${inset} }`,
  })
  await send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 255, g: 255, b: 255, a: 1 },
  })
  // 一次跨文档导航应用外框注入，避免路由切换与立即刷新同时销毁测试上下文。
  await send('Page.navigate', { url: origin + '/?frame-check#/' })
  await waitFor(
    'Windows 10 外框挂载',
    `!!document.querySelector('.win10-frame .win')`
  )
  const bottom = await evaluate(`
    Math.round(document.querySelector('.win10-frame .win').getBoundingClientRect().bottom)
  `)
  const height = await evaluate('innerHeight')
  assert.equal(height - bottom, inset)
  const shadow = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 400, y: bottom, width: 40, height: inset, scale: 1 },
  })
  const pixels = await evaluate(`(async () => {
    const image = new Image()
    image.src = 'data:image/png;base64,${shadow.data}'
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const edgeX = Math.floor(image.width / 2)
    return Array.from({ length: image.height }, (_, y) =>
      context.getImageData(edgeX, y, 1, 1).data[0]
    )
  })()`)
  assert(pixels[1] < 225, '内沿仍有清晰柔影')
  assert(
    pixels.slice(-3).every(value => value >= 254),
    '阴影在窗口裁剪边缘前淡出'
  )
  assert(pixels.every((value, index) => !index || value >= pixels[index - 1]))
  assert.deepEqual(errors, [])
  console.log(
    'PASS 模拟 Windows 10 外框的底部阴影平滑淡出，透明留边保持原有尺寸'
  )
}

try {
  await runBrowserChecks()
} finally {
  releasePlaylistResponse()
  if (send && socket?.readyState === WebSocket.OPEN) {
    await Promise.race([send('Browser.close').catch(() => {}), delay(500)])
  }
  socket?.close()
  if (browser.exitCode === null) browser.kill()
}
