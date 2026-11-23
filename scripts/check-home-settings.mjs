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
const origin = 'http://127.0.0.1:1420'
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
function spectrumAudio() {
  const rate = 16000
  const samples = rate * 12
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
const wav = spectrumAudio()

let releasePlayback
const pendingPlayback = new Promise(resolve => { releasePlayback = resolve })
const requestedQualities = []
let socket
let send
let releasePlaylistResponse
const playlistResponse = new Promise(resolve => {
  releasePlaylistResponse = resolve
})
try {
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
        () => reject(new Error(`${method} 未返回`)),
        20_000
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
    const headers = [{ name: 'Access-Control-Allow-Origin', value: origin }]
    let data
    if (path === '/mirai-avatar-fixture.svg') {
      return send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }],
        body: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#e59173"/></svg>'
        ).toString('base64'),
      })
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
    } else if (path === '/api/v1/netease/tracks/1/playback') {
      requestedQualities.push(new URL(request.url).searchParams.get('quality'))
      await pendingPlayback
      data = {
        status: 'full',
        url: 'http://127.0.0.1:8000/api/v1/netease/tracks/1/audio',
      }
    } else if (/^\/api\/v1\/netease\/tracks\/\d+\/playback$/.test(path)) {
      data = { status: 'unavailable', url: null }
    } else if (path === '/api/v1/netease/tracks/1/lyrics') {
      data = {
        lrc: '[00:00.00]街灯落在静水上\n[00:04.00]夜色穿过城市\n[00:08.00]The sky opens up again',
        translatedLrc:
          '[00:00.00]Streetlights settle on the still water\n[00:04.00]Evening moves through the city',
        yrc: '[0,3800](0,800,0)街灯(800,1200,0)落在(2000,1800,0)静水上\n[4000,3800](4000,1000,0)夜色(5000,1000,0)穿过(6000,1800,0)城市',
        ytlrc:
          '[0,3800](0,600,0)Streetlights (600,1500,0)settle on (2200,1500,0)the still water\n[00:04.00]Evening moves through the city',
      }
    } else if (path === '/api/v1/netease/tracks/1/audio') {
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
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
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
  const waitFor = (label, expression) =>
    until(label, () => evaluate(expression))
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Fetch.enable', {
    patterns: [
      { urlPattern: 'http://127.0.0.1:8000/*' },
      { urlPattern: 'https://api.open-meteo.com/*' },
      { urlPattern: '*/*missing-banner-cover.webp' },
      { urlPattern: 'https://p1.music.126.net/mirai-avatar-fixture.svg' },
    ],
  })
  await resize(1240, 820)
  await send('Page.navigate', { url: origin })
  await waitFor(
    '空曲库首页',
    `document.querySelector('.win-bottom [data-play]')?.disabled`
  )
  assert(
    await evaluate(
      `document.querySelector('.home-content').textContent.includes('暂无推荐专辑')`
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
  assert.equal(
    await evaluate(`!!document.querySelector('main .banner')`),
    false
  )
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
    `document.querySelector('[data-banner-title]')?.textContent === '首次导入' &&
    document.querySelector('[data-banner-sub]')?.textContent === '歌手'`
  )
  console.log('PASS 空曲库、资料登记、直接进入详情和动态挂载横幅')

  await evaluate(`localStorage.setItem('miraiMusic.publicPlatformProfiles.v1', JSON.stringify({
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
  await evaluate(`(async () => {
    const { usePlayerStore } = await import('/src/stores/player.ts')
    usePlayerStore().setLinkedProfile('netease', null)
  })()`)
  console.log('PASS 旧网易云关联补齐公开头像并保留关联时间')
  const firstCard = `document.querySelector('.home-content .feat b')?.textContent`
  const prev = `document.querySelector('[aria-label="上一页推荐专辑"]')`
  const next = `document.querySelector('[aria-label="下一页推荐专辑"]')`
  await waitFor('恢复已导入歌单', `${firstCard} === '专辑 1'`)
  await waitFor(
    '主打封面颜色和标题',
    `
    document.querySelector('[data-banner-title]')?.textContent === '曲目 1' &&
    document.querySelector('[data-banner-sub]')?.textContent === '歌手 1 · 专辑 1' &&
    document.querySelector('[data-banner-mini-cover]')?.naturalWidth > 0 &&
    document.querySelector('.banner-girl')?.naturalWidth > 0 &&
    !!document.querySelector('[data-banner-bg]')?.style.getPropertyValue('--banner-accent')
  `
  )
  const bannerLook = await evaluate(`(() => {
    const banner = document.querySelector('[data-banner]')
    const bg = getComputedStyle(banner.querySelector('[data-banner-bg]'))
    const girl = banner.querySelector('.banner-girl')
    const artwork = document.createElement('canvas')
    artwork.width = 200; artwork.height = 130
    const paint = artwork.getContext('2d', { willReadFrequently: true })
    paint.drawImage(girl, 0, 0, 200, 130)
    const removedWave = paint.getImageData(190, 62, 8, 14).data
    return { gradient: bg.backgroundImage.includes('radial-gradient') && !bg.backgroundImage.includes('url('),
      covers: banner.querySelectorAll('.banner-covers, [data-bc]').length,
      girl: girl.naturalWidth > 0 && getComputedStyle(girl).maskImage.includes('linear-gradient'),
      clean: girl.getAttribute('src').endsWith('/featured-singer-clean.png') &&
        removedWave.every((value, index) => index % 4 !== 3 || value <= 8) }
  })()`)
  assert.deepEqual(bannerLook, {
    gradient: true,
    covers: 0,
    girl: true,
    clean: true,
  })
  const bannerSpectrum = `document.querySelector('[data-banner-spectrum]')`
  const bottomSpectrum = `document.querySelector('[data-spectrum]')`
  await waitFor(
    '横幅频谱挂载',
    `${bannerSpectrum}?.dataset.spectrumMode === 'static'`
  )
  const spectrumLayout = await evaluate(`(() => {
    const spectrum = ${bannerSpectrum}
    const { x, y, width, height } = spectrum.getBoundingClientRect()
    const banner = spectrum.closest('[data-banner]')
    const bounds = banner.getBoundingClientRect()
    const text = banner.querySelector('.banner-content').getBoundingClientRect()
    const stage = banner.querySelector('.banner-stage')
    const portrait = stage.querySelector('img').getBoundingClientRect()
    return { width, height, relativeX: (x + width / 2 - bounds.x) / bounds.width,
      relativeY: (y + height / 2 - bounds.y) / bounds.height,
      titleGap: x - text.right, behindPortrait: x + width > portrait.left &&
        Number(getComputedStyle(stage).zIndex) > Number(getComputedStyle(spectrum).zIndex) }
  })()`)
  assert(spectrumLayout.width > 250 && spectrumLayout.height <= 76)
  assert(
    spectrumLayout.relativeX > 0.67 &&
      spectrumLayout.relativeY > 0.55 &&
      spectrumLayout.relativeY < 0.68
  )
  assert(spectrumLayout.titleGap >= 0 && spectrumLayout.behindPortrait)
  const bannerPlay = `document.querySelector('.banner-content [data-banner-play]')`
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
  await resize(1240, 820)
  await evaluate(`${bannerPlay}.focus()`)
  await key('Enter', 13)
  const playButton = `document.querySelector('.win-bottom [data-play]')`
  await waitFor('原位显示等待中的播放按钮', `${playButton}.getAttribute('aria-busy') === 'true'`)
  await evaluate(`${playButton}.click()`)
  await waitFor('点击加载按钮取消点播', `${playButton}.getAttribute('aria-busy') === 'false'`)
  await evaluate(`${playButton}.click()`)
  await waitFor('再次点击开始获取', `${playButton}.getAttribute('aria-busy') === 'true'`)
  releasePlayback()
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
    ${bannerSpectrum}.dataset.spectrumMode === 'static' && !document.querySelector('audio').paused
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
    `${bannerSpectrum}.dataset.spectrumMode === 'static' && document.querySelector('audio').paused`
  )
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
  await evaluate(`${stagePlay}.click()`)
  await waitFor(
    '继续播放时逐字进度随真实媒体时钟前进',
    `${wordFills}[1] > 33 && !document.querySelector('audio').paused`
  )
  await evaluate(`${stagePlay}.click()`)
  await waitFor('暂停媒体', `document.querySelector('audio').paused`)
  await evaluate(`document.querySelector('audio').currentTime = 0.32`)
  await waitFor('后跳后重新填色', `JSON.stringify(${wordFills}) === '[40,0,0]'`)
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await waitFor(
    '少动效时按词段边界高亮',
    `JSON.stringify(${wordFills}) === '[100,0,0]'`
  )
  await send('Emulation.setEmulatedMedia', { features: [] })
  await evaluate(`document.querySelector('audio').currentTime = 8.1`)
  await waitFor(
    '只有 LRC 的句子继续整句高亮',
    `${lyrics}.querySelector('.fl-line.on .fl-o')?.textContent === 'The sky opens up again' &&
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
  const coverSize = `(() => { const box = document.querySelector('.fs-cover').getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)] })()`
  await delay(350)
  const glowDesktop = await evaluate(coverSize)
  await resize(620, 740)
  await delay(200)
  const glowNarrow = await evaluate(coverSize)
  await resize(1240, 820)
  const themeTabs = 'document.querySelector(".fs-theme-seg")'
  const activeTheme = `${lyrics}.closest('[data-lyric-theme]').dataset.lyricTheme`
  // 从实际的滑动胶囊切换主题，焦点移动不提前提交选择。
  async function chooseTheme(theme) {
    await evaluate(`${themeTabs}.querySelector('[data-slide-value="${theme}"]').click()`)
  }
  await evaluate(`${themeTabs}.querySelector('button').focus()`)
  await key('End', 35)
  await waitFor('键盘定位到末尾主题', `document.activeElement?.dataset.slideValue === 'chat' && ${activeTheme} === 'glow'`)
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
  assert.deepEqual(await evaluate(coverSize), glowDesktop)
  await resize(620, 740)
  await delay(220)
  assert.deepEqual(await evaluate(coverSize), glowNarrow)
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
  await captureLyricsTheme('ink')
  await chooseTheme('glow')
  await chooseTheme('cinema')
  await waitFor(
    '连续切换以字幕主题为准，歌词居中且保留词段进度',
    `${activeTheme} === 'cinema' &&
      getComputedStyle(${lyrics}.querySelector('.fl-line.on')).textAlign === 'center' &&
      JSON.stringify(${wordFills}) === '[100,33,0]'`
  )
  await captureLyricsTheme('cinema')
  await chooseTheme('glow')
  await waitFor('恢复微光排版', `${activeTheme} === 'glow'`)
  console.log('PASS 真实媒体时钟逐字填色、整句回退、少动效与三种歌词主题')
  await evaluate(`${reading}.click()`)
  await waitFor(
    '阅读模式居中且沿用当前句',
    `(() => {
    const viewport = ${lyrics}
    if (!viewport?.closest('.fs-reading') || ${reading}.getAttribute('aria-pressed') !== 'true') return false
    const bounds = viewport.getBoundingClientRect()
    const win = viewport.closest('.fs').getBoundingClientRect()
    return Math.abs(bounds.left + bounds.width / 2 - (win.left + win.width / 2)) < 10 &&
      !!viewport.querySelector('.fl-line.on')
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
  await waitFor(
    '重新展开横幅',
    `(() => {
      const banner = document.querySelector('[data-banner]')
      return banner.getBoundingClientRect().height === 224 &&
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
  const secondTrack = `曲目 ${pageSize + 1}`
  const tableTop = await evaluate(
    `document.querySelector('.home-content .table-head').getBoundingClientRect().top`
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
        `document.querySelector('.home-content .table-head').getBoundingClientRect().top`
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
  await evaluate(`document.querySelector('.home-content .feat').click()`)
  await waitFor(
    '点选真实曲目',
    `document.querySelector('.win-bottom [data-title]')?.textContent === ${JSON.stringify(secondTrack)}`
  )
  await waitFor(
    '切换到封面加载失败的曲目',
    `(() => {
    const img = document.querySelector('[data-banner-mini-cover]')
    const bg = document.querySelector('[data-banner-bg]')
    return document.querySelector('[data-banner-title]')?.textContent === ${JSON.stringify(secondTrack)} &&
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
    document.querySelector('[data-panel="recent"] .trow').textContent.includes('曲目 1')
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
  console.log('PASS 右侧双向实频、立绘挡层、暂停与减少动效、横幅折叠和推荐翻页')

  await resize(860, 740)
  await evaluate(`location.hash = '#/settings'`)
  await send('Page.reload')
  await waitFor(
    '设置页',
    `!!document.querySelector('[data-slide-value="audio"]')`
  )
  await evaluate(`document.querySelector('[data-slide-value="audio"]').click()`)
  await waitFor('十频段', `document.querySelectorAll('.eq-band').length === 10`)
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
  await evaluate(`(async () => {
    const {usePlayerStore} = await import('/src/stores/player.ts')
    const store = usePlayerStore()
    window.fixturePlayer = store
    store.state.queue = store.registerCatalogTracks(Array.from({ length: 777 }, (_, i) => ({
      platform: 'netease', id: String(10000+i), title: '队列 ' + i, artists: ['样本'], album: '队列验证',
      durationMs: 120000, coverUrl: null, sourceUrl: 'https://music.163.com/song?id=' + (10000+i)
    })))
    store.state.idx = store.state.queue[420]
  })()`)
  const queueButton = `document.querySelector('.win-bottom button[aria-label="播放队列"]')`
  const queue = `document.querySelector('.main-queue')`
  await evaluate(`${queueButton}.click()`)
  await waitFor('长队列打开并定位当前歌曲', `${queue}?.querySelector('[aria-current=true]')?.dataset.qpos === '420'`)
  const mountedRows = await evaluate(`${queue}.querySelectorAll('.qrow').length`)
  assert(mountedRows > 0 && mountedRows < 35, String(mountedRows))
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
  const quality = `document.querySelector('.win-bottom [aria-label="音质"]')`
  await evaluate(`fixturePlayer.state.settings.glassStyle='glass'; ${quality}.click()`)
  const panel = `document.querySelector('.choice-panel')`
  await waitFor('毛玻璃音质菜单', `${panel}?.parentElement.hasAttribute('data-player') && getComputedStyle(${panel}).backdropFilter.includes('16px')`)
  await evaluate(`fixturePlayer.state.settings.glassStyle='liquid'`)
  await waitFor('液态玻璃菜单实时切换', `getComputedStyle(${panel}).backgroundImage.includes('gradient') && getComputedStyle(${panel}).backdropFilter.includes('saturate')`)
  await evaluate(`${panel}.querySelector('[data-choice="lossless"]').click()`)
  await waitFor('选择品质后恢复入口焦点', `!${panel} && document.activeElement === ${quality} && ${quality}.textContent.includes('无损')`)
  await evaluate(`fixturePlayer.state.idx = 0; ${playButton}.click()`)
  await until('点播携带所选的无损音质', () => requestedQualities.includes('lossless'))
  await evaluate(`fixturePlayer.state.settings.bottomSpectrum = false`)
  await waitFor('关闭底栏频谱后横幅仍可见', `getComputedStyle(${bottomSpectrum}).display === 'none' && ${bannerSpectrum}.clientHeight > 0`)
  console.log(`PASS 777 首队列挂载 ${mountedRows} 行，覆盖当前歌曲、键盘、拖放、图片懒加载、双材质及音质请求`)
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
  await send('Page.navigate', { url: origin + '/#/' })
  await send('Page.reload')
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
} finally {
  releasePlaylistResponse()
  if (send && socket?.readyState === WebSocket.OPEN) {
    await Promise.race([send('Browser.close').catch(() => {}), delay(500)])
  }
  socket?.close()
  if (browser.exitCode === null) browser.kill()
}
