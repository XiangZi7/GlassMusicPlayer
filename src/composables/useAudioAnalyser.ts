import { ref, onUnmounted, computed } from 'vue'

export type VisualizerType = 'bars' | 'wave' | 'circular'

export interface AudioAnalyserOptions {
  fftSize?: number // 频域分析大小 (32-32768, 必须是2的幂)
  smoothingTimeConstant?: number // 平滑系数 (0-1)
  minDecibels?: number // 最小分贝
  maxDecibels?: number // 最大分贝
}

// 全局单例，确保只创建一次音频上下文
let globalAudioContext: AudioContext | null = null
let globalAnalyser: AnalyserNode | null = null
let globalSourceNode: MediaElementAudioSourceNode | null = null
let globalAnimationId: number | null = null
let globalIsInitialized = ref(false)
let globalIsAnalysing = ref(false)
let globalFrequencyData = ref<Uint8Array>(new Uint8Array(0))
let globalTimeDomainData = ref<Uint8Array>(new Uint8Array(0))

export function useAudioAnalyser(options: AudioAnalyserOptions = {}) {
  const {
    fftSize = 2048, // 默认2048个采样点
    smoothingTimeConstant = 0.8, // 平滑系数
    minDecibels = -90,
    maxDecibels = -10
  } = options

  // 使用全局单例
  const isInitialized = globalIsInitialized
  const isAnalysing = globalIsAnalysing
  const frequencyData = globalFrequencyData
  const timeDomainData = globalTimeDomainData

  // 计算属性
  const bufferLength = computed(() => globalAnalyser?.frequencyBinCount || 0)

  // 平均音量 (0-100)
  const averageVolume = computed(() => {
    if (frequencyData.value.length === 0) return 0
    const sum = frequencyData.value.reduce((a, b) => a + b, 0)
    return Math.round((sum / frequencyData.value.length / 255) * 100)
  })

  // 低音强度 (0-100) - 前1/4频段
  const bassLevel = computed(() => {
    if (frequencyData.value.length === 0) return 0
    const bassRange = frequencyData.value.slice(0, Math.floor(bufferLength.value / 4))
    const sum = bassRange.reduce((a, b) => a + b, 0)
    return Math.round((sum / bassRange.length / 255) * 100)
  })

  // 高音强度 (0-100) - 后1/4频段
  const trebleLevel = computed(() => {
    if (frequencyData.value.length === 0) return 0
    const trebleRange = frequencyData.value.slice(Math.floor(bufferLength.value * 3 / 4))
    const sum = trebleRange.reduce((a, b) => a + b, 0)
    return Math.round((sum / trebleRange.length / 255) * 100)
  })

  /**
   * 初始化音频分析器
   * @param audioElement HTML Audio 元素
   */
  const init = (audioElement: HTMLAudioElement) => {
    if (globalIsInitialized.value) {
      console.log('AudioAnalyser already initialized, reusing existing instance')
      return
    }

    try {
      // 创建 AudioContext (兼容性处理)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      globalAudioContext = new AudioContextClass()

      // 创建分析器节点
      globalAnalyser = globalAudioContext.createAnalyser()
      globalAnalyser.fftSize = fftSize
      globalAnalyser.smoothingTimeConstant = smoothingTimeConstant
      globalAnalyser.minDecibels = minDecibels
      globalAnalyser.maxDecibels = maxDecibels

      // 从 audio 元素创建源节点
      globalSourceNode = globalAudioContext.createMediaElementSource(audioElement)

      // 连接节点: source -> analyser -> destination (扬声器)
      globalSourceNode.connect(globalAnalyser)
      globalAnalyser.connect(globalAudioContext.destination)

      // 初始化数据数组
      const bufferLen = globalAnalyser.frequencyBinCount
      globalFrequencyData.value = new Uint8Array(bufferLen)
      globalTimeDomainData.value = new Uint8Array(bufferLen)

      globalIsInitialized.value = true
      console.log('AudioAnalyser initialized successfully')
    } catch (error) {
      console.error('Failed to initialize AudioAnalyser:', error)
    }
  }

  /**
   * 开始分析 (启动动画循环)
   */
  const start = () => {
    if (!globalIsInitialized.value || !globalAnalyser) {
      console.warn('AudioAnalyser not initialized')
      return
    }

    if (globalIsAnalysing.value) return

    globalIsAnalysing.value = true

    const analyse = () => {
      if (!globalIsAnalysing.value || !globalAnalyser) return

      // 获取频域数据 (频谱)
      globalAnalyser.getByteFrequencyData(globalFrequencyData.value)

      // 获取时域数据 (波形)
      globalAnalyser.getByteTimeDomainData(globalTimeDomainData.value)

      // 继续下一帧
      globalAnimationId = requestAnimationFrame(analyse)
    }

    analyse()
  }

  /**
   * 停止分析 - 带平滑降落动画
   */
  const stop = () => {
    globalIsAnalysing.value = false
    if (globalAnimationId !== null) {
      cancelAnimationFrame(globalAnimationId)
      globalAnimationId = null
    }

    // 平滑降落动画
    const fadeOut = () => {
      if (globalFrequencyData.value.length === 0) return

      // 逐渐衰减频率数据
      let hasNonZero = false
      const newFreqData = new Uint8Array(globalFrequencyData.value.length)
      for (let i = 0; i < globalFrequencyData.value.length; i++) {
        // 每帧衰减到原来的85%，创建平滑的降落效果
        const newValue = Math.floor(globalFrequencyData.value[i] * 0.85)
        newFreqData[i] = newValue
        if (newValue > 0) hasNonZero = true
      }
      globalFrequencyData.value = newFreqData

      // 时域数据逐渐回到中间值128
      const newTimeData = new Uint8Array(globalTimeDomainData.value.length)
      for (let i = 0; i < globalTimeDomainData.value.length; i++) {
        const current = globalTimeDomainData.value[i]
        const diff = 128 - current
        // 逐渐向128靠拢
        newTimeData[i] = Math.floor(current + diff * 0.15)
      }
      globalTimeDomainData.value = newTimeData

      // 如果还有非零值，继续动画
      if (hasNonZero && !globalIsAnalysing.value) {
        globalAnimationId = requestAnimationFrame(fadeOut)
      } else {
        // 完全归零
        globalFrequencyData.value = new Uint8Array(globalFrequencyData.value.length)
        const finalTimeData = new Uint8Array(globalTimeDomainData.value.length)
        finalTimeData.fill(128)
        globalTimeDomainData.value = finalTimeData
      }
    }

    // 开始降落动画
    fadeOut()
  }

  /**
   * 恢复 AudioContext (用于用户交互后)
   */
  const resume = async () => {
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
      try {
        await globalAudioContext.resume()
        console.log('AudioContext resumed')
      } catch (error) {
        console.error('Failed to resume AudioContext:', error)
      }
    }
  }

  /**
   * 销毁分析器 (注意：因为是全局单例，不建议在组件卸载时调用)
   */
  const destroy = () => {
    stop()

    if (globalSourceNode) {
      globalSourceNode.disconnect()
      globalSourceNode = null
    }

    if (globalAnalyser) {
      globalAnalyser.disconnect()
      globalAnalyser = null
    }

    if (globalAudioContext) {
      globalAudioContext.close()
      globalAudioContext = null
    }

    globalIsInitialized.value = false
    globalFrequencyData.value = new Uint8Array(0)
    globalTimeDomainData.value = new Uint8Array(0)
  }

  // 注意：不在 onUnmounted 中自动清理，因为是全局单例
  // 如果需要清理，应该在应用级别手动调用 destroy()

  return {
    // 状态
    isInitialized,
    isAnalysing,

    // 数据
    frequencyData, // 频域数据 (用于频谱图)
    timeDomainData, // 时域数据 (用于波形图)
    bufferLength,

    // 计算属性
    averageVolume,
    bassLevel,
    trebleLevel,

    // 方法
    init,
    start,
    stop,
    resume,
    destroy
  }
}
