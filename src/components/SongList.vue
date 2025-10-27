<template>
  <div class="song-list">
    <!-- 操作栏 -->
    <div v-if="showControls" class="mb-6 flex items-center justify-end">
      <div class="flex items-center space-x-4">
        <button class="text-purple-300 hover:text-white transition-colors" @click="$emit('sort')">
          <span class="icon-[mdi--sort] h-5 w-5"></span>
        </button>
        <button class="text-purple-300 hover:text-white transition-colors" @click="$emit('filter')">
          <span class="icon-[mdi--filter] h-5 w-5"></span>
        </button>
      </div>
    </div>

    <div class="glass-card p-6">
      <!-- 列表头部 -->
      <div v-if="showHeader" class="hidden md:flex items-center px-4 py-2 text-sm text-purple-300 border-b border-white/10 mb-4">
        <div class="w-12 text-center">#</div>
        <div class="flex-1 min-w-0 px-4">歌曲</div>
        <div class="w-32 text-center">专辑</div>
        <div class="w-24 text-center">时长</div>
        <div class="w-20 text-center">操作</div>
      </div>

      <!-- 歌曲列表 -->
      <div class="space-y-2">
        <div 
          v-for="(song, index) in songs" 
          :key="song.id || index"
          class="song-item group flex items-center p-4 rounded-lg cursor-pointer transition-all duration-300 hover:bg-white/10"
          :class="currentPlayingIndex === index ? 'bg-white/10' : ''"
          @click="playSong(song, index)"
        >
          <!-- 序号/播放状态 -->
          <div class="w-12 shrink-0 text-center">
            <span 
              v-if="currentPlayingIndex !== index"
              class="text-purple-300 group-hover:hidden"
            >
              {{ index + 1 }}
            </span>
            <span 
              v-if="currentPlayingIndex === index"
              class="icon-[mdi--volume-high] w-5 h-5 text-pink-400 animate-pulse"
            ></span>
            <button 
              v-if="currentPlayingIndex !== index"
              class="hidden group-hover:block text-white hover:text-pink-400 transition-colors"
              @click.stop="playSong(song, index)"
            >
              <span class="icon-[mdi--play] w-5 h-5"></span>
            </button>
          </div>

          <!-- 歌曲信息 -->
          <div class="flex-1 min-w-0 px-4">
            <div class="flex items-center space-x-3">
              <!-- 封面 -->
              <div class="relative flex-shrink-0">
                <div 
                  class="w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-lg transition-transform duration-300 group-hover:scale-110"
                  :class="song.gradient || 'from-purple-400 to-pink-500'"
                >
                  {{ song.emoji || '🎵' }}
                </div>
                <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg">
                  <span class="icon-[mdi--play] w-4 h-4 text-white"></span>
                </div>
              </div>
              
              <!-- 歌名和歌手 -->
              <div class="min-w-0 flex-1">
                <h3 class="text-white font-medium truncate">{{ song.name }}</h3>
                <p class="text-purple-300 text-sm truncate">{{ song.artist }}</p>
              </div>
            </div>
          </div>

          <!-- 专辑 (桌面端显示) -->
          <div class="hidden md:block w-32 text-center">
            <span class="text-purple-300 text-sm truncate">{{ song.album || '-' }}</span>
          </div>

          <!-- 时长 -->
          <div class="w-24 text-center">
            <span class="text-purple-300 text-sm">{{ song.duration }}</span>
          </div>

          <!-- 操作按钮 -->
          <div class="w-20 flex items-center justify-center space-x-2">
            <button 
              class="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white text-purple-300"
              @click.stop="toggleLike(song, index)"
            >
              <span 
                class="w-4 h-4"
                :class="song.liked ? 'icon-[mdi--heart] text-red-400' : 'icon-[mdi--heart-outline]'"
              ></span>
            </button>
            <button 
              class="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white text-purple-300"
              @click.stop="showMoreOptions(song, index)"
            >
              <span class="icon-[mdi--dots-horizontal] w-4 h-4"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!songs || songs.length === 0" class="text-center py-12">
        <div class="text-6xl mb-4">🎵</div>
        <p class="text-purple-300 text-lg">暂无歌曲</p>
        <p class="text-purple-400 text-sm mt-2">{{ emptyMessage || '快来添加一些音乐吧！' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Song {
  id?: string | number
  name: string
  artist: string
  album?: string
  duration: string
  emoji?: string
  gradient?: string
  liked?: boolean
}

interface Props {
  songs: Song[]
  currentPlayingIndex?: number
  showHeader?: boolean
  showControls?: boolean
  emptyMessage?: string
}

interface Emits {
  (e: 'play', song: Song, index: number): void
  (e: 'like', song: Song, index: number): void
  (e: 'more', song: Song, index: number): void
  (e: 'sort'): void
  (e: 'filter'): void
}

const props = withDefaults(defineProps<Props>(), {
  currentPlayingIndex: -1,
  showHeader: true,
  showControls: true,
  emptyMessage: ''
})

const emit = defineEmits<Emits>()

// 播放歌曲
const playSong = (song: Song, index: number) => {
  emit('play', song, index)
}

// 切换喜欢状态
const toggleLike = (song: Song, index: number) => {
  emit('like', song, index)
}

// 显示更多选项
const showMoreOptions = (song: Song, index: number) => {
  emit('more', song, index)
}
</script>

<style scoped>
/* 歌曲项悬停效果 */
.song-item:hover {
  transform: translateX(4px);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .song-item {
    flex-direction: column;
    align-items: flex-start;
    space-y: 2;
  }
  
  .song-item .w-12,
  .song-item .w-24,
  .song-item .w-20 {
    width: auto;
  }
}
</style>