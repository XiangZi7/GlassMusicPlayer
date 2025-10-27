<script setup lang="ts">
import PlayerDrawer from '../components/PlayerDrawer.vue'
import { useAudio } from '@/composables/useAudio'

// 使用音频播放器组合式API
const {
  // 状态
  currentSong,
  isPlaying,
  volume,
  playMode,
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

// 抽屉状态
const isDrawerOpen = ref(false)

// 打开播放器抽屉
const openPlayerDrawer = () => {
  isDrawerOpen.value = true
}

// 关闭播放器抽屉
const closePlayerDrawer = () => {
  isDrawerOpen.value = false
}

// 计算播放按钮状态
const playButtonIcon = computed(() => {
  return isPlaying.value ? 'pause' : 'play'
})

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

// 喜欢歌曲状态（临时使用ref，后续可以集成到store中）
const isLiked = ref(false)
const toggleLike = () => {
  isLiked.value = !isLiked.value
}
</script>
<template>
  <footer class="glass-nav m-4 p-4">
    <div class="flex items-center justify-between">
      <!-- 左侧：当前歌曲信息 -->
      <div class="flex min-w-0 flex-1 items-center space-x-4">
        <div
          @click="openPlayerDrawer"
          class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg bg-cover transition-all duration-300 hover:scale-105 hover:shadow-lg"
          :style="{
            backgroundImage: currentSong?.cover
              ? `url(${currentSong.cover})`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }"
        ></div>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-white">
            {{ currentSong?.name || '暂无播放' }}
          </p>
          <p class="truncate text-xs text-purple-300">
            {{ currentSong?.artist || '未知艺术家' }}
          </p>
        </div>
        <button
          @click="toggleLike"
          class="text-white/70 transition-colors hover:text-white"
          :class="{ 'text-pink-400': isLiked }"
        >
          <span
            :class="isLiked ? 'icon-[mdi--heart]' : 'icon-[mdi--heart-outline]'"
            class="h-5 w-5"
          ></span>
        </button>
      </div>

      <!-- 中间：播放控制 -->
      <div class="flex items-center space-x-4">
        <button
          @click="togglePlayMode"
          class="text-white/70 transition-colors hover:text-white"
          :title="playModeText"
        >
          <span :class="playModeIcon" class="h-5 w-5"></span>
        </button>
        <button @click="previous" class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--skip-previous] h-5 w-5"></span>
        </button>
        <button
          @click="togglePlay"
          class="glass-button flex h-10 w-10 items-center justify-center bg-linear-to-r from-pink-500 to-purple-600"
        >
          <div
            v-if="playButtonIcon === 'play'"
            class="ml-0.5 h-0 w-0 border-y-3 border-l-4 border-y-transparent border-l-white"
          ></div>
          <div v-else class="flex space-x-0.5">
            <div class="h-3 w-1 bg-white"></div>
            <div class="h-3 w-1 bg-white"></div>
          </div>
        </button>
        <button @click="next" class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--skip-next] h-5 w-5"></span>
        </button>
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--repeat] h-5 w-5"></span>
        </button>
      </div>

      <!-- 右侧：音量和其他控制 -->
      <div class="flex flex-1 items-center justify-end space-x-4">
        <button @click="toggleMute" class="text-white/70 transition-colors hover:text-white">
          <span :class="volumeIcon" class="h-5 w-5"></span>
        </button>
        <div class="relative h-1 w-20 overflow-hidden rounded-full bg-white/20">
          <div
            class="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500 transition-all duration-200"
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
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--playlist-music] h-5 w-5"></span>
        </button>
      </div>
    </div>

    <!-- 进度条 -->

    <div v-if="currentSong" class="mt-3 flex items-center space-x-3">
      <span class="text-xs text-white/60">{{ formattedCurrentTime }}</span>
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

    <!-- 播放器抽屉 -->
    <PlayerDrawer
      :is-open="isDrawerOpen"
      :current-song="currentSong"
      @close="closePlayerDrawer"
      @play="togglePlay"
      @pause="togglePlay"
      @next="next"
      @previous="previous"
      @volume-change="setVolume"
    />
  </footer>
</template>
