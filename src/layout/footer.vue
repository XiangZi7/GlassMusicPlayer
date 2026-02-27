<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { useSettingsStore } from '@/stores/modules/settings'
import { useAudioStore } from '@/stores/modules/audio'
import MusicProgress from '@/components/Ui/MusicProgress.vue'
import VolumeControl from '@/components/Ui/VolumeControl.vue'
import Button from '@/components/Ui/Button.vue'
import AudioVisualizer from '@/components/Ui/AudioVisualizer.vue'
import PlaylistBubble from '@/components/Ui/PlaylistBubble.vue'
import { useAudioAnalyser } from '@/composables/useAudioAnalyser'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { getColorPalette } from '@/utils/colorExtractor'
import { adaptColorsForTheme } from '@/utils/colorThemeAdapter'
import { gsap } from 'gsap'

const { t } = useI18n()
const audioStore = useAudioStore()

// 使用音频播放器组合式API
const {
  // 状态
  currentSong,
  isPlaying,
  isLoading,
  currentTime,
  formattedCurrentTime,
  formattedDuration,
  playModeIcon,
  playModeText,

  // 播放控制
  togglePlay,
  next,
  previous,

  // 播放模式控制
  togglePlayMode,
} = useAudio()

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

const state = reactive({
  // 播放列表
  showQueue: false,
  // 当前歌词索引
  currentLyricIndex: 0,
  // 背景渐变颜色
  footerGradient: [] as string[],
  // 封面翻转状态
  isFlipping: false,
  // 当前显示的封面（用于翻转动画）
  displayCover: '' as string,
  // 前一个封面（用于翻转动画）
  prevCover: '' as string,
})
const { showQueue, currentLyricIndex } = toRefs(state)

// 封面容器引用
const coverRef = ref<HTMLElement | null>(null)
const coverFrontRef = ref<HTMLElement | null>(null)
const coverBackRef = ref<HTMLElement | null>(null)

// 计算可视化器渐变颜色
const visualizerGradient = computed(() => {
  if (state.footerGradient.length === 0) {
    return ['#3b82f6', '#8b5cf6', '#ec4899']
  }
  // 提取渐变中的颜色
  const colors = state.footerGradient.map((color: string) => {
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

// 提取封面颜色
const extractCoverColors = async (coverUrl?: string) => {
  if (!coverUrl) return
  try {
    const palette = await getColorPalette(coverUrl + '?param=128x128')
    state.footerGradient = palette.gradient
  } catch (error) {
    console.error('Failed to extract footer colors:', error)
  }
}

const { mergedLines, activeTimeline, fetchLyrics } = useLyrics()
const settingsStore = useSettingsStore()
const { footerLyrics, audioVisualizer } = storeToRefs(settingsStore)

const updateLyricIndex = () => {
  const times = activeTimeline.value
  if (!times.length) {
    state.currentLyricIndex = 0
    return
  }
  const t = currentTime.value
  let idx = times.findIndex((time: number, i: number) => {
    const next = times[i + 1]
    return t >= time && (next === undefined || t < next)
  })
  if (idx === -1) {
    if (t < times[0]) idx = 0
    else if (t >= times[times.length - 1]) idx = times.length - 1
    else idx = times.findIndex(time => time > t)
  }
  if (idx !== -1) state.currentLyricIndex = idx
}

// 封面翻转动画
const flipCover = (newCover: string) => {
  if (!coverRef.value || state.isFlipping || !state.displayCover) {
    state.displayCover = newCover
    return
  }

  state.isFlipping = true
  state.prevCover = state.displayCover

  // 创建翻转动画
  const tl = gsap.timeline({
    onComplete: () => {
      state.isFlipping = false
      state.prevCover = ''
    },
  })

  // 翻转到背面
  tl.to(coverRef.value, {
    rotateY: 90,
    scale: 0.9,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      state.displayCover = newCover
    },
  })

  // 翻转回正面
  tl.to(coverRef.value, {
    rotateY: 0,
    scale: 1,
    duration: 0.3,
    ease: 'back.out(1.5)',
  })
}

watch(currentTime, updateLyricIndex)
watch(
  () => [footerLyrics.value.enabled, currentSong.value?.id],
  ([enabled, id]) => {
    if (enabled) fetchLyrics(id as any)
  },
  { immediate: true }
)

// 监听歌曲变化，提取颜色并触发翻转动画
watch(
  () => currentSong.value,
  (song, oldSong) => {
    if (song?.cover) {
      extractCoverColors(song.cover)
      // 只有当歌曲真正变化时才触发翻转
      if (oldSong && oldSong.id !== song.id) {
        flipCover(song.cover)
      } else if (!state.displayCover) {
        state.displayCover = song.cover
      }
    }
  },
  { immediate: true }
)

// 监听播放状态，控制音频分析
watch(
  isPlaying,
  (playing: any) => {
    if (playing && audioVisualizer.value.enabledInFooter) {
      if (isAnalyserInitialized.value) {
        startAnalyser()
        resumeAnalyser()
      }
    } else {
      stopAnalyser()
    }
  },
  { immediate: true }
)

// 初始化音频分析器
onMounted(() => {
  const audioElement = audioStore.audio.audio
  if (audioElement && !isAnalyserInitialized.value) {
    initAnalyser(audioElement)
  }
})

// 监听音频元素变化
watch(
  () => audioStore.audio.audio,
  audioElement => {
    if (audioElement && !isAnalyserInitialized.value) {
      initAnalyser(audioElement)
      if (isPlaying.value && audioVisualizer.value.enabledInFooter) {
        startAnalyser()
        resumeAnalyser()
      }
    }
  }
)

onUnmounted(() => {
  stopAnalyser()
})

const emit = defineEmits(['show'])
</script>
<template>
  <footer class="glass-nav relative m-4 overflow-hidden p-4">
    <!-- 音频可视化器背景 -->
    <div
      v-if="isAnalyserInitialized && audioVisualizer.enabledInFooter"
      class="absolute bottom-0 w-full left-0 -z-10 opacity-30"
    >
      <AudioVisualizer
        :frequency-data="frequencyData"
        :time-domain-data="timeDomainData"
        type="bars"
        :bar-count="64"
        :bar-width="3"
        :bar-gap="2"
        :gradient-colors="visualizerGradient"
        :height="80"
      />
    </div>

    <div class="relative z-10 flex items-center justify-between">
      <!-- 左侧：当前歌曲信息 -->
      <div class="flex min-w-0 flex-1 space-x-4">
        <!-- 封面容器 - 3D 翻转效果 -->
        <div class="cover-container" style="perspective: 800px;">
          <div
            ref="coverRef"
            id="footer-cover"
            @click="emit('show')"
            class="cover-inner flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg bg-cover shadow-lg transition-shadow duration-300 hover:shadow-xl"
            :class="{ 'animate-pulse-subtle': isPlaying }"
            :style="{
              backgroundImage: state.displayCover
                ? `url(${state.displayCover + '?param=128x128'})`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }"
          >
            <!-- 播放状态指示器 -->
            <div
              v-if="isPlaying"
              class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20 opacity-0 transition-opacity hover:opacity-100"
            >
              <div class="flex items-end gap-0.5 h-4">
                <span class="w-1 bg-white rounded-full animate-equalizer-1"></span>
                <span class="w-1 bg-white rounded-full animate-equalizer-2"></span>
                <span class="w-1 bg-white rounded-full animate-equalizer-3"></span>
              </div>
            </div>
          </div>
        </div>
        <div id="footer-song-info" class="flex min-w-0 flex-col justify-around">
          <p class="text-primary truncate text-sm font-medium">
            {{ currentSong?.name || t('player.unknownSong') }}
          </p>
          <p class="text-primary/80 truncate text-xs">
            {{ currentSong?.artist || t('player.unknownArtist') }}
          </p>
        </div>
        <div
          v-if="footerLyrics.enabled && mergedLines.length"
          class="flex min-w-0 flex-col justify-around"
        >
          <template v-for="mode in footerLyrics.modes" :key="mode">
            <p v-if="mode === 'original'" class="text-primary/80 truncate text-sm">
              {{ mergedLines[currentLyricIndex]?.ori || '' }}
            </p>
            <p v-else-if="mode === 'trans'" class="text-primary/70 truncate text-xs">
              {{ mergedLines[currentLyricIndex]?.tran || '' }}
            </p>
            <p v-else-if="mode === 'roma'" class="text-primary/70 truncate text-xs">
              {{ mergedLines[currentLyricIndex]?.roma || '' }}
            </p>
          </template>
        </div>
      </div>

      <!-- 中间：播放控制 -->
      <div class="flex items-center space-x-4">
        <Button
          variant="text"
          size="none"
          @click="previous"
          icon="icon-[mdi--skip-previous]"
          icon-class="size-6"
        />
        <Button
          variant="gradient"
          size="icon-lg"
          rounded="full"
          @click="togglePlay"
          :title="isPlaying ? t('player.pause') : t('player.play')"
          :loading="isLoading"
          :pulse="true"
          :press3d="true"
        >
          <span
            v-if="!isLoading"
            :class="isPlaying ? 'icon-[mdi--pause]' : 'icon-[mdi--play]'"
            class="text-primary h-6 w-6"
          ></span>
        </Button>
        <Button
          variant="text"
          size="none"
          @click="next"
          icon="icon-[mdi--skip-next]"
          icon-class="size-6"
        />
        <Button
          variant="text"
          :icon="playModeIcon"
          icon-class="size-6"
          size="none"
          @click="togglePlayMode"
          :title="playModeText"
        />
      </div>

      <!-- 右侧：音量和其他控制 -->
      <div class="relative flex flex-1 items-center justify-end space-x-4">
        <VolumeControl />
        <PlaylistBubble v-model:show="showQueue" placement="top-right" :offset-y="20">
          <template #trigger>
            <Button
              variant="text"
              size="none"
              icon="icon-[mdi--playlist-music]"
              icon-class="size-6"
              class="text-primary/70 hover:text-primary flex items-center transition-colors"
            >
            </Button>
          </template>
        </PlaylistBubble>
      </div>
    </div>

    <!-- 进度条 -->
    <div v-if="currentSong" class="relative z-10 mt-3 flex items-center space-x-3">
      <span class="text-primary/60 text-xs">{{
        isLoading ? t('player.loading') : formattedCurrentTime
      }}</span>
      <MusicProgress class="flex-1" />
      <span class="text-primary/60 text-xs">{{ formattedDuration }}</span>
    </div>
  </footer>
</template>

<style scoped>
/* 封面容器 */
.cover-container {
  position: relative;
}

.cover-inner {
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform;
}

/* 播放时微微脉动 */
@keyframes pulse-subtle {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.2);
  }
  50% {
    box-shadow: 0 4px 20px rgba(236, 72, 153, 0.35);
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}

/* 音频均衡器动画 */
@keyframes equalizer-1 {
  0%, 100% { height: 4px; }
  50% { height: 16px; }
}

@keyframes equalizer-2 {
  0%, 100% { height: 8px; }
  50% { height: 12px; }
}

@keyframes equalizer-3 {
  0%, 100% { height: 6px; }
  50% { height: 14px; }
}

.animate-equalizer-1 {
  animation: equalizer-1 0.5s ease-in-out infinite;
}

.animate-equalizer-2 {
  animation: equalizer-2 0.5s ease-in-out infinite 0.1s;
}

.animate-equalizer-3 {
  animation: equalizer-3 0.5s ease-in-out infinite 0.2s;
}
</style>
