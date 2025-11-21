// 音频工具函数

/**
 * 格式化时间（秒）为 mm:ss 格式
 * @param seconds 秒数
 * @returns 格式化后的时间字符串
 */
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * 解析时间字符串（mm:ss）为秒数
 * @param timeString 时间字符串
 * @returns 秒数
 */
export const parseTime = (timeString: string): number => {
  const parts = timeString.split(':')
  if (parts.length !== 2) return 0

  const minutes = parseInt(parts[0], 10)
  const seconds = parseInt(parts[1], 10)

  if (isNaN(minutes) || isNaN(seconds)) return 0

  return minutes * 60 + seconds
}

/**
 * 获取音频文件的元数据
 * @param file 音频文件
 * @returns Promise<AudioMetadata>
 */
export interface AudioMetadata {
  duration: number
  title?: string
  artist?: string
  album?: string
}

export const getAudioMetadata = (file: File): Promise<AudioMetadata> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)

    audio.addEventListener('loadedmetadata', () => {
      const metadata: AudioMetadata = {
        duration: audio.duration || 0,
        title: file.name.replace(/\.[^/.]+$/, ''), // 移除文件扩展名
      }

      URL.revokeObjectURL(url)
      resolve(metadata)
    })

    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法加载音频文件'))
    })

    audio.src = url
  })
}

/**
 * 检查是否为支持的音频格式
 * @param file 文件
 * @returns 是否支持
 */
export const isSupportedAudioFormat = (file: File): boolean => {
  const supportedTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/webm',
  ]

  return supportedTypes.includes(file.type) || /\.(mp3|wav|ogg|aac|flac|webm)$/i.test(file.name)
}

/**
 * 创建音频可视化数据
 * @param audioElement 音频元素
 * @returns AudioContext 和 AnalyserNode
 */
export const createAudioVisualizer = (audioElement: HTMLAudioElement) => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const analyser = audioContext.createAnalyser()
  const source = audioContext.createMediaElementSource(audioElement)

  analyser.fftSize = 256
  source.connect(analyser)
  analyser.connect(audioContext.destination)

  return { audioContext, analyser }
}

/**
 * 获取频谱数据
 * @param analyser AnalyserNode
 * @returns 频谱数据数组
 */
export const getFrequencyData = (analyser: AnalyserNode): Uint8Array => {
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  analyser.getByteFrequencyData(dataArray)
  return dataArray
}

/**
 * 音量淡入淡出效果
 * @param audioElement 音频元素
 * @param targetVolume 目标音量 (0-1)
 * @param duration 持续时间（毫秒）
 */
export const fadeVolume = (
  audioElement: HTMLAudioElement,
  targetVolume: number,
  duration: number = 1000
): Promise<void> => {
  return new Promise(resolve => {
    const startVolume = audioElement.volume
    const volumeDiff = targetVolume - startVolume
    const steps = 50
    const stepDuration = duration / steps
    const stepSize = volumeDiff / steps

    let currentStep = 0

    const fadeInterval = setInterval(() => {
      currentStep++
      audioElement.volume = Math.max(0, Math.min(1, startVolume + stepSize * currentStep))

      if (currentStep >= steps) {
        clearInterval(fadeInterval)
        audioElement.volume = targetVolume
        resolve()
      }
    }, stepDuration)
  })
}

/**
 * 交叉淡入淡出（在两个音频之间切换）
 * @param currentAudio 当前音频
 * @param nextAudio 下一个音频
 * @param duration 切换持续时间（毫秒）
 */
export const crossfade = async (
  currentAudio: HTMLAudioElement,
  nextAudio: HTMLAudioElement,
  duration: number = 2000
): Promise<void> => {
  // 同时开始淡出当前音频和淡入下一个音频
  const fadeOutPromise = fadeVolume(currentAudio, 0, duration)
  const fadeInPromise = fadeVolume(nextAudio, 1, duration)

  // 开始播放下一个音频
  nextAudio.play()

  await Promise.all([fadeOutPromise, fadeInPromise])

  // 停止当前音频
  currentAudio.pause()
  currentAudio.currentTime = 0
}
