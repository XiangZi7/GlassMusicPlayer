const fftSize = 2048
const bandCount = 56
const floor = 2

type CapturableAudio = HTMLAudioElement & { captureStream?: () => MediaStream }

// 读取播放元素的 PCM 副本并绘制频谱，音量、输出设备和播放进度仍由原音频元素控制。
export function createSpectrum(
  canvas: HTMLCanvasElement,
  audio: CapturableAudio
) {
  const paint = canvas.getContext('2d')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const bins = new Uint8Array(fftSize / 2)
  let context: AudioContext | undefined
  let analyser: AnalyserNode | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let frame: number | undefined
  let enabled = true

  // 在点歌或继续播放的用户操作中恢复 Web Audio。
  function resume(): void {
    if (!paint || !audio.captureStream || !window.AudioContext) return
    try {
      context ??= new AudioContext()
    } catch {
      return
    }
    if (context.state === 'suspended')
      void context.resume().catch(() => undefined)
  }

  // 取 50 Hz 至 10 kHz 的对数频带，让人声和低音的变化更容易观察。
  function draw(): void {
    if (!paint || !analyser || !context) return
    frame = requestAnimationFrame(draw)
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
    paint.fillStyle = 'rgba(255,255,255,0.36)'
    analyser.getByteFrequencyData(bins)

    const step = width / bandCount
    const binScale = fftSize / context.sampleRate
    for (let band = 0; band < bandCount; band++) {
      const start = Math.floor(50 * 200 ** (band / bandCount) * binScale)
      const end = Math.min(
        bins.length,
        Math.max(
          start + 1,
          Math.floor(50 * 200 ** ((band + 1) / bandCount) * binScale)
        )
      )
      let peak = 0
      for (let bin = start; bin < end; bin++)
        peak = Math.max(peak, bins[bin] ?? 0)
      const barHeight = (height - floor) * (peak / 255)
      if (barHeight >= 1)
        paint.fillRect(
          band * step + 1,
          height - floor - barHeight,
          Math.max(1, step - 3),
          barHeight
        )
    }
  }

  // 暂停、关闭动效或缓冲时停止读频率，并清除上一次的画面。
  function stop(): void {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    paint?.resetTransform()
    paint?.clearRect(0, 0, canvas.width, canvas.height)
  }

  // 媒体就绪后捕获当前曲目的音轨，失败时保持播放器原有的出声路径。
  function update(): void {
    if (!enabled || reduced.matches || audio.paused || audio.readyState < 3) {
      stop()
      return
    }
    if (
      !audio.crossOrigin ||
      !context ||
      !audio.captureStream ||
      frame !== undefined
    )
      return
    if (!source) {
      try {
        const stream = audio.captureStream()
        if (!stream.getAudioTracks().length) return
        const input = context.createMediaStreamSource(stream)
        analyser ??= new AnalyserNode(context, {
          fftSize,
          smoothingTimeConstant: 0.72,
        })
        input.connect(analyser)
        source = input
      } catch {
        return
      }
    }
    draw()
  }

  // 换曲时释放旧音轨，下一次播放重新捕获。
  function reset(): void {
    stop()
    source?.disconnect()
    source = undefined
  }

  reduced.addEventListener('change', update)
  return {
    resume,
    update,
    stop,
    reset,
    // 播放器的界面动效偏好也应用于频谱。
    setMotion(motion: boolean): void {
      if (motion === enabled) return
      enabled = motion
      update()
    },
    // 关闭主播放器时释放分析器与音频上下文。
    destroy(): void {
      reset()
      reduced.removeEventListener('change', update)
      if (context) void context.close().catch(() => undefined)
    },
  }
}
