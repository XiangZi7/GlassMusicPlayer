import {
  artworkColor,
  type ArtworkColor,
} from '@/services/player/artwork-color'
import {
  spectrumProfile,
  spectrumRhythm,
} from '@/services/player/spectrum-profile'

const fftSize = 4096

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

  // 发布主频谱状态；横幅与半调点阵只显示实频或静态轮廓。
  function setMode(value: SpectrumMode): void {
    mode = value
    canvas.dataset.spectrumMode = value
    if (banner)
      banner.canvas.dataset.spectrumMode = value === 'live' ? 'live' : 'static'
    if (dots)
      dots.canvas.dataset.spectrumMode = value === 'live' ? 'live' : 'static'
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
    paintDots()
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
    paint.fillStyle = `rgba(${color.join(',')},${live ? 0.46 : 0.19})`
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

  // 半调点阵（独立设计层，与横幅插画分离）：点阵自带一个基础剖面——基准半径沿水平方向
  // 由左向右平滑渐强（靠文案侧渐隐、靠人物侧最密），列内再以中线为峰收边，整体是一块有意
  // 设计的印刷半调，而不是满铺的均匀噪点。每列对应一个对数频段（低频在左、高频在右，与
  // 底栏细柱同一映射）；只有实频（live）帧在基础剖面上调制半径与亮度，暂停、静态与示例
  // 模拟时只画一帧静态基础剖面，不拿模拟数据冒充频峰。
  function paintDots(): void {
    if (!dots || destroyed) return
    const { paint } = dots
    const size = fitCanvas(dots.canvas, paint)
    if (!size) return
    const { width, height } = size
    const cols = Math.max(18, Math.min(56, Math.round(width / 10)))
    const step = width / cols
    const rows = Math.max(4, Math.round(height / step))
    const rowStep = height / rows
    const live = mode === 'live'
    const color = currentColor.map(channel =>
      Math.round(channel * 0.7 + 255 * 0.3)
    )
    const maxRadius = step * 0.42
    const center = (rows - 1) / 2
    for (let col = 0; col < cols; col++) {
      // 水平基础剖面：smoothstep 让左缘的点径渐变到零，点阵像印在平涂背景上的一层网屏。
      const t = cols > 1 ? col / (cols - 1) : 1
      const hProfile = t * t * (3 - 2 * t)
      let energy = 0
      if (live && levels.length) {
        const start = Math.floor((col / cols) * levels.length)
        const end = Math.max(
          start + 1,
          Math.floor(((col + 1) / cols) * levels.length)
        )
        for (let index = start; index < end; index++)
          energy = Math.max(energy, levels[index] ?? 0)
      }
      for (let row = 0; row < rows; row++) {
        // 垂直剖面以中线为峰、上下收边，与水平剖面相乘得到点在本列的基准大小。
        const vProfile =
          rows > 1 ? 1 - Math.abs(row - center) / (center + 1) : 1
        const profile = hProfile * vProfile
        const baseRadius = maxRadius * profile
        if (baseRadius < 0.4) continue
        // live 时能量在基准上放大点径并提亮；剖面薄的左侧靠提亮呈现低频脉动，不撑大点径。
        const radius = live
          ? Math.min(step * 0.46, baseRadius * (0.5 + 1.05 * energy))
          : baseRadius
        const alpha = live
          ? Math.min(
              0.88,
              0.12 + 0.3 * profile + 0.5 * energy * (0.35 + 0.65 * hProfile)
            )
          : 0.1 + 0.3 * profile
        paint.fillStyle = `rgba(${color.join(',')},${alpha.toFixed(3)})`
        paint.beginPath()
        paint.arc((col + 0.5) * step, (row + 0.5) * rowStep, radius, 0, Math.PI * 2)
        paint.fill()
      }
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

  // 首页问候条的半调点阵与横幅频谱同路连接，复用同一次音频分析；断开时停画并解除尺寸监听。
  function setDotsCanvas(canvas: HTMLCanvasElement | null): void {
    if (destroyed || (dots?.canvas ?? null) === canvas) return
    if (dots) observer?.unobserve(dots.canvas)
    const paint = canvas?.getContext('2d')
    dots = canvas && paint ? { canvas, paint } : undefined
    if (dots) {
      dots.canvas.dataset.spectrumMode = mode === 'live' ? 'live' : 'static'
      observer?.observe(dots.canvas)
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
    },
    destroy(): void {
      if (destroyed) return
      destroyed = true
      colorVersion++
      reset()
      observer?.disconnect()
      reduced.removeEventListener('change', update)
      if (context) void context.close().catch(() => undefined)
    },
  }
}
