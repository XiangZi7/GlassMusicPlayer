<script setup lang="ts">
/**
 * PlayerDrawer - 全屏播放器抽屉
 * 包含黑胶/圆形频谱两种封面模式、歌词滚动、可视化背景、
 * 共享元素过渡动画、歌词拖动跳转等功能
 */
import { gsap } from 'gsap'
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { useLyricsScroll } from '@/composables/useLyricsScroll'
import { useGradientBackground } from '@/composables/useGradientBackground'
import { useCommentCount } from '@/composables/useCommentCount'
import { useI18n } from 'vue-i18n'
import { useAudioAnalyser } from '@/composables/useAudioAnalyser'
import { useLyricsDrag } from '@/composables/useLyricsDrag'
import { useDrawerTransition } from '@/composables/useDrawerTransition'
import VinylDisc from '@/components/Player/VinylDisc.vue'

const { t } = useI18n()
const globalStore = useGlobalStore()
const audioStore = useAudioStore()
const settingsStore = useSettingsStore()
const { audioVisualizer } = storeToRefs(settingsStore)

// ═══ 主题与可视化器切换 ═══

/** 当前主题对应图标 */
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

/** 循环切换主题：light → dark → system */
const cycleTheme = () => {
  const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const idx = order.indexOf(globalStore.theme)
  globalStore.setTheme(order[(idx + 1) % 3])
}

/** 循环切换可视化器类型：bars → wave → circular */
const cycleVisualizerType = () => {
  const types: Array<'bars' | 'wave' | 'circular'> = ['bars', 'wave', 'circular']
  const idx = types.indexOf(audioVisualizer.value.visualizerType)
  settingsStore.setAudioVisualizerType(types[(idx + 1) % 3])
}

/** 可视化器类型对应图标 */
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

/** 抽屉开关（双向绑定） */
const isOpen = defineModel<boolean>()

// ═══ 模板引用 ═══
const drawerRef = useTemplateRef('drawerRef')
const lyricsRef = useTemplateRef('lyricsRef')
const bgARef = useTemplateRef('bgARef')
const bgBRef = useTemplateRef('bgBRef')
const lyricsContainerRef = ref<HTMLElement | null>(null)
const vinylDiscRef = ref<InstanceType<typeof VinylDisc> | null>(null)

// ═══ 组合式函数 ═══

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

// 歌词拖动
const {
  isDragging: lyricsDragging,
  previewIndex: dragPreviewIndex,
  previewInfo: dragPreviewInfo,
  onDragStart: handleLyricsDragStart,
} = useLyricsDrag({
  lyricsRef,
  lyricsContainerRef,
  activeSingleLyrics,
  timeForIndex,
  setCurrentTime,
  currentLyricIndex,
  autoScroll,
  scrollToCurrentLyric,
  toggleAutoScroll,
  formattedDuration,
  showTrans,
})

// 背景渐变
const {
  useCoverBg,
  bgAStyle,
  bgBStyle,
  activeGradient,
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

// 抽屉过渡动画
const {
  isRendered,
  open: openDrawer,
  close: closeDrawer,
} = useDrawerTransition({
  drawerRef,
  vinylDiscRef,
  currentSong,
  isPlaying,
})

// 本地 UI 状态
const state = reactive({
  /** 播放列表弹出框 */
  isRecentOpen: false,
  /** 评论弹窗 */
  isCommentsOpen: false,
  /** 移动端歌词视图 */
  showMobileLyrics: false,
  /** 圆形可视化器封面 URL */
  circularCover: '' as string,
  /** 封面翻转动画锁 */
  isCircularFlipping: false,
})

const { isRecentOpen, isCommentsOpen, showMobileLyrics } = toRefs(state)

// ═══ 圆形可视化器封面翻转动画 ═══

const circularCoverRef = ref<HTMLElement | null>(null)

/** 翻转动画：旋转 Y 轴 90° → 替换图片 → 旋转回来 + 发光 */
const flipCircularCover = (newCover: string) => {
  if (!circularCoverRef.value || state.isCircularFlipping) {
    state.circularCover = newCover
    return
  }

  if (!state.circularCover) {
    state.circularCover = newCover
    return
  }

  state.isCircularFlipping = true

  const tl = gsap.timeline({
    onComplete: () => {
      state.isCircularFlipping = false
    },
  })

  // 第一阶段：翻转到90度 + 缩放
  tl.to(circularCoverRef.value, {
    rotateY: 90,
    scale: 0.85,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      state.circularCover = newCover
    },
  })

  // 第二阶段：翻转回来
  tl.to(circularCoverRef.value, {
    rotateY: 0,
    scale: 1,
    duration: 0.35,
    ease: 'back.out(1.7)',
  })

  // 添加发光效果
  tl.fromTo(
    circularCoverRef.value,
    { boxShadow: '0 0 0 rgba(236, 72, 153, 0)' },
    {
      boxShadow: '0 0 40px rgba(236, 72, 153, 0.6)',
      duration: 0.2,
      yoyo: true,
      repeat: 1,
    },
    0
  )
}

/** 可视化器渐变色：从背景主色调提取并适配当前主题 */
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

/** 播放模式对应图标 */
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

/** 切换歌词选项（翻译/罗马音），切换后重新定位 */
const toggleLyricsOption = async (option: 'trans' | 'roma') => {
  if (option === 'trans') showTrans.value = !showTrans.value
  else showRoma.value = !showRoma.value
  await nextTick()
  lyricsPositioned.value = false
  updateCurrentLyric(true)
}

/** 点击封面切换播放/暂停（加载中忽略） */
const handleAlbumCoverClick = () => {
  if (!isLoading.value) {
    togglePlay()
  }
}

// ═══ Watchers ═══

/** 抽屉开关：打开时初始化动画和背景，关闭时清理 */
watch(
  () => isOpen.value,
  async newVal => {
    if (newVal) {
      isRendered.value = true
      await nextTick()
      openDrawer()
      lyricsPositioned.value = false
      updateCurrentLyric(true)
      setBackgroundGradient(currentSong.value?.cover)
    } else {
      closeDrawer()
      stopBackgroundBreathing()
    }
  }
)

/** 播放状态变化：控制呼吸动画和音频分析器 */
watch(
  isPlaying,
  playing => {
    if (playing) {
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

/** 切歌时：加载歌词、重置滚动、更新背景、翻转封面 */
watch(
  currentSong,
  async (s, oldSong) => {
    await fetchLyrics(s?.id)
    resetLyrics()
    await nextTick()
    updateCurrentLyric(true)
    setBackgroundGradient(s?.cover, 0)

    // 触发圆形可视化器封面翻转动画
    if (s?.cover && oldSong && oldSong.id !== s.id) {
      flipCircularCover(s.cover)
    } else if (s?.cover && !state.circularCover) {
      state.circularCover = s.cover
    }
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
})

/** 监听音频元素变化，初始化频谱分析器 */
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
      <!-- 暗角 -->
      <div class="vignette pointer-events-none absolute inset-0"></div>

      <!-- 音频可视化器 - 占满背景底部 -->
      <div
        v-if="
          isAnalyserInitialized &&
          audioVisualizer.enabledInDrawer &&
          audioVisualizer.visualizerType !== 'circular'
        "
        class="absolute right-0 bottom-0 left-0 z-10 opacity-30"
      >
        <AudioVisualizer
          :frequency-data="frequencyData"
          :time-domain-data="timeDomainData"
          :type="audioVisualizer.visualizerType"
          :bar-count="128"
          :bar-width="4"
          :bar-gap="1"
          :gradient-colors="visualizerGradient"
          :height="180"
          class="h-full"
        />
      </div>
    </div>

    <div
      class="absolute top-0 right-0 left-0 z-10 flex items-center justify-between p-4 lg:px-6 lg:pt-5"
    >
      <div class="flex items-center gap-2">
        <div class="glass-toolbar flex items-center gap-0.5 rounded-xl p-1">
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            :title="t('player.fontDec')"
            @click="decreaseScale()"
            icon="icon-[mdi--format-font-size-decrease]"
            icon-class="h-4 w-4"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            :title="t('player.fontInc')"
            @click="increaseScale()"
            icon="icon-[mdi--format-font-size-increase]"
            icon-class="h-4 w-4"
          />
          <div class="mx-0.5 h-4 w-px bg-white/8"></div>
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            :class="{ 'text-primary bg-white/12 ring-1 ring-white/15': autoScroll }"
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

      <div class="flex items-center gap-2">
        <div
          v-if="lyricsTrans.length || lyricsRoma.length"
          class="glass-toolbar flex items-center gap-1 rounded-xl p-1"
        >
          <Button
            v-if="lyricsTrans.length"
            variant="ghost"
            size="sm"
            rounded="lg"
            class="gap-1.5 text-xs"
            :class="{ 'text-primary bg-white/12 ring-1 ring-white/15': showTrans }"
            @click="toggleLyricsOption('trans')"
          >
            <span class="icon-[mdi--translate] h-3.5 w-3.5" />
            <span>{{ t('player.translate') }}</span>
          </Button>
          <Button
            v-if="lyricsRoma.length"
            variant="ghost"
            size="sm"
            rounded="lg"
            class="gap-1.5 text-xs"
            :class="{ 'text-primary bg-white/12 ring-1 ring-white/15': showRoma }"
            @click="toggleLyricsOption('roma')"
          >
            <span class="icon-[mdi--alphabetical-variant] h-3.5 w-3.5"></span>
            <span>{{ t('player.roma') }}</span>
          </Button>
        </div>

        <div class="glass-toolbar flex items-center gap-0.5 rounded-xl p-1">
          <Button
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            class="lg:hidden"
            @click="showMobileLyrics = !showMobileLyrics"
            :icon="showMobileLyrics ? 'icon-[mdi--album]' : 'icon-[mdi--text-box-outline]'"
            icon-class="h-4 w-4"
          />

          <Button
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            :class="{ 'bg-white/12 text-yellow-300/80': !useCoverBg }"
            @click="useCoverBg = !useCoverBg"
            :title="t('player.toggleBg')"
          >
            <span
              :class="[
                useCoverBg ? 'icon-[mdi--image-multiple-outline]' : 'icon-[mdi--palette-swatch]',
                'h-4 w-4',
              ]"
            ></span>
          </Button>

          <Button
            v-if="isAnalyserInitialized"
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            :class="{ 'bg-white/12 text-cyan-300/80': audioVisualizer.enabledInDrawer }"
            @click="settingsStore.setAudioVisualizerDrawer(!audioVisualizer.enabledInDrawer)"
            title="切换频谱显示"
            icon="icon-[mdi--waveform]"
            icon-class="h-4 w-4"
          />

          <Button
            v-if="isAnalyserInitialized && audioVisualizer.enabledInDrawer"
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            @click="cycleVisualizerType"
            title="切换频谱模式"
          >
            <span :class="[visualizerTypeIcon, 'h-4 w-4']"></span>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            @click="cycleTheme"
            :title="t('components.settings.themeMode')"
          >
            <span :class="[themeIcon, 'h-4 w-4']"></span>
          </Button>

          <div class="mx-0.5 h-4 w-px bg-white/8"></div>

          <Button
            variant="ghost"
            size="icon-sm"
            rounded="lg"
            @click="isOpen = false"
            icon="icon-[mdi--chevron-down]"
            icon-class="h-5 w-5"
          />
        </div>
      </div>
    </div>

    <div
      class="player-left-panel flex w-full flex-col items-center justify-center px-4 pt-20 pb-8 lg:w-1/2 lg:px-8 lg:pt-24 lg:pb-12"
      :class="{ 'hidden lg:flex': state.showMobileLyrics }"
    >
      <!-- 专辑封面区域 -->
      <!-- 圆形频谱可视化模式 -->
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
          <AudioVisualizer
            :frequency-data="frequencyData"
            :time-domain-data="timeDomainData"
            type="circular"
            :bar-count="128"
            :gradient-colors="visualizerGradient"
            :height="384"
            class="h-full w-full"
          />
          <!-- 中心封面 - 带翻转动画 -->
          <div
            ref="circularCoverRef"
            class="circular-cover absolute top-1/2 left-1/2 aspect-square w-1/2 -translate-x-1/2 -translate-y-1/2 scale-80 cursor-pointer overflow-hidden rounded-full"
            style="perspective: 1000px; transform-style: preserve-3d"
            @click="handleAlbumCoverClick"
          >
            <img
              v-if="state.circularCover"
              :src="state.circularCover + '?param=320x320'"
              :alt="currentSong?.name"
              class="h-full w-full object-cover"
              style="backface-visibility: hidden"
            />
            <div v-else class="h-full w-full bg-linear-to-br from-blue-500 to-purple-600"></div>
          </div>
        </div>
      </div>
      <!-- 黑胶播放器模式 -->
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
      </div>

      <!-- 歌曲信息（两种模式共享） -->
      <div class="song-info mb-4 text-center lg:mb-6">
        <h2
          class="song-title text-primary mb-1 line-clamp-1 text-xl font-bold sm:text-2xl lg:text-3xl"
        >
          {{ currentSong?.name || t('player.unknownSong') }}
        </h2>
        <p class="text-primary/60 text-sm sm:text-base lg:text-lg">
          {{ currentSong?.artist || t('player.unknownArtist') }}
        </p>
        <p v-if="currentSong?.album" class="text-primary/35 mt-0.5 text-xs sm:text-sm">
          {{ currentSong.album }}
        </p>
      </div>

      <div v-if="currentSong" class="mb-5 w-full max-w-xl px-4">
        <MusicProgress :color="visualizerGradient" />
        <div class="mt-1.5 flex justify-between">
          <span class="text-primary/45 text-[11px] tabular-nums">{{
            isLoading ? t('player.loading') : formattedCurrentTime
          }}</span>
          <span class="text-primary/45 text-[11px] tabular-nums">{{ formattedDuration }}</span>
        </div>
      </div>

      <div class="controls-row mb-5 flex items-center gap-3 sm:gap-5 lg:mb-6">
        <Button
          variant="ghost"
          rounded="full"
          size="none"
          class="ctrl-btn h-10 w-10 justify-center"
          :class="{ 'bg-pink-500/15 text-pink-400!': playMode !== 'list' }"
          @click="togglePlayMode"
        >
          <span :class="playModeIconClass" class="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          rounded="full"
          size="none"
          class="ctrl-btn h-12 w-12 justify-center"
          @click="previous"
          icon="icon-[mdi--skip-previous]"
          icon-class="h-6 w-6"
        />

        <Button
          variant="gradient"
          rounded="full"
          size="none"
          class="main-play-btn h-[72px] w-[72px] justify-center"
          :loading="isLoading"
          :pulse="true"
          :press3d="true"
          @click="togglePlay"
        >
          <span
            v-if="!isLoading"
            :class="!isPlaying ? 'icon-[mdi--play]' : 'icon-[mdi--pause]'"
            class="h-8 w-8"
          ></span>
        </Button>

        <Button
          variant="ghost"
          rounded="full"
          size="none"
          class="ctrl-btn h-12 w-12 justify-center"
          @click="next"
          icon="icon-[mdi--skip-next]"
          icon-class="h-6 w-6"
        />

        <PlaylistBubble
          v-model:show="isRecentOpen"
          placement="top-left"
          :offset-x="8"
          :offset-y="10"
        >
          <template #trigger>
            <Button
              variant="ghost"
              rounded="full"
              size="none"
              class="ctrl-btn h-10 w-10 justify-center"
              icon="icon-[mdi--playlist-music]"
              icon-class="h-5 w-5"
            />
          </template>
        </PlaylistBubble>
      </div>

      <div class="flex w-full max-w-sm items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          rounded="2xl"
          class="gap-1.5 px-3.5 py-1.5 text-xs"
          @click="isCommentsOpen = true"
        >
          <span class="icon-[mdi--comment-outline] h-4 w-4"></span>
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
        :class="{ 'cursor-grabbing': lyricsDragging, 'cursor-grab': !lyricsDragging }"
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
              current: index === (lyricsDragging ? dragPreviewIndex : currentLyricIndex),
              'text-primary/40': index !== (lyricsDragging ? dragPreviewIndex : currentLyricIndex),
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

        <!-- 歌词中心指示线 -->
        <!-- <div class="pointer-events-none absolute top-1/2 right-0 left-0 -z-10 flex items-center">
          <div
            class="center-line h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent"
          ></div>
        </div> -->

        <!-- 拖动时显示的时间和歌词提示 -->
        <Transition name="fade-scale">
          <div
            v-if="lyricsDragging && dragPreviewInfo"
            class="drag-preview pointer-events-none absolute top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-black/85 px-6 py-4 shadow-2xl backdrop-blur-xl"
          >
            <div class="mb-3 flex items-center justify-center gap-3">
              <span class="text-primary text-2xl font-bold tabular-nums">{{
                dragPreviewInfo.time
              }}</span>
              <span class="text-primary/25">/</span>
              <span class="text-lg text-white/40 tabular-nums">{{
                dragPreviewInfo.totalDuration
              }}</span>
            </div>
            <div class="max-w-md text-center">
              <p class="text-primary mb-1.5 text-base leading-relaxed font-medium">
                {{ dragPreviewInfo.lyric.ori }}
              </p>
              <p
                v-if="dragPreviewInfo.showTrans && dragPreviewInfo.lyric.tran"
                class="text-primary/50 text-sm"
              >
                {{ dragPreviewInfo.lyric.tran }}
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

/* 暗角效果 */
.vignette {
  background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.45) 100%);
}

.glass-toolbar {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* 控制按钮 hover 效果 */
.ctrl-btn {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: scale(1.08);
}
.ctrl-btn:active {
  transform: scale(0.95);
}

/* 主播放按钮光环 */
.main-play-btn {
  box-shadow:
    0 0 30px rgba(236, 72, 153, 0.25),
    0 8px 32px rgba(139, 92, 246, 0.2);
  transition: box-shadow 0.3s ease;
}
.main-play-btn:hover {
  box-shadow:
    0 0 40px rgba(236, 72, 153, 0.35),
    0 0 60px rgba(139, 92, 246, 0.15),
    0 8px 32px rgba(139, 92, 246, 0.25);
}

/* 圆形可视化器封面翻转动画 */
.circular-cover {
  will-change: transform, box-shadow;
  transition: box-shadow 0.3s ease;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.3);
}

.circular-cover img {
  will-change: transform;
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
  padding: 0.5rem 1.5rem;
  margin-bottom: 0.25rem;
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  white-space: pre-line;
}

.lyric-line.current {
  @apply text-primary;
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(139, 92, 246, 0.08));
  transform: scale(1.06);
}
.lyric-line.current .lyric-text {
  @apply text-xl font-semibold lg:text-2xl;
}
.lyric-line.current .lyric-sub {
  @apply text-primary/60 mt-1 text-sm lg:text-base;
}

.lyric-sub {
  @apply text-primary/40 mt-0.5 text-sm;
}

@media (max-width: 1024px) {
  .player-left-panel {
    width: 100%;
  }
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
  box-shadow:
    0 25px 50px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
</style>
