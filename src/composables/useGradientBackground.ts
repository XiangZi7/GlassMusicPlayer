import { gsap } from 'gsap'
import type { Ref } from 'vue'
import { getColorPalette } from '@/utils/colorExtractor'

export interface GradientBackgroundOptions {
  /** 背景A层元素引用 */
  bgARef: Ref<HTMLElement | null>
  /** 背景B层元素引用 */
  bgBRef: Ref<HTMLElement | null>
  /** 是否正在播放 */
  isPlaying: Ref<boolean>
  /** 抽屉是否打开 */
  isOpen: Ref<boolean>
}

export interface GradientBackgroundState {
  /** 是否使用封面背景 */
  useCoverBg: boolean
  /** 当前激活的背景层 */
  bgActive: 'A' | 'B'
  /** 背景A层渐变色数组 */
  bgAGradient: string[]
  /** 背景B层渐变色数组 */
  bgBGradient: string[]
}

export function useGradientBackground(options: GradientBackgroundOptions) {
  const { bgARef, bgBRef, isPlaying, isOpen } = options

  const state = reactive<GradientBackgroundState>({
    useCoverBg: true,
    bgActive: 'A',
    bgAGradient: [],
    bgBGradient: [],
  })

  let bgBreathingTweens: gsap.core.Tween[] = []

  /**
   * 生成背景A层样式
   */
  const bgAStyle = computed(() => {
    if (state.bgAGradient.length === 0) return {}
    const topColor = state.bgAGradient[0]
    const mainColor = state.bgAGradient[1]
    return {
      backgroundImage: `linear-gradient(to bottom, ${topColor} 0%, ${mainColor} 30%, ${mainColor} 65%, #000 100%)`,
    }
  })

  /**
   * 生成背景B层样式
   */
  const bgBStyle = computed(() => {
    if (state.bgBGradient.length === 0) return {}
    const topColor = state.bgBGradient[0]
    const mainColor = state.bgBGradient[1]
    return {
      backgroundImage: `linear-gradient(to bottom, ${topColor} 0%, ${mainColor} 30%, ${mainColor} 65%, #000 100%)`,
    }
  })

  /**
   * 获取当前激活背景的渐变色
   */
  const activeGradient = computed(() => {
    return state.bgActive === 'A' ? state.bgAGradient : state.bgBGradient
  })

  /**
   * 开始背景呼吸动画
   */
  const startBackgroundBreathing = () => {
    stopBackgroundBreathing()

    if (bgARef.value && parseFloat(getComputedStyle(bgARef.value).opacity) > 0) {
      const tween = gsap.to(bgARef.value, {
        scale: '+=0.05',
        opacity: '+=0.05',
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      bgBreathingTweens.push(tween)
    }

    if (bgBRef.value && parseFloat(getComputedStyle(bgBRef.value).opacity) > 0) {
      const tween = gsap.to(bgBRef.value, {
        scale: '+=0.05',
        opacity: '+=0.05',
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      bgBreathingTweens.push(tween)
    }
  }

  /**
   * 停止背景呼吸动画
   */
  const stopBackgroundBreathing = () => {
    bgBreathingTweens.forEach(tween => tween.kill())
    bgBreathingTweens = []
  }

  /**
   * 设置背景渐变（从封面提取颜色）
   * @param coverUrl 封面图片URL
   * @param delay 延迟时间（毫秒）
   */
  const setBackgroundGradient = async (coverUrl?: string, delay = 0) => {
    if (!state.useCoverBg || !coverUrl) return

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    try {
      const palette = await getColorPalette(coverUrl + '?param=320x320')

      // 首次初始化
      if (state.bgAGradient.length === 0 && state.bgBGradient.length === 0) {
        state.bgAGradient = palette.gradient
        if (bgARef.value) {
          gsap.set(bgARef.value, { opacity: 0, scale: 1.6 })
          gsap.to(bgARef.value, {
            opacity: 0.55,
            scale: 1.5,
            duration: 1.2,
            ease: 'power2.out',
            onComplete: () => {
              if (isPlaying.value && isOpen.value) {
                startBackgroundBreathing()
              }
            },
          })
        }
        state.bgActive = 'A'
        return
      }

      // 双层切换实现平滑过渡
      const incomingRef = state.bgActive === 'A' ? bgBRef : bgARef
      const outgoingRef = state.bgActive === 'A' ? bgARef : bgBRef

      if (state.bgActive === 'A') {
        state.bgBGradient = palette.gradient
      } else {
        state.bgAGradient = palette.gradient
      }

      if (incomingRef.value) {
        gsap.set(incomingRef.value, { opacity: 0, scale: 1.6 })
        gsap.to(incomingRef.value, {
          opacity: 0.55,
          scale: 1.5,
          duration: 1.4,
          ease: 'power2.inOut',
          onComplete: () => {
            if (isPlaying.value && isOpen.value) {
              startBackgroundBreathing()
            }
          },
        })
      }

      if (outgoingRef.value) {
        gsap.to(outgoingRef.value, {
          opacity: 0,
          scale: 1.45,
          duration: 1.4,
          ease: 'power2.inOut',
        })
      }

      state.bgActive = state.bgActive === 'A' ? 'B' : 'A'
    } catch (error) {
      console.error('Failed to extract colors:', error)
    }
  }

  /**
   * 切换封面背景开关
   */
  const toggleCoverBg = () => {
    state.useCoverBg = !state.useCoverBg
  }

  // 清理动画
  onUnmounted(() => {
    stopBackgroundBreathing()
  })

  return {
    ...toRefs(state),
    bgAStyle,
    bgBStyle,
    activeGradient,
    startBackgroundBreathing,
    stopBackgroundBreathing,
    setBackgroundGradient,
    toggleCoverBg,
  }
}
