import { createFullscreenMotion } from '@/services/player/fullscreen-motion'
import { fullscreenTitleClass } from '@/services/player/fullscreen-title'
import { parseEqualizerGains } from '@/services/player/equalizer'
import { createCatalogAudio } from '@/services/player/catalog-audio'
import { parseCatalogLyrics } from '@/services/player/catalog-lyrics'
import { metaSeed } from '@/utils/stable-seed'
import { createLyricWindow, lyricRow, mountedLyricRows } from '@/services/player/lyric-window'
import { getCatalogLyrics } from '@/api'
import { defaultCover, emptyTrack } from '@/constants/music'
import { notify } from '@/services/notification'
import { recentSearches } from '@/services/player/preferences'
import { favoriteHint, favoriteKey, favoriteTarget } from '@/services/player/favorites'

// 此文件直接迁自 ui/music-player-glass-vs-minimal.html 的脚本。
// 页面、列表和状态由 Vue / Pinia 管理；保留播放时序、歌词跟随和原始动画协调。
export function mountSourcePlayer(root, options = {}) {
  const nativeDocument = root.ownerDocument
  const nativeWindow = nativeDocument.defaultView
  const cleanups = []
  const timeouts = new Set()
  const frames = new Set()
  const bound = new WeakMap()
  // 路由组件重复挂载时只绑定新节点，公共布局监听在卸载时统一释放。
  function listenElement(el, type, handler, config) {
    const key = type + '|' + handler.toString()
    let keys = bound.get(el)
    if (!keys) {
      keys = new Set()
      bound.set(el, keys)
    }
    if (keys.has(key)) return
    keys.add(key)
    el.addEventListener(type, handler, config)
  }
  let destroyed = false
  let nativeDirection = 1

  // 将原稿查询限定在当前页面，避免影响独立桌面窗口或其他 Vue 视图。
  const document = {
    get body() {
      return nativeDocument.body
    },
    get activeElement() {
      return nativeDocument.activeElement
    },
    querySelectorAll: selector => root.querySelectorAll(selector),
    getElementById: id => root.querySelector('[id="' + id + '"]'),
    createElement: tag => nativeDocument.createElement(tag),
    addEventListener(type, handler, config) {
      nativeDocument.addEventListener(type, handler, config)
      cleanups.push(() =>
        nativeDocument.removeEventListener(type, handler, config)
      )
    },
  }
  const window = nativeWindow

  // 注册需要在 Vue 页面退出时移除的原稿窗口监听。
  function listenWindow(type, handler, config) {
    nativeWindow.addEventListener(type, handler, config)
    cleanups.push(() => nativeWindow.removeEventListener(type, handler, config))
  }
  // 跟踪原稿延时动画，卸载后取消尚未执行的回调。
  function setTimeout(handler, delay) {
    const id = nativeWindow.setTimeout(() => {
      timeouts.delete(id)
      if (!destroyed) handler()
    }, delay)
    timeouts.add(id)
    return id
  }
  // 原稿取消动画延时后同步释放记录。
  function clearTimeout(id) {
    nativeWindow.clearTimeout(id)
    timeouts.delete(id)
  }
  // 跟踪原稿视差、歌词和切歌过渡的动画帧。
  function requestAnimationFrame(handler) {
    const id = nativeWindow.requestAnimationFrame(time => {
      frames.delete(id)
      if (!destroyed) handler(time)
    })
    frames.add(id)
    return id
  }
  // 原稿主动停止动画时同时清理帧记录。
  function cancelAnimationFrame(id) {
    nativeWindow.cancelAnimationFrame(id)
    frames.delete(id)
  }

  const TRACKS = options.tracks
  // 转义曲目和歌词文字，保持原稿生成内容的安全边界。
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  }
  const noLines = []
  const unavailableLines = [{ t: 0, o: '暂无歌词', tr: '' }]
  // 歌词只使用当前曲目的真实时间轴，空播放器不创建歌词行。
  function fsLinesFor(idx) {
    if (!TRACKS[idx]) return noLines
    return catalogLyrics || unavailableLines
  }
  // 在有序时间轴中定位当前句，首句之前返回 -1，支持向前或向后拖动。
  function lyricIndexAt(lines, time) {
    let left = 0, right = lines.length
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (lines[mid].t <= time + 0.001) left = mid + 1
      else right = mid
    }
    return left - 1
  }
  var VOL_SPK = '<path d="M11 5L6 9H3v6h3l5 4z"/>'
  var ICON_VOL_HIGH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    VOL_SPK +
    '<path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.6 5.4a9.5 9.5 0 010 13.2"/></svg>'
  var ICON_VOL_LOW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    VOL_SPK +
    '<path d="M15.5 10a2.9 2.9 0 010 4"/></svg>'
  var ICON_VOL_MUTE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    VOL_SPK +
    '<path d="M16 9.6l5.4 5.4M21.4 9.6L16 15"/></svg>'
  const state = options.state
  // 所有红心入口将点击时的曲库位置交给同一个账号收藏流程。
  function toggleFavorite() {
    return options.toggleFavorite(state.idx)
  }
  // 平台页和电台页各自沿用宽内容模式，其余页面保持常规面板设置。
  function nowPlayingKey() {
    return state.page === 'connect' || state.page === 'radio'
      ? 'npWideOpen'
      : 'npOpen'
  }
  let catalogLyrics = null
  let hasTimedLyrics = false
  let stageRequest
  let stageTrigger
  let lyricRequest
  let wordCue
  let wordFrame
  const audio = createCatalogAudio(root, {
    time(time, duration) {
      if (state.resumeTime > 0 && duration > 0) {
        const target = Math.min(duration - 0.1, state.resumeTime)
        state.resumeTime = 0
        audio.seek(Math.max(0, target))
        state.t = Math.max(0, target)
        state.streamDuration = duration
        render()
        return
      }
      const durationChanged = state.streamDuration !== duration
      state.t = time
      state.streamDuration = duration
      if (durationChanged) render()
      else renderClock()
    },
    equalizer(status) {
      state.equalizerStatus = status
    },
    playing(playing) {
      state.playing = playing
      if (playing && TRACKS[state.idx]?.catalog && state.recent[0] !== state.idx) {
        state.recent = [state.idx, ...state.recent.filter(index => index !== state.idx)]
      }
      render()
    },
    status(status) {
      state.catalogStatus = status
    },
    // 底栏与全屏按钮共用音频请求的生命周期。
    loading(loading) {
      if (state.audioLoading === loading) return
      state.audioLoading = loading
      options.onStateChange?.(getSnapshot())
    },
    // 只公布音源实际返回的档位或码率。
    quality(quality) {
      state.actualQuality = quality
    },
    ended: finishPlayback,
  })

  // 在线歌曲以音频时长为准，加载前用平台曲目时长。
  function currentDuration() {
    return state.streamDuration || TRACKS[state.idx]?.dur || 0
  }

  // 所有播放视图的进度操作都控制同一个音频元素。
  function seekTo(time) {
    if (!TRACKS[state.idx]) return
    state.resumeTime = 0
    state.t = Math.max(0, Math.min(currentDuration(), time))
    if (TRACKS[state.idx].catalog) audio.seek(state.t)
    renderClock()
  }

  // 拉取当前曲目的歌词，切歌后忽略上一请求结果。
  async function loadCatalogLyrics(track) {
    const request = new AbortController()
    lyricRequest = request
    try {
      const result = await getCatalogLyrics(
        track.platform,
        track.id,
        request.signal
      )
      if (request.signal.aborted) return
      const lines = parseCatalogLyrics(result)
      if (lines.length) {
        catalogLyrics = lines
        hasTimedLyrics = lines.some(line => line.words || line.trWords)
        render()
      }
    } catch {
      // 歌词不可用时仍可正常听歌。
    }
  }
  const { animateFsTrackChange, animateFsEntrance, cancelFsStageAnims } =
    createFullscreenMotion({
      players,
      state,
      tracks: TRACKS,
      document,
      window,
      setTimeout,
      queueNextTi,
    })
  var fsCloseTimer = null
  // 用户切换系统减少动态效果时，立即交还舞台的 CSS 静止状态。
  const stageMotionPreference = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  )
  function cancelStageMotion() {
    players().forEach(function (p) {
      cancelFsStageAnims(p.querySelector('[data-fs]'))
    })
  }
  function syncStageMotionPreference() {
    if (stageMotionPreference.matches) cancelStageMotion()
    if (wordCue) paintLyricWords(audio.position() ?? state.t)
  }
  stageMotionPreference.addEventListener('change', syncStageMotionPreference)
  cleanups.push(() => {
    stageMotionPreference.removeEventListener(
      'change',
      syncStageMotionPreference
    )
    cancelStageMotion()
  })

  // 仅更新正在唱的句子，暂停和拖动时也用真实媒体位置重算填色。
  function paintLyricWords(time) {
    const smooth = state.settings.motion && !stageMotionPreference.matches
    for (const part of wordCue.parts) {
      const elapsed = time - part.word.start
      const progress = smooth && part.word.duration > 0
        ? Math.max(0, Math.min(1, elapsed / part.word.duration))
        : Number(elapsed >= 0)
      const percent = Math.round(progress * 100)
      if (part.percent === percent) continue
      part.percent = percent
      part.node.style.setProperty('--sung', percent + '%')
    }
  }

  // 全屏播放时跟随媒体时钟跨越句边界，离开全屏或暂停后停止逐帧更新。
  function tickLyricWords() {
    wordFrame = undefined
    if (!wordCue || !state.stage || !state.playing) return
    const time = audio.position()
    if (time === undefined) return
    if (time + 0.001 >= wordCue.next || time + 0.001 < wordCue.start) {
      state.t = time
      renderClock()
      return
    }
    paintLyricWords(time)
    wordFrame = requestAnimationFrame(tickLyricWords)
  }

  // 所有全屏主题共享实际媒体位置和词段时钟，只更新当前唱句。
  function syncLyricWords(lines, index) {
    const viewport = state.stage && root.querySelector('[data-fs-lyrics]')
    if (!viewport || !hasTimedLyrics) {
      wordCue = undefined
    } else {
      const line = lines[index]
      const row = line?.words || line?.trWords ? lyricRow(viewport, index) : undefined
      const parts = row && row === wordCue?.row ? wordCue.parts : []
      if (row && row !== wordCue?.row) {
        const timings = [...(line.words ?? []), ...(line.trWords ?? [])]
        row.querySelectorAll('.fl-word').forEach((node, wordIndex) => {
          parts.push({ node, word: timings[wordIndex], percent: -1 })
        })
      }
      wordCue = {
        row,
        parts,
        start: line?.t ?? -Infinity,
        next: lines[index + 1]?.t ?? Infinity,
      }
      paintLyricWords(audio.position() ?? state.t)
    }
    if (wordCue && state.playing) {
      if (wordFrame === undefined) wordFrame = requestAnimationFrame(tickLyricWords)
    } else if (wordFrame !== undefined) {
      cancelAnimationFrame(wordFrame)
      wordFrame = undefined
    }
  }

  // 普通行使用完整文本，保留词段的真实空格与换行宽度。
  function lyricMarkup(className, text, words) {
    const inner = escHtml(words ? words.map(word => word.text).join('') : text)
    return '<span class="' + className + (words ? ' fl-timed' : '') + '">' + inner + '</span>'
  }

  // 只有当前句需要逐字填色；移出高亮后合并词段，保留按钮、键盘焦点和行高。
  function setWordSpans(row, line, active) {
    if (!row || !line) return
    for (const [selector, words] of [['.fl-o', line.words], ['.fl-tr', line.trWords]]) {
      if (!words?.length) continue
      const text = row.querySelector(selector)
      if (!text) continue
      if (active) text.innerHTML = words.map(word =>
        '<span class="fl-word">' + escHtml(word.text) + '</span>'
      ).join('')
      else text.textContent = text.textContent
    }
  }

  // 按原稿用曲目与行号生成固定的气泡宽度、字号及行距，仅在创建歌词行时计算。
  function chatLineStyle(trackIndex, lineIndex) {
    const seed = Math.imul(trackIndex + 1, 2654435761) ^ Math.imul(lineIndex + 1, 2246822519)
    // 每个维度单独取样，切换主题再切回时仍得到同一排版。
    function sample(channel) {
      let value = seed ^ Math.imul(channel, 3266489917)
      value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
      value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
      return ((value ^ (value >>> 15)) >>> 0) / 4294967296
    }
    const gap = ((sample(2) * 8 - 4) * 0.7).toFixed(1)
    const size = (0.93 + sample(4) * 0.16).toFixed(3)
    return `--chat-gap:${gap}px;--chat-size:${size};--chat-width:${sample(6).toFixed(3)}`
  }

  // 按原稿格式显示播放时间。
  function fmt(s) {
    s = Math.max(0, Math.floor(s))
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
  }
  // 查找当前 Vue 页面里的播放器窗口。
  function players() {
    return document.querySelectorAll('[data-player]')
  }
  // 原稿交互：保留 effVol 对应的界面行为与调用规则。
  function effVol() {
    return state.muted ? 0 : state.vol
  }
  // 原稿交互：保留 renderVolume 对应的界面行为与调用规则。
  function renderVolume() {
    var eff = effVol()
    audio.setVolume(eff / 100)
    var icon =
      eff === 0 ? ICON_VOL_MUTE : eff < 50 ? ICON_VOL_LOW : ICON_VOL_HIGH
    var lbl =
      eff === 0
        ? '已静音 · 原音量 ' + state.vol + '% — 点击恢复声音'
        : '音量 ' + state.vol + '% — 点击静音'
    players().forEach(function (p) {
      p.querySelectorAll('[data-volbtn]').forEach(function (b) {
        b.innerHTML = icon
        b.setAttribute('aria-label', lbl)
        b.setAttribute('title', lbl)
        b.classList.toggle('muted', eff === 0)
      })
      p.querySelectorAll('.vol').forEach(function (v) {
        if (document.activeElement !== v) v.value = eff
        v.style.setProperty('--p', eff + '%')
        v.setAttribute('aria-label', '音量 ' + eff + '%')
      })
    })
  }
  // 原稿交互：保留 setVol 对应的界面行为与调用规则。
  function setVol(v) {
    v = Math.max(0, Math.min(100, Math.round(v)))
    state.vol = v
    if (v > 0) {
      state.muted = false
      state.lastVol = v
    }
    renderVolume()
    showVolTips()
  }
  // 原稿交互：保留 toggleMute 对应的界面行为与调用规则。
  function toggleMute() {
    if (state.muted || state.vol === 0) {
      state.muted = false
      if (state.vol === 0) state.vol = state.lastVol > 0 ? state.lastVol : 70
    } else {
      state.lastVol = state.vol
      state.muted = true
    }
    renderVolume()
    showVolTips()
  }
  var volTipTimer = 0
  // 按滑杆当前值把气泡对准 thumb 中心，并钳制在定位父级的可见范围内。
  function placeVolTip(v, tip) {
    var host = tip.offsetParent
    if (!host) return
    var sr = v.getBoundingClientRect()
    var hr = host.getBoundingClientRect()
    if (!sr.width || !hr.width) return
    var min = parseFloat(v.min) || 0
    var max = parseFloat(v.max) || 100
    var ratio = Math.max(
      0,
      Math.min(1, ((parseFloat(v.value) || 0) - min) / (max - min))
    )
    var thumb = 14
    var cx = sr.left - hr.left + thumb / 2 + (sr.width - thumb) * ratio
    tip.style.left = Math.max(26, Math.min(hr.width - 26, cx)) + 'px'
    tip.style.bottom = hr.height - (sr.top - hr.top) + 9 + 'px'
  }
  // 用户调音量时刷新每把可见滑杆的气泡（有效音量为 0 显示「静音」，其余显示百分比），停手 1.2 秒后统一淡出。
  function showVolTips() {
    var eff = effVol()
    var text = eff === 0 ? '静音' : eff + '%'
    players().forEach(function (p) {
      p.querySelectorAll('.vol').forEach(function (v) {
        var tip = v.parentNode
          ? v.parentNode.querySelector('[data-vol-tip]')
          : null
        if (!tip) return
        if (!v.getClientRects().length) {
          tip.classList.remove('on')
          return
        }
        tip.textContent = text
        placeVolTip(v, tip)
        tip.classList.add('on')
      })
    })
    if (volTipTimer) clearTimeout(volTipTimer)
    volTipTimer = setTimeout(function () {
      volTipTimer = 0
      document.querySelectorAll('[data-vol-tip]').forEach(function (t) {
        t.classList.remove('on')
      })
    }, 1200)
  }
  /* ---------- this round : queue model + listening bundle + desktop bundle ---------- */
  var ICON_QNEXT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5v14l7-7z" fill="currentColor" stroke="none"/><path d="M13 5v14l7-7z" fill="currentColor" stroke="none" opacity=".55"/><path d="M21 5v14"/></svg>'
  var deskFont = 21
  // 默认队列只收录选中的在线曲目，本地资料不进入播放队列。
  function defaultQueue(current = state.idx) {
    return TRACKS[current]?.catalog ? [current] : []
  }

  // 首次播放时建立默认队列，显式选中的歌单队列由播放入口维护。
  function ensureQueue() {
    if (!state.queue || !state.queue.length) {
      state.queue = defaultQueue()
    }
  }
  // 原稿交互：保留 qpos 对应的界面行为与调用规则。
  function qpos() {
    ensureQueue()
    return state.queue.indexOf(state.idx)
  }
  // 原稿交互：保留 queueNextTi 对应的界面行为与调用规则。
  function queueNextTi() {
    ensureQueue()
    var q = state.queue,
      p = q.indexOf(state.idx)
    if (state.repeat === 2) return state.idx
    if (p < q.length - 1) return q[p + 1]
    if (state.repeat === 1 || state.radioOn) return q[0] ?? null
    return null
  }
  // 从真实在线曲库按本地日期抽取曲目，首页跨天时传入更新后的日期。
  function smartList(day = new Date().toDateString()) {
    const arr = TRACKS.flatMap((track, index) => track.catalog ? [index] : [])
    var seed = metaSeed('rewind|' + day)
    for (var i = arr.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
      var j = seed % (i + 1),
        t = arr[i]
      arr[i] = arr[j]
      arr[j] = t
    }
    return arr.slice(0, 8)
  }
  // 播放当天的推荐清单，使用和导入歌单相同的队列入口。
  function playSmart() {
    const list = smartList()
    if (list.length) playTracks(list, list[0])
  }
  /* radio : seed = current track; same album first, then same artist, then seeded rest */
  // 原稿交互：保留 similarOrder 对应的界面行为与调用规则。
  function similarOrder(seedIdx) {
    var seed = TRACKS[seedIdx],
      sameAlbum = [],
      sameArtist = [],
      rest = []
    TRACKS.forEach(function (tr, i) {
      if (i === seedIdx || Boolean(tr.catalog) !== Boolean(seed.catalog)) return
      if (seed.album !== '—' && tr.album === seed.album) sameAlbum.push(i)
      else if (tr.artist === seed.artist) sameArtist.push(i)
      else rest.push(i)
    })
    rest.sort(function (a, b) {
      return (
        metaSeed(seed.title + '|' + TRACKS[a].title) -
        metaSeed(seed.title + '|' + TRACKS[b].title)
      )
    })
    return sameAlbum.concat(sameArtist, rest)
  }
  // 使用已选歌曲作为种子开启电台，空播放器保持原状。
  function startRadio() {
    var seed = state.idx
    if (!TRACKS[seed]?.catalog) return
    state.radioOn = true
    state.radioSeed = seed
    state.queue = [seed].concat(similarOrder(seed))
    buildLists()
    setPlaying(true)
    render()
  }
  // 原稿交互：保留 stopRadio 对应的界面行为与调用规则。
  function stopRadio() {
    state.radioOn = false
    state.radioSeed = null
    state.queue = defaultQueue()
    buildLists()
    render()
  }
  // 电台页和播放控制共用同一套队列状态。
  function toggleRadio() {
    if (state.radioOn) stopRadio()
    else startRadio()
  }
  // 原稿交互：保留 radioExtend 对应的界面行为与调用规则。
  function radioExtend() {
    if (!state.radioOn) return
    var seed = state.radioSeed == null ? state.idx : state.radioSeed
    var more = similarOrder(seed).filter(function (i) {
      return state.queue.indexOf(i) === -1
    })
    if (!more.length) {
      var rest = similarOrder(seed).filter(i => i !== state.idx)
      if (seed !== state.idx) rest.push(seed)
      rest.sort(function (a, b) {
        return (
          metaSeed('again' + state.queue.length + '|' + TRACKS[a].title) -
          metaSeed('again' + state.queue.length + '|' + TRACKS[b].title)
        )
      })
      more = rest
    }
    if (more.length) {
      state.queue = [state.idx, ...more.slice(0, 6)]
      buildLists()
    }
  }
  /* queue editing : play-next + drag reorder */
  // 把有效曲目放到当前歌曲之后，未选歌时放在队首。
  function playNext(ti) {
    if (!TRACKS[ti]?.catalog) return
    ensureQueue()
    if (ti === state.idx) return
    var q = state.queue,
      p = q.indexOf(state.idx),
      cur = q.indexOf(ti)
    if (cur > -1) q.splice(cur, 1)
    if (cur > -1 && cur < p) p--
    q.splice(p + 1, 0, ti)
    buildLists()
    render()
  }
  // 原稿交互：保留 moveQueue 对应的界面行为与调用规则。
  function moveQueue(from, to) {
    var q = state.queue
    if (!q || from < 0 || from >= q.length) return
    var it = q.splice(from, 1)[0]
    if (to > from) to--
    to = Math.max(0, Math.min(q.length, to))
    q.splice(to, 0, it)
    buildLists()
    render()
  }
  // 将原稿桌面功能入口接入对应的 Tauri 独立窗口。
  function handleUtil(u) {
    if (u === 'lyr') {
      state.settings.deskLock = false
      render()
    }
    options.onDesktop?.(u)
  }
  // 同步原稿演示曲目的快捷切歌入口。

  // 按原稿生成歌曲列表、推荐卡片和播放队列。
  function buildLists() {
    ensureQueue()
  }

  // 历史记录包含完整路由，使前进和后退能区分不同平台与歌单。
  function currentLocation() {
    return { page: state.page, playlistIdx: state.playlistIdx, path: options.currentPath?.() }
  }
  // 普通页面沿用曲库索引，公开歌单携带平台与 ID 组成的详情地址。
  function setPage(pg, plIdx, viaNav, path) {
    if (stageRequest && pg !== state.page) closeStage()
    if (pg === 'settings' && !viaNav && options.onSettings) {
      options.onSettings()
      return
    }
    state._util = null
    var np = typeof plIdx === 'number' ? plIdx : state.playlistIdx
    if (
      !viaNav &&
      (pg !== state.page || (pg === 'playlist' && np !== state.playlistIdx) || (path && path !== options.currentPath?.()))
    ) {
      state._hist.push(currentLocation())
      if (state._hist.length > 24) state._hist.shift()
      state._fwd = []
    }
    if (typeof plIdx === 'number') state.playlistIdx = plIdx
    state.page = pg
    state._pageKey = ''
    if (!viaNav && options.onNavigate) options.onNavigate(pg, state.playlistIdx, path)
    render()
    players().forEach(function (p) {
      var m = p.querySelector('.main')
      if (m) m.scrollTop = 0
    })
  }
  // 原稿交互：保留 navBack 对应的界面行为与调用规则。
  function navBack() {
    if (!state._hist.length) return
    state._fwd.push(currentLocation())
    var h = state._hist.pop()
    setPage(h.page, h.playlistIdx, true)
    options.onNavigate(h.page, h.playlistIdx, h.path)
  }
  // 原稿交互：保留 navFwd 对应的界面行为与调用规则。
  function navFwd() {
    if (!state._fwd.length) return
    state._hist.push(currentLocation())
    var f = state._fwd.pop()
    setPage(f.page, f.playlistIdx, true)
    options.onNavigate(f.page, f.playlistIdx, f.path)
  }
  var PAGE_NAMES = {
    home: '首页',
    daily: '每日推荐',
    discovery: '发现歌单',
    search: '搜索',
    library: '音乐库',
    albums: '专辑',
    artists: '歌手',
    album: '专辑',
    artist: '歌手',
    liked: '我喜欢的',
    recent: '最近播放',
    smart: '智能歌单',
    playlist: '歌单',
    settings: '设置',
    connect: '内容导入',
    upload: '内容导入',
    downloads: '内容导入',
    hub: '功能全景',
    radio: '歌曲电台',
  }
  /* grouped navigation : album/artist detail + 专辑/歌手/喜欢/最近 all belong to the 音乐库 hub item;
   upload/downloads belong to the 内容导入 hub item — the sliding pill targets the hub item */
  var NAVKEY = {
    daily: 'home',
    discovery: 'home',
    album: 'library',
    artist: 'library',
    albums: 'library',
    artists: 'library',
    liked: 'library',
    recent: 'library',
    smart: 'library',
    upload: 'connect',
    downloads: 'connect',
  }
  var PAGE_SIZE = 10
  var PG_PREV =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>'
  var PG_NEXT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>'
  // 原稿交互：保留 firstIdxBy 对应的界面行为与调用规则。
  function firstIdxBy(fn) {
    var seen = {},
      out = []
    TRACKS.forEach(function (tr, i) {
      var k = fn(tr)
      if (!seen[k]) {
        seen[k] = 1
        out.push(i)
      }
    })
    return out
  }
  // 原稿交互：保留 albumPos 对应的界面行为与调用规则。
  function albumPos() {
    var a = TRACKS[state.playlistIdx]?.album,
      seen = {},
      pos = 0
    for (var i = 0; i < TRACKS.length; i++) {
      if (TRACKS[i].catalog) continue
      if (!seen[TRACKS[i].album]) {
        seen[TRACKS[i].album] = 1
        if (TRACKS[i].album === a) return pos
        pos++
      }
    }
    return 0
  }
  /* standard 7-slot pagination (Atlassian / IxDF pattern): first + last, current ±1, ellipsis;
   rendered only when there is more than one page; current page is a glass capsule */

  // 测量侧栏选中入口并移动原稿高亮胶囊。
  function positionPill(p) {
    var pill = p.querySelector('[data-pill]')
    if (!pill) return
    var target = null,
      kind = 'nav'
    if (state._util)
      target = p.querySelector('[data-util="' + state._util + '"]')
    if (!target && state.page === 'playlist' && state.customPl) {
      target = Array.from(p.querySelectorAll('[data-custom]')).find(
        el =>
          el.getAttribute('data-custom') ===
          (state.customPl.id || state.customPl.name)
      )
      kind = 'pl'
    }
    if (!target && state.page === 'playlist') {
      target = p.querySelectorAll('[data-sidebar-lists] .plist')[albumPos()]
      kind = 'pl'
    }
    if (!target)
      target = p.querySelector(
        '[data-nav="' + (NAVKEY[state.page] || state.page) + '"]'
      )
    if (!target) {
      pill.style.opacity = '0'
      return
    }
    pill.classList.toggle('pl', kind === 'pl')
    var first = !p._pillInit
    p._pillInit = true
    if (first) pill.style.transition = 'none'
    pill.style.height = target.offsetHeight + 'px'
    pill.style.transform = 'translateY(' + target.offsetTop + 'px)'
    pill.style.opacity = '1'
    if (first)
      requestAnimationFrame(function () {
        pill.style.transition = ''
      })
  }
  // 按原稿导航状态更新页面与列表。
  // 渲染各页标题及详情，直接打开空曲库的详情路由时显示空态。
  function renderPages() {
    players().forEach(function (p) {
      var main = p.querySelector('.main')
      if (main) main.classList.toggle('show-page', state.page !== 'home')
      p.querySelectorAll('[data-chrome-title]').forEach(function (el) {
        var dt = TRACKS[state.playlistIdx]
        var name = state.page === 'artist' || state.page === 'album'
          ? options.detailName?.() ?? (state.page === 'artist' ? dt?.artist : dt?.album)
          : dt?.album
        var detail = ['playlist', 'album', 'artist'].includes(state.page)
        el.textContent = PAGE_NAMES[state.page] + (detail && name ? ' · ' + name : '')
      })
      p.querySelectorAll('[data-nav-back]').forEach(function (el) {
        el.disabled = !state._hist.length
      })
      p.querySelectorAll('[data-nav-fwd]').forEach(function (el) {
        el.disabled = !state._fwd.length
      })
      p.querySelectorAll('[data-panel]').forEach(function (pn) {
        pn.classList.toggle(
          'active',
          pn.getAttribute('data-panel') === state.page
        )
      })
      p.querySelectorAll('[data-nav]').forEach(function (nv) {
        nv.classList.toggle(
          'on',
          nv.getAttribute('data-nav') === (NAVKEY[state.page] || state.page)
        )
      })
      p.querySelectorAll('[data-sidebar-lists] .plist').forEach(
        function (pl, i) {
          pl.classList.toggle(
            'on',
            state.page === 'playlist' && !state.customPl && i === albumPos()
          )
        }
      )
      p.querySelectorAll('[data-lib-tab]').forEach(function (b) {
        var k = b.getAttribute('data-lib-tab')
        b.classList.toggle(
          'on',
          state.page === k ||
            (state.page === 'album' && k === 'albums') ||
            (state.page === 'artist' && k === 'artists')
        )
      })
      p.querySelectorAll('[data-src-tab]').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-src-tab') === state.page)
      })
      p.querySelectorAll('[data-custom]').forEach(function (pl) {
        pl.classList.toggle(
          'on',
          state.page === 'playlist' &&
            !!state.customPl &&
            pl.getAttribute('data-custom') ===
              (state.customPl.id || state.customPl.name)
        )
      })
      if (state.page === 'playlist' && state.customPl) {
        p.querySelectorAll('[data-chrome-title]').forEach(function (el) {
          el.textContent = '歌单 · ' + state.customPl.name
        })
      }
      var likedIdx = TRACKS.map(function (tr, i) {
        return i
      }).filter(function (i) {
        return !!state.liked[i]
      })
      p.querySelectorAll('[data-liked-count]').forEach(function (el) {
        el.textContent = likedIdx.length
      })
      p.querySelectorAll('[data-liked-total]').forEach(function (el) {
        el.textContent = likedIdx.length
      })
      var lem = p.querySelector('[data-liked-empty]')
      if (lem) lem.style.display = likedIdx.length ? 'none' : 'block'
      var rem = p.querySelector('[data-recent-empty]')
      if (rem) rem.style.display = state.recent.length ? 'none' : 'block'
      p.querySelectorAll('[data-sort]').forEach(function (b) {
        var pr = b.getAttribute('data-sort').split(':')
        b.classList.toggle('on', (state.sorts[pr[0]] || 'def') === pr[1])
      })
      p.querySelectorAll('[data-clear-recent]').forEach(function (b) {
        b.style.display = state.recent.length ? '' : 'none'
      })
      positionPill(p)
    })
  }
  // 同步原稿全部设置控件和毛玻璃、液态玻璃材质。
  function renderSettings() {
    var s = state.settings
    document.body.classList.toggle('wx-off', !s.weather)
    document.body.classList.toggle('calm', !s.motion)
    if (!s.motion) cancelStageMotion()
    players().forEach(function (p, pi) {
      var eff =
        s.glassStyle === 'frosted'
          ? 'frosted'
          : s.glassStyle === 'liquid'
            ? 'liquid'
            : pi === 1
              ? 'liquid'
              : 'frosted'
      var wrap = p.parentElement
      if (wrap) {
        wrap.classList.toggle('glass-win', eff === 'frosted')
        wrap.classList.toggle('liquid-win', eff === 'liquid')
      }
      if (eff === 'liquid') p.setAttribute('data-liquid', '')
      else p.removeAttribute('data-liquid')
      var ed = p.querySelector('.brand span')
      if (ed)
        ed.textContent =
          eff === 'frosted' ? 'FROSTED EDITION' : 'LIQUID EDITION'
      var col = document.getElementById(pi === 1 ? 'colB' : 'colA')
      if (col) {
        var ver = col.querySelector('.ver')
        if (ver) {
          ver.textContent =
            'VERSION ' +
            (pi === 1 ? 'B' : 'A') +
            ' · ' +
            (eff === 'frosted' ? 'FROSTED' : 'LIQUID')
          ver.classList.toggle('ver-a', eff === 'frosted')
          ver.classList.toggle('ver-b', eff === 'liquid')
        }
      }
    })
    players().forEach(function (p) {
      p.querySelectorAll('[data-set-toggle]').forEach(function (b) {
        var on = !!s[b.getAttribute('data-set-toggle')]
        b.classList.toggle('on', on)
        b.setAttribute('aria-checked', on ? 'true' : 'false')
      })
      p.querySelectorAll('[data-set-seg]').forEach(function (seg) {
        var key = seg.getAttribute('data-set-seg')
        seg.querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('on', b.getAttribute('data-val') === s[key])
        })
      })
      p.querySelectorAll('[data-set-range]').forEach(function (r) {
        var key = r.getAttribute('data-set-range')
        if (document.activeElement !== r) r.value = s[key]
        r.style.setProperty('--p', (r.value / r.max) * 100 + '%')
      })
      p.querySelectorAll('[data-set-val]').forEach(function (el) {
        el.textContent = s[el.getAttribute('data-set-val')] + ' 秒'
      })
    })
  }

  // 原稿交互：保留 fmtSize 对应的界面行为与调用规则。
  function fmtSize(b) {
    if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB'
    if (b > 1024) return Math.round(b / 1024) + ' KB'
    return b + ' B'
  }
  // 保留本地文件条目的录入流程，无封面时使用通用占位图。
  function addUploadToLibrary(i) {
    var f = state.uploads[i]
    if (!f || f.added) return
    var base = f.name.replace(/\.[^.]+$/, '')
    TRACKS.push({
      title: base,
      artist: '本地文件',
      album: '我上传的',
      dur: 0,
      cover: defaultCover,
      q: '本地资料',
      glow: 'rgba(140,160,255,.5)',
      mine: true,
    })
    f.added = true
    state.upAdded++
    state.upMsg = '已登记《' + base + '》的文件信息。'
    buildLists()
    state._pageKey = ''
    state._srcKey = ''
    render()
  }

  /* fullscreen ambience colours: three tints derived from the track's own glow colour —
   base, lightened, deepened — so the mesh stays strictly inside the album palette */
  // 原稿交互：保留 ambVars 对应的界面行为与调用规则。
  function ambVars(glow) {
    var m = /(\d+)[, ]+(\d+)[, ]+(\d+)/.exec(glow || '')
    if (!m) return null
    var r = +m[1],
      g = +m[2],
      b = +m[3]
    function mix(tr, tg, tb, f) {
      return [
        Math.round(r + (tr - r) * f),
        Math.round(g + (tg - g) * f),
        Math.round(b + (tb - b) * f),
      ]
    }
    var l = mix(255, 255, 255, 0.38),
      d = mix(10, 10, 18, 0.34)
    return {
      a1: 'rgba(' + r + ',' + g + ',' + b + ',.50)',
      a2: 'rgba(' + l[0] + ',' + l[1] + ',' + l[2] + ',.36)',
      a3: 'rgba(' + d[0] + ',' + d[1] + ',' + d[2] + ',.44)',
    }
  }
  // 原稿交互：保留 applyAmb 对应的界面行为与调用规则。
  function applyAmb(p, ambEl) {
    var v = ambEl._av
    if (!v) return
    p.style.setProperty('--amb1', v.a1)
    p.style.setProperty('--amb2', v.a2)
    p.style.setProperty('--amb3', v.a3)
  }
  // 同步时间文本时只写变化的秒数，避免重复替换文本节点。
  function updateClockLabel(element, value) {
    if (element && element.textContent !== value) element.textContent = value
  }

  // 右侧歌词展开后才创建行；换句只更新上次和本次的高亮。
  function updateSidebarLyrics(box, lines, index) {
    if (!box?.classList.contains('show')) return
    if (box._lines !== lines) {
      box.classList.toggle('long-lyrics', lines.length >= 96)
      box.innerHTML = lines.map((line, i) =>
        '<div class="' + (i === index ? '' : 'dim') + '">' + escHtml(line.o) + '</div>'
      ).join('')
      box._lines = lines
    } else if (box._activeLine !== index) {
      box.children[box._activeLine]?.classList.add('dim')
      box.children[index]?.classList.remove('dim')
    }
    box._activeLine = index
  }

  // 换曲或离开舞台时结束歌词浏览，使下次打开直接定位到媒体时钟。
  function resetLyricBrowsing(fl) {
    if (!fl) return
    state._lyrHoldUntil = 0
    lyricRow(fl, fl._focus)?.classList.remove('focus')
    fl._focus = null
    fl._keyboardBrowsing = false
    fl.classList.remove('keyboard-browsing')
    if (fl._hideT) clearTimeout(fl._hideT)
    fl._hideT = null
    const column = fl.closest('.fs-lyrcol')
    const returnButton = column?.querySelector('[data-lyrreturn]')
    const seekChip = column?.querySelector('[data-lyrseek]')
    if (returnButton) returnButton.hidden = true
    if (seekChip) {
      seekChip.hidden = true
      seekChip.classList.remove('show')
    }
  }

  // 全屏歌词仅在曲目或时间轴替换时创建；固定的时间标签只生成一次。
  function updateStageLyrics(fl, lines, index, realign) {
    if (!fl) return
    const rebuilt = fl._lines !== lines || fl._track !== state.idx
    const previous = fl._activeLine ?? -1
    if (!rebuilt && previous === index && !realign) return
    if (rebuilt) {
      fl._lines = lines
      fl._track = state.idx
      resetLyricBrowsing(fl)
      fl.classList.toggle('lyrics-unavailable', !catalogLyrics)
      fl._activeLine = -1
      fl._window = createLyricWindow(fl, lines.length, (group, start, end) => {
        group.innerHTML = lines.slice(start, end).map((line, offset) => {
          const i = start + offset
          return '<button type="button" class="fl-line" tabindex="-1" aria-current="false" data-lj="' +
            i + '" style="' + chatLineStyle(state.idx, i) + '">' +
            lyricMarkup('fl-o', line.o, line.words) +
            (line.tr ? lyricMarkup('fl-tr', line.tr, line.trWords) : '') + '</button>'
        }).join('')
        for (let i = start; i < end; i++) {
          const row = group.children[i - start]
          row.setAttribute('aria-label', fmt(lines[i].t) + ' ' + lines[i].o)
          row.classList.toggle('d1', Math.abs(i - fl._activeLine) === 1)
        }
      })
    }
    fl._window?.sync(index, realign || rebuilt)
    if (rebuilt || previous !== index) {
      if (!rebuilt) setWordSpans(lyricRow(fl, previous), lines[previous], false)
      setWordSpans(lyricRow(fl, index), lines[index], true)
      // 当前句、相邻句与唯一 Tab 入口均只涉及前后两个局部范围。
      const changed = new Set([previous - 1, previous, previous + 1, index - 1, index, index + 1])
      for (const i of changed) {
        const row = lyricRow(fl, i)
        if (!row) continue
        row.classList.toggle('on', i === index)
        row.classList.toggle('d1', Math.abs(i - index) === 1)
        row.setAttribute('aria-current', String(i === index))
        row.tabIndex = i === Math.max(0, index) ? 0 : -1
      }
      fl._activeLine = index
    }
    const active = lyricRow(fl, index)
    if (!active || state._lyrHoldUntil > Date.now()) return
    // 远距离定位先展开目标附近的真实行高，再居中；相邻唱句沿用平滑跟随。
    const centeredTop = () => Math.max(0, active.offsetTop - fl.clientHeight / 2 + active.offsetHeight / 2)
    const top = centeredTop()
    const jump = fl._window && (realign || Math.abs(fl.scrollTop - top) > fl.clientHeight * 2)
    const instant = rebuilt || jump || !state.settings.motion || stageMotionPreference.matches
    fl._progUntil = Date.now() + (instant ? 90 : 780)
    fl.scrollTo({ top, behavior: instant ? 'instant' : 'smooth' })
    if (jump) {
      fl._window.sync(index)
      fl.scrollTo({ top: centeredTop(), behavior: 'instant' })
    }
  }

  // 媒体时钟只驱动当前可见的进度条、唱句、频谱与桌面快照。
  function renderClock(refreshLyrics = false) {
    const duration = currentDuration()
    const ratio = duration ? state.t / duration : 0
    const lines = fsLinesFor(state.idx)
    const index = lyricIndexAt(lines, state.t)
    const current = TRACKS[state.idx]
    state.capsuleLyric = current ? lines[index]?.o || current.title : ''
    const key = state.idx + ':' + !!catalogLyrics + ':' + index
    if (!state.stage) audio.setSpectrumPlayback({
      playing: state.playing, time: state.t, duration, seed: state.idx, demo: false,
    })
    players().forEach(p => {
      const surface = p.querySelector(state.stage ? '.fs-dock' : '.win-bottom')
      if (surface) {
        updateClockLabel(surface.querySelector('[data-cur]'), fmt(state.t))
        updateClockLabel(surface.querySelector('[data-dur]'), fmt(duration))
        updateClockLabel(surface.querySelector('[data-remain]'), '-' + fmt(duration - state.t))
        const seek = surface.querySelector('[data-seek]')
        if (seek) {
          const value = String(Math.round(ratio * 1000))
          if (seek.value !== value) seek.value = value
          const fill = ratio * 100 + '%'
          if (seek.style.getPropertyValue('--p') !== fill) seek.style.setProperty('--p', fill)
        }
      }
      if (refreshLyrics || state._lyrKey !== key) {
        if (state.stage) updateStageLyrics(p.querySelector('[data-fs-lyrics]'), lines, index, !state._lyrKey)
        else if (state[nowPlayingKey()]) updateSidebarLyrics(p.querySelector('[data-lyric]'), lines, index)
      }
    })
    state._lyrKey = key
    syncLyricWords(lines, index)
    if (options.onStateChange) options.onStateChange(getSnapshot())
  }

  // 同步曲目、歌词、队列、横幅与桌面表面，保持原稿行为。
  function render() {
    audio.setEqualizer({
      enabled: state.settings.eqEnabled,
      preamp: state.settings.eqPreamp,
      gains: parseEqualizerGains(state.settings.eqGains),
      autoHeadroom: state.settings.eqAutoHeadroom,
    })
    audio.setSpectrumMotion(state.settings.motion && !state.stage)
    const npOpen = state[nowPlayingKey()]
    const current = TRACKS[state.idx]
    var tr = { ...(current || emptyTrack), dur: currentDuration() }
    audio.setSpectrumArtwork(tr.cover, tr.glow, !!tr.catalog)
    var av = null
    if (state._ambIdx !== state.idx) {
      state._ambIdx = state.idx
      av = ambVars(tr.glow)
    }
    players().forEach(function (p) {
      p.querySelectorAll('[data-like],[data-stage-toggle],[data-lyricbtn]').forEach(function (el) {
        el.disabled = !current
      })
      p.querySelectorAll('[data-seek],[data-radio-quick]').forEach(function (el) {
        el.disabled = !current?.catalog
      })
      p.querySelectorAll('[data-prev],[data-next]').forEach(function (el) {
        el.disabled = !current && !state.queue?.length
      })
      p.classList.toggle('playing', state.playing)
      p.classList.toggle('fs-open', state.stage)
      p.classList.toggle('np-collapsed', !npOpen)
      p.querySelectorAll('.np-toggle').forEach(function (el) {
        var lbl = npOpen ? '收起正在播放面板' : '展开正在播放面板'
        el.setAttribute('aria-expanded', npOpen ? 'true' : 'false')
        el.setAttribute('aria-label', lbl)
        el.setAttribute('title', lbl)
      })
      p.querySelectorAll('[data-np-switch]').forEach(function (el) {
        el.classList.toggle('on', state.npOpen)
        el.setAttribute('aria-checked', state.npOpen ? 'true' : 'false')
      })
      var fsx = p.querySelector('[data-fs]')
      if (fsx) fsx.classList.toggle('qopen', state.fsQ)
      p.querySelectorAll('[data-fsq-toggle]').forEach(function (el) {
        el.classList.toggle('on', state.fsQ)
      })
      p.style.setProperty('--glow', tr.glow)
      if (av) {
        var ambEl = p.querySelector('.fs-amb')
        if (ambEl) {
          ambEl._av = av
          if (!p._ambSet) {
            p._ambSet = true
            applyAmb(p, ambEl)
          } else if (!ambEl._swapT) {
            ambEl.classList.add('swap')
            ambEl._swapT = setTimeout(function () {
              ambEl._swapT = null
              applyAmb(p, ambEl)
              ambEl.classList.remove('swap')
            }, 570)
          }
        }
      }
      p.querySelectorAll('[data-next-title]').forEach(function (el) {
        if (current && state.repeat === 2) {
          el.textContent = tr.title + ' · ' + tr.artist
        } else if (current && state.shuffle) {
          el.textContent = '随机播放'
        } else {
          var nti = queueNextTi()
          el.textContent =
            nti == null
              ? '队列结束'
              : TRACKS[nti].title + ' · ' + TRACKS[nti].artist
        }
      })
      p.querySelectorAll('[data-radio-chip]').forEach(function (el) {
        el.hidden = !state.radioOn
      })
      p.querySelectorAll('[data-radio-quick]').forEach(function (el) {
        el.textContent = state.radioOn ? '电台中 · 查看' : '开启电台'
      })
      p.querySelectorAll('[data-radio-count]').forEach(function (el) {
        el.textContent = state.radioOn ? 'ON' : ''
      })
      p.querySelectorAll('[data-cover]').forEach(function (el) {
        el.src = tr.cover
      })
      p.querySelectorAll('[data-title]').forEach(function (el) {
        el.textContent = tr.title
      })
      var titleEl = p.querySelector('.fs-titleblock h4')
      if (titleEl) {
        var titleClass = fullscreenTitleClass(tr.title || '')
        ;['t-mid', 't-long', 't-xlong'].forEach(function (tier) {
          titleEl.classList.toggle(tier, titleClass === tier)
        })
        titleEl.setAttribute('title', tr.title)
      }
      p.querySelectorAll('[data-artist]').forEach(function (el) {
        el.textContent = current ? [tr.artist, tr.album !== '—' && tr.album].filter(Boolean).join(' · ') : ''
        el.title = el.textContent
      })
      p.querySelectorAll('[data-track-subtitle]').forEach(function (el) {
        el.textContent = tr.subtitle || ''
        el.title = el.textContent
        el.hidden = !el.textContent
      })
      p.querySelectorAll('[data-like]').forEach(function (el) {
        el.classList.toggle('liked', !!state.liked[state.idx])
        el.setAttribute(
          'aria-pressed',
          state.liked[state.idx] ? 'true' : 'false'
        )
        el.setAttribute(
          'aria-label',
          state.liked[state.idx] ? '取消收藏' : '收藏'
        )
        el.setAttribute('aria-busy', String(!!tr.catalog && state.pendingFavorites.has(favoriteKey(tr.catalog))))
        el.title = el.getAttribute('aria-label') + ' · ' + favoriteHint(tr)
      })
      p.querySelectorAll('[data-shuffle]').forEach(function (el) {
        el.classList.toggle('on', state.shuffle)
        el.setAttribute('aria-pressed', state.shuffle ? 'true' : 'false')
      })
      p.querySelectorAll('[data-repeat]').forEach(function (el) {
        el.classList.toggle('on', state.repeat > 0)
        el.classList.toggle('one', state.repeat === 2)
        var rl =
          state.repeat === 2
            ? '单曲循环'
            : state.repeat === 1
              ? '循环全部'
              : '循环已关闭'
        el.setAttribute('aria-label', rl)
        el.setAttribute('title', rl + ' — 点击切换')
      })
      var bg = p.querySelector('[data-bg]')
      if (bg) bg.style.backgroundImage = 'url(' + tr.cover + ')'
      var fsbg = p.querySelector('[data-fs-bg]')
      if (fsbg) fsbg.style.backgroundImage = 'url(' + tr.cover + ')'
      var glow = p.querySelector('[data-glow]')
      if (glow) glow.style.backgroundImage = 'url(' + tr.cover + ')'
      p.querySelectorAll('[data-meta1]').forEach(function (el) {
        el.textContent = tr.q
      })
      p.querySelectorAll('[data-meta2]').forEach(function (el) {
        el.textContent = current ?
          'TRACK ' +
          String(state.idx + 1).padStart(2, '0') +
          ' / ' +
          String(TRACKS.length).padStart(2, '0') : '暂无播放'
      })
      p.querySelectorAll('[data-fs-giant]').forEach(function (el) {
        el.textContent = tr.artist.toUpperCase()
      })
      p.querySelectorAll('[data-fsnum]').forEach(function (el) {
        el.textContent =
          String(state.idx + 1).padStart(2, '0') +
          ' / ' +
          String(TRACKS.length).padStart(2, '0')
      })
      p.querySelectorAll('[data-fs-spec]').forEach(function (el) {
        el.textContent =
          tr.album.toUpperCase() + ' · ' + tr.q + ' · ' + fmt(tr.dur)
      })
      p.querySelectorAll('.feat').forEach(function (it) {
        var ti = it.getAttribute('data-ti')
        if (ti !== null && TRACKS[parseInt(ti, 10)]) {
          it.classList.toggle('on', TRACKS[parseInt(ti, 10)].album === tr.album)
        }
      })
    })
    renderVolume()
    var pgSig =
      state.query +
      '|' +
      state.page +
      '|' +
      state.playlistIdx +
      '|' +
      (state.customPl ? state.customPl.id || state.customPl.name : '') +
      '|' +
      TRACKS.length
    if (state._pgSig !== pgSig) {
      state._pgSig = pgSig
      state.pg = {}
    }
    var pageKey =
      state.page +
      '|' +
      state.playlistIdx +
      '|' +
      state.query +
      '|' +
      state.idx +
      '|' +
      JSON.stringify(state.liked) +
      '|' +
      JSON.stringify(state.sorts) +
      '|' +
      state.recent.join(',') +
      '|' +
      (state._util || '') +
      '|' +
      (state.customPl ? state.customPl.id || state.customPl.name : '') +
      '|' +
      (state.customPl?.name || '') +
      '|' +
      TRACKS.length +
      '|' +
      (state.radioOn ? 'R' : '') +
      '|' +
      (state.smartOpen || '')
    if (state._pageKey !== pageKey) {
      state._pageKey = pageKey
      renderPages()
    }
    renderSettings()
    document.querySelectorAll('#trackPills button').forEach(function (b) {
      var ti = parseInt(b.getAttribute('data-ti'), 10)
      b.classList.toggle(
        'on',
        !isNaN(ti) &&
          !!TRACKS[ti] &&
          TRACKS[ti].album === current?.album
      )
    })

    renderClock(true)
  }
  // 曲目播完后按现有队列和循环规则决定重播、续播或暂停。
  function finishPlayback() {
    if (state.repeat === 2) {
      seekTo(0)
      setPlaying(true)
      return
    }
    if (state.radioOn && qpos() >= state.queue.length - 1) radioExtend()
    if (qpos() < state.queue.length - 1 || state.repeat === 1) {
      nextTrack()
      return
    }
    setPlaying(false)
    seekTo(0)
  }

  // 只播放具有平台音源的曲目，由真实媒体事件更新状态和进度。
  function setPlaying(v) {
    const track = TRACKS[state.idx]
    if (!track) {
      if (v && state.queue?.length) selectTrack(state.queue[0], true)
      return
    }
    const source = track.catalog
    if (!source) return
    if (v) {
      if (!catalogLyrics && !lyricRequest) void loadCatalogLyrics(source)
      void audio.play(source, state.settings.quality)
    } else audio.pause()
  }
  // 点击加载中的播放按钮也可取消取源，键盘和桌面控制沿用同一行为。
  function togglePlayback() {
    setPlaying(!state.playing && !state.audioLoading)
  }

  // 网易云音质或授权变化时释放旧媒体，保留真实进度，暂停中的歌曲等待下次播放。
  function reloadPlayback(resume = true) {
    if (TRACKS[state.idx]?.catalog?.platform !== 'netease') return
    const shouldPlay = resume && (state.playing || state.audioLoading)
    state.resumeTime = state.resumeTime || audio.position() || state.t
    audio.reset()
    state.playing = false
    state.catalogStatus = null
    if (shouldPlay) setPlaying(true)
    render()
  }

  // 同步最新版原稿：每次打开分层入场，关闭先取消入场/切歌，再镜像退场。
  function setStage(open) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (open) {
      if (fsCloseTimer) {
        clearTimeout(fsCloseTimer)
        fsCloseTimer = null
      }
      players().forEach(function (p) {
        p.classList.remove('fs-closing')
      })
      state.stage = true
      state._lyrKey = ''
      render()
      animateFsEntrance()
      return
    }
    if (!state.stage) return
    players().forEach(function (p) {
      var fs = p.querySelector('[data-fs]')
      if (fs) cancelFsStageAnims(fs)
    })
    state.stage = false
    state.fsQ = false
    render()
    if (reduce) return
    players().forEach(function (p) {
      p.classList.add('fs-closing')
    })
    if (fsCloseTimer) clearTimeout(fsCloseTimer)
    fsCloseTimer = setTimeout(function () {
      players().forEach(function (p) {
        p.classList.remove('fs-closing')
      })
      fsCloseTimer = null
    }, 360)
  }
  /* fullscreen track-change transition: runs AFTER render() has put the new track on
   stage. dir=+1 (next) brings the new cover in from the right and sends the old one
   out to the left; dir=-1 mirrors it. Old cover / blurred backdrop survive only as
   short-lived ghost copies that crossfade away. A rapid second skip cancels every
   in-flight animation and removes the ghosts first, so the stage always lands
   cleanly on the newest track. Stage closed, calm (motion off) or reduced-motion:
   no transition at all — the plain render() result stands.
   Four more devices borrowed from community player shots ride on the same run:
   (1) a light band sweeps diagonally across the cover glass only — the bottom player (dock) gets no sweep;
   (2) the slide itself is layered — backdrop, ambience mesh, outline giant, cover
   and lyrics column each travel their own distance over their own duration;
   (3) the next card in the skip direction peeks out from behind the incoming cover
   mid-slide, like flipping a stack of cards; (4) the outline giant's entrance runs
   about twice the cover's duration, so it is still drifting in after the cover has
   landed. Transform/opacity only, album colour only. */
  // 保留原稿全屏切歌的分层交叉入场动画。

  // 按原稿规则切歌并同步封面、歌词和播放队列。
  function selectTrack(i, autoplay, dir) {
    if (!TRACKS[i]?.catalog) return
    var old = state.idx
    nativeDirection = dir || (i > old ? 1 : -1)
    ensureQueue()
    if (state.queue.indexOf(i) === -1) {
      state.queue = defaultQueue(i)
      buildLists()
    }
    const useAudio = TRACKS[old]?.catalog || TRACKS[i].catalog
    if (useAudio) {
      audio.reset()
      state.playing = false
      state.catalogStatus = null
      state.streamDuration = 0
    }
    lyricRequest?.abort()
    lyricRequest = undefined
    catalogLyrics = null
    hasTimedLyrics = false
    state.resumeTime = 0
    state.idx = i
    state.t = 0
    render()
    if (autoplay) setPlaying(true)
    if (TRACKS[i].catalog && !lyricRequest)
      void loadCatalogLyrics(TRACKS[i].catalog)
    if (i !== old && TRACKS[old]) {
      var d = dir || (i > old ? 1 : -1)
      animateFsTrackChange(d, TRACKS[old])
    }
  }
  // 搜索和导入列表显式建立本次播放队列。
  function playTracks(indices, index) {
    if (!TRACKS[index]?.catalog || !indices.includes(index)) return
    state.radioOn = false
    state.radioSeed = null
    state.queue = [...new Set(indices.filter(index => TRACKS[index]?.catalog))]
    selectTrack(index, true)
  }
  // 原稿交互：保留 nextTrack 对应的界面行为与调用规则。
  function nextTrack() {
    ensureQueue()
    var q = state.queue,
      p = q.indexOf(state.idx)
    if (p === -1) {
      selectTrack(q[0], true, 1)
      return
    }
    if (state.shuffle) {
      if (q.length > 1) {
        var n = p
        while (n === p) n = Math.floor(Math.random() * q.length)
        selectTrack(q[n], true, 1)
      }
      return
    }
    if (p > -1 && p < q.length - 1) {
      selectTrack(q[p + 1], true, 1)
      return
    }
    if (state.radioOn) {
      radioExtend()
      const next = state.queue[qpos() + 1]
      if (next !== undefined) selectTrack(next, true, 1)
      return
    }
    selectTrack(q[0], true, 1)
  }
  // 原稿交互：保留 prevTrack 对应的界面行为与调用规则。
  function prevTrack() {
    if (state.t > 3) {
      seekTo(0)
      return
    }
    ensureQueue()
    var q = state.queue,
      p = q.indexOf(state.idx)
    selectTrack(p === -1 ? q[q.length - 1] : q[(p - 1 + q.length) % q.length], true, -1)
  }

  function bindPlayer(p) {
    p.querySelectorAll('[data-play]').forEach(function (el) {
      listenElement(el, 'click', function () {
        togglePlayback()
      })
    })
    p.querySelectorAll('[data-stage-toggle]').forEach(function (el) {
      listenElement(el, 'click', function () {
        if (state.stage) closeStage()
        else void openStage(el)
      })
    })
    p.querySelectorAll('[data-fsq-toggle]').forEach(function (el) {
      listenElement(el, 'click', function () {
        state.fsQ = !state.fsQ
        render()
      })
    })
    p.querySelectorAll('[data-np-toggle],[data-np-switch]').forEach(
      function (el) {
        listenElement(el, 'click', function () {
          const key = el.hasAttribute('data-np-switch')
            ? 'npOpen'
            : nowPlayingKey()
          state[key] = !state[key]
          render()
        })
      }
    )
    var fsEl = p.querySelector('[data-fs]')
    if (
      fsEl &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      listenElement(fsEl, 'mousemove', function (e) {
        var r = fsEl.getBoundingClientRect()
        var nx = (e.clientX - r.left) / r.width - 0.5,
          ny = (e.clientY - r.top) / r.height - 0.5
        fsEl.style.setProperty('--px', nx.toFixed(3))
        fsEl.style.setProperty('--py', ny.toFixed(3))
      })
      listenElement(fsEl, 'mouseleave', function () {
        fsEl.style.setProperty('--px', 0)
        fsEl.style.setProperty('--py', 0)
      })
    }
    p.querySelectorAll('[data-next]').forEach(function (el) {
      listenElement(el, 'click', nextTrack)
    })
    p.querySelectorAll('[data-prev]').forEach(function (el) {
      listenElement(el, 'click', prevTrack)
    })
    p.querySelectorAll('[data-like]').forEach(function (el) {
      listenElement(el, 'click', toggleFavorite)
    })
    p.querySelectorAll('[data-shuffle]').forEach(function (el) {
      listenElement(el, 'click', function () {
        state.shuffle = !state.shuffle
        render()
      })
    })
    p.querySelectorAll('[data-repeat]').forEach(function (el) {
      listenElement(el, 'click', function () {
        state.repeat = (state.repeat + 1) % 3
        render()
      })
    })
    p.querySelectorAll('[data-seek]').forEach(function (seek) {
      listenElement(seek, 'input', function () {
        seekTo((seek.value / 1000) * currentDuration())
      })
      var prow = seek.closest('.edge-prow')
      if (prow) {
        var tip = prow.querySelector('[data-seek-tip]')
        listenElement(seek, 'mousemove', function (e) {
          var r = prow.getBoundingClientRect()
          if (!r.width) return
          var x = e.clientX - r.left
          var ratio = Math.max(0, Math.min(1, x / r.width))
          if (tip) {
            var total = currentDuration()
            tip.textContent = fmt(ratio * total) + ' / ' + fmt(total)
            tip.style.left = Math.max(46, Math.min(r.width - 46, x)) + 'px'
          }
          prow.classList.add('tip-on')
        })
        listenElement(seek, 'mouseleave', function () {
          prow.classList.remove('tip-on')
        })
      }
    })
    p.querySelectorAll('[data-lyricbtn]').forEach(function (lb) {
      listenElement(lb, 'click', function () {
        var ly = p.querySelector('[data-lyric]')
        ly.classList.toggle('show')
        lb.classList.toggle('on')
        if (ly.classList.contains('show')) renderClock(true)
      })
    })
    /* fullscreen lyrics : drag / scroll to browse — the line at the column's centre
     is focused, a chip shows its start time, and clicking the chip (or the line
     itself) seeks playback there. Follow-scroll pauses while browsing and
     resumes a few seconds after the user lets go. */
    p.querySelectorAll('[data-fs-lyrics]').forEach(function (fl) {
      var col = fl.closest('.fs-lyrcol')
      var chip = col ? col.querySelector('[data-lyrseek]') : null
      var drag = null
      var returnButton = col ? col.querySelector('[data-lyrreturn]') : null
      // 立即恢复当前播放句，清理浏览计时和芯片；不会改变播放时间。
      function resumeFollowing() {
        const restoreFocus =
          document.activeElement === returnButton ||
          document.activeElement === chip
        state._lyrHoldUntil = 0
        lyricRow(fl, fl._focus)?.classList.remove('focus')
        fl._focus = null
        fl._keyboardBrowsing = false
        fl.classList.remove('keyboard-browsing')
        if (fl._hideT) clearTimeout(fl._hideT)
        fl._hideT = null
        if (chip) {
          chip.classList.remove('show')
          chip.hidden = true
        }
        if (returnButton) returnButton.hidden = true
        state._lyrKey = ''
        render()
        if (restoreFocus) {
          fl._restoringFocus = true
          ;(fl.querySelector('.fl-line.on') || lyricRow(fl, 0, true))?.focus({
            preventScroll: true,
          })
          fl._restoringFocus = false
        }
      }
      // 行按钮的点击与回车都用真实音频的媒体时钟定位。
      function seekLine(j) {
        var lines = fsLinesFor(state.idx)
        if (!lines[j]) return
        resumeFollowing()
        seekTo(Math.min(currentDuration() - 0.3, lines[j].t + 0.02))
      }
      // 浏览时按可视区域中心选择定位句，供拖动与键盘共用。
      function centreLine() {
        const rows = mountedLyricRows(fl)
        if (!rows.length) return -1
        const mid = fl.scrollTop + fl.clientHeight / 2
        // 行高由原文和译文实测，按实际中心坐标二分定位。
        const center = i => rows[i].offsetTop + rows[i].offsetHeight / 2
        let left = 0, right = rows.length - 1
        while (left < right) {
          const index = Math.floor((left + right) / 2)
          if (center(index) < mid) left = index + 1
          else right = index
        }
        const nearest = left > 0 && mid - center(left - 1) <= center(left) - mid ? left - 1 : left
        return Number(rows[nearest].getAttribute('data-lj'))
      }
      // 手动滚动暂停跟随并显示回到当前入口；键盘焦点停留期间不抢读词位置。
      function browse() {
        state._lyrHoldUntil = Date.now() + 3200
        if (returnButton) returnButton.hidden = false
        var j = centreLine()
        if (j < 0) return
        if (fl._focus !== j) {
          lyricRow(fl, fl._focus)?.classList.remove('focus')
          fl._focus = j
          lyricRow(fl, j).classList.add('focus')
        }
        if (chip && col) {
          var lines = fsLinesFor(state.idx)
          if (lines[j]) {
            chip.querySelector('[data-lyrseek-t]').textContent = fmt(lines[j].t)
            chip._j = j
            var colR = col.getBoundingClientRect(),
              lnR = lyricRow(fl, j).getBoundingClientRect()
            var y = lnR.top - colR.top + lnR.height / 2
            chip.style.top = Math.max(52, Math.min(colR.height - 26, y)) + 'px'
            chip.hidden = false
            chip.classList.add('show')
          }
        }
        if (fl._hideT) clearTimeout(fl._hideT)
        fl._hideT = setTimeout(function () {
          fl._hideT = null
          if (fl._keyboardBrowsing && fl.contains(document.activeElement)) {
            state._lyrHoldUntil = Number.MAX_SAFE_INTEGER
            return
          }
          resumeFollowing()
        }, 3200)
      }
      // 滚轮主动打断程序滚动，避免快速滚动时被自动跟随吞掉。
      listenElement(
        fl,
        'wheel',
        () => {
          fl._progUntil = 0
          browse()
        },
        { passive: true }
      )
      // 键盘浏览不触发全局音量快捷键，也不使用延迟滚动动画。
      listenElement(fl, 'keydown', event => {
        const row = event.target?.closest?.('.fl-line')
        if (!row) return
        const index = Number(row.getAttribute('data-lj'))
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          seekLine(index)
          return
        }
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        const count = fsLinesFor(state.idx).length
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : Math.max(
                  0,
                  Math.min(
                    count - 1,
                    index + (event.key === 'ArrowDown' ? 1 : -1)
                  )
                )
        const target = lyricRow(fl, next, true)
        if (!target) return
        fl._keyboardBrowsing = true
        fl.classList.add('keyboard-browsing')
        fl._progUntil = 0
        target.focus({ preventScroll: true })
        fl.scrollTop = Math.max(
          0,
          target.offsetTop - fl.clientHeight / 2 + target.offsetHeight / 2
        )
        browse()
      })
      // 焦点进入歌词时保留手动浏览；移到其他控件后恢复普通延迟跟随。
      listenElement(fl, 'focusin', () => {
        if (fl._restoringFocus) return
        fl._keyboardBrowsing = true
        fl.classList.add('keyboard-browsing')
        browse()
      })
      listenElement(fl, 'focusout', event => {
        if (!state.stage) return
        if (fl.contains(event.relatedTarget)) return
        fl._keyboardBrowsing = false
        fl.classList.remove('keyboard-browsing')
        browse()
      })
      if (returnButton) listenElement(returnButton, 'click', resumeFollowing)
      listenElement(
        fl,
        'scroll',
        function () {
          if (!state.stage) return
          fl._window?.sync(fl._activeLine)
          if (fl._progUntil && Date.now() < fl._progUntil) return
          browse()
        },
        { passive: true }
      )
      listenElement(fl, 'pointerdown', function (e) {
        if (e.pointerType === 'touch') return
        /* never let a drag start a native text selection */
        e.preventDefault()
        var sel = window.getSelection && window.getSelection()
        if (sel && sel.removeAllRanges) sel.removeAllRanges()
        drag = { y: e.clientY, st: fl.scrollTop, moved: false }
        try {
          fl.setPointerCapture(e.pointerId)
        } catch (_e) {}
      })
      listenElement(fl, 'pointermove', function (e) {
        if (!drag) return
        var dy = e.clientY - drag.y
        if (Math.abs(dy) > 5) {
          drag.moved = true
          fl.classList.add('dragging')
        }
        if (drag.moved) {
          var sel2 = window.getSelection && window.getSelection()
          if (sel2 && sel2.removeAllRanges) sel2.removeAllRanges()
          fl.scrollTop = drag.st - dy
        }
      })
      listenElement(fl, 'pointerup', function (e) {
        if (!drag) return
        var wasDrag = drag.moved
        drag = null
        fl.classList.remove('dragging')
        fl._clickSupp = Date.now() + 450
        if (!wasDrag) {
          for (const row of mountedLyricRows(fl)) {
            var rr = row.getBoundingClientRect()
            if (e.clientY >= rr.top && e.clientY <= rr.bottom) {
              seekLine(Number(row.getAttribute('data-lj')))
              break
            }
          }
        }
      })
      listenElement(fl, 'pointercancel', function () {
        drag = null
        fl.classList.remove('dragging')
      })
      listenElement(fl, 'click', function (e) {
        if (fl._clickSupp && Date.now() < fl._clickSupp) return
        var ln =
          e.target && e.target.closest ? e.target.closest('.fl-line') : null
        if (ln) seekLine(parseInt(ln.getAttribute('data-lj'), 10))
      })
      if (chip) {
        listenElement(chip, 'click', function () {
          if (chip._j != null) seekLine(chip._j)
        })
      }
    })
    p.querySelectorAll('.sidebar .navitem').forEach(function (b) {
      listenElement(b, 'click', function () {
        var pg = b.getAttribute('data-nav')
        if (pg) {
          setPage(pg)
        } else {
          state._util = b.getAttribute('data-util')
          state._pageKey = ''
          render()
          handleUtil(state._util)
        }
      })
    })
    p.querySelectorAll('[data-nav-back]').forEach(function (nb) {
      listenElement(nb, 'click', navBack)
    })
    p.querySelectorAll('[data-nav-fwd]').forEach(function (nf) {
      listenElement(nf, 'click', navFwd)
    })
    // 底栏队列气泡由 Vue 独立管理；这里不再通过底栏入口打开全屏。
    p.querySelectorAll('[data-radio-quick]').forEach(function (rb) {
      listenElement(rb, 'click', function () {
        if (!state.radioOn) startRadio()
        setPage('radio')
      })
    })
    p.querySelectorAll('[data-tag]').forEach(function (tg) {
      listenElement(tg, 'click', function () {
        setQuery(tg.getAttribute('data-tag'))
      })
    })
    p.querySelectorAll('[data-set-toggle]').forEach(function (b) {
      listenElement(b, 'click', function () {
        var k = b.getAttribute('data-set-toggle')
        state.settings[k] = !state.settings[k]
        renderSettings()
      })
    })
    p.querySelectorAll('[data-set-seg]').forEach(function (seg) {
      var key = seg.getAttribute('data-set-seg')
      seg.querySelectorAll('button').forEach(function (b) {
        listenElement(b, 'click', function () {
          state.settings[key] = b.getAttribute('data-val')
          renderSettings()
        })
      })
    })
    p.querySelectorAll('[data-set-range]').forEach(function (r) {
      listenElement(r, 'input', function () {
        state.settings[r.getAttribute('data-set-range')] = parseInt(r.value, 10)
        renderSettings()
      })
    })
    /* hub tabs + generic page jump + pagination (delegated: pager buttons are re-rendered) */
    p.querySelectorAll('[data-lib-tab]').forEach(function (b) {
      listenElement(b, 'click', function () {
        setPage(b.getAttribute('data-lib-tab'))
      })
    })
    p.querySelectorAll('[data-src-tab]').forEach(function (b) {
      listenElement(b, 'click', function () {
        setPage(b.getAttribute('data-src-tab'))
      })
    })
    p.querySelectorAll('[data-goto]').forEach(function (b) {
      listenElement(b, 'click', function () {
        setPage(b.getAttribute('data-goto'))
      })
    })
    var pgMain = p.querySelector('.main')
    if (pgMain) {
      listenElement(pgMain, 'click', function (e) {
        var cl =
          e.target && e.target.closest
            ? e.target.closest('[data-clear-recent]')
            : null
        if (cl) {
          state.recent = []
          state.pg.recent = 1
          state._pageKey = ''
          render()
          return
        }
        var qn =
          e.target && e.target.closest ? e.target.closest('[data-qnext]') : null
        if (qn) {
          playNext(parseInt(qn.getAttribute('data-qnext'), 10))
          return
        }
        var srw =
          e.target && e.target.closest ? e.target.closest('[data-srow]') : null
        if (srw) {
          selectTrack(parseInt(srw.getAttribute('data-srow'), 10), true)
          return
        }
        var stg =
          e.target && e.target.closest
            ? e.target.closest('[data-smart-toggle]')
            : null
        if (stg) {
          var sk = stg.getAttribute('data-smart-toggle')
          state.smartOpen = state.smartOpen === sk ? null : sk
          state._pageKey = ''
          render()
          return
        }
        var sb =
          e.target && e.target.closest ? e.target.closest('[data-sort]') : null
        if (sb) {
          var pr = sb.getAttribute('data-sort').split(':')
          state.sorts[pr[0]] = pr[1]
          state.pg[pr[0]] = 1
          state._pageKey = ''
          render()
          return
        }
        var g =
          e.target && e.target.closest ? e.target.closest('[data-pg-go]') : null
        if (!g || g.disabled) return
        var parts = g.getAttribute('data-pg-go').split(':')
        state.pg[parts[0]] = parseInt(parts[1], 10)
        state._pageKey = ''
        state._srcKey = ''
        buildLists()
        render()
      })
    }
    var fi = p.querySelector('[data-file-input]')
    function takeFiles(list) {
      if (!list || !list.length) return
      for (var i = 0; i < list.length; i++) {
        var f = list[i]
        var folder = ''
        if (f.webkitRelativePath) folder = f.webkitRelativePath.split('/')[0]
        else if (f._fold) folder = f._fold
        state.uploads.push({
          name: f.name,
          size: fmtSize(f.size),
          ext: (f.name.split('.').pop() || '').toUpperCase(),
          added: false,
          folder: folder,
        })
      }
      state.upMsg =
        '已读取 ' +
        list.length +
        ' 个文件，可登记文件名和大小。'
      state._srcKey = ''
      render()
    }
    p.querySelectorAll('[data-pick-files]').forEach(function (b) {
      listenElement(b, 'click', function () {
        if (fi) fi.click()
      })
    })
    if (fi)
      listenElement(fi, 'change', function () {
        takeFiles(fi.files)
        fi.value = ''
      })
    var fiDir = p.querySelector('[data-dir-input]')
    p.querySelectorAll('[data-pick-dir]').forEach(function (b) {
      listenElement(b, 'click', function () {
        if (fiDir) fiDir.click()
      })
    })
    if (fiDir)
      listenElement(fiDir, 'change', function () {
        takeFiles(fiDir.files)
        fiDir.value = ''
      })
    /* drag a whole folder in: walk dropped directory entries recursively */
    function collectEntry(entry, rootName, out, cb) {
      if (entry.isFile) {
        entry.file(
          function (f) {
            try {
              f._fold = rootName
            } catch (e) {}
            out.push(f)
            cb()
          },
          function () {
            cb()
          }
        )
        return
      }
      if (entry.isDirectory) {
        var rd = entry.createReader()
        ;(function nextBatch() {
          rd.readEntries(
            function (ents) {
              if (!ents.length) {
                cb()
                return
              }
              var pend = ents.length
              ents.forEach(function (en) {
                collectEntry(en, rootName, out, function () {
                  if (--pend === 0) nextBatch()
                })
              })
            },
            function () {
              cb()
            }
          )
        })()
        return
      }
      cb()
    }
    var drop = p.querySelector('[data-drop]')
    if (drop) {
      listenElement(drop, 'dragover', function (e) {
        e.preventDefault()
        drop.classList.add('drag')
      })
      listenElement(drop, 'dragleave', function () {
        drop.classList.remove('drag')
      })
      listenElement(drop, 'drop', function (e) {
        e.preventDefault()
        drop.classList.remove('drag')
        var items = e.dataTransfer.items,
          out = [],
          pend = 0,
          used = false
        if (items && items.length) {
          for (var i = 0; i < items.length; i++) {
            var it = items[i]
            if (it.kind !== 'file') continue
            var en = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null
            if (en) {
              used = true
              pend++
              collectEntry(en, en.isDirectory ? en.name : '', out, function () {
                if (--pend === 0) takeFiles(out)
              })
            }
          }
        }
        if (!used) takeFiles(e.dataTransfer.files)
      })
    }
    p.querySelectorAll('[data-up-add]').forEach(function (b) {
      listenElement(b, 'click', function () {
        var panel = b.closest('.page-panel')
        if (!panel) return
        var tIn = panel.querySelector('[data-up-title]'),
          aIn = panel.querySelector('[data-up-artist]'),
          alIn = panel.querySelector('[data-up-album]')
        var title = tIn ? tIn.value.trim() : ''
        if (!title) {
          state.upMsg = '先填一下歌名 — 歌手和专辑可以留空。'
          state._srcKey = ''
          render()
          return
        }
        TRACKS.push({
          title: title,
          artist: (aIn && aIn.value.trim()) || '未知歌手',
          album: (alIn && alIn.value.trim()) || '我上传的',
          dur: 0,
          cover: defaultCover,
          q: '本地资料',
          glow: 'rgba(140,160,255,.5)',
          mine: true,
        })
        state.upAdded++
        state.upMsg = '已登记《' + title + '》的曲目信息。'
        if (tIn) tIn.value = ''
        if (aIn) aIn.value = ''
        if (alIn) alIn.value = ''
        buildLists()
        state._pageKey = ''
        state._srcKey = ''
        render()
      })
    })
    p.querySelectorAll('[data-newpl]').forEach(function (b) {
      listenElement(b, 'click', function () {
        state._plSeq = (state._plSeq || 0) + 1
        var name = '新建歌单 ' + state._plSeq
        while (
          state.myLists.some(function (m) {
            return m.name === name
          })
        ) {
          state._plSeq++
          name = '新建歌单 ' + state._plSeq
        }
        const playlist = {
          name: name,
          source: '本地自建',
          count: 0,
          trackIndices: [],
        }
        state.myLists.push(playlist)
        state.customPl = playlist
        state._srcKey = ''
        setPage('playlist', state.playlistIdx)
        state._pageKey = ''
        render()
      })
    })
    /* volume: one shared state for every slider + speaker button, both windows + fullscreen docks */
    p.querySelectorAll('.vol').forEach(function (v) {
      listenElement(v, 'input', function () {
        setVol(parseInt(v.value, 10))
      })
      listenElement(v, 'pointerenter', function () {
        showVolTips()
      })
      listenElement(
        v,
        'wheel',
        function (e) {
          e.preventDefault()
          setVol(state.vol + (e.deltaY < 0 ? 5 : -5))
        },
        { passive: false }
      )
    })
    p.querySelectorAll('[data-volbtn]').forEach(function (b) {
      listenElement(b, 'click', toggleMute)
      listenElement(b, 'pointerenter', function () {
        showVolTips()
      })
      listenElement(
        b,
        'wheel',
        function (e) {
          e.preventDefault()
          setVol(state.vol + (e.deltaY < 0 ? 5 : -5))
        },
        { passive: false }
      )
    })
    // 保留原稿的收起与展开阈值，短首页随正文自然滚动。
    var mainEl = p.querySelector('.main')
    if (mainEl) {
      listenElement(
        mainEl,
        'scroll',
        function () {
          var c = mainEl.classList.contains('compact')
          if (!c && mainEl.scrollTop > 70 && hasRoomForCompactBanner(mainEl))
            mainEl.classList.add('compact')
          else if (c && mainEl.scrollTop < 12)
            mainEl.classList.remove('compact')
        },
        { passive: true }
      )
    }
    var banner = p.querySelector('[data-banner]')
    if (banner) {
      // 隐藏、全屏覆盖或减动效时跳过横幅的鼠标取景和样式写入。
      listenElement(banner, 'mousemove', function (e) {
        if (banner.classList.contains('banner-calm')) return
        var r = banner.getBoundingClientRect()
        if (!r.width || !r.height) return
        var bx = (e.clientX - r.left) / r.width - 0.5
        var by = (e.clientY - r.top) / r.height - 0.5
        banner.style.setProperty('--bx', bx.toFixed(3))
        banner.style.setProperty('--by', by.toFixed(3))
        banner.style.setProperty('--bxp', (bx + 0.5) * 100 + '%')
        banner.style.setProperty('--byp', (by + 0.5) * 100 + '%')
      })
      // 只有仍在显示动效的横幅才需要复位视差。
      listenElement(banner, 'mouseleave', function () {
        if (banner.classList.contains('banner-calm')) return
        banner.style.setProperty('--bx', 0)
        banner.style.setProperty('--by', 0)
      })
    }
    /* liquid: specular follows mouse — follows the effective glass style, so it moves with the 玻璃质感 setting */
    listenElement(p, 'mousemove', function (e) {
      var wrap = p.parentElement
      if (!wrap || !wrap.classList.contains('liquid-win')) return
      var r = p.getBoundingClientRect()
      p.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%')
      p.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%')
    })
  }
  // 新路由和动态挂载的横幅复用现有频谱，同步其画布后再绑定控件。
  function bind() {
    audio.bindSpectrumViews()
    players().forEach(bindPlayer)
  }
  bind()
  document.addEventListener('keydown', function (e) {
    // 模态层自行处理键盘，避免 Escape 返回首页或空格改变背景播放。
    if (nativeDocument.querySelector('dialog[open]')) return
    if (e.code === 'Escape' && (state.stage || state.stageLoading)) {
      closeStage()
      return
    }
    if (e.code === 'Escape' && state.page !== 'home') {
      setPage('home')
      return
    }
    if (
      e.code === 'Space' &&
      !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)
    ) {
      e.preventDefault()
      togglePlayback()
    }
    if (e.code === 'Space' && document.activeElement.tagName === 'BODY') {
      e.preventDefault()
      togglePlayback()
    }
    var ktag = document.activeElement.tagName
    if (/INPUT|TEXTAREA/.test(ktag)) return
    if (e.code === 'ArrowRight') {
      seekTo(state.t + 5)
    }
    if (e.code === 'ArrowLeft') {
      seekTo(state.t - 5)
    }
    if (e.code === 'ArrowUp') {
      e.preventDefault()
      setVol(state.vol + 5)
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault()
      setVol(state.vol - 5)
    }
    if (e.code === 'KeyM') {
      toggleMute()
    }
  })

  listenWindow('resize', function () {
    players().forEach(function (p) {
      positionPill(p)
    })
  })

  buildLists()
  render()

  // 折叠后的可滚动距离至少保留触发阈值，防止浏览器将页面挤回顶部。
  function hasRoomForCompactBanner(scroller) {
    const hero = scroller.querySelector('[data-banner]')
    if (!hero) return false
    const style = nativeWindow.getComputedStyle(hero)
    const compactHeight = parseFloat(style.getPropertyValue('--banner-compact-height'))
    const shrink = hero.offsetHeight - compactHeight
    return scroller.scrollHeight - scroller.clientHeight - shrink >= 70
  }

  // 小窗只接收当前句及相邻歌词，以绝对行号定位动画，避免每次时钟广播整首文本。
  function getSnapshot() {
    const track = { ...(TRACKS[state.idx] || emptyTrack), dur: currentDuration() }
    const lines = fsLinesFor(state.idx)
    const lyricIndex = Math.max(0, lyricIndexAt(lines, state.t))
    const lyricOffset = Math.max(0, lyricIndex - 1)
    return {
      track,
      playing: state.playing,
      audioLoading: state.audioLoading,
      playable: TRACKS[state.idx] ? !!track.catalog : !!state.queue?.length,
      glassStyle: state.settings.glassStyle,
      lyricIslandSnap: state.settings.lyricIslandSnap,
      time: state.t,
      volume: effVol(),
      liked: !!state.liked[state.idx],
      favoriteBusy: !!track.catalog && state.pendingFavorites.has(favoriteKey(track.catalog)),
      favoriteHint: favoriteHint(track),
      favoriteTarget: favoriteTarget(TRACKS[state.idx]),
      lyrics: lines.slice(lyricOffset, lyricIndex + 2).map(line => line.o),
      lyricOffset,
      lyricIndex,
      capsuleLyric: state.capsuleLyric,
      motion: state.settings.motion,
      fontSize: deskFont,
      locked: state.settings.deskLock,
      index: state.idx,
      direction: nativeDirection,
    }
  }
  // 独立窗口共用主播放器的收藏、点播和进度操作。
  function dispatch(action) {
    if (action.type === 'toggle') togglePlayback()
    else if (action.type === 'next') nextTrack()
    else if (action.type === 'previous') prevTrack()
    else if (action.type === 'like') {
      if (action.favoriteTarget && action.favoriteTarget === favoriteTarget(TRACKS[state.idx])) void toggleFavorite()
      else render()
    }
    else if (action.type === 'volume') setVol(action.value)
    else if (action.type === 'seek') {
      seekTo(Math.max(0, Math.min(1, action.value)) * currentDuration())
    }
  }
  // Vue 页面退出时只释放宿主资源，不修改原稿的交互状态与视觉规则。
  function destroy() {
    destroyed = true
    stageRequest?.abort()
    state.stageLoading = false
    lyricRequest?.abort()
    audio.destroy()
    cleanups.forEach(cleanup => cleanup())
    timeouts.forEach(id => nativeWindow.clearTimeout(id))
    frames.forEach(id => nativeWindow.cancelAnimationFrame(id))
    root
      .getAnimations({ subtree: true })
      .forEach(animation => animation.cancel())

    nativeDocument.body.classList.remove('wx-off', 'calm')
  }
  // 页面挂载后重建必要的测量与事件，不重置播放时钟。
  function refresh() {
    bind()
    state._pageKey = ''
    state._srcKey = ''
    state._lyrKey = ''
    buildLists()
    render()
  }
  // 提交关键词并更新历史；从曲名进入时按来源打开歌曲结果第一页。
  function setQuery(query, songPlatform) {
    if (songPlatform) {
      state.searchPlatform = songPlatform
      state.searchKind = 'tracks'
      state.pg.search = 1
    }
    state.queryDraft = query
    state.query = query.trim()
    if (state.query) state.searchHistory = recentSearches([state.query, ...state.searchHistory])
    state.queryRevision++
    if (songPlatform) {
      setPage('search')
      return
    }
    state._pageKey = ''
    render()
  }
  // 第一次进入在舞台就绪后启动原有分层动画；再次点击可取消慢加载。
  async function openStage(trigger) {
    if (!TRACKS[state.idx] || state.stage) return
    if (stageRequest) {
      closeStage()
      return
    }
    stageTrigger = trigger ?? nativeDocument.activeElement
    if (!root.querySelector('[data-fs]') && options.prepareStage) {
      const request = new AbortController()
      stageRequest = request
      state.stageLoading = true
      try {
        await options.prepareStage(request.signal)
        if (destroyed || request.signal.aborted || !TRACKS[state.idx]) return
        bind()
        state._ambIdx = undefined
      } catch {
        if (!destroyed && !request.signal.aborted) notify('全屏舞台加载失败，请重新打开', 'error')
        return
      } finally {
        if (stageRequest === request) {
          stageRequest = undefined
          state.stageLoading = false
        }
      }
    }
    setStage(true)
    root.querySelector('.fs-top [data-stage-toggle]')?.focus({ preventScroll: true })
  }
  // 取消仍在准备的舞台，或播放既有退场动画并把焦点交回入口。
  function closeStage() {
    stageRequest?.abort()
    stageRequest = undefined
    state.stageLoading = false
    if (state.stage) {
      setStage(false)
      resetLyricBrowsing(root.querySelector('[data-fs-lyrics]'))
    }
    if (stageTrigger?.isConnected) stageTrigger.focus({ preventScroll: true })
    stageTrigger = undefined
  }
  return {
    getSnapshot,
    dispatch,
    destroy,
    bind,
    refresh,
    navigate: setPage,
    selectTrack,
    reloadPlayback,
    openStage,
    playTracks,
    toggleRadio,
    setQuery,
    playSmart,
    smartList,
    playNext,
    moveQueue,
    render,
    addUploadToLibrary,
  }
}
