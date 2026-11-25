import {
  artworkColor,
  type ArtworkColor,
} from '@/services/player/artwork-color'
import {
  spectrumProfile,
  spectrumRhythm,
} from '@/services/player/spectrum-profile'
import {
  halftoneFieldColor,
  sampleHalftoneBgColor,
  sampleHalftoneField,
} from '@/services/player/halftone-profile'

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
    // 横幅频谱在所有状态下恒用 pop-yellow（用户真机反馈：播放时切回封面 accent 色与参照
    // hero 左下的黄色 EQ 对不上，看着像变了样）。静态种子帧与实频帧同色，只有条高随真实
    // levels 起伏；底栏频谱是另一块画布，仍走专辑色，不受此处影响。形状仍是既有正弦
    // 种子轮廓（细条密排），与参照 7 根粗条的疏密不完全一致，这一点维持既有取舍。
    paint.fillStyle = 'rgba(255,216,61,0.85)'
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

  // 点阵取色路径开关：false = 按插画横向色移取色（halftoneFieldColor）再向封面 accent
  // 轻混，与原图烤入点田的色相进程一致——横幅插画换回带烤入点田的原图后采用这一路；
  // true = 按背景色表的印刷极性取色（亮底深点、暗底亮点），那是为无点平涂版插画准备的，
  // 原图回归后叠加层若再按极性取色会与底图点色打架，故本轮停用。极性分支与
  // sampleHalftoneBgColor / 背景色表都保留不删：日后插画再换回平涂版时把开关置 true
  // 即可恢复下方极性取色块，不需要重写采样与混合逻辑。
  const DOTS_POLARITY_COLOR = false

  // 半调点阵叠加层：横幅插画已换回带烤入点田的原图，静态/暂停时底图点田就是参照的
  // 静态长相，叠加层什么都不画（fitCanvas 清空后直接返回），避免两层点田双印错位；
  // 只有实频（live）帧才在采样剖面（halftone-profile，本就采自这张原图、场形天然对位）
  // 上调制点径与亮度，让原田随音乐活过来。画布整幅覆盖横幅，每个点先经横幅写入的可见
  // 图像矩形（data-img-*，由 featured-banner 按 object-fit: cover 的实际裁切算出）映射回
  // 插画坐标再采样，窗口变窄、裁切右移时叠加田随图一起移动，始终贴着人物轮廓且不压
  // 人物与贴纸本体。每列对应一个对数频段（低频在左、高频在右，与底栏细柱同一映射）；
  // data-spectrum-mode 仍按实频与否诚实标注，示例模拟不驱动这一层，不拿模拟冒充频峰。
  function paintDots(): void {
    if (!dots || destroyed) return
    const { canvas, paint } = dots
    const size = fitCanvas(canvas, paint)
    if (!size) return
    if (mode !== 'live') return
    const { width, height } = size
    // 可见图像矩形（插画归一化坐标）：组件未写入时按插画原始尺寸与缺省 object-position
    // 现算，保证组件挂载顺序变化时第一帧也不跑偏。
    let u0 = Number(canvas.dataset.imgU0)
    let v0 = Number(canvas.dataset.imgV0)
    let u1 = Number(canvas.dataset.imgU1)
    let v1 = Number(canvas.dataset.imgV1)
    if (
      !Number.isFinite(u0) ||
      !Number.isFinite(v0) ||
      !Number.isFinite(u1) ||
      !Number.isFinite(v1) ||
      u1 <= u0 ||
      v1 <= v0
    ) {
      const scale = Math.max(width / 2736, height / 912)
      const dw = 2736 * scale
      const dh = 912 * scale
      const ox = (width - dw) * 0.5
      const oy = (height - dh) * 0.36
      u0 = -ox / dw
      v0 = -oy / dh
      u1 = (width - ox) / dw
      v1 = (height - oy) / dh
    }
    // 点距跟随插画显示宽度（原图点距约占图宽 0.95%），裁切放大时点距同步放大，不变密度。
    const pitch = Math.max(8, (width / (u1 - u0)) * 0.0095)
    const cols = Math.ceil(width / pitch)
    const rows = Math.ceil(height / pitch)
    const accent = currentColor.map(channel =>
      Math.round(channel * 0.7 + 255 * 0.3)
    )
    for (let col = 0; col < cols; col++) {
      const px = (col + 0.5) * pitch
      const u = u0 + (px / width) * (u1 - u0)
      let energy = 0
      if (levels.length) {
        const start = Math.floor((px / width) * levels.length)
        const end = Math.max(
          start + 1,
          Math.floor(((px + pitch) / width) * levels.length)
        )
        for (let index = start; index < end; index++)
          energy = Math.max(energy, levels[index] ?? 0)
      }
      for (let row = 0; row < rows; row++) {
        const py = (row + 0.5) * pitch
        const v = v0 + (py / height) * (v1 - v0)
        const field = sampleHalftoneField(u, v)
        // 剖面权重再强化：强度先过 1.6 次幂，稀疏区（低强度格）即使在 live 也压到近乎
        // 不可见，点田的密度印象完全由采样剖面主导——播放帧与未播时底图的烤入场看上去
        // 是同一片田活过来，而不是另罩一张均匀机械网格。能量只在权重之上调制点径的
        // 呼吸幅度与节奏，不决定哪里有点、点有多密。
        const weight = Math.pow(field, 1.6)
        if (weight < 0.05) continue
        const baseRadius = pitch * 0.46 * Math.sqrt(weight)
        // 能量在剖面基准上小幅放大点径；剖面为零处再有能量也不冒点，场的形状不被频谱改写。
        const radius = Math.min(pitch * 0.48, baseRadius * (0.72 + 0.55 * energy))
        if (radius < 0.5) continue
        let cr = 0
        let cg = 0
        let cb = 0
        if (DOTS_POLARITY_COLOR) {
          // 极性取色（本轮停用，保留供平涂版插画恢复使用）：先采样该点在平涂版里的背景
          // 色，按其亮度在「提亮亮点」与「压暗墨点」之间平滑混合（亮度带 0.24–0.44，
          // 标定自光池与左缘深蓝的实测亮度）；随后往封面 accent 提亮色轻混三成，再按
          // 混合前亮度等比缩放回去——色相可以向封面色靠，但明暗极性关系不被冲掉。
          const bg = sampleHalftoneBgColor(u, v)
          const bgLum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255
          const bend = Math.min(1, Math.max(0, (bgLum - 0.24) / 0.2))
          const polarity = bend * bend * (3 - 2 * bend)
          const lightR = Math.min(255, bg[0] * 1.85 + 12)
          const lightG = Math.min(255, bg[1] * 1.85 + 12)
          const lightB = Math.min(255, bg[2] * 1.85 + 12)
          cr = lightR + (bg[0] * 0.5 - lightR) * polarity
          cg = lightG + (bg[1] * 0.5 - lightG) * polarity
          cb = lightB + (bg[2] * 0.5 - lightB) * polarity
          const mixed: [number, number, number] = [
            cr * 0.7 + accent[0]! * 0.3,
            cg * 0.7 + accent[1]! * 0.3,
            cb * 0.7 + accent[2]! * 0.3,
          ]
          const baseLum = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb
          const mixedLum =
            0.2126 * mixed[0] + 0.7152 * mixed[1] + 0.0722 * mixed[2]
          const restore = mixedLum > 1 ? baseLum / mixedLum : 1
          cr = Math.min(255, mixed[0] * restore)
          cg = Math.min(255, mixed[1] * restore)
          cb = Math.min(255, mixed[2] * restore)
        } else {
          // 色移取色（本轮采用）：按插画横向位置取原田色相（青蓝→紫→品红紫），再向
          // 封面 accent 提亮色轻混三成，让叠加点与底图烤入点田同色系、只随能量呼吸。
          const fc = halftoneFieldColor(u)
          cr = fc[0] * 0.7 + accent[0]! * 0.3
          cg = fc[1] * 0.7 + accent[1]! * 0.3
          cb = fc[2] * 0.7 + accent[2]! * 0.3
        }
        cr = Math.round(cr)
        cg = Math.round(cg)
        cb = Math.round(cb)
        // alpha 同样由剖面权重主导且上限压低（0.9 → 0.62）：能量项乘着权重走，稀疏区
        // 再强的能量也提不亮，整场不会比底图烤入点田更抢眼，切换瞬间不换图案感。
        const alpha = Math.min(0.62, 0.05 + 0.5 * weight + 0.3 * energy * weight)
        paint.fillStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`
        paint.beginPath()
        paint.arc(px, py, radius, 0, Math.PI * 2)
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
