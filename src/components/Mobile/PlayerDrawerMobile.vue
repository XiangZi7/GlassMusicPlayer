<script setup lang="ts">
// 播放抽屉：展示当前歌曲信息与歌词，支持滚动高亮与点击跳转
import { gsap } from 'gsap'
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { commentMusic } from '@/api'
import SongCommentsDialog from '@/components/Comments/SongCommentsDialog.vue'
import { useNow, useOnline, useBattery } from '@vueuse/core'

const isOpen = defineModel<boolean>()
const state = reactive({
  isRendered: false,
  currentLyricIndex: 0,
  lyricsOffset: 0,
  isRecentOpen: false,
  isCommentsOpen: false,
  commentCount: 0,
  // 是否使用封面背景（放大+模糊）
  useCoverBg: true,
  // 背景层管理（A/B双层交替淡入淡出）
  bgActive: 'A' as 'A' | 'B',
  bgAUrl: '' as string,
  bgBUrl: '' as string,
  lyricsPositioned: false,
  autoScroll: true,
  lyricsScale: 1,
  // 显示封面 or 歌词
  showLyrics: false,
})
// 响应式引用
const { currentLyricIndex, showLyrics } = toRefs(state)
// 使用音频播放器
const {
  currentSong,
  isPlaying,
  isLoading,
  volume,
  currentTime,
  progress,
  playMode,
  togglePlay,
  next,
  previous,
  setVolume,
  toggleMute,
  setProgress,
  setCurrentTime,
  formattedCurrentTime,
  formattedDuration,
  togglePlayMode,
} = useAudio()

// 响应式状态
const drawerRef = useTemplateRef('drawerRef')
const albumCoverRef = useTemplateRef('albumCoverRef')
const lyricsRef = useTemplateRef('lyricsRef')
const bgARef = useTemplateRef('bgARef')
const bgBRef = useTemplateRef('bgBRef')

// 顶部状态：当前时间与联网状态
const now = useNow()
const online = useOnline()
const timeText = computed(() =>
  new Date(now.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
)
const battery = useBattery()
const batteryPct = computed(() =>
  typeof battery.level?.value === 'number' ? Math.round(battery.level.value * 100) : null
)
const batteryIcon = computed(() =>
  battery.charging?.value ? 'icon-[mdi--battery-charging]' : 'icon-[mdi--battery]'
)

// 歌词封装
// 说明：集中管理歌词的多轨显示与时间轴信息
// - lyricsTrans：翻译文本数组（可选显示）
// - lyricsRoma：罗马音文本数组（可选显示）
// - showTrans：翻译开关（true 显示翻译）
// - showRoma：罗马音开关（true 显示罗马音）
// - activeSingleLyrics：当前实际渲染的歌词行（随开关动态切换）
// - activeTimeline：每句歌词的时间轴，用于定位与高亮
// - timeForIndex：根据行索引返回对应的播放时间
// - fetchLyrics：按歌曲 ID 拉取歌词数据
const {
  lyricsTrans,
  lyricsRoma,
  showTrans,
  showRoma,
  activeSingleLyrics,
  activeTimeline,
  fetchLyrics,
} = useLyrics()
// 切换“翻译”后：等待视图更新，重置定位标记并将当前行居中
const toggleTransBtn = async () => {
  showTrans.value = !showTrans.value
  await nextTick()
  state.lyricsPositioned = false
  updateCurrentLyric(true)
}
// 切换“罗马音”后：等待视图更新，重置定位标记并将当前行居中
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

// 方法
const handleTogglePlay = () => {
  togglePlay()
}

// 点击显示歌词后：等待视图更新，重置定位标记并将当前行居中
const handleShowLyricsClick = async () => {
  showLyrics.value = true

  state.lyricsPositioned = false
  await nextTick()
  updateCurrentLyric(true)
}

const touchStartY = ref<number | null>(null)
const lyricDragStartY = ref<number | null>(null)
const lyricDragStartTime = ref<number | null>(null)
const draggingLyrics = ref(false)
const previewLyricTime = ref<number | null>(null)
const lyricDragMoved = ref(false)
const formatSeconds = (sec: number | null) => {
  if (sec == null) return ''
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
}
const formattedPreviewLyricTime = computed(() => formatSeconds(previewLyricTime.value))
const handleCenterTouchStart = (e: TouchEvent) => {
  touchStartY.value = e.touches?.[0]?.clientY ?? null
}
const handleCenterTouchEnd = async (e: TouchEvent) => {
  const endY = e.changedTouches?.[0]?.clientY ?? null
  if (touchStartY.value == null || endY == null) return
  const dy = endY - touchStartY.value
  touchStartY.value = null
  if (!showLyrics.value && Math.abs(dy) > 30) {
    showLyrics.value = true
    state.lyricsPositioned = false
    await nextTick()
    updateCurrentLyric(true)
  }
}

const handleLyricsTouchStart = (e: TouchEvent) => {
  lyricDragStartY.value = e.touches?.[0]?.clientY ?? null
  lyricDragStartTime.value = currentTime.value
  draggingLyrics.value = true
  previewLyricTime.value = currentTime.value
  lyricDragMoved.value = false
}

const handleLyricsTouchMove = (e: TouchEvent) => {
  if (!draggingLyrics.value) return
  const y = e.touches?.[0]?.clientY ?? null
  if (lyricDragStartY.value == null || y == null || lyricDragStartTime.value == null) return
  const dy = y - lyricDragStartY.value
  const threshold = 12
  if (Math.abs(dy) < threshold) {
    previewLyricTime.value = lyricDragStartTime.value
    return
  }
  lyricDragMoved.value = true
  const sensitivity = -0.06
  const delta = dy * sensitivity
  const base = lyricDragStartTime.value
  const total = activeTimeline.value[activeTimeline.value.length - 1] ?? base
  const nextTime = Math.max(0, Math.min(total, base + delta))
  previewLyricTime.value = nextTime
}

const handleLyricsTouchEnd = () => {
  if (lyricDragMoved.value && previewLyricTime.value != null) {
    setCurrentTime(previewLyricTime.value)
    updateCurrentLyric(true)
  }
  draggingLyrics.value = false
  lyricDragStartY.value = null
  lyricDragStartTime.value = null
  previewLyricTime.value = null
  lyricDragMoved.value = false
}

const handleProgressClick = (event: MouseEvent) => {
  const progressBar = event.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newProgress = (clickX / rect.width) * 100
  setProgress(Math.max(0, Math.min(100, newProgress)))
  updateCurrentLyric()
}

// 动画相关
let albumRotationTween: gsap.core.Tween | null = null
// 不再使用模拟计时器，改为监听音频 currentTime 更新歌词高亮

const startAlbumRotation = () => {
  if (albumCoverRef.value) {
    albumRotationTween = gsap.to(albumCoverRef.value, {
      rotation: 360,
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

// 加载歌曲评论数量
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

// 更新当前歌词索引
// 说明：根据当前播放时间在时间轴中定位应高亮的歌词行，并触发居中滚动
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

// 滚动到当前歌词位置
// 说明：以容器的可视中心为参考，计算当前行相对中心的偏移量并平滑对齐
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

// 背景封面淡入淡出
const setBackground = (url?: string) => {
  if (!state.useCoverBg || !url) return
  if (state.bgAUrl === '' && state.bgBUrl === '') {
    // 初始设置：直接显示A层
    state.bgAUrl = url
    if (bgARef.value) gsap.set(bgARef.value, { opacity: 0 })
    if (bgARef.value) gsap.to(bgARef.value, { opacity: 0.6, duration: 0.8, ease: 'power2.out' })
    state.bgActive = 'A'
    return
  }

  if (state.bgActive === 'A') {
    state.bgBUrl = url
    if (bgBRef.value) gsap.set(bgBRef.value, { opacity: 0 })
    if (bgBRef.value)
      gsap.to(bgBRef.value as any, { opacity: 0.6, duration: 0.8, ease: 'power2.out' })
    if (bgARef.value)
      gsap.to(bgARef.value as any, { opacity: 0, duration: 0.8, ease: 'power2.out' })
    state.bgActive = 'B'
  } else {
    state.bgAUrl = url
    if (bgARef.value) gsap.set(bgARef.value, { opacity: 0 })
    if (bgARef.value)
      gsap.to(bgARef.value as any, { opacity: 0.6, duration: 0.8, ease: 'power2.out' })
    if (bgBRef.value)
      gsap.to(bgBRef.value as any, { opacity: 0, duration: 0.8, ease: 'power2.out' })
    state.bgActive = 'A'
  }
}

// 抽屉动画
const openDrawer = async () => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value, { display: 'flex' })

    const tl = gsap.timeline()
    await nextTick()
    tl.fromTo(
      drawerRef.value,
      {
        y: '-100%',
        opacity: 0,
      },
      {
        y: '0%',
        opacity: 1,
        duration: 0.6,
        ease: 'power3.out',
      }
    ).fromTo(
      '.lyric-line',
      {
        y: 30,
        opacity: 0,
      },
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        stagger: 0.1,
        ease: 'power2.out',
      },
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

// 监听器
watch(
  () => isOpen.value,
  async newVal => {
    if (newVal) {
      state.isRendered = true
      await nextTick()
      openDrawer()
      state.lyricsPositioned = false
      updateCurrentLyric(true)
      setBackground(currentSong.value?.cover)
      isPlaying.value ? startAlbumRotation() : stopAlbumRotation()
    } else {
      closeDrawer()
      isPlaying.value ? startAlbumRotation() : stopAlbumRotation()
    }
  }
)

// 播放状态控制封面旋转
watch(
  isPlaying,
  playing => {
    playing ? startAlbumRotation() : stopAlbumRotation()
  },
  { immediate: true }
)

// 监听当前时间更新歌词高亮
watch(currentTime, () => {
  updateCurrentLyric()
})

// 当前歌曲变化时拉取歌词
watch(
  currentSong,
  async s => {
    await fetchLyrics(s?.id)
    state.currentLyricIndex = 0
    state.lyricsPositioned = false
    await nextTick()
    updateCurrentLyric(true)
    // 背景封面淡入淡出
    setBackground(s?.cover)
  },
  { immediate: true }
)

// 生命周期
onMounted(() => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value as any, { display: 'none' })
  }
})

onUnmounted(() => {
  stopAlbumRotation()
})
</script>
<template>
  <div
    v-if="state.isRendered"
    ref="drawerRef"
    class="mask-glass fixed inset-0 z-9999 backdrop-blur-md"
  >
    <div v-if="state.useCoverBg" class="absolute inset-0 -z-10">
      <div
        ref="bgARef"
        class="absolute inset-0 scale-130 transform bg-cover bg-top blur-2xl"
        :style="
          state.bgAUrl
            ? { backgroundImage: `url(${state.bgAUrl})`, opacity: state.bgActive === 'A' ? 0.6 : 0 }
            : {}
        "
      ></div>
      <div
        ref="bgBRef"
        class="absolute inset-0 scale-130 transform bg-cover bg-top blur-2xl"
        :style="
          state.bgBUrl
            ? { backgroundImage: `url(${state.bgBUrl})`, opacity: state.bgActive === 'B' ? 0.6 : 0 }
            : {}
        "
      ></div>
      <div class="bottom-mask-gradient absolute right-0 bottom-0 left-0 h-1/3"></div>
    </div>
    <div class="absolute top-0 right-0 left-0 flex items-center justify-between p-3">
      <div class="glass-nav flex items-center gap-3 rounded-2xl px-3 py-1">
        <span class="text-primary text-sm">{{ timeText }}</span>
        <span class="text-primary flex items-center gap-1 text-sm">
          <span
            :class="online ? 'bg-green-400' : 'bg-red-400'"
            class="inline-block h-2 w-2 rounded-full"
          ></span>
          {{ online ? '在线' : '离线' }}
        </span>
        <span v-if="battery.isSupported" class="text-primary flex items-center gap-1 text-sm">
          <span :class="batteryIcon" class="h-4 w-4"></span>
          {{ batteryPct !== null ? batteryPct + '%' : 'N/A' }}
        </span>
      </div>
      <button
        class="glass-button flex h-10 w-10 items-center justify-center rounded-full"
        @click="isOpen = false"
      >
        <span class="icon-[mdi--close] text-primary h-5 w-5"></span>
      </button>
    </div>

    <div class="absolute inset-x-0 top-12 bottom-0 flex flex-col items-center gap-4 px-4 pb-5">
      <div
        class="flex w-full flex-1 items-center justify-center"
        @touchstart="handleCenterTouchStart"
        @touchend="handleCenterTouchEnd"
      >
        <div
          v-show="!state.showLyrics"
          class="album-wrapper relative h-80 w-80"
          @click.stop="handleShowLyricsClick"
        >
          <div
            ref="albumCoverRef"
            class="vinyl-disc relative h-80 w-80 overflow-hidden rounded-full shadow-2xl"
          >
            <div
              class="vinyl-label absolute top-1/2 left-1/2 h-52 w-52 -translate-1/2 rounded-full bg-cover"
              :style="{
                backgroundImage: currentSong?.cover
                  ? `url(${currentSong.cover})`
                  : 'linear-gradient(135deg, rgba(167,139,250,0.6) 0%, rgba(108,92,231,0.6) 100%)',
              }"
            ></div>
            <div
              class="spindle absolute top-1/2 left-1/2 h-5 w-5 -translate-1/2 rounded-full"
            ></div>
          </div>
          <!-- 在黑胶封面右上方加入唱臂组件（轴心、手臂、配重、唱头、针），随播放状态切换角度 -->
          <div
            class="tonearm absolute -top-8 -right-4 z-10 origin-top-left transition-transform duration-500 ease-out"
            :class="isPlaying ? 'rotate-5' : 'rotate-[-20deg]'"
          >
            <div class="arm-pivot relative h-10 w-10 rounded-full"></div>
            <div class="arm-shaft mt-[-2px] h-36 w-2 rounded-full"></div>
            <div class="counterweight -mt-3 ml-2 h-6 w-6 rounded-full"></div>
            <div class="headshell relative mt-1 h-9 w-14 rounded-md">
              <div
                class="cartridge absolute top-1/2 left-1/2 h-4 w-9 -translate-x-1/2 -translate-y-1/2 rounded-sm"
              ></div>
              <div class="stylus absolute top-full left-1/2 h-4 w-[2px] -translate-x-1/2"></div>
            </div>
          </div>
        </div>
        <div
          v-show="state.showLyrics"
          ref="lyricsContainerRef"
          class="lyrics-container relative flex max-h-[60vh] w-full flex-col overflow-hidden p-4"
          @touchstart="handleLyricsTouchStart"
          @touchmove.prevent="handleLyricsTouchMove"
          @touchend="handleLyricsTouchEnd"
          @click.stop="showLyrics = false"
        >
          <div
            v-if="draggingLyrics && previewLyricTime !== null"
            class="time-indicator absolute right-0 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm"
          >
            <span class="text-primary/90">{{ formattedPreviewLyricTime }}</span>
          </div>
          <div
            ref="lyricsRef"
            class="lyrics-scroll relative z-20 h-auto"
            :style="{ fontSize: state.lyricsScale + 'rem' }"
          >
            <div
              v-for="(line, index) in activeSingleLyrics"
              :key="index"
              class="lyric-line z-50 mb-6 text-center transition-all duration-500"
              :class="{
                'text-primary scale-110 transform text-xl font-semibold':
                  index === currentLyricIndex,
                'text-primary/50': index !== currentLyricIndex,
              }"
            >
              <p>{{ line.ori }}</p>
              <p v-if="showTrans && line.tran">{{ line.tran }}</p>
              <p v-if="showRoma && line.roma">{{ line.roma }}</p>
            </div>
            <div class="h-64"></div>
          </div>
        </div>
      </div>

      <div class="w-full">
        <div ref="titleBarRef" v-show="!state.showLyrics" class="mb-2 text-left">
          <div class="max-w-[85%] min-w-0">
            <div class="flex items-center justify-start gap-2">
              <h3 class="text-primary truncate text-lg font-semibold">
                {{ currentSong?.name || '' }}
              </h3>
            </div>
            <p
              v-if="currentSong?.artist || currentSong?.album"
              class="text-primary/80 mt-1 truncate text-base"
            >
              <span v-if="currentSong?.artist" class="inline-flex items-center gap-1">
                <span class="icon-[mdi--account-music-outline] h-5 w-5"></span>
                {{ currentSong?.artist }}
              </span>
              <span v-if="currentSong?.artist && currentSong?.album" class="text-primary/60 mx-2"
                >•</span
              >
              <span v-if="currentSong?.album" class="inline-flex items-center gap-1">
                <span class="icon-[mdi--album] h-5 w-5"></span>
                {{ currentSong?.album }}
              </span>
            </p>
          </div>
        </div>
        <div v-if="currentSong" class="mb-3 flex items-center gap-3">
          <span class="text-primary/80 text-base">{{ formattedCurrentTime }}</span>
          <div
            @click="handleProgressClick"
            class="progress-track relative h-2 flex-1 cursor-pointer overflow-hidden rounded-full"
          >
            <div class="progress-fill h-full rounded-full" :style="{ width: `${progress}%` }"></div>
          </div>
          <span class="text-primary/80 text-base">{{ formattedDuration }}</span>
        </div>
        <div class="mb-3 flex items-center justify-center gap-3">
          <button
            class="glass-button flex h-10 w-10 items-center justify-center rounded-full"
            title="字体减小"
            @click="state.lyricsScale = Math.max(0.8, state.lyricsScale - 0.05)"
          >
            <span class="icon-[mdi--format-font-size-decrease] text-primary h-5 w-5"></span>
          </button>
          <button
            class="glass-button flex h-10 w-10 items-center justify-center rounded-full"
            title="字体增大"
            @click="state.lyricsScale = Math.min(1.4, state.lyricsScale + 0.05)"
          >
            <span class="icon-[mdi--format-font-size-increase] text-primary h-5 w-5"></span>
          </button>
          <button
            class="glass-button flex h-10 w-10 items-center justify-center rounded-full"
            :class="state.autoScroll ? 'bg-hover-glass' : ''"
            title="自动居中"
            @click="toggleAutoScroll"
          >
            <span
              :class="state.autoScroll ? 'icon-[mdi--autorenew]' : 'icon-[mdi--pause]'"
              class="text-primary h-5 w-5"
            ></span>
          </button>
          <button
            v-if="lyricsTrans.length"
            class="glass-button flex h-10 w-10 items-center justify-center rounded-full"
            :class="showTrans ? 'bg-hover-glass' : ''"
            title="翻译"
            @click="toggleTransBtn"
          >
            <span class="icon-[mdi--translate] text-primary h-5 w-5"></span>
          </button>
          <button
            v-if="lyricsRoma.length"
            class="glass-button flex h-10 w-10 items-center justify-center rounded-full"
            :class="showRoma ? 'bg-hover-glass' : ''"
            title="罗马音"
            @click="toggleRomaBtn"
          >
            <span class="icon-[mdi--format-letter-case] text-primary h-5 w-5"></span>
          </button>
          <button
            class="glass-button flex h-10 w-10 items-center justify-center rounded-full"
            :class="state.useCoverBg ? '' : 'bg-hover-glass'"
            title="切换背景"
            @click="state.useCoverBg = !state.useCoverBg"
          >
            <span
              :class="
                state.useCoverBg
                  ? 'icon-[mdi--image-multiple-outline]'
                  : 'icon-[mdi--palette-swatch]'
              "
              class="text-primary h-5 w-5"
            ></span>
          </button>
        </div>
        <div class="flex items-center justify-center gap-10">
          <button
            class="glass-button flex h-16 w-16 items-center justify-center rounded-full"
            @click="previous"
          >
            <span class="icon-[mdi--skip-previous] text-primary h-8 w-8"></span>
          </button>
          <button
            class="flex h-18 w-18 items-center justify-center rounded-full bg-linear-to-r from-pink-500 to-purple-600 shadow-2xl"
            :class="isLoading ? 'opacity-50' : ''"
            :disabled="isLoading"
            @click="handleTogglePlay"
          >
            <span
              v-if="isLoading"
              class="icon-[mdi--loading] text-primary h-9 w-9 animate-spin"
            ></span>
            <span
              v-else
              :class="isPlaying ? 'icon-[mdi--pause]' : 'icon-[mdi--play]'"
              class="text-primary h-9 w-9"
            ></span>
          </button>
          <button
            class="glass-button flex h-16 w-16 items-center justify-center rounded-full"
            @click="next"
          >
            <span class="icon-[mdi--skip-next] text-primary h-8 w-8"></span>
          </button>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <button
            class="glass-button flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
            @click="state.isCommentsOpen = true"
          >
            <span class="icon-[mdi--comment-outline] text-primary/80 h-4 w-4"></span
            ><span class="text-primary">{{ state.commentCount }}</span>
          </button>
          <div class="flex items-center space-x-3">
            <button @click="toggleMute" class="flex items-center transition-colors duration-200">
              <span
                v-if="volume === 0"
                class="icon-[mdi--volume-off] text-primary/80 h-4 w-4"
              ></span>
              <span
                v-else-if="volume < 0.5"
                class="icon-[mdi--volume-medium] text-primary/80 h-4 w-4"
              ></span>
              <span v-else class="icon-[mdi--volume-high] text-primary/80 h-4 w-4"></span>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              :value="volume * 100"
              @input="(e: any) => setVolume(parseInt(e.target.value) / 100)"
              class="slider bg-hover-glass h-2 w-28 appearance-none rounded-full outline-none"
            />
          </div>
          <button
            class="glass-button flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
            @click="togglePlayMode"
          >
            <span
              :class="
                playMode === 'single'
                  ? 'icon-[mdi--repeat-once]'
                  : playMode === 'random'
                    ? 'icon-[mdi--shuffle]'
                    : 'icon-[mdi--repeat]'
              "
              class="text-primary h-4 w-4"
            ></span
            ><span class="text-primary">模式</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  <SongCommentsDialog v-model:show="state.isCommentsOpen" :song-id="currentSong?.id ?? null" />
</template>

<style scoped>
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
}
.vinyl-disc::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background:
    radial-gradient(
      ellipse at 30% 20%,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.12) 25%,
      rgba(255, 255, 255, 0.06) 40%,
      transparent 55%
    ),
    linear-gradient(160deg, transparent 60%, rgba(255, 255, 255, 0.06) 70%, transparent 85%);
  mix-blend-mode: screen;
  pointer-events: none;
}
.vinyl-label {
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 2px 16px rgba(0, 0, 0, 0.25);
}
.spindle {
  background: radial-gradient(circle at 30% 30%, #c9c9c9, #9a9a9a 60%, #6f6f6f);
}
.album-wrapper {
  transition: transform 0.3s ease;
}
.album-wrapper:active {
  transform: scale(0.97);
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
</style>
<style scoped>
.lyrics-container {
  mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
}
.lyrics-scroll {
  transform: translateY(0);
  transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.lyric-line {
  line-height: 1.8;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  white-space: pre-line;
}
.time-indicator {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
</style>
