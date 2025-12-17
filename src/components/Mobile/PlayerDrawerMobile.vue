<script setup lang="ts">
// 播放抽屉(移动端)：展示当前歌曲信息与歌词，支持滚动高亮与点击跳转
import { gsap } from 'gsap'
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { commentMusic } from '@/api'
import { useI18n } from 'vue-i18n'
import { getColorPalette } from '@/utils/colorExtractor'
import MusicProgress from '@/components/Ui/MusicProgress.vue'
import VolumeControlMobile from '@/components/Mobile/VolumeControlMobile.vue'
import PlaylistDrawerMobile from '@/components/Mobile/PlaylistDrawerMobile.vue'
import PlaylistCommentsPopup from '@/components/Mobile/PlaylistCommentsPopup.vue'
import Button from '@/components/Ui/Button.vue'

// 国际化文本函数
const { t } = useI18n()
// 抽屉开关（父组件通过 v-model 控制）
const isOpen = defineModel<boolean>()
interface PlayerDrawerState {
  // 抽屉是否渲染
  isRendered: boolean
  // 当前高亮的歌词索引
  currentLyricIndex: number
  // 歌词时间校正偏移（秒）
  lyricsOffset: number
  // 评论弹窗状态
  isCommentsOpen: boolean
  // 评论总数
  commentCount: number
  // 是否使用封面模糊背景
  useCoverBg: boolean
  // 背景层激活标记（A/B）
  bgActive: 'A' | 'B'
  // 背景A层渐变色
  bgAGradient: string[]
  // 背景B层渐变色
  bgBGradient: string[]
  // 是否已定位歌词到居中
  lyricsPositioned: boolean
  // 自动居中开关
  autoScroll: boolean
  // 歌词字号比例
  lyricsScale: number
  // 是否显示歌词
  showLyrics: boolean
  // 是否显示工具栏
  showToolbar: boolean
  // 中心区触摸起点Y
  touchStartY: number | null
  // 歌词拖动起点Y
  lyricDragStartY: number | null
  // 歌词拖动起始时间（秒）
  lyricDragStartTime: number | null
  // 是否正在拖动歌词
  draggingLyrics: boolean
  // 拖动预览时间（秒）
  previewLyricTime: number | null
  // 是否发生了拖动动作
  lyricDragMoved: boolean
}

const state = reactive<PlayerDrawerState>({
  isRendered: false,
  currentLyricIndex: 0,
  lyricsOffset: 0,
  isCommentsOpen: false,
  commentCount: 0,
  // 是否使用封面背景（放大+模糊）
  useCoverBg: true,
  // 背景层管理（A/B双层交替淡入淡出）
  bgActive: 'A' as 'A' | 'B',
  bgAGradient: [] as string[],
  bgBGradient: [] as string[],
  lyricsPositioned: false,
  autoScroll: true,
  lyricsScale: 1,
  // 显示封面 or 歌词
  showLyrics: false,
  // 显示工具栏
  showToolbar: false,
  // 歌词拖动相关状态
  touchStartY: null as number | null,
  lyricDragStartY: null as number | null,
  lyricDragStartTime: null as number | null,
  draggingLyrics: false,
  previewLyricTime: null as number | null,
  lyricDragMoved: false,
})

// 响应式引用（模板中使用）
const {
  isRendered,
  currentLyricIndex,
  showLyrics,
  showToolbar,
  lyricDragMoved,
  previewLyricTime,
  useCoverBg,
  autoScroll,
  lyricsScale,
  isCommentsOpen,
  commentCount,
} = toRefs(state)

// 使用音频播放器
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

// 媒体会话（系统媒体控制集成）在 useAudio 内通过 watch(currentSong) 自动更新

// 模板引用
// 抽屉根节点引用
const drawerRef = useTemplateRef('drawerRef')
// 专辑封面节点（旋转动画目标）
const albumCoverRef = useTemplateRef('albumCoverRef')
// 歌词滚动容器引用
const lyricsRef = useTemplateRef('lyricsRef')
// 背景A层引用
const bgARef = useTemplateRef('bgARef')
// 背景B层引用
const bgBRef = useTemplateRef('bgBRef')

// 生成背景渐变样式
const bgAStyle = computed(() => {
  if (state.bgAGradient.length === 0) return {}
  return {
    backgroundImage: `linear-gradient(135deg, ${state.bgAGradient.join(', ')})`
  }
})

const bgBStyle = computed(() => {
  if (state.bgBGradient.length === 0) return {}
  return {
    backgroundImage: `linear-gradient(135deg, ${state.bgBGradient.join(', ')})`
  }
})

// 歌词封装
// 说明：集中管理歌词的多轨显示与时间轴信息
// - lyricsTrans：翻译文本数组（可选显示）
// - lyricsRoma：罗马音文本数组（可选显示）
// - showTrans：翻译开关（true 显示翻译）
// - showRoma：罗马音开关（true 显示罗马音）
// - activeSingleLyrics：当前实际渲染的歌词行（随开关动态切换）
// - activeTimeline：每句歌词的时间轴，用于定位与高亮
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

// 自动居中开关方法：切换 autoScroll 并在开启时立即居中当前句
const toggleAutoScroll = () => {
  state.autoScroll = !state.autoScroll
  if (state.autoScroll) updateCurrentLyric(true)
}

// 播放/暂停交互方法：调用 togglePlay 切换播放状态
const handleTogglePlay = () => {
  togglePlay()
}

// 显示歌词视图方法：打开歌词并在下一帧居中定位当前句
const handleShowLyricsClick = async () => {
  showLyrics.value = true
  state.lyricsPositioned = false
  await nextTick()
  updateCurrentLyric(true)
}

// 工具函数：格式化秒数为 mm:ss
const formatSeconds = (sec: number | null) => {
  if (sec == null) return ''
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
}

// 预览时间的格式化文本（拖动歌词时在右侧显示）
const formattedPreviewLyricTime = computed(() => formatSeconds(previewLyricTime.value))

// 中心区域触摸开始：记录起点Y用于判定滑动距离
const handleCenterTouchStart = (e: TouchEvent) => {
  state.touchStartY = e.touches?.[0]?.clientY ?? null
}

// 中心区域触摸结束：根据滑动距离切换歌词视图
const handleCenterTouchEnd = async (e: TouchEvent) => {
  const endY = e.changedTouches?.[0]?.clientY ?? null
  if (state.touchStartY == null || endY == null) return
  const dy = endY - state.touchStartY
  state.touchStartY = null
  if (!showLyrics.value && Math.abs(dy) > 30) {
    showLyrics.value = true
    state.lyricsPositioned = false
    await nextTick()
    updateCurrentLyric(true)
  }
}

// 歌词拖动开始：记录起点与当前播放时间，重置预览状态
const handleLyricsTouchStart = (e: TouchEvent) => {
  state.lyricDragStartY = e.touches?.[0]?.clientY ?? null
  state.lyricDragStartTime = currentTime.value
  state.draggingLyrics = true
  previewLyricTime.value = null
  lyricDragMoved.value = false
}

// 歌词拖动移动：超过阈值后计算预览时间（向上/下拖动）
const handleLyricsTouchMove = (e: TouchEvent) => {
  if (!state.draggingLyrics) return
  const y = e.touches?.[0]?.clientY ?? null
  if (state.lyricDragStartY == null || y == null || state.lyricDragStartTime == null) return
  const dy = y - state.lyricDragStartY
  const threshold = 12
  if (Math.abs(dy) < threshold) {
    previewLyricTime.value = null
    return
  }
  lyricDragMoved.value = true
  const sensitivity = -0.06
  const delta = dy * sensitivity
  const base = state.lyricDragStartTime
  const total = activeTimeline.value[activeTimeline.value.length - 1] ?? base
  const nextTime = Math.max(0, Math.min(total, base + delta))
  previewLyricTime.value = nextTime
}

// 歌词拖动结束：如果发生拖动则跳转到预览时间，并重置拖动状态
const handleLyricsTouchEnd = () => {
  if (lyricDragMoved.value && previewLyricTime.value != null) {
    setCurrentTime(previewLyricTime.value)
    updateCurrentLyric(true)
  }
  state.draggingLyrics = false
  state.lyricDragStartY = null
  state.lyricDragStartTime = null
  previewLyricTime.value = null
  lyricDragMoved.value = false
}

// 动画相关
// 专辑封面旋转动画实例（用于启动/停止控制）
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

// 停止封面旋转动画（销毁 tween 实例）
const stopAlbumRotation = () => {
  if (albumRotationTween) {
    albumRotationTween.kill()
    albumRotationTween = null
  }
}

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

const stopBackgroundBreathing = () => {
  bgBreathingTweens.forEach(tween => tween.kill())
  bgBreathingTweens = []
}

// 加载歌曲评论数量方法：根据歌曲ID获取评论总数
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

// 更新当前歌词索引（方法：updateCurrentLyric）
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

// 滚动到当前歌词位置（方法：scrollToCurrentLyric）
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

// 背景封面淡入淡出（方法：setBackground）
const setBackground = async (coverUrl?: string, delay: number = 0) => {
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

// 抽屉动画：打开/关闭过渡（方法：openDrawer/closeDrawer）
const openDrawer = async () => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value, { display: 'flex' })

    const tl = gsap.timeline()
    await nextTick()
    tl.fromTo(
      drawerRef.value,
      { y: '100%', opacity: 0 },
      { y: '0%', opacity: 1, duration: 0.5, ease: 'power3.out' }
    ).fromTo(
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
      y: '100%',
      opacity: 0,
      duration: 0.35,
      ease: 'power3.in',
    })

    stopAlbumRotation()
  }
}

// 监听器：抽屉开关、播放状态、时间进度、当前歌曲
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
      isPlaying.value ? startBackgroundBreathing() : stopBackgroundBreathing()
    } else {
      closeDrawer()
      isPlaying.value ? startAlbumRotation() : stopAlbumRotation()
      stopBackgroundBreathing()
    }
  }
)

// 播放状态控制封面旋转
watch(
  isPlaying,
  playing => {
    playing ? startAlbumRotation() : stopAlbumRotation()
    playing ? startBackgroundBreathing() : stopBackgroundBreathing()
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
  stopBackgroundBreathing()
})

// 播放模式图标计算属性（变量：playModeIcon）
const playModeIcon = computed(() => {
  switch (playMode.value) {
    case 'single':
      return 'icon-[mdi--repeat-once]'
    case 'random':
      return 'icon-[mdi--shuffle]'
    default:
      return 'icon-[mdi--repeat]'
  }
})
</script>

<template>
  <!-- 抽屉容器：仅在 isRendered 为 true 时显示 -->
  <div
    v-if="isRendered"
    ref="drawerRef"
    class="bg-overlay/95 fixed inset-0 z-9999 flex flex-col backdrop-blur-xl"
  >
    <!-- 封面模糊背景（可切换启用） -->
    <div v-show="useCoverBg" class="absolute inset-0 -z-10 overflow-hidden">
      <div
        ref="bgARef"
        class="bg-layer absolute inset-0 opacity-0"
        :style="bgAStyle"
      ></div>
      <div
        ref="bgBRef"
        class="bg-layer absolute inset-0 opacity-0"
        :style="bgBStyle"
      ></div>
      <div class="bg-overlay/30 absolute inset-0"></div>
    </div>

    <!-- 顶部栏：返回、标题、副工具按钮 -->
    <div class="safe-area-top flex items-center justify-between px-4 py-3">
      <Button
        variant="ghost"
        size="icon-lg"
        rounded="full"
        icon="mdi--chevron-down"
        icon-class="h-7 w-7 text-primary/90"
        @click="isOpen = false"
      />

      <div class="flex flex-col items-center">
        <span class="text-primary/50 text-xs">{{ t('player.nowPlaying') }}</span>
      </div>

      <Button
        variant="ghost"
        size="icon-lg"
        rounded="full"
        icon="mdi--dots-horizontal"
        icon-class="h-6 w-6 text-primary/90"
        @click="showToolbar = !showToolbar"
      />
    </div>

    <!-- 工具栏：自动居中、翻译、罗马音、背景、字号、评论 -->
    <div
      v-show="showToolbar"
      class="toolbar-panel fixed top-16 right-4 left-4 z-50 overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md"
    >
      <div class="grid grid-cols-4 gap-1 p-2">
        <Button
          variant="text"
          size="none"
          class="toolbar-btn"
          :class="{ active: autoScroll }"
          icon="mdi--autorenew"
          icon-class="h-5 w-5"
          @click="toggleAutoScroll"
        >
          <span>{{ t('player.autoCenter') }}</span>
        </Button>

        <Button
          variant="text"
          size="none"
          class="toolbar-btn"
          :icon="useCoverBg ? 'icon-[mdi--image]' : 'icon-[mdi--image-off]'"
          icon-class="h-5 w-5"
          @click="useCoverBg = !useCoverBg"
        >
          <span>{{ t('player.bgToggle') }}</span>
        </Button>

        <Button
          variant="text"
          size="none"
          class="toolbar-btn"
          icon="mdi--format-font-size-decrease"
          icon-class="h-5 w-5"
          @click="lyricsScale = Math.max(0.75, lyricsScale - 0.05)"
        >
          <span>{{ t('player.fontDec') }}</span>
        </Button>

        <Button
          variant="text"
          size="none"
          class="toolbar-btn"
          icon="mdi--format-font-size-increase"
          icon-class="h-5 w-5"
          @click="lyricsScale = Math.min(1.5, lyricsScale + 0.05)"
        >
          <span>{{ t('player.fontInc') }}</span>
        </Button>
      </div>
    </div>

    <!-- 中心展示区：封面或歌词 -->
    <div
      class="flex flex-1 flex-col items-center justify-center overflow-hidden px-6"
      @touchstart="handleCenterTouchStart"
      @touchend="handleCenterTouchEnd"
    >
      <div
        v-show="!showLyrics"
        class="album-area flex h-full w-full flex-col items-center justify-center"
        @click.stop="handleShowLyricsClick"
      >
        <div class="album-wrapper relative mb-8">
          <div
            ref="albumCoverRef"
            class="vinyl-disc relative aspect-square w-[65vw] max-w-[280px] overflow-hidden rounded-full shadow-2xl"
          >
            <div
              class="vinyl-label absolute top-1/2 left-1/2 h-[65%] w-[65%] -translate-1/2 rounded-full bg-cover bg-center"
              :style="{
                backgroundImage: currentSong?.cover
                  ? `url(${currentSong.cover+'?param=320x320'})`
                  : 'linear-gradient(135deg, rgba(167,139,250,0.6) 0%, rgba(108,92,231,0.6) 100%)',
              }"
            ></div>
            <div
              class="spindle absolute top-1/2 left-1/2 h-6 w-6 -translate-1/2 rounded-full"
            ></div>
          </div>

          <div
            class="tonearm absolute -top-8 -right-4 z-10 origin-top-left transition-transform duration-500 ease-out"
            :class="isPlaying ? 'rotate-6' : 'rotate-[-18deg]'"
          >
            <div class="arm-pivot relative h-8 w-8 rounded-full"></div>
            <div class="arm-shaft -mt-px h-28 w-2 rounded-full"></div>
            <div class="counterweight -mt-2 ml-2 h-5 w-5 rounded-full"></div>
            <div class="headshell relative mt-0.5 h-6 w-9 rounded-md">
              <div
                class="cartridge absolute top-1/2 left-1/2 h-3 w-6 -translate-x-1/2 -translate-y-1/2 rounded-sm"
              ></div>
              <div class="stylus absolute top-full left-1/2 h-3 w-[2px] -translate-x-1/2"></div>
            </div>
          </div>
        </div>

        <div class="w-full px-6 text-center">
          <h2 class="text-primary line-clamp-1 text-xl font-bold">
            {{ currentSong?.name || t('player.unknownSong') }}
          </h2>
          <p class="text-primary/60 mt-2 line-clamp-1 text-base">
            {{ currentSong?.artist || t('player.unknownArtist') }}
          </p>
        </div>

        <!-- 迷你歌词展示 -->
        <div class="mt-5 flex min-h-12 w-full flex-col items-center justify-center px-4">
          <p
            class="text-primary/80 text-center text-base font-medium transition-all duration-300"
            :class="{ 'opacity-0': !activeSingleLyrics[currentLyricIndex]?.ori }"
          >
            {{ activeSingleLyrics[currentLyricIndex]?.ori || '...' }}
          </p>
          <p
            v-if="showTrans && activeSingleLyrics[currentLyricIndex]?.tran"
            class="text-primary/60 mt-1 text-center text-sm"
          >
            {{ activeSingleLyrics[currentLyricIndex]?.tran }}
          </p>
          <p
            v-if="showRoma && activeSingleLyrics[currentLyricIndex]?.roma"
            class="text-primary/60 mt-1 text-center text-sm"
          >
            {{ activeSingleLyrics[currentLyricIndex]?.roma }}
          </p>
        </div>
      </div>

      <!-- 歌词页顶部信息：歌名与歌手 -->
      <div
        v-show="showLyrics"
        class="z-10 w-full shrink-0 py-4 text-center"
        @click="showLyrics = false"
      >
        <h2 class="text-primary truncate px-4 text-xl font-bold">
          {{ currentSong?.name || t('player.unknownSong') }}
        </h2>
        <p class="text-primary/60 mt-1 truncate px-4 text-sm">
          {{ currentSong?.artist || t('player.unknownArtist') }}
        </p>
      </div>

      <!-- 歌词区域：拖动预览时间、滚动居中、高亮当前句 -->
      <div
        v-show="showLyrics"
        ref="lyricsContainerRef"
        class="lyrics-container relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
        @touchstart="handleLyricsTouchStart"
        @touchmove.prevent="handleLyricsTouchMove"
        @touchend="handleLyricsTouchEnd"
        @click.stop="showLyrics = false"
      >
        <div
          v-if="lyricDragMoved && previewLyricTime !== null"
          class="time-indicator absolute top-1/2 right-4 z-30 -translate-y-1/2 rounded-full bg-white/20 px-3 py-1 text-sm backdrop-blur-sm"
        >
          <span class="text-primary">{{ formattedPreviewLyricTime }}</span>
        </div>
        <div
          ref="lyricsRef"
          class="lyrics-scroll relative z-20 h-auto pt-[30vh]"
          :style="{ fontSize: lyricsScale + 'rem' }"
        >
          <div
            v-for="(line, index) in activeSingleLyrics"
            :key="index"
            class="lyric-line mb-6 px-4 text-center transition-all duration-500"
            :class="{
              'text-primary scale-105 transform font-semibold': index === currentLyricIndex,
              'text-primary/40': index !== currentLyricIndex,
            }"
          >
            <p class="leading-relaxed">{{ line.ori }}</p>
            <p v-if="showTrans && line.tran" class="mt-1 text-sm opacity-80">{{ line.tran }}</p>
            <p v-if="showRoma && line.roma" class="mt-1 text-xs opacity-60">{{ line.roma }}</p>
          </div>
          <div class="h-[40vh]"></div>
        </div>
      </div>
    </div>

    <!-- 底部控制区：进度、播放控制、音量滑块 -->
    <div class="controls-area safe-area-bottom px-6">
      <!-- 快捷操作栏 -->
      <div class="mx-auto flex w-full max-w-xs items-center justify-between px-4">
        <!-- 播放列表和历史播放 -->
        <PlaylistDrawerMobile />
        <!-- 评论 -->
        <div class="relative">
          <Button
            variant="ghost"
            size="none"
            class="group p-2"
            icon="icon-[mdi--message-processing-outline]"
            icon-class="h-6 w-6 text-primary/70 group-hover:text-primary transition-colors"
            @click.stop="isCommentsOpen = true"
          />
          <span
            v-if="commentCount > 0"
            class="pointer-events-none absolute top-2 right-2 flex h-4 min-w-4 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-pink-500 px-1 text-[0.6rem] font-bold text-white shadow-sm"
          >
            {{ commentCount > 999 ? '999+' : commentCount }}
          </span>
        </div>
        <!-- 翻译 -->
        <Button
          v-if="lyricsTrans.length"
          variant="ghost"
          size="none"
          class="p-2"
          icon="mdi--translate"
          :icon-class="['h-6 w-6', { 'text-primary': showTrans }]"
          @click.stop="toggleTransBtn"
        />
        <!-- 罗马音 -->
        <Button
          v-if="lyricsRoma.length"
          variant="ghost"
          size="none"
          class="group p-2"
          icon="mdi--alphabetical"
          :icon-class="[
            'h-6 w-6 text-primary/70 group-hover:text-primary transition-colors',
            { 'text-primary': showRoma },
          ]"
          @click.stop="toggleRomaBtn"
        />
      </div>
      <div v-if="currentSong" class="mb-4">
        <MusicProgress />
        <div class="text-primary/50 mt-2 flex justify-between text-xs">
          <span>{{ formattedCurrentTime }}</span>
          <span>{{ formattedDuration }}</span>
        </div>
      </div>

      <div class="mb-4 flex items-center justify-center gap-6">
        <Button
          variant="ghost"
          size="icon-lg"
          rounded="full"
          class="control-btn"
          :icon="playModeIcon"
          icon-class="text-primary/70 h-7 w-7"
          @click="togglePlayMode"
        />

        <Button
          variant="ghost"
          size="icon-lg"
          rounded="full"
          class="control-btn"
          icon="mdi--skip-previous"
          icon-class="text-primary h-8 w-8"
          @click="previous"
        />

        <Button
          variant="gradient"
          size="icon-lg"
          rounded="full"
          class="play-btn size-16!"
          :class="isLoading ? 'opacity-60' : ''"
          :loading="isLoading"
          :disabled="isLoading"
          :icon="isPlaying ? 'mdi--pause' : 'mdi--play'"
          icon-class="h-8 w-8"
          @click="handleTogglePlay"
        />

        <Button
          variant="ghost"
          size="icon-lg"
          rounded="full"
          class="control-btn"
          icon="mdi--skip-next"
          icon-class="text-primary h-8 w-8"
          @click="next"
        />
        <VolumeControlMobile />
      </div>
    </div>
  </div>
  <!-- 评论弹窗 -->
  <PlaylistCommentsPopup v-model:show="isCommentsOpen" :id="currentSong?.id ?? null" />
</template>

<style scoped>
.safe-area-top {
  padding-top: max(env(safe-area-inset-top), 12px);
}

.safe-area-bottom {
  padding-bottom: max(env(safe-area-inset-bottom), 24px);
}

.bg-layer {
  transform: scale(1.5);
  filter: blur(40px) saturate(1.3);
  transition: filter 0.3s ease;
  will-change: transform, opacity;
}

.vinyl-disc {
  background: radial-gradient(circle at 50% 50%, #1a1a1a 0%, #0a0a0a 60%, #000 100%);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.vinyl-disc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: repeating-radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.04) 0px,
    rgba(255, 255, 255, 0.04) 1px,
    transparent 2px,
    transparent 4px
  );
  pointer-events: none;
}

.vinyl-disc::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
  mix-blend-mode: screen;
  pointer-events: none;
}

.vinyl-label {
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 2px 20px rgba(0, 0, 0, 0.3);
}

.spindle {
  background: radial-gradient(circle at 30% 30%, #d0d0d0, #808080 60%, #505050);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.album-wrapper {
  transition: transform 0.3s ease;
}

.album-wrapper:active {
  transform: scale(0.97);
}

.tonearm {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}

.arm-pivot {
  background: conic-gradient(from 180deg at 50% 50%, #d0d0d0, #b0b0b0, #909090, #d0d0d0);
}

.arm-shaft {
  background: linear-gradient(180deg, #c0c0c0 0%, #a0a0a0 50%, #808080 100%);
}

.counterweight {
  background: radial-gradient(circle at 30% 30%, #a0a0a0, #707070 60%, #505050);
}

.headshell {
  background: linear-gradient(135deg, #606060, #404040);
}

.cartridge {
  background: linear-gradient(180deg, #707070, #404040);
}

.stylus {
  background: linear-gradient(180deg, #d0d0d0, #909090);
}

.lyrics-container {
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 20%,
    black 80%,
    transparent 100%
  );
}

.lyrics-scroll {
  transform: translateY(0);
}

.lyric-line {
  line-height: 1.6;
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.progress-track:active .progress-thumb {
  transform: translateY(-50%) scale(1.3);
}

.control-btn {
  transition: all 0.2s ease;
}

.control-btn:active {
  transform: scale(0.9);
  background: rgba(255, 255, 255, 0.1);
}

.play-btn {
  transition: all 0.2s ease;
}

.play-btn:active {
  transform: scale(0.95);
}

.toolbar-panel {
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toolbar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.625rem;
  transition: all 0.2s ease;
}

.toolbar-btn:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.1);
}

.toolbar-btn.active {
  background: rgba(236, 72, 153, 0.3);
  color: rgb(236, 72, 153);
}

.time-indicator {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
