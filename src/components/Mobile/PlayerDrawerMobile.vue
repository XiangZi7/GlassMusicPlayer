<script setup lang="ts">
// 播放抽屉(移动端)：展示当前歌曲信息与歌词，支持滚动高亮与点击跳转
import { gsap } from 'gsap'
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { useLyricsScroll } from '@/composables/useLyricsScroll'
import { useGradientBackground } from '@/composables/useGradientBackground'
import { useCommentCount } from '@/composables/useCommentCount'
import { useI18n } from 'vue-i18n'
import MusicProgress from '@/components/Ui/MusicProgress.vue'
import VolumeControlMobile from '@/components/Mobile/VolumeControlMobile.vue'
import PlaylistDrawerMobile from '@/components/Mobile/PlaylistDrawerMobile.vue'
import PlaylistCommentsPopup from '@/components/Mobile/PlaylistCommentsPopup.vue'
import Button from '@/components/Ui/Button.vue'
import VinylDisc from '@/components/Player/VinylDisc.vue'

// 国际化文本函数
const { t } = useI18n()
// 抽屉开关（父组件通过 v-model 控制）
const isOpen = defineModel<boolean>()

// 模板引用
const drawerRef = useTemplateRef('drawerRef')
const lyricsRef = useTemplateRef('lyricsRef')
const bgARef = useTemplateRef('bgARef')
const bgBRef = useTemplateRef('bgBRef')

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
  fetchLyrics,
} = useLyrics()

// 歌词滚动
const {
  currentIndex: currentLyricIndex,
  positioned: lyricsPositioned,
  autoScroll,
  scale: lyricsScale,
  updateCurrentLyric,
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

// 本地状态
const state = reactive({
  isRendered: false,
  isCommentsOpen: false,
  showLyrics: false,
  showToolbar: false,
  // 触摸相关
  touchStartY: null as number | null,
  lyricDragStartY: null as number | null,
  lyricDragStartTime: null as number | null,
  draggingLyrics: false,
  previewLyricTime: null as number | null,
  lyricDragMoved: false,
})

const {
  isRendered,
  showLyrics,
  showToolbar,
  lyricDragMoved,
  previewLyricTime,
  isCommentsOpen,
} = toRefs(state)

// 切换翻译/罗马音
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

const handleShowLyricsClick = async () => {
  showLyrics.value = true
  lyricsPositioned.value = false
  await nextTick()
  updateCurrentLyric(true)
}

// 时间格式化
const formatSeconds = (sec: number | null) => {
  if (sec == null) return ''
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
}

const formattedPreviewLyricTime = computed(() => formatSeconds(previewLyricTime.value))

// 触摸事件处理
const handleCenterTouchStart = (e: TouchEvent) => {
  state.touchStartY = e.touches?.[0]?.clientY ?? null
}

const handleCenterTouchEnd = async (e: TouchEvent) => {
  const endY = e.changedTouches?.[0]?.clientY ?? null
  if (state.touchStartY == null || endY == null) return
  const dy = endY - state.touchStartY
  state.touchStartY = null
  if (!showLyrics.value && Math.abs(dy) > 30) {
    showLyrics.value = true
    lyricsPositioned.value = false
    await nextTick()
    updateCurrentLyric(true)
  }
}

const handleLyricsTouchStart = (e: TouchEvent) => {
  state.lyricDragStartY = e.touches?.[0]?.clientY ?? null
  state.lyricDragStartTime = currentTime.value
  state.draggingLyrics = true
  previewLyricTime.value = null
  lyricDragMoved.value = false
}

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

// 抽屉动画
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
      startBackgroundBreathing()
    } else {
      stopBackgroundBreathing()
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
    setBackgroundGradient(s?.cover)
  },
  { immediate: true }
)

onMounted(() => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value as any, { display: 'none' })
  }
})

// 播放模式图标
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
        icon="icon-[mdi--chevron-down]"
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
        icon="icon-[mdi--dots-horizontal]"
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
          icon="icon-[mdi--autorenew]"
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
          icon="icon-[mdi--format-font-size-decrease]"
          icon-class="h-5 w-5"
          @click="decreaseScale(0.05, 0.75)"
        >
          <span>{{ t('player.fontDec') }}</span>
        </Button>

        <Button
          variant="text"
          size="none"
          class="toolbar-btn"
          icon="icon-[mdi--format-font-size-increase]"
          icon-class="h-5 w-5"
          @click="increaseScale(0.05, 1.5)"
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
        <VinylDisc
          ref="vinylDiscRef"
          :cover="currentSong?.cover"
          :is-playing="isPlaying"
          :is-loading="isLoading"
          size="md"
          class="mb-8"
        />

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
          icon="icon-[mdi--translate]"
          :icon-class="['h-6 w-6', { 'text-primary': showTrans }]"
          @click.stop="toggleTransBtn"
        />
        <!-- 罗马音 -->
        <Button
          v-if="lyricsRoma.length"
          variant="ghost"
          size="none"
          class="group p-2"
          icon="icon-[mdi--alphabetical]"
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
          icon="icon-[mdi--skip-previous]"
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
          icon="icon-[mdi--skip-next]"
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
