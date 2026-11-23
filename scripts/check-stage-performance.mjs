import assert from 'node:assert/strict'

// 通过真实媒体、浏览器 DOM 变更与网络拦截验证首页与全屏之间的工作量。
export async function checkStagePerformance({ evaluate, waitFor, key, resize, waitForStageRequest, releaseStage }) {
  const entry = "document.querySelector('.win-bottom [data-stage-toggle]')"
  const close = "document.querySelector('.fs-top [data-stage-toggle]')"
  const stage = "document.querySelector('[data-fs-lyrics]')"
  const side = "document.querySelector('[data-lyric]')"
  await waitFor('首页已挂载', `!!${entry}`)
  assert.equal(await evaluate("document.querySelector('[data-fs]')?.childElementCount ?? 0"), 0)
  assert.equal(await evaluate("performance.getEntriesByType('resource').some(r => r.name.includes('/PlayerFullscreen.vue'))"), false)
  await evaluate(`(async () => {
    const store = (await import('/src/stores/player.ts')).usePlayerStore()
    store.registerCatalogTracks([{ platform: 'netease', id: '1', title: '测量', artists: ['歌手'],
      album: '专辑', durationMs: 240000, sourceUrl: 'https://music.163.com/song?id=1', coverUrl: null }])
  })()`)
  await waitFor('曲库可点播', "!!document.querySelector('.home-content .trow')")
  await evaluate("document.querySelector('.home-content .trow').click()", true)
  await waitFor('真实媒体与歌词就绪', "document.querySelector('audio').currentTime > 0.15 && document.querySelector('[data-player]').classList.contains('playing') && document.querySelector('[data-capsule-text]')?.textContent.includes('句')")
  await evaluate("document.querySelector('.win-bottom [data-play]').click()", true)
  await waitFor('暂停事件完成', "!document.querySelector('[data-player]').classList.contains('playing')")
  assert.equal(await evaluate(`${side}.childElementCount`), 0)
  const staticWrites = await evaluate(`(() => {
    const observer = new MutationObserver(() => {})
    observer.observe(document.querySelector('[data-player]'), { subtree: true, attributes: true, childList: true })
    const audio = document.querySelector('audio')
    for (let i = 0; i < 20; i++) audio.dispatchEvent(new Event('timeupdate'))
    const changes = observer.takeRecords()
    observer.disconnect()
    return changes.filter(change => change.target.matches?.('[data-cover],[data-title],[data-volbtn],.vol')).length
  })()`)
  assert.equal(staticWrites, 0)
  await evaluate(`${entry}.click()`)
  await waitFor('加载失败有反馈', "document.querySelector('.notification-toast')?.textContent.includes('全屏舞台加载失败')")
  await evaluate(`${entry}.click()`)
  await waitForStageRequest()
  assert.equal(await evaluate(`${entry}.getAttribute('aria-busy')`), 'true')
  await key('Escape', 27)
  await releaseStage()
  await waitFor('取消后模块已返回', "performance.getEntriesByType('resource').filter(r => r.name.includes('/PlayerFullscreen.vue')).length >= 2")
  assert.equal(await evaluate("!!document.querySelector('.fs-open, [data-fs]')"), false)
  await evaluate(`${entry}.click()`)
  await waitFor('首次展开长歌词', `!!${stage}?.querySelector('.fl-line.on') && document.activeElement === ${close}`)
  const initialRows = await evaluate(`${stage}.querySelectorAll('.fl-line').length`)
  assert(initialRows > 0 && initialRows <= 64, `首次展开挂载 ${initialRows} 行`)
  assert.equal(await evaluate(`${stage}.querySelectorAll('.fl-word').length`), 2)
  await evaluate("document.querySelector('audio').currentTime = 1.05")
  try {
    await waitFor('起始唱句', `${stage}.querySelector('.on')?.dataset.lj === '2'`)
  } catch (error) {
    const position = await evaluate(`(async () => {
      const media = document.querySelector('audio')
      const { state } = (await import('/src/stores/player.ts')).usePlayerStore()
      return { media: media.currentTime, paused: media.paused, duration: media.duration, playing: state.playing,
        time: state.t, stage: state.stage, lyric: ${stage}.querySelector('.on')?.outerHTML?.slice(0, 240) }
    })()`)
    throw new Error(JSON.stringify(position), { cause: error })
  }
  await evaluate(`window.changedRows = new Set()
    window.rowObserver = new MutationObserver(records => {
      for (const record of records) if (record.target.matches('.fl-line')) changedRows.add(record.target)
    })
    rowObserver.observe(${stage}, { attributes: true, subtree: true })
    document.querySelector('audio').currentTime = 1.55`)
  await waitFor('相邻唱句', `${stage}.querySelector('.on')?.dataset.lj === '3'`)
  const touched = await evaluate('rowObserver.disconnect(); changedRows.size')
  assert(touched > 0 && touched <= 4, `相邻换句改动了 ${touched} 行`)
  await evaluate(`${stage}.querySelector('.on').focus()`)
  await key('End', 35)
  await waitFor('键盘浏览长歌词末行', "document.activeElement.dataset.lj === '479'")
  await waitFor('末行在视口内', `(() => {
    const last = document.activeElement.getBoundingClientRect(), box = ${stage}.getBoundingClientRect()
    return last.top >= box.top - 2 && last.bottom <= box.bottom + 2 && ${stage}.querySelectorAll('.fl-line').length <= 80
  })()`)
  await key('Escape', 27)
  await waitFor('退出恢复入口焦点', `!document.querySelector('.fs-open') && document.activeElement === ${entry}`)
  await evaluate("document.querySelector('audio').currentTime = 3.1")
  await waitFor('首页胶囊继续同步', "document.querySelector('[data-capsule-text]')?.textContent === '第6句'")
  assert.equal(await evaluate(`${stage}.querySelector('.on').dataset.lj`), '3')
  await evaluate("document.querySelector('[data-lyricbtn]').click()")
  await waitFor('侧栏首次展开即同步', `${side}.children.length === 480 && !${side}.children[6].classList.contains('dim')`)
  await evaluate(`${entry}.click()`)
  await waitFor('重新打开同步至媒体时钟', `${stage}.querySelector('.on')?.dataset.lj === '6'`)
  await waitFor('重新打开定位当前句', `(() => {
    const current = ${stage}.querySelector('.on').getBoundingClientRect(), box = ${stage}.getBoundingClientRect()
    return Math.abs(current.top + current.height / 2 - box.top - box.height / 2) < 5
  })()`)
  await resize(860, 640)
  await evaluate("document.querySelector('[data-slide-value=\"chat\"]').click()")
  await waitFor('对话主题就绪', "!!document.querySelector('.fs[data-lyric-theme=\"chat\"]')")
  await evaluate("document.querySelector('audio').currentTime = 112.1")
  const centered = `(() => {
    const active = ${stage}.querySelector('.on'), bounds = ${stage}.getBoundingClientRect()
    if (active?.dataset.lj !== '224') return false
    const rect = active.getBoundingClientRect()
    return Math.abs(rect.top + rect.height / 2 - bounds.top - bounds.height / 2) < 5
  })()`
  await waitFor('跨组跳转后双语长句居中', centered)
  const translatedHeight = await evaluate(`${stage}.querySelector('.on').offsetHeight`)
  await evaluate("document.querySelector('[aria-label=\"显示译文\"]').click()")
  await waitFor('关闭译文按实际行高重新居中', `${centered} && ${stage}.querySelector('.on').offsetHeight < ${translatedHeight}`)
  const bubbles = await evaluate(`(() => {
    const left = ${stage}.querySelector('[data-lj="224"]'), right = ${stage}.querySelector('[data-lj="223"]')
    const incoming = left.getBoundingClientRect(), outgoing = right.getBoundingClientRect()
    return { offset: outgoing.left - incoming.left, gap: incoming.top - outgoing.bottom }
  })()`)
  assert(bubbles.offset > 0, JSON.stringify(bubbles))
  assert(bubbles.gap > 0, JSON.stringify(bubbles))
  await evaluate(`${stage}.querySelector('.on').focus()`)
  await key('End', 35)
  await key('Enter', 13)
  await waitFor('末行跨组点播使用真实媒体时间', `Math.abs(document.querySelector('audio').currentTime - 239.52) < 0.02 && ${stage}.querySelector('.on')?.dataset.lj === '479'`)
  await evaluate(`${stage}.dispatchEvent(new WheelEvent('wheel', { deltaY: -250 }));
    ${stage}.scrollTo({ top: ${stage}.scrollHeight * 0.45, behavior: 'instant' })`)
  await waitFor('手动滚动加载中段并有返回入口', `(() => {
    const focused = Number(${stage}.querySelector('.focus')?.dataset.lj)
    return focused > 120 && focused < 340 && !document.querySelector('[data-lyrreturn]').hidden
  })()`)
  await evaluate("document.querySelector('[data-lyrreturn]').click()")
  await waitFor('返回当前句后末行仍可见', `(() => {
    const current = ${stage}.querySelector('.on').getBoundingClientRect(), box = ${stage}.getBoundingClientRect()
    return Math.abs(current.top + current.height / 2 - box.top - box.height / 2) < 10
  })()`)
  // 在同一舞台样式和窗口内交替测量两种方案的首次建树与同步布局，避免用耗时作为断言。
  const timing = await evaluate(`(async () => {
    const { createLyricWindow } = await import('/src/services/player/lyric-window.js')
    const current = ${stage}
    const samples = Array.from(current.querySelectorAll('.fl-line'), row => row.outerHTML)
    const rows = Array.from({ length: 480 }, (_, i) => samples[i % samples.length])
    const times = { css: [], virtual: [] }
    const sheet = document.createElement('style')
    sheet.textContent = '.measure-lyrics-css .fl-line { content-visibility:auto; contain-intrinsic-block-size:auto 72px }'
    document.head.append(sheet)
    try {
      for (let pass = 0; pass < 7; pass++) {
        for (const mode of (pass % 2 ? ['css', 'virtual'] : ['virtual', 'css'])) {
          const sample = current.cloneNode(false)
          sample.removeAttribute('data-fs-lyrics')
          sample.classList.add('measure-lyrics-' + mode)
          Object.assign(sample.style, { position: 'absolute', inset: '0 auto auto 0', width: current.clientWidth + 'px', height: current.clientHeight + 'px' })
          current.parentElement.append(sample)
          const start = performance.now()
          if (mode === 'css') sample.innerHTML = rows.join('')
          else createLyricWindow(sample, rows.length, (group, from, end) => {
            group.innerHTML = rows.slice(from, end).join('')
          }).sync(0, true)
          void sample.scrollHeight
          times[mode].push(performance.now() - start)
          sample.remove()
        }
      }
    } finally { sheet.remove() }
    return Object.fromEntries(Object.entries(times).map(([mode, values]) => [mode, values.sort((a,b) => a-b)[3].toFixed(1)]))
  })()`)
  console.log(`PASS 首页舞台和隐藏歌词均为 0 行，20 次进度事件改写静态控件 ${staticWrites} 次；480 句首次挂载 ${initialRows} 行，相邻换句更新 ${touched} 行，挂载 2 个词段。已验证取消、重试、键盘末行与重新打开定位。`)
  console.log(`480 行对话样本建树与同步布局中位数（7 次）：仅 CSS 跳过屏外排版 ${timing.css} ms，分组虚拟渲染 ${timing.virtual} ms。`)
}
