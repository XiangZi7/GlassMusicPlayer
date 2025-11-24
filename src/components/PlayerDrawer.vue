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
})
// 响应式引用
const { isRendered, currentLyricIndex, isRecentOpen, isCommentsOpen, commentCount } = toRefs(state)
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

// 播放模式图标计算属性
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
  timeForIndex,
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

const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newVolume = parseInt(target.value) / 100
  setVolume(newVolume)
}

const handleProgressClick = (event: MouseEvent) => {
  const progressBar = event.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newProgress = (clickX / rect.width) * 100
  setProgress(Math.max(0, Math.min(100, newProgress)))
  updateCurrentLyric()
}

// 点击歌词跳转到对应时间
const seekToLyric = (index: number) => {
  const targetTime = timeForIndex(index) ?? 0
  setCurrentTime(targetTime)
  state.currentLyricIndex = index
  scrollToCurrentLyric()
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
const openDrawer = () => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value, { display: 'flex' })

    const tl = gsap.timeline()
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
    )
      .fromTo(
        '.album-cover',
        {
          scale: 0.5,
          opacity: 0,
        },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: 'back.out(1.7)',
        },
        '-=0.3'
      )
      .fromTo(
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
    console.log('🚀 ~ playing:', playing)
  },
  { immediate: true }
)

// 监听当前时间更新歌词高亮
watch(currentTime, () => {
  updateCurrentLyric()
})

watch(
  () => activeSingleLyrics.value,
  () => {
    console.log(
      '🚀 ~ file: PlayerDrawer.vue:377 ~ activeSingleLyrics.value:',
      activeSingleLyrics.value
    )
  }
)

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
    v-if="isRendered"
    ref="drawerRef"
    :class="[
      'absolute inset-0 z-50 flex backdrop-blur-md backdrop-filter',
      state.useCoverBg
        ? isRecentOpen
          ? 'bg-black/70'
          : 'bg-black/90'
        : isRecentOpen
          ? 'bg-black/65'
          : 'bg-black/85',
    ]"
  >
    <!-- 背景：封面放大+模糊（双层淡入淡出） -->
    <div v-if="state.useCoverBg" class="absolute inset-0 -z-10">
      <div
        ref="bgARef"
        class="absolute inset-0 scale-130 transform bg-cover bg-top opacity-50 blur-2xl"
        :style="state.bgAUrl ? { backgroundImage: `url(${state.bgAUrl})` } : {}"
      ></div>
      <div
        ref="bgBRef"
        class="absolute inset-0 scale-130 transform bg-cover bg-top opacity-50 blur-2xl"
        :style="state.bgBUrl ? { backgroundImage: `url(${state.bgBUrl})` } : {}"
      ></div>
    </div>
    <div class="absolute top-6 left-6 z-10 flex gap-2">
      <div class="flex items-center gap-2 rounded-2xl p-1">
        <button
          class="glass-button flex h-9 w-9 items-center justify-center rounded-full"
          title="字体减小"
          @click="state.lyricsScale = Math.max(0.8, state.lyricsScale - 0.05)"
        >
          <span class="icon-[mdi--format-font-size-decrease] h-4 w-4 text-white"></span>
        </button>
        <button
          class="glass-button flex h-9 w-9 items-center justify-center rounded-full"
          title="字体增大"
          @click="state.lyricsScale = Math.min(1.4, state.lyricsScale + 0.05)"
        >
          <span class="icon-[mdi--format-font-size-increase] h-4 w-4 text-white"></span>
        </button>
        <button
          class="glass-button flex h-9 w-9 items-center justify-center rounded-full"
          :class="state.autoScroll ? 'bg-hover-glass ring-1 ring-white/15' : ''"
          title="自动居中"
          @click="toggleAutoScroll"
        >
          <span
            :class="state.autoScroll ? 'icon-[mdi--autorenew]' : 'icon-[mdi--pause]'"
            class="h-4 w-4 text-white"
          ></span>
        </button>
      </div>
      <div class="glass-nav flex items-center gap-2 rounded-2xl px-3 py-1">
        <span class="text-sm text-white">{{ timeText }}</span>
        <span class="flex items-center gap-1 text-sm text-white">
          <span
            :class="online ? 'bg-green-400' : 'bg-red-400'"
            class="inline-block h-2 w-2 rounded-full"
          ></span>
          {{ online ? '在线' : '离线' }}
        </span>
        <span v-if="battery.isSupported" class="flex items-center gap-1 text-sm text-white">
          <span :class="batteryIcon" class="h-4 w-4"></span>
          {{ batteryPct !== null ? batteryPct + '%' : 'N/A' }}
        </span>
      </div>
    </div>
    <div class="absolute top-6 right-6 z-10 flex gap-4">
      <div
        v-if="lyricsTrans.length || lyricsRoma.length"
        class="flex items-center gap-2 rounded-2xl p-1"
      >
        <button
          v-if="lyricsTrans.length"
          class="glass-button flex items-center gap-2 rounded-xl px-3 py-1 text-white opacity-80 hover:opacity-100"
          :class="showTrans ? 'bg-hover-glass opacity-100 ring-1 ring-white/15' : ''"
          @click="toggleTransBtn"
        >
          <span class="icon-[mdi--translate] h-4 w-4"></span>
          <span>翻译</span>
        </button>
        <button
          v-if="lyricsRoma.length"
          class="glass-button flex items-center gap-2 rounded-xl px-3 py-1 text-white opacity-80 hover:opacity-100"
          :class="showRoma ? 'bg-hover-glass opacity-100 ring-1 ring-white/15' : ''"
          @click="toggleRomaBtn"
        >
          <span class="icon-[mdi--alphabetical-variant] h-4 w-4"></span>
          <span>罗马音</span>
        </button>
      </div>
      <button
        class="glass-button ml-3 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
        :class="state.useCoverBg ? '' : 'bg-(--glass-hover-item-bg) ring-1 ring-white/15'"
        @click="state.useCoverBg = !state.useCoverBg"
        title="切换背景：封面/纯色"
      >
        <span
          :class="[
            state.useCoverBg
              ? 'icon-[mdi--image-multiple-outline] text-white'
              : 'icon-[mdi--palette-swatch] text-yellow-300',
            'h-6 w-6',
          ]"
        ></span>
      </button>
      <!-- 关闭按钮 -->

      <button
        @click="isOpen = false"
        class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
      >
        <span class="icon-[mdi--close] h-6 w-6 text-white"></span>
      </button>
    </div>

    <!-- 左侧：歌曲信息和控件 -->
    <div class="flex w-1/2 flex-col items-center justify-center px-12 py-16">
      <!-- 专辑封面区域（黑胶风格） -->
      <div class="mb-8 flex flex-col items-center">
        <div class="album-wrapper relative mb-6 h-96 w-96">
          <!-- 黑胶盘：外层为黑胶，内层为封面标签 -->
          <div
            ref="albumCoverRef"
            class="album-cover vinyl-disc relative h-96 w-96 overflow-hidden rounded-full shadow-2xl"
          >
            <!-- 封面标签（纸质质感 + 内外圈） -->
            <div
              class="vinyl-label absolute top-1/2 left-1/2 flex h-48 w-48 -translate-1/2 items-center justify-center rounded-full bg-cover text-center"
              :style="{
                backgroundImage: currentSong?.cover
                  ? `url(${currentSong.cover})`
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }"
            ></div>

            <!-- 中心金属轴 -->
            <div
              class="spindle absolute top-1/2 left-1/2 h-4 w-4 -translate-1/2 rounded-full"
            ></div>
          </div>

          <!-- 黑胶指针（写实：底座 + 手臂 + 唱头 + 配重） -->
          <div
            class="tonearm absolute -top-16 -right-20 z-10 origin-top-left transition-transform duration-500 ease-out"
            :class="isPlaying ? 'rotate-16' : 'rotate-[-28deg]'"
          >
            <!-- 轴心底座 -->
            <div class="arm-pivot relative h-12 w-12 rounded-full shadow-xl"></div>
            <!-- 手臂主体 -->
            <div class="arm-shaft mt-[-2px] h-44 w-3 rounded-full"></div>
            <!-- 配重块 -->
            <div class="counterweight -mt-4 ml-2 h-7 w-7 rounded-full shadow-md"></div>
            <!-- 唱头与针 -->
            <div class="headshell relative mt-1 h-10 w-16 rounded-md shadow-md">
              <div
                class="cartridge absolute top-1/2 left-1/2 h-5 w-10 -translate-x-1/2 -translate-y-1/2 rounded-sm"
              ></div>
              <div class="stylus absolute top-full left-1/2 h-5 w-[2px] -translate-x-1/2"></div>
            </div>
          </div>
        </div>

        <!-- 歌曲信息 -->
        <div class="text-center">
          <h2 class="mb-2 text-2xl font-bold text-white">
            {{ currentSong?.name || '未知歌曲' }}
          </h2>
          <p class="text-lg text-white/80">{{ currentSong?.artist || '未知歌手' }}</p>
          <p class="mt-1 text-sm text-white/60">{{ currentSong?.album || '未知专辑' }}</p>
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="currentSong" class="mb-3 flex w-3/5 items-center space-x-3">
        <span class="text-xs text-white/60">{{
          isLoading ? '加载中…' : formattedCurrentTime
        }}</span>
        <div
          @click="handleProgressClick"
          class="relative h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20"
        >
          <div
            class="h-full rounded-full bg-linear-to-r from-pink-400 to-purple-500 transition-all duration-200"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
        <span class="text-xs text-white/60">{{ formattedDuration }}</span>
      </div>

      <!-- 控制按钮 -->
      <div class="mb-8 flex items-center space-x-6">
        <!-- 播放模式 -->
        <button
          @click="togglePlayMode"
          class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          :class="{ 'bg-pink-500/30': playMode !== 'list' }"
        >
          <component :is="'span'" :class="playModeIconClass" class="h-5 w-5 text-white" />
        </button>

        <!-- 上一首 -->
        <button
          @click="previous"
          class="glass-button flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
        >
          <span class="icon-[mdi--skip-previous] h-6 w-6 text-white"></span>
        </button>

        <!-- 播放/暂停 -->
        <button
          @click="handleTogglePlay"
          :disabled="isLoading"
          class="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-r from-pink-500 to-purple-600 shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-pink-500/25"
          :class="isLoading ? 'cursor-wait opacity-60' : ''"
        >
          <span v-if="isLoading" class="icon-[mdi--loading] h-8 w-8 animate-spin text-white"></span>
          <span v-else-if="!isPlaying" class="icon-[mdi--play] ml-1 h-8 w-8 text-white"></span>
          <span v-else class="icon-[mdi--pause] h-8 w-8 text-white"></span>
        </button>

        <!-- 下一首 -->
        <button
          @click="next"
          class="glass-button flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
        >
          <span class="icon-[mdi--skip-next] h-6 w-6 text-white"></span>
        </button>

        <!-- 播放列表 -->
        <PlaylistBubble
          v-model:show="isRecentOpen"
          placement="top-left"
          :offset-x="8"
          :offset-y="10"
        >
          <template #trigger>
            <button
              class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
            >
              <span class="icon-[mdi--playlist-music] h-5 w-5 text-white"></span>
            </button>
          </template>
        </PlaylistBubble>
      </div>

      <!-- 底部控制栏 -->
      <div class="flex w-full max-w-md items-center justify-between">
        <!-- 评论按钮 -->
        <div class="flex items-center gap-2">
          <button
            class="glass-button flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
            @click="isCommentsOpen = true"
          >
            <span class="icon-[mdi--comment-outline] h-5 w-5 text-white/80"></span>
            <span class="text-white/90">{{ commentCount }}</span>
          </button>
        </div>
        <!-- 音量控制 -->
        <div class="flex items-center justify-center space-x-3">
          <button @click="toggleMute" class="flex items-center transition-colors duration-200">
            <span v-if="volume === 0" class="icon-[mdi--volume-off] h-5 w-5 text-white/80"></span>
            <span
              v-else-if="volume < 0.5"
              class="icon-[mdi--volume-medium] h-5 w-5 text-white/80"
            ></span>
            <span v-else class="icon-[mdi--volume-high] h-5 w-5 text-white/80"></span>
          </button>
          <input
            type="range"
            min="0"
            max="100"
            :value="volume * 100"
            @input="handleVolumeChange"
            class="slider h-2 w-20 appearance-none rounded-full bg-white/20 outline-none"
          />
        </div>
      </div>
    </div>

    <!-- 右侧：歌词区域 -->
    <div class="flex w-1/2 flex-col px-12 py-16">
      <div class="flex h-full flex-col p-8">
        <!-- 歌词滚动区域（支持单轨或双轨对照） -->
        <div class="lyrics-container relative flex-1 overflow-hidden">
          <div
            ref="lyricsRef"
            class="lyrics-scroll relative z-20 h-full"
            :style="{ fontSize: state.lyricsScale + 'rem' }"
          >
            <div
              v-for="(line, index) in activeSingleLyrics"
              :key="index"
              class="lyric-line z-50 mb-6 cursor-pointer text-center transition-all duration-500"
              :class="{
                'scale-110 transform text-xl font-semibold text-white': index === currentLyricIndex,
                'text-white/50 hover:text-white/70': index !== currentLyricIndex,
              }"
              @click="seekToLyric(index)"
            >
              {{ line.text }}
            </div>
            <!-- 空白占位，确保最后一句歌词能滚动到中心 -->
            <div class="h-64"></div>
          </div>

          <!-- 中心指示线 -->
          <div
            class="pointer-events-none absolute top-1/2 right-0 left-0 -z-10 h-px bg-linear-to-r from-transparent via-white/30 to-transparent"
          ></div>
        </div>
      </div>
    </div>
  </div>
  <SongCommentsDialog v-model:show="isCommentsOpen" :song-id="currentSong?.id ?? null" />
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

.label-mark {
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.spindle {
  background: radial-gradient(circle at 30% 30%, #c9c9c9, #9a9a9a 60%, #6f6f6f);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.45),
    inset 0 1px 2px rgba(255, 255, 255, 0.35);
}

/* 指针在移动时更自然的微小阴影 */
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

.particle {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(180deg);
  }
}

.sound-wave {
  animation: soundWave 0.8s ease-in-out infinite alternate;
}

@keyframes soundWave {
  0% {
    height: 1rem;
  }
  100% {
    height: 3rem;
  }
}

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
  transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.lyric-line {
  line-height: 1.8;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  white-space: pre-line;
}

.lyric-line:hover {
  background: rgba(255, 255, 255, 0.05);
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* 专辑封面旋转动画 */
.album-wrapper {
  transition: transform 0.3s ease;
}

.album-wrapper:hover {
  transform: scale(1.05);
}

/* 粒子效果增强 */
.particle-container .particle {
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 255, 255, 0.2) 70%,
    transparent 100%
  );
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

/* 歌词高亮效果 */
.lyric-line.scale-110 {
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(139, 92, 246, 0.1));
}

/* 按钮悬停效果增强 */
.glass-button:active {
  transform: scale(0.95);
}

/* 进度条增强样式 */
.progress-bar-thumb {
  transition: all 0.2s ease;
}

.progress-bar-thumb:hover {
  transform: translateX(-50%) translateY(-50%) scale(1.2);
  box-shadow: 0 0 15px rgba(236, 72, 153, 0.6);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .drawer-content {
    flex-direction: column;
  }

  .left-panel,
  .right-panel {
    width: 100%;
  }

  .album-cover {
    width: 16rem;
    height: 16rem;
  }
}

@media (max-width: 768px) {
  .album-cover {
    width: 12rem;
    height: 12rem;
  }

  .lyric-line {
    font-size: 0.875rem;
  }
}
</style>
