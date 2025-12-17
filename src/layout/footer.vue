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
})
const { showQueue, currentLyricIndex } = toRefs(state)

// 计算可视化器渐变颜色
const visualizerGradient = computed(() => {
  if (state.footerGradient.length === 0) {
    return ['#3b82f6', '#8b5cf6', '#ec4899']
  }
  // 提取渐变中的颜色
  const colors = state.footerGradient.map(color => {
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
  let idx = times.findIndex((time, i) => {
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

watch(currentTime, updateLyricIndex)
watch(
  () => [footerLyrics.value.enabled, currentSong.value?.id],
  ([enabled, id]) => {
    if (enabled) fetchLyrics(id as any)
  },
  { immediate: true }
)

// 监听歌曲变化，提取颜色
watch(
  () => currentSong.value,
  song => {
    if (song?.cover) {
      extractCoverColors(song.cover)
    }
  },
  { immediate: true }
)

// 监听播放状态，控制音频分析
watch(
  isPlaying,
  playing => {
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
        <div
          @click="emit('show')"
          class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg bg-cover transition-all duration-300 hover:scale-105 hover:shadow-lg"
          :style="{
            backgroundImage: currentSong?.cover
              ? `url(${currentSong.cover + '?param=128x128'})`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }"
        ></div>
        <div class="flex min-w-0 flex-col justify-around">
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
          icon="mdi--skip-previous"
          icon-class="size-6"
        />
        <Button
          variant="gradient"
          size="icon-lg"
          rounded="full"
          @click="togglePlay"
          :title="isPlaying ? t('player.pause') : t('player.play')"
          :loading="isLoading"
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
          icon="mdi--skip-next"
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
              icon="mdi--playlist-music"
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
