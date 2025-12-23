<script setup lang="ts">
import { gsap } from 'gsap'
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { commentMusic } from '@/api'
import SongCommentsDialog from '@/components/Comments/SongCommentsDialog.vue'
import MusicProgress from '@/components/Ui/MusicProgress.vue'
import VolumeControl from '@/components/Ui/VolumeControl.vue'
import Button from '@/components/Ui/Button.vue'
import AudioVisualizer from '@/components/Ui/AudioVisualizer.vue'
import { useI18n } from 'vue-i18n'
import { useGlobalStore } from '@/stores/modules/global'
import { useAudioStore } from '@/stores/modules/audio'
import { useSettingsStore } from '@/stores/modules/settings'
import { getColorPalette } from '@/utils/colorExtractor'
import { useAudioAnalyser } from '@/composables/useAudioAnalyser'
import { adaptColorsForTheme } from '@/utils/colorThemeAdapter'

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
      // 专辑旋转
      startAlbumRotation()
      return 'icon-[mdi--chart-bar]'
    case 'wave':
      return 'icon-[mdi--waveform]'
    case 'circular':
      startAlbumRotation()
      return 'icon-[mdi--circle-outline]'
  }
})

const isOpen = defineModel<boolean>()

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

// 计算可视化器渐变颜色
const visualizerGradient = computed(() => {
  const gradient = state.bgActive === 'A' ? state.bgAGradient : state.bgBGradient
  if (gradient.length === 0) {
    return ['#3b82f6', '#8b5cf6', '#ec4899']
  }
  // 提取渐变中的颜色
  const colors = gradient.map(color => {
    // 如果包含rgba，提取rgb部分
    const match = color.match(/rgba?\(([^)]+)\)/)
    if (match) {
      const values = match[1].split(',').slice(0, 3)
      return `rgb(${values.join(',')})`
    }
    return color
  })

  // 根据主题调整颜色
  return adaptColorsForTheme(colors)
})

const state = reactive({
  // 播放器抽屉是否已渲染
  isRendered: false,
  // 当前高亮的歌词索引
  currentLyricIndex: 0,
  // 歌词滚动偏移量
  lyricsOffset: 0,
  // 最近播放面板是否打开
  isRecentOpen: false,
  // 评论面板是否打开
  isCommentsOpen: false,
  // 评论数量
  commentCount: 0,
  // 是否使用封面背景
  useCoverBg: true,
  // 当前激活的背景（用于背景切换动画）
  bgActive: 'A' as 'A' | 'B',
  // 背景A的渐变色数组
  bgAGradient: [] as string[],
  // 背景B的渐变色数组
  bgBGradient: [] as string[],
  // 歌词是否已定位到当前播放位置
  lyricsPositioned: false,
  // 是否启用歌词自动滚动
  autoScroll: true,
  // 歌词缩放比例
  lyricsScale: 1,
  // 移动端是否显示歌词
  showMobileLyrics: false,
  // 歌词是否正在被拖动
  lyricsDragging: false,
  // 拖动开始的Y坐标
  dragStartY: 0,
  // 拖动开始时的歌词滚动位置
  dragStartScrollY: 0,
  // 拖动时预览的歌词索引
  dragPreviewIndex: -1,
})

const {
  isRendered,
  useCoverBg,
  currentLyricIndex,
  isRecentOpen,
  isCommentsOpen,
  commentCount,
  showMobileLyrics,
} = toRefs(state)

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

const drawerRef = useTemplateRef('drawerRef')
const albumCoverRef = useTemplateRef('albumCoverRef')
const lyricsRef = useTemplateRef('lyricsRef')
const bgARef = useTemplateRef('bgARef')
const bgBRef = useTemplateRef('bgBRef')
const lyricsContainerRef = ref<HTMLElement | null>(null)

// 生成背景渐变样式
const bgAStyle = computed(() => {
  if (state.bgAGradient.length === 0) return {}
  return {
    backgroundImage: `linear-gradient(135deg, ${state.bgAGradient.join(', ')})`,
  }
})

const bgBStyle = computed(() => {
  if (state.bgBGradient.length === 0) return {}
  return {
    backgroundImage: `linear-gradient(135deg, ${state.bgBGradient.join(', ')})`,
  }
})

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

const toggleTransBtn = async () => {
  showTrans.value = !showTrans.value
  await nextTick()
  state.lyricsPositioned = false
  updateCurrentLyric(true)
}

const toggleRomaBtn = async () => {
  showRoma.value = !showRoma.value
  await nextTick()
  state.lyricsPositioned = false
  updateCurrentLyric(true)
}

const toggleAutoScroll = () => {
  state.autoScroll = !state.autoScroll
  if (state.autoScroll) updateCurrentLyric(true)
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
  state.autoScroll = false

  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  state.dragStartY = clientY

  // 获取当前的transform translateY值
  if (lyricsRef.value) {
    const transform = window.getComputedStyle(lyricsRef.value).transform
    if (transform && transform !== 'none') {
      const matrix = new DOMMatrix(transform)
      state.dragStartScrollY = matrix.m42 // translateY value
    } else {
      state.dragStartScrollY = 0
    }
  }

  // 禁止文本选择
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

  // 直接设置transform
  gsap.set(lyricsRef.value, { y: newScrollY })

  // 计算当前应该高亮哪一句歌词
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

  // 恢复文本选择和鼠标样式
  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''
  document.body.style.cursor = ''

  // 如果有预览索引，跳转到该歌词
  if (state.dragPreviewIndex >= 0 && state.dragPreviewIndex < activeSingleLyrics.value.length) {
    const targetTime = timeForIndex(state.dragPreviewIndex) ?? 0
    setCurrentTime(targetTime)
    state.currentLyricIndex = state.dragPreviewIndex
    scrollToCurrentLyric()
  }

  state.dragPreviewIndex = -1
  // 1秒后恢复自动滚动
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

let albumRotationTween: gsap.core.Tween | null = null
let bgBreathingTweens: gsap.core.Tween[] = []

// 开始封面旋转动画（无限匀速旋转）
const startAlbumRotation = () => {
  if (albumCoverRef.value) {
    if (albumRotationTween) albumRotationTween.kill()
    albumRotationTween = gsap.to(albumCoverRef.value, {
      rotation: '+=360',
      duration: 10,
      repeat: -1,
      ease: 'none',
    })
  }
}
const stopAlbumRotation = () => {
  if (albumRotationTween) {
    albumRotationTween.kill()
    albumRotationTween = null
  }
}

const startBackgroundBreathing = () => {
  stopBackgroundBreathing()
}

const stopBackgroundBreathing = () => {
  bgBreathingTweens.forEach(tween => tween.kill())
  bgBreathingTweens = []
}

const loadCommentCount = async (songId?: number | string) => {
  if (!songId) {
    state.commentCount = 0
    return
  }
  try {
    const res: any = await commentMusic({ id: Number(songId), limit: 1, offset: 0 })
    state.commentCount = Number(res?.data?.total ?? res?.total ?? res?.totalCount ?? 0)
  } catch {
    state.commentCount = 0
  }
}

watch(
  () => currentSong.value?.id,
  id => {
    loadCommentCount(id as any)
  },
  { immediate: true }
)

const updateCurrentLyric = (instant = false) => {
  const adjustedTime = currentTime.value + state.lyricsOffset
  const times = activeTimeline.value
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
  if (idx !== -1 && idx !== state.currentLyricIndex) {
    state.currentLyricIndex = idx
    if (state.autoScroll) scrollToCurrentLyric(instant)
  } else if (!state.lyricsPositioned) {
    if (state.autoScroll) scrollToCurrentLyric(instant)
  }
}

const scrollToCurrentLyric = (instant = false) => {
  if (lyricsRef.value && state.currentLyricIndex >= 0) {
    const lyricsContainer = lyricsRef.value
    const currentLyricElement = lyricsContainer.children[state.currentLyricIndex] as HTMLElement

    if (currentLyricElement) {
      const containerHeight = lyricsContainer.parentElement?.clientHeight || 0
      const targetScrollTop =
        currentLyricElement.offsetTop - containerHeight / 2 + currentLyricElement.clientHeight / 2
      if (instant || !state.lyricsPositioned) {
        gsap.set(lyricsContainer, { y: -targetScrollTop })
        state.lyricsPositioned = true
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

const setBackgroundGradient = async (coverUrl?: string, delay: number = 0) => {
  if (!state.useCoverBg || !coverUrl) return

  // 延迟执行以等待动画完成
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  try {
    // 提取颜色
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

    // 双层切换以实现平滑过渡
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

const openDrawer = () => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value, { display: 'flex' })

    const tl = gsap.timeline()
    tl.fromTo(
      drawerRef.value,
      { y: '-100%', opacity: 0 },
      { y: '0%', opacity: 1, duration: 0.6, ease: 'power3.out' }
    )
      .fromTo(
        '.album-cover',
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
        '-=0.3'
      )
      .fromTo(
        '.song-info',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
        '-=0.2'
      )
      .fromTo(
        '.lyric-line',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power2.out' },
        '-=0.2'
      )
  }
}

const closeDrawer = () => {
  if (drawerRef.value) {
    const tl = gsap.timeline({
      onComplete: () => {
        state.isRendered = false
      },
    })

    tl.to(drawerRef.value, {
      y: '-100%',
      opacity: 0,
      duration: 0.4,
      ease: 'power3.in',
    })

    stopAlbumRotation()
  }
}

watch(
  () => isOpen.value,
  async newVal => {
    if (newVal) {
      state.isRendered = true
      await nextTick()
      openDrawer()
      state.lyricsPositioned = false
      updateCurrentLyric(true)
      // 抽屉打开动画完成后再提取颜色
      setBackgroundGradient(currentSong.value?.cover)
      // 音频分析由 isPlaying 的 watch 统一管理，这里不需要再启动
      if (isPlaying.value) {
        startAlbumRotation()
        startBackgroundBreathing()
      } else {
        stopAlbumRotation()
        stopBackgroundBreathing()
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
      startAlbumRotation()
      if (isOpen.value) {
        startBackgroundBreathing()
      }
      // 启动音频分析（无论抽屉是否打开，因为 footer 也需要）
      if (isAnalyserInitialized.value) {
        startAnalyser()
        resumeAnalyser()
      }
    } else {
      stopAlbumRotation()
      stopBackgroundBreathing()
      // 停止音频分析
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
    state.currentLyricIndex = 0
    state.lyricsPositioned = false
    await nextTick()
    updateCurrentLyric(true)
    // 切换歌曲时使用平滑过渡，无需延迟
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
  stopAlbumRotation()
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
            @click="state.lyricsScale = Math.max(0.8, state.lyricsScale - 0.05)"
          >
            <span class="icon-[mdi--format-font-size-decrease] h-4 w-4"></span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="xl"
            :title="t('player.fontInc')"
            @click="state.lyricsScale = Math.min(1.4, state.lyricsScale + 0.05)"
          >
            <span class="icon-[mdi--format-font-size-increase] h-4 w-4"></span>
          </Button>
          <div class="mx-1 h-4 w-px bg-white/10"></div>
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="xl"
            :class="{ 'text-primary bg-white/15 ring-1 ring-white/20': state.autoScroll }"
            :title="t('player.autoCenter')"
            @click="toggleAutoScroll"
          >
            <span
              :class="state.autoScroll ? 'icon-[mdi--autorenew]' : 'icon-[mdi--pause]'"
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
          :class="{ 'bg-white/20 text-yellow-300': !state.useCoverBg }"
          @click="state.useCoverBg = !state.useCoverBg"
          :title="t('player.toggleBg')"
        >
          <span
            :class="[
              state.useCoverBg
                ? 'icon-[mdi--image-multiple-outline]'
                : 'icon-[mdi--palette-swatch]',
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
            class="absolute top-1/2 left-1/2 h-full w-[65%] -translate-x-1/2 -translate-y-1/2 scale-80 cursor-pointer overflow-hidden rounded-full"
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
        <div
          class="album-wrapper relative mb-6 h-96 w-96 cursor-pointer"
          @click="handleAlbumCoverClick"
        >
          <div
            ref="albumCoverRef"
            class="album-cover vinyl-disc relative h-full w-full overflow-hidden rounded-full shadow-2xl"
          >
            <div
              class="vinyl-label absolute top-1/2 left-1/2 flex h-1/2 w-1/2 -translate-1/2 items-center justify-center rounded-full bg-cover text-center"
              :style="{
                backgroundImage: currentSong?.cover
                  ? `url(${currentSong.cover + '?param=320x320'})`
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }"
            ></div>
            <div
              class="spindle absolute top-1/2 left-1/2 h-6 w-6 -translate-1/2 rounded-full"
            ></div>
          </div>

          <div
            class="tonearm absolute -top-16 -right-20 z-10 origin-top-left transition-transform duration-500 ease-out"
            :class="isPlaying ? 'rotate-16' : 'rotate-[-28deg]'"
          >
            <div class="arm-pivot relative h-14 w-14 rounded-full shadow-xl"></div>
            <div class="arm-shaft mt-[-2px] h-44 w-3 rounded-full"></div>
            <div class="counterweight -mt-3 ml-1.5 h-8 w-8 rounded-full shadow-md"></div>
            <div class="headshell relative mt-1 h-12 w-20 rounded-md shadow-md">
              <div
                class="cartridge absolute top-1/2 left-1/2 h-6 w-12 -translate-x-1/2 -translate-y-1/2 rounded-sm"
              ></div>
              <div class="stylus absolute top-full left-1/2 h-6 w-[2px] -translate-x-1/2"></div>
            </div>
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
          :style="{ fontSize: state.lyricsScale + 'rem' }"
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

.album-wrapper {
  transition: transform 0.3s ease;
}
.album-wrapper:hover {
  transform: scale(1.03);
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
