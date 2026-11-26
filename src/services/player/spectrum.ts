import {
  artworkColor,
  type ArtworkColor,
} from '@/services/player/artwork-color'
import {
  spectrumProfile,
  spectrumRhythm,
} from '@/services/player/spectrum-profile'

const fftSize = 4096

// 横幅点阵音频绑定的平滑参数：点位/点径全部由原图提取层承担（见 paintDots），
// 这里只定能量怎样调制叠加 alpha——攻击快、释放慢的一阶平滑加 alpha 限幅，
// 再叠 1 秒整层淡入淡出，保证点是平滑起伏而不是逐帧跳变。
const DOTS_COLS = 28
const DOTS_ATTACK_MS = 90
const DOTS_RELEASE_MS = 350
const DOTS_FADE_MS = 1000
const DOTS_MAX_ALPHA = 0.35
const DOTS_ALPHA_SLEW = 0.9

// 保留细柱与自适应密度，同时同步原稿的左右 2px 留白；窄窗口不裁切 168 根。
export function spectrumLayout(width: number) {
  if (!Number.isFinite(width) || width <= 0)
    return { count: 0, step: 0, barWidth: 0, padding: 0 }
  const padding = Math.min(2, width / 4)
  const innerWidth = width - padding * 2
  const count = Math.max(1, Math.min(320, Math.floor((innerWidth + 2) / 4)))
  const step = innerWidth / count
  return { count, step, barWidth: Math.min(2, step * 0.55), padding }
}

export interface SpectrumPlayback {
  playing: boolean
  time: number
  duration: number
  seed: number
  demo: boolean
}

type CapturableAudio = HTMLAudioElement & { captureStream?: () => MediaStream }
type SpectrumMode = 'static' | 'live' | 'simulated'

// 按显示尺寸设置画布像素密度，折叠或隐藏时不重新分配位图。
function fitCanvas(canvas: HTMLCanvasElement, paint: CanvasRenderingContext2D) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) return
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  const pixelWidth = Math.round(width * ratio)
  const pixelHeight = Math.round(height * ratio)
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  paint.setTransform(ratio, 0, 0, ratio, 0, 0)
  paint.clearRect(0, 0, width, height)
  return { width, height, ratio }
}

// 真实频谱仍捕获已有播放元素的 PCM 副本，不改音量、输出设备或出声路径。
export function createSpectrum(
  canvas: HTMLCanvasElement,
  audio: CapturableAudio
) {
  const paint = canvas.getContext('2d')
  let banner:
    { canvas: HTMLCanvasElement; paint: CanvasRenderingContext2D } | undefined
  let dots:
    { canvas: HTMLCanvasElement; paint: CanvasRenderingContext2D } | undefined
  // 原图提取点层的位图与就绪标记：只在横幅点阵画布接入时懒加载，
  // 人物切换导致地址变化时重新加载（当前地址单独记一份用于比对）。
  let dotsImage: HTMLImageElement | undefined
  let dotsImageReady = false
  let dotsImageSrc = ''
  // 点阵整层淡入淡出进度：0 时叠加层完全不画，静态横幅与单图版逐像素一致。
  let dotsFade = 0
  let dotsFadeFrame: number | undefined
  // 上一帧点阵推进的时间戳，供按真实帧间隔做时间常数平滑而不是按帧数凑系数。
  let dotsStamp: number | undefined
  // 每列平滑后的能量与最终显示 alpha：能量走攻击/释放平滑，alpha 再走限幅，
  // 两级串联后帧间变化被压到很小（量化口径见 qa 采样脚本）。
  const dotLevels = new Float32Array(DOTS_COLS)
  const dotAlphas = new Float32Array(DOTS_COLS)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const bins = new Uint8Array(fftSize / 2)
  let context: AudioContext | undefined
  let analyser: AnalyserNode | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let frame: number | undefined
  let enabled = true
  let destroyed = false
  let analysisFailed = false
  let playback: SpectrumPlayback | undefined
  let mode: SpectrumMode = 'static'
  let profileSeed = NaN
  let profile: Float32Array = new Float32Array(0)
  let levels = new Float32Array(0)
  let targets = new Float32Array(0)
  let clock = 0
  let lastTimestamp: number | undefined
  let lastPaint: number | undefined
  let artworkKey = ''
  let colorVersion = 0
  let targetColor: ArtworkColor = [110, 140, 255]
  let currentColor: ArtworkColor = targetColor
  let fromColor: ArtworkColor = targetColor
  let colorStart: number | undefined

  // 发布主频谱状态；横幅 EQ 条带只显示实频或静态轮廓。
  function setMode(value: SpectrumMode): void {
    mode = value
    canvas.dataset.spectrumMode = value
    if (banner)
      banner.canvas.dataset.spectrumMode = value === 'live' ? 'live' : 'static'
    if (dots) {
      dots.canvas.dataset.spectrumMode = value === 'live' ? 'live' : 'static'
      kickDotsFade()
    }
  }

  // 懒加载当前人物的提取点层（逐点提取成果，与对应整图逐像素同源）：
  // 叠加层不重画任何网格，只把这张与底图同尺寸、同点位的透明点图按列调 alpha 贴回
  // 原位再轻微提亮——点位、点径、点形与静态图严格一致，从根上避开双重印点与摩尔纹。
  // 地址由 featured-banner 按素材映射写在画布 dataset 上，缺省为原始人物那张。
  function ensureDotsImage(): void {
    if (typeof Image === 'undefined' || !dots) return
    const src = dots.canvas.dataset.dotsSrc || '/images/pop-hero-dots.webp'
    if (dotsImage && dotsImageSrc === src) return
    dotsImageSrc = src
    dotsImageReady = false
    const image = new Image()
    image.src = src
    image.onload = () => {
      if (dotsImage !== image) return
      dotsImageReady = true
      if (dotsFade > 0) paintDots()
    }
    dotsImage = image
  }

  // 推进一帧点阵状态：每列目标能量取自底栏同一组实频 levels（低频在左、高频在右），
  // 先按攻击 90ms / 释放 350ms 的时间常数平滑，再把显示 alpha 朝目标限幅推进
  // （每秒至多 0.9），整层另有 1 秒淡入淡出包络；非 live 时目标归零、包络回落。
  function stepDots(timestamp: number): void {
    const dt =
      dotsStamp === undefined
        ? 16
        : Math.min(100, Math.max(0, timestamp - dotsStamp))
    dotsStamp = timestamp
    const live = mode === 'live' && enabled && !reduced.matches
    const target = live ? 1 : 0
    if (dotsFade !== target && dt > 0) {
      const step = dt / DOTS_FADE_MS
      dotsFade =
        target > dotsFade
          ? Math.min(target, dotsFade + step)
          : Math.max(target, dotsFade - step)
    }
    const maxStep = (dt / 1000) * DOTS_ALPHA_SLEW
    const targets: number[] = []
    for (let col = 0; col < DOTS_COLS; col++) {
      let energy = 0
      if (live && levels.length) {
        const start = Math.floor((col / DOTS_COLS) * levels.length)
        const end = Math.max(
          start + 1,
          Math.floor(((col + 1) / DOTS_COLS) * levels.length)
        )
        for (let index = start; index < end; index++)
          energy = Math.max(energy, levels[index] ?? 0)
      }
      targets.push(energy)
      const previous = dotLevels[col]!
      const tau = energy > previous ? DOTS_ATTACK_MS : DOTS_RELEASE_MS
      const smoothed =
        previous + (energy - previous) * (1 - Math.exp(-dt / tau))
      dotLevels[col] = smoothed
      const goal = dotsFade * DOTS_MAX_ALPHA * smoothed
      const current = dotAlphas[col]!
      dotAlphas[col] =
        current +
        Math.max(-maxStep, Math.min(maxStep, goal - current))
    }
    if (dots) {
      dots.canvas.dataset.dotsFade = dotsFade.toFixed(3)
      dots.canvas.dataset.dotsAlpha = Array.from(dotAlphas, value =>
        value.toFixed(3)
      ).join(',')
      // 平滑前的每列目标一并发布，供 QA 量化平滑前后的帧间跳变差。
      dots.canvas.dataset.dotsTarget = targets
        .map(value => value.toFixed(3))
        .join(',')
    }
  }

  // 绘制横幅点阵叠加层：按横幅 cover 裁切的同一坐标系把提取点图分列贴回原位，
  // 只调每列 alpha 并以固定提亮滤镜让原点“亮起来”；点径恒为提取层原样（零变化），
  // 点色就是提取层自带的单墨青蓝，不另上色。包络为零或减动效时完全不画，
  // 静态横幅与单图版逐像素一致。
  function paintDots(timestamp = 0): void {
    if (!dots || destroyed) return
    const { canvas, paint } = dots
    if (reduced.matches || !enabled) {
      if (dotsFade !== 0 || dotAlphas.some(value => value > 0)) {
        dotsFade = 0
        dotLevels.fill(0)
        dotAlphas.fill(0)
      }
      const cleared = fitCanvas(canvas, paint)
      if (cleared) canvas.dataset.dotsAlpha = ''
      return
    }
    stepDots(timestamp)
    const size = fitCanvas(canvas, paint)
    if (!size) return
    // 人物切换后地址可能已变，先确认点图仍是当前人物的那张再绘制。
    ensureDotsImage()
    if (!dotsImageReady || !dotsImage) return
    if (dotAlphas.every(value => value < 0.004)) return
    const { width, height } = size
    // 图像空间口径随当前人物素材走：原生尺寸与裁切分数由 featured-banner 按素材
    // 映射写在画布 dataset 上，与底图 object-position 同口径；缺省即原始人物
    // 的 2736×912 与展开 62%·36% / 窄窗 88%·36%。折叠迷你条下画布被 CSS 隐藏、
    // 尺寸为零已在上方返回。
    const artW = Number(canvas.dataset.artWidth) || 2736
    const artH = Number(canvas.dataset.artHeight) || 912
    const posX =
      width <= 700
        ? Number(canvas.dataset.artPosXNarrow) || 0.88
        : Number(canvas.dataset.artPosX) || 0.62
    const posY = Number(canvas.dataset.artPosY) || 0.36
    const scale = Math.max(width / artW, height / artH)
    const ox = (width - artW * scale) * posX
    const oy = (height - artH * scale) * posY
    const sy0 = Math.max(0, (0 - oy) / scale)
    const sy1 = Math.min(artH, (height - oy) / scale)
    const dy0 = oy + sy0 * scale
    const dy1 = oy + sy1 * scale
    if (sy1 <= sy0) return
    paint.filter = 'brightness(1.7) saturate(1.25)'
    for (let col = 0; col < DOTS_COLS; col++) {
      const alpha = dotAlphas[col]!
      if (alpha < 0.004) continue
      const dx0 = (col / DOTS_COLS) * width
      const dx1 = ((col + 1) / DOTS_COLS) * width
      const sx0 = Math.max(0, (dx0 - ox) / scale)
      const sx1 = Math.min(artW, (dx1 - ox) / scale)
      if (sx1 <= sx0) continue
      paint.globalAlpha = alpha
      paint.drawImage(
        dotsImage,
        sx0,
        sy0,
        sx1 - sx0,
        sy1 - sy0,
        ox + sx0 * scale,
        dy0,
        (sx1 - sx0) * scale,
        dy1 - dy0
      )
    }
    paint.globalAlpha = 1
    paint.filter = 'none'
  }

  // 点阵淡入淡出帧循环：主频谱循环在暂停后会停下，这一独立循环把 1 秒淡出走完，
  // 不让点层在暂停瞬间硬消失；包络与各列 alpha 都归零后自动停帧。
  function fadeDots(timestamp?: number): void {
    if (!dots || destroyed) {
      dotsFadeFrame = undefined
      return
    }
    paintDots(timestamp ?? 0)
    const target = mode === 'live' && enabled && !reduced.matches ? 1 : 0
    const settled =
      dotsFade === target && dotAlphas.every(value => value < 0.004 || target === 1)
    if (!settled && !(target === 1 && dotsFade === 1)) {
      dotsFadeFrame = requestAnimationFrame(fadeDots)
    } else if (target === 1 && dotsFade === 1) {
      // 稳态 live 时主循环 paintBars 每帧都会带 paintDots，这里只在淡入未完成时续帧。
      dotsFadeFrame = undefined
    } else {
      dotsFadeFrame = undefined
    }
  }

  // 模式或动效开关变化后启动点阵过渡循环；已在目标态时不做无谓排帧。
  function kickDotsFade(): void {
    if (!dots || destroyed || dotsFadeFrame !== undefined) return
    dotsFadeFrame = requestAnimationFrame(fadeDots)
  }

  // 播放中的换色与原稿 background 过渡一样持续 600ms，不逐帧读取封面像素。
  function paintColor(timestamp: number, resting: boolean): string {
    if (resting) currentColor = targetColor
    else {
      colorStart ??= timestamp
      const progress = Math.min(1, Math.max(0, (timestamp - colorStart) / 600))
      const ease = 1 - (1 - progress) ** 2
      const mix = (channel: number) =>
        Math.round(
          fromColor[channel]! +
            (targetColor[channel]! - fromColor[channel]!) * ease
        )
      currentColor = [mix(0), mix(1), mix(2)]
    }
    return `rgba(${currentColor.join(',')},0.55)`
  }

  // 在底栏保留原有细柱，并把相同的一帧频带复用给横幅。
  function paintBars(timestamp: number, resting: boolean): void {
    if (!paint || destroyed) return
    const size = fitCanvas(canvas, paint)
    if (!size && !banner?.canvas.clientWidth) return
    const width = size?.width || banner!.canvas.clientWidth
    const height = size?.height ?? 0
    const ratio = size?.ratio ?? 1
    paint.fillStyle = paintColor(timestamp, resting)
    const { count, step, barWidth, padding } = spectrumLayout(width)
    const seed = playback?.seed ?? 0
    if (levels.length !== count || profileSeed !== seed) {
      profileSeed = seed
      profile = spectrumProfile(seed, count)
      levels = new Float32Array(count)
      targets = new Float32Array(count)
      canvas.dataset.spectrumBands = String(count)
    }
    if (!resting && mode === 'live' && analyser && context) {
      analyser.getByteFrequencyData(bins)
      const binScale = fftSize / context.sampleRate
      // 保留真实的 50Hz–10kHz 对数频带，柱高只取实际能量，不乘随机轮廓。
      for (let band = 0; band < count; band++) {
        const start = Math.floor(50 * 200 ** (band / count) * binScale)
        const end = Math.min(
          bins.length,
          Math.max(
            start + 1,
            Math.floor(50 * 200 ** ((band + 1) / count) * binScale)
          )
        )
        let peak = 0
        for (let bin = start; bin < end; bin++)
          peak = Math.max(peak, bins[bin] ?? 0)
        targets[band] = peak / 255
      }
    } else if (!resting && mode === 'simulated') {
      spectrumRhythm(seed, clock, playback?.duration ?? 200, profile, targets)
    }
    for (let band = 0; band < count; band++) {
      let barHeight: number
      if (resting) barHeight = (height * Math.round(profile[band]! * 100)) / 100
      else {
        const target = targets[band]!
        const previous = levels[band]!
        const attack = mode === 'live' ? 0.62 : 0.6
        const release = mode === 'live' ? 0.24 : 0.16
        levels[band] =
          previous +
          (target - previous) * (target > previous ? attack : release)
        barHeight =
          mode === 'live'
            ? height * levels[band]!
            : height * profile[band]! * (0.06 + levels[band]! * 1.12)
      }
      barHeight = Math.min(height, Math.max(0, barHeight))
      if (barHeight <= 0) continue
      const x =
        Math.round((padding + band * step + (step - barWidth) / 2) * ratio) /
        ratio
      const y = height - barHeight
      if (typeof paint.roundRect === 'function') {
        const radius = Math.min(1, barWidth / 2, barHeight / 2)
        paint.beginPath()
        paint.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0])
        paint.fill()
      } else paint.fillRect(x, y, barWidth, barHeight)
    }
    paintBanner()
    paintDots(timestamp)
  }

  // 从中线向左右映射实频，并逐渐降低边缘高度，让频谱融入横幅背景。
  function paintBanner(): void {
    if (!banner || destroyed) return
    const { canvas, paint } = banner
    const size = fitCanvas(canvas, paint)
    if (!size) return
    const { width, height } = size
    const half = Math.max(1, Math.min(64, Math.floor(width / 10)))
    const count = half * 2
    const step = width / count
    const barWidth = Math.min(3, step * 0.6)
    const live = mode === 'live'
    const color = currentColor.map(channel =>
      Math.round(channel * 0.76 + 255 * 0.24)
    )
    // 静态种子帧改用 pop-yellow 实色小条，对齐参照 hero 左下的黄色 EQ；实频帧仍走封面
    // accent 提亮色，让条带在播放时回到与底栏一致的专辑色体系。取舍：静态帧的形状仍是
    // 既有正弦种子轮廓（细条密排），只换颜色不换形，与参照 7 根粗条的疏密不完全一致。
    paint.fillStyle = live
      ? `rgba(${color.join(',')},0.46)`
      : 'rgba(255,216,61,0.85)'
    for (let band = 0; band < count; band++) {
      let barHeight: number
      if (live) {
        const outward = band < half ? half - band - 1 : band - half
        const start = Math.floor((outward / half) ** 1.25 * levels.length)
        const end = Math.max(
          start + 1,
          Math.floor(((outward + 1) / half) ** 1.25 * levels.length)
        )
        let peak = 0
        for (let index = start; index < end; index++)
          peak = Math.max(peak, levels[index] ?? 0)
        const falloff =
          0.32 + 0.68 * Math.cos((Math.PI * (outward + 0.5)) / (2 * half))
        barHeight = 2 + peak ** 1.08 * Math.max(0, height - 8) * falloff
      } else barHeight = 2 + 7 * Math.sin((Math.PI * (band + 0.5)) / count) ** 2
      barHeight = Math.min(height, barHeight)
      const x = band * step + (step - barWidth) / 2
      const y = (height - barHeight) / 2
      if (typeof paint.roundRect === 'function') {
        paint.beginPath()
        paint.roundRect(
          x,
          y,
          barWidth,
          barHeight,
          Math.min(barWidth / 2, barHeight / 2)
        )
        paint.fill()
      } else paint.fillRect(x, y, barWidth, barHeight)
    }
  }

  function applyColor(color: ArtworkColor): void {
    fromColor = currentColor
    targetColor = color
    colorStart = undefined
    canvas.style.color = `rgb(${color.join(',')})`
    canvas.style.setProperty?.('--spec-c', `rgba(${color.join(',')},0.55)`)
    canvas.dataset.spectrumColor = color.join(',')
    if (frame === undefined) paintBars(0, true)
  }

  // 在线曲目保留实际封面取色；原稿示例曲目可直接沿用其专辑背景光色。
  function setArtwork(url: string, glow: string, preferArtwork = true): void {
    const key = `${url}|${glow}|${preferArtwork}`
    if (destroyed || key === artworkKey) return
    artworkKey = key
    const version = ++colorVersion
    const match = /(\d+)[, ]+(\d+)[, ]+(\d+)/.exec(glow)
    const fallback: ArtworkColor = match
      ? [
          Math.min(255, +match[1]!),
          Math.min(255, +match[2]!),
          Math.min(255, +match[3]!),
        ]
      : [110, 140, 255]
    applyColor(fallback)
    if (!preferArtwork) return
    void artworkColor(url, canvas.ownerDocument).then(color => {
      if (!destroyed && version === colorVersion && color) applyColor(color)
    })
  }

  function resume(): void {
    if (!paint || !audio.captureStream || !window.AudioContext || destroyed)
      return
    try {
      context ??= new AudioContext()
    } catch {
      return
    }
    if (context.state === 'suspended')
      void context.resume().catch(() => undefined)
  }

  // 停止动画帧，但原稿静态轮廓仍然留在玻璃背景上。
  function stop(): void {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    lastTimestamp = lastPaint = undefined
    levels.fill(0)
    setMode('static')
    paintBars(0, true)
  }

  function draw(timestamp?: number): void {
    if (
      destroyed ||
      !enabled ||
      reduced.matches ||
      !(playback?.playing ?? !audio.paused) ||
      (!playback?.demo && (audio.paused || audio.readyState < 3))
    ) {
      stop()
      return
    }
    frame = requestAnimationFrame(draw)
    if (timestamp !== undefined) {
      if (lastTimestamp !== undefined && mode === 'simulated')
        clock += Math.max(0, timestamp - lastTimestamp) / 1000
      lastTimestamp = timestamp
      if (lastPaint !== undefined && timestamp - lastPaint < 33) return
      lastPaint = timestamp
    }
    paintBars(timestamp ?? 0, false)
  }

  function update(): void {
    if (destroyed || !paint) return
    if (!enabled || reduced.matches || !(playback?.playing ?? !audio.paused)) {
      stop()
      return
    }
    // 加载、缓冲或无跨域权限的真实曲目保持静态，不把模拟峰值冒充实频。
    if (!playback?.demo && (audio.paused || audio.readyState < 3)) {
      stop()
      return
    }
    if (
      !playback?.demo &&
      !source &&
      !analysisFailed &&
      audio.crossOrigin &&
      context &&
      audio.captureStream
    ) {
      try {
        const stream = audio.captureStream()
        if (stream.getAudioTracks().length) {
          const input = context.createMediaStreamSource(stream)
          analyser ??= new AnalyserNode(context, {
            fftSize,
            smoothingTimeConstant: 0.64,
          })
          input.connect(analyser)
          source = input
        }
      } catch {
        analysisFailed = true
      }
    }
    const nextMode = playback?.demo
      ? 'simulated'
      : source && analyser && context
        ? 'live'
        : 'static'
    if (nextMode === 'static') {
      stop()
      return
    }
    if (mode !== nextMode) {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
      levels.fill(0)
      lastTimestamp = lastPaint = undefined
      setMode(nextMode)
    }
    if (frame === undefined) draw()
  }

  // 接入现有时钟；示例状态由曲目来源明确给出，不读取或创建第二个播放时钟。
  function setPlayback(value: SpectrumPlayback): void {
    if (destroyed) return
    if (!playback || playback.seed !== value.seed) {
      clock = value.time
      levels.fill(0)
      lastTimestamp = lastPaint = undefined
    } else if (Math.abs(clock - value.time) > 1.6) clock = value.time
    playback = value
    update()
  }

  function reset(): void {
    stop()
    source?.disconnect()
    source = undefined
    analysisFailed = false
  }

  reduced.addEventListener('change', update)
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(() => {
          if (frame === undefined) paintBars(0, true)
        })
  observer?.observe(canvas)
  setMode('static')
  paintBars(0, true)

  // 首页挂载、切换路由或更换媒体元素时连接当前画布，只保留一个尺寸监听。
  function setBannerCanvas(canvas: HTMLCanvasElement | null): void {
    if (destroyed || (banner?.canvas ?? null) === canvas) return
    if (banner) observer?.unobserve(banner.canvas)
    const paint = canvas?.getContext('2d')
    banner = canvas && paint ? { canvas, paint } : undefined
    if (banner) {
      banner.canvas.dataset.spectrumMode = mode === 'live' ? 'live' : 'static'
      observer?.observe(banner.canvas)
      paintBanner()
    }
  }

  // 首页挂载时连接横幅点阵画布：接入即懒加载提取点层并对齐当前模式，
  // 静态时包络为零、画布保持全透明，不改变单图版的任何像素。
  function setDotsCanvas(canvas: HTMLCanvasElement | null): void {
    if (destroyed || (dots?.canvas ?? null) === canvas) return
    if (dots) observer?.unobserve(dots.canvas)
    const paint = canvas?.getContext('2d')
    dots = canvas && paint ? { canvas, paint } : undefined
    if (dots) {
      dots.canvas.dataset.spectrumMode = mode === 'live' ? 'live' : 'static'
      observer?.observe(dots.canvas)
      ensureDotsImage()
      paintDots()
    }
  }

  return {
    resume,
    update,
    stop,
    reset,
    setArtwork,
    setPlayback,
    setBannerCanvas,
    setDotsCanvas,
    setMotion(motion: boolean): void {
      if (motion === enabled) return
      enabled = motion
      update()
      kickDotsFade()
    },
    destroy(): void {
      if (destroyed) return
      destroyed = true
      colorVersion++
      if (dotsFadeFrame !== undefined) cancelAnimationFrame(dotsFadeFrame)
      dotsFadeFrame = undefined
      reset()
      observer?.disconnect()
      reduced.removeEventListener('change', update)
      if (context) void context.close().catch(() => undefined)
    },
  }
}
