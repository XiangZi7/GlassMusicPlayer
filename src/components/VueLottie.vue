<script setup lang="ts">
import lottie, { AnimationItem } from 'lottie-web'

interface Props {
  // 动画数据源，可以是本地路径、远程URL或JSON对象
  animationData?: any
  path?: string
  // 容器样式
  width?: string
  height?: string
  containerStyle?: Record<string, any>
  containerClass?: string
  // 动画配置
  loop?: boolean
  autoplay?: boolean
  speed?: number
  // 渲染器类型
  renderer?: 'svg' | 'canvas' | 'html'
  // 质量设置
  rendererSettings?: any
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '100%',
  loop: true,
  autoplay: true,
  speed: 1,
  renderer: 'svg',
  containerStyle: () => ({}),
  containerClass: '',
})

interface Emits {
  ready: [animation: AnimationItem]
  complete: []
  loopComplete: []
  enterFrame: []
  segmentStart: []
  error: [error: any]
}

const emit = defineEmits<Emits>()

const lottieContainer = ref<HTMLElement>()
let animationInstance: AnimationItem | null = null

// 加载本地JSON文件
const loadLocalAnimation = async (path: string) => {
  try {
    // 处理本地路径
    let animationPath = path

    // 如果是相对路径，转换为绝对路径
    if (!path.startsWith('http') && !path.startsWith('/')) {
      // 在开发环境中，使用import.meta.url来获取正确的路径
      if (import.meta.env.DEV) {
        // 开发环境：直接使用相对路径
        animationPath = new URL(path, import.meta.url).href
      } else {
        // 生产环境：使用相对于public目录的路径
        animationPath = `/${path.replace(/^\.\//, '').replace(/^\//, '')}`
      }
    }

    const response = await fetch(animationPath)
    if (!response.ok) {
      throw new Error(`Failed to load animation: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error loading local animation:', error)
    emit('error', error)
    throw error
  }
}

// 初始化动画
const initAnimation = async () => {
  if (!lottieContainer.value) return

  try {
    // 清理之前的动画实例
    if (animationInstance) {
      animationInstance.destroy()
      animationInstance = null
    }

    let animationData = props.animationData

    // 如果提供了路径，加载动画数据
    if (props.path && !animationData) {
      animationData = await loadLocalAnimation(props.path)
    }

    if (!animationData) {
      throw new Error('No animation data or path provided')
    }

    // 创建动画实例
    animationInstance = lottie.loadAnimation({
      container: lottieContainer.value,
      renderer: props.renderer,
      loop: props.loop,
      autoplay: props.autoplay,
      animationData: animationData,
      rendererSettings: props.rendererSettings || {
        preserveAspectRatio: 'xMidYMid slice',
      },
    })

    // 设置播放速度
    if (props.speed !== 1) {
      animationInstance.setSpeed(props.speed)
    }

    // 绑定事件
    animationInstance.addEventListener('DOMLoaded', () => {
      emit('ready', animationInstance!)
    })

    animationInstance.addEventListener('complete', () => {
      emit('complete')
    })

    animationInstance.addEventListener('loopComplete', () => {
      emit('loopComplete')
    })

    animationInstance.addEventListener('enterFrame', () => {
      emit('enterFrame')
    })

    animationInstance.addEventListener('segmentStart', () => {
      emit('segmentStart')
    })
  } catch (error) {
    console.error('Error initializing animation:', error)
    emit('error', error)
  }
}

// 暴露方法给父组件
const play = () => {
  animationInstance?.play()
}

const pause = () => {
  animationInstance?.pause()
}

const stop = () => {
  animationInstance?.stop()
}

const goToAndStop = (value: number, isFrame?: boolean) => {
  animationInstance?.goToAndStop(value, isFrame)
}

const goToAndPlay = (value: number, isFrame?: boolean) => {
  animationInstance?.goToAndPlay(value, isFrame)
}

const setSpeed = (speed: number) => {
  animationInstance?.setSpeed(speed)
}

const setDirection = (direction: 1 | -1) => {
  animationInstance?.setDirection(direction)
}

const destroy = () => {
  if (animationInstance) {
    animationInstance.destroy()
    animationInstance = null
  }
}

defineExpose({
  play,
  pause,
  stop,
  goToAndStop,
  goToAndPlay,
  setSpeed,
  setDirection,
  destroy,
  animationInstance: () => animationInstance,
})

// 监听props变化
watch(
  () => [props.animationData, props.path],
  () => {
    nextTick(() => {
      initAnimation()
    })
  },
  { deep: true }
)

watch(
  () => props.speed,
  newSpeed => {
    if (animationInstance) {
      animationInstance.setSpeed(newSpeed)
    }
  }
)

onMounted(() => {
  nextTick(() => {
    initAnimation()
  })
})

onUnmounted(() => {
  destroy()
})
</script>
<template>
  <div
    ref="lottieContainer"
    :style="{
      width: width,
      height: height,
      ...containerStyle,
    }"
    :class="containerClass"
  ></div>
</template>

<style scoped>
/* 默认样式 */
</style>
