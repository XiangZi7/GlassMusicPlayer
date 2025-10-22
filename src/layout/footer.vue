<script setup lang="ts">
import PlayerDrawer from '../components/PlayerDrawer.vue'

// 当前播放歌曲
const currentSong = ref({
  title: '夜空中最亮的星',
  artist: '逃跑计划',
  album: '世界',
  duration: '04:12',
  emoji: '🌟',
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
})

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

// 播放器事件处理
const handlePlay = () => {
  console.log('播放')
}

const handlePause = () => {
  console.log('暂停')
}

const handleNext = () => {
  console.log('下一首')
}

const handlePrevious = () => {
  console.log('上一首')
}

const handleVolumeChange = (volume: number) => {
  console.log('音量变化:', volume)
}
</script>
<template>
  <footer class="glass-nav m-4 p-4">
    <div class="flex items-center justify-between">
      <!-- 左侧：当前歌曲信息 -->
      <div class="flex min-w-0 flex-1 items-center space-x-4">
        <div
          @click="openPlayerDrawer"
          class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-br from-pink-400 to-purple-500 transition-all duration-300 hover:scale-105 hover:shadow-lg"
        >
          <span class="text-lg text-white">🎵</span>
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-white">{{ currentSong.title }}</p>
          <p class="truncate text-xs text-purple-300">{{ currentSong.artist }}</p>
        </div>
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--heart-outline] h-5 w-5"></span>
        </button>
      </div>

      <!-- 中间：播放控制 -->
      <div class="flex items-center space-x-4">
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--shuffle] h-5 w-5"></span>
        </button>
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--skip-previous] h-5 w-5"></span>
        </button>
        <button
          class="glass-button flex h-10 w-10 items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600"
        >
          <div
            class="ml-0.5 h-0 w-0 border-y-3 border-l-4 border-y-transparent border-l-white"
          ></div>
        </button>
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--skip-next] h-5 w-5"></span>
        </button>
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--repeat] h-5 w-5"></span>
        </button>
      </div>

      <!-- 右侧：音量和其他控制 -->
      <div class="flex flex-1 items-center justify-end space-x-4">
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--volume-high] h-5 w-5"></span>
        </button>
        <div class="h-1 w-20 overflow-hidden rounded-full bg-white/20">
          <div class="h-full w-2/3 rounded-full bg-gradient-to-r from-pink-400 to-purple-500"></div>
        </div>
        <button class="text-white/70 transition-colors hover:text-white">
          <span class="icon-[mdi--playlist-music] h-5 w-5"></span>
        </button>
      </div>
    </div>
    
    <!-- 播放器抽屉 -->
    <PlayerDrawer
      :is-open="isDrawerOpen"
      :current-song="currentSong"
      @close="closePlayerDrawer"
      @play="handlePlay"
      @pause="handlePause"
      @next="handleNext"
      @previous="handlePrevious"
      @volume-change="handleVolumeChange"
    />
  </footer>
</template>
