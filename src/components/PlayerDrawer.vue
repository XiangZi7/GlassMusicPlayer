<script setup lang="ts">
import { gsap } from 'gsap'
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { useLyricsScroll } from '@/composables/useLyricsScroll'
import { useGradientBackground } from '@/composables/useGradientBackground'
import { useCommentCount } from '@/composables/useCommentCount'
import { useI18n } from 'vue-i18n'
import { useAudioAnalyser } from '@/composables/useAudioAnalyser'
import VinylDisc from '@/components/Player/VinylDisc.vue'

const { t } = useI18n()
const globalStore = useGlobalStore()
const audioStore = useAudioStore()
const settingsStore = useSettingsStore()
const { audioVisualizer } = storeToRefs(settingsStore)

const themeIcon = computed(() => {
  switch (globalStore.theme) {
    case 'light':
      return 'icon-[mdi--white-balance-sunny]'
    case 'dark':
      return 'icon-[mdi--moon-waning-crescent]'
    default:
      return 'icon-[mdi--theme-light-dark]'
  }
})

const cycleTheme = () => {
  const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const idx = order.indexOf(globalStore.theme)
  globalStore.setTheme(order[(idx + 1) % 3])
}

const cycleVisualizerType = () => {
  const types: Array<'bars' | 'wave' | 'circular'> = ['bars', 'wave', 'circular']
  const idx = types.indexOf(audioVisualizer.value.visualizerType)
  settingsStore.setAudioVisualizerType(types[(idx + 1) % 3])
}

const visualizerTypeIcon = computed(() => {
  switch (audioVisualizer.value.visualizerType) {
    case 'bars':
      return 'icon-[mdi--chart-bar]'
    case 'wave':
      return 'icon-[mdi--waveform]'
    case 'circular':
      return 'icon-[mdi--circle-outline]'
  }
})

const isOpen = defineModel<boolean>()

// 模板引用
const drawerRef = useTemplateRef('drawerRef')
const lyricsRef = useTemplateRef('lyricsRef')
const bgARef = useTemplateRef('bgARef')
const bgBRef = useTemplateRef('bgBRef')
const lyricsContainerRef = ref<HTMLElement | null>(null)
const vinylDiscRef = ref<InstanceType<typeof VinylDisc> | null>(null)

// 音频播放器
const {
  currentSong,
  isPlaying,
  isLoading,
  currentTime,
  playMode,
  togglePlay,
  next,
  previous,
  setCurrentTime,
  formattedCurrentTime,
  formattedDuration,
  togglePlayMode,
} = useAudio()

// 歌词
const {
  lyricsTrans,
  lyricsRoma,
  showTrans,
  showRoma,
  activeSingleLyrics,
  activeTimeline,
  timeForIndex,
  fetchLyrics,
} = useLyrics()

// 歌词滚动
const {
  currentIndex: currentLyricIndex,
  positioned: lyricsPositioned,
  autoScroll,
  scale: lyricsScale,
  updateCurrentLyric,
  scrollToCurrentLyric,
  toggleAutoScroll,
  resetLyrics,
  increaseScale,
  decreaseScale,
} = useLyricsScroll({
  lyricsRef,
  timeline: activeTimeline,
  currentTime,
})

// 背景渐变
const {
  useCoverBg,
  bgAStyle,
  bgBStyle,
  activeGradient,
  startBackgroundBreathing,
  stopBackgroundBreathing,
  setBackgroundGradient,
} = useGradientBackground({
  bgARef,
  bgBRef,
  isPlaying,
  isOpen: isOpen as Ref<boolean>,
})

// 评论数量
const songId = computed(() => currentSong.value?.id)
const { commentCount } = useCommentCount({ songId })

// 音频分析器
const {
  frequencyData,
  timeDomainData,
  isInitialized: isAnalyserInitialized,
  init: initAnalyser,
  start: startAnalyser,
  stop: stopAnalyser,
  resume: resumeAnalyser,
} = useAudioAnalyser({
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
})

// 本地状态
const state = reactive({
  isRendered: false,
  isRecentOpen: false,
  isCommentsOpen: false,
  showMobileLyrics: false,
  // 歌词拖动相关
  lyricsDragging: false,
  dragStartY: 0,
  dragStartScrollY: 0,
  dragPreviewIndex: -1,
})

const { isRendered, isRecentOpen, isCommentsOpen, showMobileLyrics } = toRefs(state)

// 计算可视化器渐变颜色
const visualizerGradient = computed(() => {
  const gradient = activeGradient.value
  if (gradient.length === 0) {
    return ['#3b82f6', '#8b5cf6', '#ec4899']
  }
  const colors = gradient.map(color => {
    const match = color.match(/rgba?\(([^)]+)\)/)
    if (match) {
      const values = match[1].split(',').slice(0, 3)
      return `rgb(${values.join(',')})`
    }
    return color
  })
  return adaptColorsForTheme(colors)
})

const playModeIconClass = computed(() => {
  switch (playMode.value) {
    case 'single':
      return 'icon-[mdi--repeat-once]'
    case 'random':
      return 'icon-[mdi--shuffle]'
    case 'list':
    default:
      return 'icon-[mdi--repeat]'
  }
})

const toggleTransBtn = async () => {
  showTrans.value = !showTrans.value
  await nextTick()
  lyricsPositioned.value = false
  updateCurrentLyric(true)
}

const toggleRomaBtn = async () => {
  showRoma.value = !showRoma.value
  await nextTick()
  lyricsPositioned.value = false
  updateCurrentLyric(true)
}

const handleTogglePlay = () => {
  togglePlay()
}

const handleAlbumCoverClick = () => {
  if (!isLoading.value) {
    togglePlay()
  }
}

// 歌词拖动相关逻辑
const handleLyricsDragStart = (e: MouseEvent | TouchEvent) => {
  e.preventDefault()

  state.lyricsDragging = true
  autoScroll.value = false

  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  state.dragStartY = clientY

  if (lyricsRef.value) {
    const transform = window.getComputedStyle(lyricsRef.value).transform
    if (transform && transform !== 'none') {
      const matrix = new DOMMatrix(transform)
      state.dragStartScrollY = matrix.m42
    } else {
      state.dragStartScrollY = 0
    }
  }

  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
  document.body.style.cursor = 'grabbing'
}

const handleLyricsDragMove = (e: MouseEvent | TouchEvent) => {
  if (!state.lyricsDragging || !lyricsRef.value || !lyricsContainerRef.value) return

  e.preventDefault()

  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  const deltaY = clientY - state.dragStartY
  const newScrollY = state.dragStartScrollY + deltaY

  gsap.set(lyricsRef.value, { y: newScrollY })

  const containerHeight = lyricsContainerRef.value.clientHeight
  const centerY = containerHeight / 2

  let closestIndex = 0
  let minDistance = Infinity

  const lyricElements = lyricsRef.value.children
  for (let i = 0; i < lyricElements.length - 1; i++) {
    const element = lyricElements[i] as HTMLElement
    const rect = element.getBoundingClientRect()
    const containerRect = lyricsContainerRef.value.getBoundingClientRect()
    const elementCenterY = rect.top + rect.height / 2 - containerRect.top
    const distance = Math.abs(elementCenterY - centerY)

    if (distance < minDistance) {
      minDistance = distance
      closestIndex = i
    }
  }

  state.dragPreviewIndex = closestIndex
}

const handleLyricsDragEnd = () => {
  if (!state.lyricsDragging) return

  state.lyricsDragging = false

  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''
  document.body.style.cursor = ''

  if (state.dragPreviewIndex >= 0 && state.dragPreviewIndex < activeSingleLyrics.value.length) {
    const targetTime = timeForIndex(state.dragPreviewIndex) ?? 0
    setCurrentTime(targetTime)
    currentLyricIndex.value = state.dragPreviewIndex
    scrollToCurrentLyric()
  }

  state.dragPreviewIndex = -1
  setTimeout(() => {
    toggleAutoScroll()
  }, 1500)
}

// 计算拖动预览时的时间信息
const dragPreviewTime = computed(() => {
  if (state.dragPreviewIndex < 0 || state.dragPreviewIndex >= activeSingleLyrics.value.length) {
    return null
  }

  const time = timeForIndex(state.dragPreviewIndex) ?? 0
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return {
    time: formattedTime,
    lyric: activeSingleLyrics.value[state.dragPreviewIndex],
  }
})

// 抽屉动画 - 共享元素过渡
const openDrawer = async () => {
  if (!drawerRef.value) return

  // 获取 footer 中封面的位置
  const footerCover = document.getElementById('footer-cover')

  // 先显示抽屉但内容透明
  gsap.set(drawerRef.value, { display: 'flex', opacity: 1 })

  // 获取抽屉中目标元素
  await nextTick()
  const targetCover = drawerRef.value.querySelector('.album-cover') as HTMLElement
  const targetSongInfo = drawerRef.value.querySelector('.song-info') as HTMLElement
  // 获取黑胶唱片中心的 vinyl-label 元素
  const vinylLabel = targetCover?.querySelector('.vinyl-label') as HTMLElement

  // 如果能获取到 footer 元素，执行共享元素过渡
  if (footerCover && targetCover && vinylLabel) {
    const footerRect = footerCover.getBoundingClientRect()
    // 目标是 vinyl-label（黑胶中心封面）而不是整个唱片
    const labelRect = vinylLabel.getBoundingClientRect()

    // 创建封面克隆元素
    const coverClone = document.createElement('div')
    coverClone.className = 'hero-clone-cover'
    coverClone.style.cssText = `
      position: fixed;
      z-index: 9999;
      width: ${footerRect.width}px;
      height: ${footerRect.height}px;
      left: ${footerRect.left}px;
      top: ${footerRect.top}px;
      border-radius: 8px;
      background-image: ${currentSong.value?.cover ? `url(${currentSong.value.cover}?param=320x320)` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
      background-size: cover;
      background-position: center;
      pointer-events: none;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `
    document.body.appendChild(coverClone)

    // 隐藏原始 vinyl-label，但显示唱片外框
    gsap.set(vinylLabel, { opacity: 0 })
    gsap.set(targetSongInfo, { opacity: 0 })

    // 背景先淡入
    gsap.fromTo(
      drawerRef.value,
      { backgroundColor: 'rgba(0,0,0,0)' },
      { backgroundColor: 'rgba(0,0,0,0.95)', duration: 0.5, ease: 'power2.out' }
    )

    // 封面克隆飞到 vinyl-label 位置（黑胶中心）
    const tl = gsap.timeline({
      onComplete: () => {
        // 动画完成后，平滑过渡：克隆淡出，真实元素淡入
        gsap.to(coverClone, {
          opacity: 0,
          duration: 0.2,
          ease: 'power2.out',
          onComplete: () => {
            coverClone.remove()
          }
        })
        gsap.to(vinylLabel, {
          opacity: 1,
          duration: 0.2,
          ease: 'power2.out'
        })
        // 如果正在播放，启动旋转动画
        if (isPlaying.value) {
          vinylDiscRef.value?.startAlbumRotation()
        }
      }
    })

    tl.to(coverClone, {
      width: labelRect.width,
      height: labelRect.height,
      left: labelRect.left,
      top: labelRect.top,
      borderRadius: '50%',
      duration: 0.6,
      ease: 'power3.out',
    })

    // 歌曲信息淡入
    tl.fromTo(
      targetSongInfo,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
      '-=0.3'
    )

    // 歌词入场
    tl.fromTo(
      '.lyric-line',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' },
      '-=0.2'
    )
  } else {
    // 降级：普通动画
    const tl = gsap.timeline({
      onComplete: () => {
        // 如果正在播放，启动旋转动画
        if (isPlaying.value) {
          vinylDiscRef.value?.startAlbumRotation()
        }
      }
    })
    tl.fromTo(
      drawerRef.value,
      { y: '-100%', opacity: 0 },
      { y: '0%', opacity: 1, duration: 0.6, ease: 'power3.out' }
    )
    .fromTo(
      '.album-cover',
      { y: -60, opacity: 0, scale: 0.8 },
      { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' },
      '-=0.4'
    )
    .fromTo(
      '.song-info',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
      '-=0.4'
    )
    .fromTo(
      '.lyric-line',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: 'power2.out' },
      '-=0.3'
    )
  }
}

const closeDrawer = () => {
  if (!drawerRef.value) return

  // 停止旋转动画
  vinylDiscRef.value?.stopAlbumRotation()

  const footerCover = document.getElementById('footer-cover')
  const targetCover = drawerRef.value.querySelector('.album-cover') as HTMLElement
  const vinylLabel = targetCover?.querySelector('.vinyl-label') as HTMLElement

  if (footerCover && targetCover && vinylLabel) {
    const footerRect = footerCover.getBoundingClientRect()
    // 从 vinyl-label 位置开始动画
    const labelRect = vinylLabel.getBoundingClientRect()

    // 创建封面克隆（从 vinyl-label 位置开始）
    const coverClone = document.createElement('div')
    coverClone.className = 'hero-clone-cover'
    coverClone.style.cssText = `
      position: fixed;
      z-index: 9999;
      width: ${labelRect.width}px;
      height: ${labelRect.height}px;
      left: ${labelRect.left}px;
      top: ${labelRect.top}px;
      border-radius: 50%;
      background-image: ${currentSong.value?.cover ? `url(${currentSong.value.cover}?param=320x320)` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
      background-size: cover;
      background-position: center;
      pointer-events: none;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `
    document.body.appendChild(coverClone)

    // 隐藏 vinyl-label
    gsap.set(vinylLabel, { opacity: 0 })

    const tl = gsap.timeline({
      onComplete: () => {
        coverClone.remove()
        state.isRendered = false
      }
    })

    // 封面从 vinyl-label 飞回 footer
    tl.to(coverClone, {
      width: footerRect.width,
      height: footerRect.height,
      left: footerRect.left,
      top: footerRect.top,
      borderRadius: '8px',
      duration: 0.5,
      ease: 'power3.inOut',
    })

    // 背景淡出
    tl.to(drawerRef.value, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
    }, '-=0.4')
  } else {
    // 降级：普通关闭动画
    const tl = gsap.timeline({
      onComplete: () => {
        state.isRendered = false
      },
    })
    tl.to(drawerRef.value, {
      y: '100%',
      opacity: 0,
      duration: 0.4,
      ease: 'power3.in',
    })
  }
}

// Watchers
watch(
  () => isOpen.value,
  async newVal => {
    if (newVal) {
      state.isRendered = true
      await nextTick()
      openDrawer()
      lyricsPositioned.value = false
      updateCurrentLyric(true)
      setBackgroundGradient(currentSong.value?.cover)
      if (isPlaying.value) {
        startBackgroundBreathing()
      }
    } else {
      closeDrawer()
      stopBackgroundBreathing()
    }
  }
)

watch(
  isPlaying,
  playing => {
    if (playing) {
      if (isOpen.value) {
        startBackgroundBreathing()
      }
      if (isAnalyserInitialized.value) {
        startAnalyser()
        resumeAnalyser()
      }
    } else {
      stopBackgroundBreathing()
      stopAnalyser()
    }
  },
  { immediate: true }
)

watch(currentTime, () => {
  updateCurrentLyric()
})

watch(
  currentSong,
  async s => {
    await fetchLyrics(s?.id)
    resetLyrics()
    await nextTick()
    updateCurrentLyric(true)
    setBackgroundGradient(s?.cover, 0)
  },
  { immediate: true }
)

onMounted(() => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value as any, { display: 'none' })
  }

  // 初始化音频分析器
  const audioElement = audioStore.audio.audio
  if (audioElement && !isAnalyserInitialized.value) {
    initAnalyser(audioElement)
  }

  // 添加全局拖动事件监听
  document.addEventListener('mousemove', handleLyricsDragMove)
  document.addEventListener('mouseup', handleLyricsDragEnd)
  document.addEventListener('touchmove', handleLyricsDragMove, { passive: false })
  document.addEventListener('touchend', handleLyricsDragEnd)
})

// 监听音频元素变化，初始化分析器
watch(
  () => audioStore.audio.audio,
  audioElement => {
    if (audioElement && !isAnalyserInitialized.value) {
      initAnalyser(audioElement)
      if (isPlaying.value && isOpen.value) {
        startAnalyser()
        resumeAnalyser()
      }
    }
  }
)

onUnmounted(() => {
  stopBackgroundBreathing()

  // 移除全局拖动事件监听
  document.removeEventListener('mousemove', handleLyricsDragMove)
  document.removeEventListener('mouseup', handleLyricsDragEnd)
  document.removeEventListener('touchmove', handleLyricsDragMove)
  document.removeEventListener('touchend', handleLyricsDragEnd)
})
</script>

<template>
  <div
    v-if="isRendered"
    ref="drawerRef"
    class="bg-overlay/95 absolute inset-0 z-50 flex backdrop-blur-md backdrop-filter"
  >
    <div v-show="useCoverBg" class="absolute inset-0 -z-10 overflow-hidden">
      <div ref="bgARef" class="bg-layer absolute inset-0 opacity-0" :style="bgAStyle"></div>
      <div ref="bgBRef" class="bg-layer absolute inset-0 opacity-0" :style="bgBStyle"></div>
      <div class="bg-overlay/40 absolute inset-0"></div>

      <!-- 音频可视化器 - 占满背景底部 -->
      <div
        v-if="
          isAnalyserInitialized &&
          audioVisualizer.enabledInDrawer &&
          audioVisualizer.visualizerType !== 'circular'
        "
        class="absolute right-0 bottom-0 left-0 z-10 opacity-40"
      >
        <AudioVisualizer
          :frequency-data="frequencyData"
          :time-domain-data="timeDomainData"
          :type="audioVisualizer.visualizerType"
          :bar-count="128"
          :bar-width="4"
          :bar-gap="1"
          :gradient-colors="visualizerGradient"
          :height="150"
          class="h-full"
        />
      </div>
    </div>

    <div class="absolute top-0 right-0 left-0 z-10 flex items-center justify-between p-4 lg:p-6">
      <div class="flex items-center gap-3">
        <div class="glass-toolbar flex items-center gap-1 rounded-2xl p-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="xl"
            :title="t('player.fontDec')"
            @click="decreaseScale()"
          >
            <span class="icon-[mdi--format-font-size-decrease] h-4 w-4"></span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="xl"
            :title="t('player.fontInc')"
            @click="increaseScale()"
          >
            <span class="icon-[mdi--format-font-size-increase] h-4 w-4"></span>
          </Button>
          <div class="mx-1 h-4 w-px bg-white/10"></div>
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="xl"
            :class="{ 'text-primary bg-white/15 ring-1 ring-white/20': autoScroll }"
            :title="t('player.autoCenter')"
            @click="toggleAutoScroll"
          >
            <span
              :class="autoScroll ? 'icon-[mdi--autorenew]' : 'icon-[mdi--pause]'"
              class="h-4 w-4"
            ></span>
          </Button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div
          v-if="lyricsTrans.length || lyricsRoma.length"
          class="glass-toolbar flex items-center gap-2 rounded-2xl p-1.5"
        >
          <Button
            v-if="lyricsTrans.length"
            variant="ghost"
            size="sm"
            rounded="xl"
            class="gap-2"
            :class="{ 'text-primary bg-white/15 ring-1 ring-white/20': showTrans }"
            @click="toggleTransBtn"
          >
            <span class="icon-[mdi--translate] h-4 w-4" />
            <span>{{ t('player.translate') }}</span>
          </Button>
          <Button
            v-if="lyricsRoma.length"
            variant="ghost"
            size="sm"
            rounded="xl"
            class="gap-2"
            :class="{ 'text-primary bg-white/15 ring-1 ring-white/20': showRoma }"
            @click="toggleRomaBtn"
          >
            <span class="icon-[mdi--alphabetical-variant] h-4 w-4"></span>
            <span>{{ t('player.roma') }}</span>
          </Button>
        </div>

        <Button
          variant="soft"
          rounded="full"
          size="none"
          class="flex size-11 justify-center border border-[#ffffff1a] lg:hidden"
          @click="showMobileLyrics = !showMobileLyrics"
          :icon="showMobileLyrics ? 'icon-[mdi--album]' : 'icon-[mdi--text-box-outline]'"
          icon-class="h-5 w-5"
        />

        <Button
          variant="soft"
          rounded="full"
          size="none"
          class="size-11 justify-center border border-[#ffffff1a]"
          :class="{ 'bg-white/20 text-yellow-300': !useCoverBg }"
          @click="useCoverBg = !useCoverBg"
          :title="t('player.toggleBg')"
        >
          <span
            :class="[
              useCoverBg ? 'icon-[mdi--image-multiple-outline]' : 'icon-[mdi--palette-swatch]',
              'h-5 w-5',
            ]"
          ></span>
        </Button>

        <Button
          v-if="isAnalyserInitialized"
          variant="soft"
          rounded="full"
          size="none"
          class="h-11 w-11 justify-center border border-[#ffffff1a]"
          :class="{ 'bg-white/20 text-cyan-300': audioVisualizer.enabledInDrawer }"
          @click="settingsStore.setAudioVisualizerDrawer(!audioVisualizer.enabledInDrawer)"
          title="切换频谱显示"
        >
          <span class="icon-[mdi--waveform] h-5 w-5"></span>
        </Button>

        <Button
          v-if="isAnalyserInitialized && audioVisualizer.enabledInDrawer"
          variant="soft"
          rounded="full"
          size="none"
          class="h-11 w-11 justify-center border border-[#ffffff1a]"
          @click="cycleVisualizerType"
          title="切换频谱模式"
        >
          <span :class="[visualizerTypeIcon, 'h-5 w-5']"></span>
        </Button>

        <Button
          variant="soft"
          rounded="full"
          size="none"
          class="h-11 w-11 justify-center border border-[#ffffff1a]"
          @click="cycleTheme"
          :title="t('components.settings.themeMode')"
        >
          <span :class="[themeIcon, 'h-5 w-5']"></span>
        </Button>

        <Button
          variant="soft"
          rounded="full"
          size="none"
          class="h-11 w-11 justify-center border border-[#ffffff1a]"
          @click="isOpen = false"
        >
          <span class="icon-[mdi--chevron-down] h-6 w-6"></span>
        </Button>
      </div>
    </div>

    <div
      class="player-left-panel flex w-full flex-col items-center justify-center px-4 pt-20 pb-8 lg:w-1/2 lg:px-8 lg:pt-24 lg:pb-12"
      :class="{ 'hidden lg:flex': state.showMobileLyrics }"
    >
      <!-- 专辑封面和频谱可视化 -->
      <!-- 圆形频谱可视化 - 当选择 circular 类型时显示 -->
      <div
        v-if="
          isAnalyserInitialized &&
          audioVisualizer.enabledInDrawer &&
          audioVisualizer.visualizerType === 'circular'
        "
        class="mb-4 flex flex-col items-center lg:mb-6"
      >
        <!-- 可视化容器：固定尺寸 384px -->
        <div class="relative mb-6">
          <!-- 圆形频谱可视化 -->
          <AudioVisualizer
            :frequency-data="frequencyData"
            :time-domain-data="timeDomainData"
            type="circular"
            :bar-count="128"
            :gradient-colors="visualizerGradient"
            :height="384"
            class="h-full w-full"
          />

          <!-- 中心封面图片 - 绝对定位居中，75% = 288px -->
          <div
            class="absolute top-1/2 left-1/2 aspect-square w-1/2 -translate-x-1/2 -translate-y-1/2 scale-80 cursor-pointer overflow-hidden rounded-full"
            @click="handleAlbumCoverClick"
          >
            <img
              v-if="currentSong?.cover"
              :src="currentSong.cover + '?param=320x320'"
              :alt="currentSong.name"
              class="h-full w-full object-cover"
            />
            <div v-else class="h-full w-full bg-linear-to-br from-blue-500 to-purple-600"></div>
          </div>
        </div>

        <div class="song-info text-center">
          <h2 class="text-primary mb-1 line-clamp-1 text-xl font-bold sm:text-2xl lg:text-3xl">
            {{ currentSong?.name || t('player.unknownSong') }}
          </h2>
          <p class="text-primary/70 text-sm sm:text-base lg:text-lg">
            {{ currentSong?.artist || t('player.unknownArtist') }}
          </p>
          <p class="text-primary/50 mt-0.5 text-xs sm:text-sm">
            {{ currentSong?.album || t('player.unknownAlbum') }}
          </p>
        </div>
      </div>
      <!-- 黑胶播放器 -->
      <div v-else class="mb-4 flex flex-col items-center lg:mb-6">
        <VinylDisc
          ref="vinylDiscRef"
          :cover="currentSong?.cover"
          :is-playing="isPlaying"
          :is-loading="isLoading"
          size="lg"
          class="album-cover mb-6"
          @click="handleAlbumCoverClick"
        />

        <div class="song-info text-center">
          <h2 class="text-primary mb-1 line-clamp-1 text-xl font-bold sm:text-2xl lg:text-3xl">
            {{ currentSong?.name || t('player.unknownSong') }}
          </h2>
          <p class="text-primary/70 text-sm sm:text-base lg:text-lg">
            {{ currentSong?.artist || t('player.unknownArtist') }}
          </p>
          <p class="text-primary/50 mt-0.5 text-xs sm:text-sm">
            {{ currentSong?.album || t('player.unknownAlbum') }}
          </p>
        </div>
      </div>

      <div v-if="currentSong" class="mb-4 w-full max-w-xl px-4">
        <!-- 音乐进度条 -->
        <MusicProgress :color="visualizerGradient" />
        <div class="mt-1 flex justify-between">
          <span class="text-primary/50 text-xs">{{
            isLoading ? t('player.loading') : formattedCurrentTime
          }}</span>
          <span class="text-primary/50 text-xs">{{ formattedDuration }}</span>
        </div>
      </div>

      <div class="mb-4 flex items-center gap-3 sm:gap-4 lg:mb-6">
        <Button
          variant="soft"
          rounded="full"
          size="none"
          class="h-11 w-11 justify-center"
          :class="{ 'bg-pink-500/30': playMode !== 'list' }"
          @click="togglePlayMode"
        >
          <component :is="'span'" :class="playModeIconClass" class="h-5 w-5" />
        </Button>

        <Button
          variant="soft"
          rounded="full"
          size="none"
          class="h-14 w-14 justify-center"
          @click="previous"
        >
          <span class="icon-[mdi--skip-previous] h-6 w-6"></span>
        </Button>

        <Button
          variant="gradient"
          rounded="full"
          size="none"
          class="h-18 w-18 justify-center shadow-2xl"
          :loading="isLoading"
          @click="handleTogglePlay"
        >
          <span
            v-if="!isLoading"
            :class="!isPlaying ? 'icon-[mdi--play]' : 'icon-[mdi--pause]'"
            class="h-8 w-8"
          ></span>
        </Button>

        <Button
          variant="soft"
          rounded="full"
          size="none"
          class="h-14 w-14 justify-center"
          @click="next"
        >
          <span class="icon-[mdi--skip-next] h-6 w-6"></span>
        </Button>

        <PlaylistBubble
          v-model:show="isRecentOpen"
          placement="top-left"
          :offset-x="8"
          :offset-y="10"
        >
          <template #trigger>
            <Button variant="soft" rounded="full" size="none" class="h-11 w-11 justify-center">
              <span class="icon-[mdi--playlist-music] h-5 w-5"></span>
            </Button>
          </template>
        </PlaylistBubble>
      </div>

      <div class="flex w-full max-w-sm items-center justify-between px-4">
        <Button
          variant="soft"
          size="sm"
          rounded="2xl"
          class="gap-2 px-4 py-2"
          @click="isCommentsOpen = true"
        >
          <span class="icon-[mdi--comment-outline] h-5 w-5"></span>
          <span>{{ commentCount }}</span>
        </Button>

        <div class="volume-control flex items-center gap-2">
          <VolumeControl />
        </div>
      </div>
    </div>

    <div
      class="player-right-panel hidden w-1/2 flex-col px-6 pt-20 pb-8 lg:flex lg:px-8 lg:pt-24 lg:pb-12"
      :class="{ 'flex! w-full': state.showMobileLyrics }"
    >
      <div
        ref="lyricsContainerRef"
        class="lyrics-container relative h-full flex-1 overflow-hidden"
        :class="{ 'cursor-grabbing': state.lyricsDragging, 'cursor-grab': !state.lyricsDragging }"
      >
        <div
          ref="lyricsRef"
          class="lyrics-scroll relative z-20 h-full select-none"
          :style="{ fontSize: lyricsScale + 'rem' }"
          @mousedown="handleLyricsDragStart"
          @touchstart="handleLyricsDragStart"
        >
          <div
            v-for="(line, index) in activeSingleLyrics"
            :key="index"
            class="lyric-line text-center transition-all duration-500"
            :class="{
              current:
                index === (state.lyricsDragging ? state.dragPreviewIndex : currentLyricIndex),
              'text-primary/40':
                index !== (state.lyricsDragging ? state.dragPreviewIndex : currentLyricIndex),
            }"
          >
            <p class="lyric-text pointer-events-none">{{ line.ori }}</p>
            <p v-if="showTrans && line.tran" class="lyric-sub pointer-events-none">
              {{ line.tran }}
            </p>
            <p v-if="showRoma && line.roma" class="lyric-sub pointer-events-none">
              {{ line.roma }}
            </p>
          </div>
          <div class="h-64"></div>
        </div>

        <div
          class="pointer-events-none absolute top-1/2 right-0 left-0 -z-10 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        ></div>

        <!-- 拖动时显示的时间和歌词提示 -->
        <Transition name="fade-scale">
          <div
            v-if="state.lyricsDragging && dragPreviewTime"
            class="drag-preview pointer-events-none absolute top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/30 bg-black/90 px-6 py-4 shadow-2xl backdrop-blur-xl"
          >
            <div class="mb-3 flex items-center justify-center gap-4">
              <div class="flex items-center gap-2">
                <span class="icon-[mdi--clock-outline] text-primary h-5 w-5"></span>
                <span class="text-primary text-2xl font-bold">{{ dragPreviewTime.time }}</span>
              </div>
              <div class="h-6 w-px bg-white/20"></div>
              <div class="flex items-center gap-2">
                <span class="icon-[mdi--clock-end] h-5 w-5 text-white/60"></span>
                <span class="text-xl text-white/60">{{ formattedDuration }}</span>
              </div>
            </div>
            <div class="max-w-md text-center">
              <p class="text-primary mb-2 text-lg font-semibold">{{ dragPreviewTime.lyric.ori }}</p>
              <p v-if="showTrans && dragPreviewTime.lyric.tran" class="text-primary/70 text-sm">
                {{ dragPreviewTime.lyric.tran }}
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
  <SongCommentsDialog v-model:show="isCommentsOpen" :song-id="currentSong?.id ?? null" />
</template>

<style scoped>
@reference "../style/tailwind.css";
.bg-layer {
  transform: scale(1.5);
  filter: blur(48px) saturate(1.3);
  transition: filter 0.3s ease;
  will-change: transform, opacity;
}

.glass-toolbar {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.vinyl-disc {
  background: radial-gradient(circle at 50% 50%, #161616 0%, #0b0b0b 60%, #000 100%);
}
.vinyl-disc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: repeating-radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.06) 0px,
    rgba(255, 255, 255, 0.06) 1px,
    transparent 3px
  );
  opacity: 0.25;
  pointer-events: none;
}
.vinyl-disc::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: radial-gradient(
    ellipse at 30% 15%,
    rgba(255, 255, 255, 0.18),
    rgba(255, 255, 255, 0.02) 40%,
    transparent 60%
  );
  mix-blend-mode: screen;
  pointer-events: none;
}

.vinyl-label {
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 2px 16px rgba(0, 0, 0, 0.25);
  position: relative;
  overflow: hidden;
}
.vinyl-label::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: repeating-radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.12) 0px,
    rgba(255, 255, 255, 0.12) 1px,
    transparent 2px
  );
  opacity: 0.25;
  pointer-events: none;
}
.vinyl-label::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 70%;
  height: 70%;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  opacity: 0.6;
}

.spindle {
  background: radial-gradient(circle at 30% 30%, #c9c9c9, #9a9a9a 60%, #6f6f6f);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.45),
    inset 0 1px 2px rgba(255, 255, 255, 0.35);
}

.tonearm {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
}
.arm-pivot {
  background: conic-gradient(from 180deg at 50% 50%, #d7d7d7, #bdbdbd, #9f9f9f, #d7d7d7);
}
.arm-shaft {
  background: linear-gradient(180deg, #d6d6d6 0%, #bfbfbf 40%, #9c9c9c 100%);
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.2);
}
.counterweight {
  background: radial-gradient(circle at 30% 30%, #bfbfbf, #8f8f8f 60%, #6f6f6f);
}
.headshell {
  background: linear-gradient(135deg, #6b7280, #374151);
}
.cartridge {
  background: linear-gradient(180deg, #8b8b8b, #5f5f5f);
}
.stylus {
  background: linear-gradient(180deg, #e5e7eb, #9ca3af);
}

.lyrics-container {
  mask-image: linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 12%,
    black 88%,
    transparent 100%
  );
}

.lyrics-scroll {
  transform: translateY(0);
  transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.lyric-line {
  line-height: 1.8;
  padding: 0.75rem 1.5rem;
  margin-bottom: 0.5rem;
  border-radius: 0.75rem;
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  white-space: pre-line;
}

.lyric-line.current {
  @apply text-primary;
  transform: scale(1.08);
  text-shadow: 0 0 24px rgba(255, 255, 255, 0.4);
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(139, 92, 246, 0.12));
}
.lyric-line.current .lyric-text {
  @apply text-xl font-semibold lg:text-2xl;
}
.lyric-line.current .lyric-sub {
  @apply text-primary/70 mt-1 text-sm lg:text-base;
}

.lyric-sub {
  @apply text-primary/40 mt-0.5 text-sm;
}

@media (max-width: 1024px) {
  .player-left-panel {
    width: 100%;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 拖动提示框动画 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
}

/* 拖动预览卡片样式 */
.drag-preview {
  min-width: 280px;
  max-width: 500px;
}
</style>
