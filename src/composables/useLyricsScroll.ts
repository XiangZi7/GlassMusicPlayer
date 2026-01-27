import { gsap } from 'gsap'
import type { Ref } from 'vue'

export interface LyricsScrollOptions {
  /** 歌词容器元素引用 */
  lyricsRef: Ref<HTMLElement | null>
  /** 时间轴数组 */
  timeline: Ref<number[]>
  /** 当前播放时间 */
  currentTime: Ref<number>
  /** 时间偏移量（秒） */
  offset?: Ref<number>
}

export interface LyricsScrollState {
  /** 当前高亮的歌词索引 */
  currentIndex: number
  /** 歌词是否已定位到当前播放位置 */
  positioned: boolean
  /** 是否启用自动滚动 */
  autoScroll: boolean
  /** 歌词缩放比例 */
  scale: number
}

export function useLyricsScroll(options: LyricsScrollOptions) {
  const { lyricsRef, timeline, currentTime, offset } = options

  const state = reactive<LyricsScrollState>({
    currentIndex: 0,
    positioned: false,
    autoScroll: true,
    scale: 1,
  })

  /**
   * 更新当前歌词索引
   * @param instant 是否立即定位（无动画）
   */
  const updateCurrentLyric = (instant = false) => {
    const adjustedTime = currentTime.value + (offset?.value ?? 0)
    const times = timeline.value
    if (!times.length) return

    let idx = times.findIndex((t, i) => {
      const nextT = times[i + 1]
      return adjustedTime >= t && (nextT === undefined || adjustedTime < nextT)
    })

    if (idx === -1) {
      if (adjustedTime < times[0]) idx = 0
      else if (adjustedTime >= times[times.length - 1]) idx = times.length - 1
      else idx = times.findIndex(t => t > adjustedTime)
    }

    if (idx !== -1 && idx !== state.currentIndex) {
      state.currentIndex = idx
      if (state.autoScroll) scrollToCurrentLyric(instant)
    } else if (!state.positioned) {
      if (state.autoScroll) scrollToCurrentLyric(instant)
    }
  }

  /**
   * 滚动到当前歌词位置
   * @param instant 是否立即定位（无动画）
   */
  const scrollToCurrentLyric = (instant = false) => {
    if (lyricsRef.value && state.currentIndex >= 0) {
      const lyricsContainer = lyricsRef.value
      const currentLyricElement = lyricsContainer.children[state.currentIndex] as HTMLElement

      if (currentLyricElement) {
        const containerHeight = lyricsContainer.parentElement?.clientHeight || 0
        const targetScrollTop =
          currentLyricElement.offsetTop - containerHeight / 2 + currentLyricElement.clientHeight / 2

        if (instant || !state.positioned) {
          gsap.set(lyricsContainer, { y: -targetScrollTop })
          state.positioned = true
        } else {
          gsap.to(lyricsContainer, {
            y: -targetScrollTop,
            duration: 0.8,
            ease: 'power2.out',
          })
        }
      }
    }
  }

  /**
   * 切换自动滚动
   */
  const toggleAutoScroll = () => {
    state.autoScroll = !state.autoScroll
    if (state.autoScroll) updateCurrentLyric(true)
  }

  /**
   * 重置歌词状态（切换歌曲时调用）
   */
  const resetLyrics = () => {
    state.currentIndex = 0
    state.positioned = false
  }

  /**
   * 增加字号
   * @param step 步长，默认 0.05
   * @param max 最大值，默认 1.4
   */
  const increaseScale = (step = 0.05, max = 1.4) => {
    state.scale = Math.min(max, state.scale + step)
  }

  /**
   * 减小字号
   * @param step 步长，默认 0.05
   * @param min 最小值，默认 0.8
   */
  const decreaseScale = (step = 0.05, min = 0.8) => {
    state.scale = Math.max(min, state.scale - step)
  }

  // 监听播放时间变化
  watch(currentTime, () => {
    updateCurrentLyric()
  })

  return {
    ...toRefs(state),
    updateCurrentLyric,
    scrollToCurrentLyric,
    toggleAutoScroll,
    resetLyrics,
    increaseScale,
    decreaseScale,
  }
}
