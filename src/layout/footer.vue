<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { useSettingsStore } from '@/stores/modules/settings'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 使用音频播放器组合式API
const {
  // 状态
  currentSong,
  isPlaying,
  isLoading,
  volume,
  currentTime,
  formattedCurrentTime,
  formattedDuration,
  progress,
  playModeIcon,
  playModeText,

  // 播放控制
  togglePlay,
  next,
  previous,

  // 播放模式控制
  togglePlayMode,

  // 音量控制
  setVolume,
  toggleMute,

  // 进度控制
  setProgress,
} = useAudio()

const state = reactive({
  // 播放列表
  showQueue: false,
  // 当前歌词索引
  currentLyricIndex: 0,
})
const { showQueue, currentLyricIndex } = toRefs(state)

const { mergedLines, activeTimeline, fetchLyrics } = useLyrics()
const settingsStore = useSettingsStore()
const { footerLyrics } = storeToRefs(settingsStore)

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

const emit = defineEmits(['show'])

// 音量图标
const volumeIcon = computed(() => {
  if (volume.value === 0) return 'icon-[mdi--volume-off]'
  if (volume.value < 0.3) return 'icon-[mdi--volume-low]'
  if (volume.value < 0.7) return 'icon-[mdi--volume-medium]'
  return 'icon-[mdi--volume-high]'
})

// 处理音量滑块变化
const handleVolumeSliderChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newVolume = parseFloat(target.value) / 100
  setVolume(newVolume)
}

// 处理进度条点击
const handleProgressClick = (event: MouseEvent) => {
  const progressBar = event.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const progressPercent = (clickX / rect.width) * 100
  setProgress(Math.max(0, Math.min(100, progressPercent)))
}
</script>
<template>
  <footer class="glass-nav m-4 p-4">
    <div class="flex items-center justify-between">
      <!-- 左侧：当前歌曲信息 -->
      <div class="flex min-w-0 flex-1 space-x-4">
        <div
          @click="emit('show')"
          class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg bg-cover transition-all duration-300 hover:scale-105 hover:shadow-lg"
          :style="{
            backgroundImage: currentSong?.cover
              ? `url(${currentSong.cover})`
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
        <button
          @click="togglePlayMode"
          class="text-primary/70 transition-colors hover:text-primary"
          :title="playModeText"
        >
          <span :class="playModeIcon" class="h-6 w-6"></span>
        </button>
        <button @click="previous" class="text-primary/70 transition-colors hover:text-primary">
          <span class="icon-[mdi--skip-previous] h-6 w-6"></span>
        </button>
        <button
          @click="togglePlay"
          :title="isPlaying ? t('player.pause') : t('player.play')"
          class="glass-button flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-r from-pink-500 to-purple-600 shadow-sm transition-transform hover:scale-105"
        >
          <span v-if="isLoading" class="icon-[mdi--loading] h-6 w-6 animate-spin text-primary"></span>
          <span
            v-else
            :class="isPlaying ? 'icon-[mdi--pause]' : 'icon-[mdi--play]'"
            class="h-6 w-6 text-primary"
          ></span>
        </button>
        <button @click="next" class="text-primary/70 transition-colors hover:text-primary">
          <span class="icon-[mdi--skip-next] h-6 w-6"></span>
        </button>
        <button class="text-primary/70 transition-colors hover:text-primary">
          <span class="icon-[mdi--repeat] h-6 w-6"></span>
        </button>
      </div>

      <!-- 右侧：音量和其他控制 -->
      <div class="relative flex flex-1 items-center justify-end space-x-4">
        <button
          @click="toggleMute"
          class="flex items-center text-primary/70 transition-colors hover:text-primary"
        >
          <span :class="volumeIcon" class="h-6 w-6"></span>
        </button>
        <div class="relative h-1 w-20 overflow-hidden rounded-full bg-white/20">
          <div
            class="h-full rounded-full bg-linear-to-r from-pink-400 to-purple-500 transition-all duration-200"
            :style="{ width: `${volume * 100}%` }"
          ></div>
          <input
            type="range"
            min="0"
            max="100"
            :value="volume * 100"
            @input="handleVolumeSliderChange"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <PlaylistBubble v-model:show="showQueue" placement="top-right" :offset-y="25">
          <template #trigger>
            <button class="flex items-center text-primary/70 transition-colors hover:text-primary">
              <span class="icon-[mdi--playlist-music] h-6 w-6"></span>
            </button>
          </template>
        </PlaylistBubble>
      </div>
    </div>

    <!-- 进度条 -->

    <div v-if="currentSong" class="mt-3 flex items-center space-x-3">
      <span class="text-primary/60 text-xs">{{
        isLoading ? t('player.loading') : formattedCurrentTime
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
      <span class="text-primary/60 text-xs">{{ formattedDuration }}</span>
    </div>
  </footer>
</template>
