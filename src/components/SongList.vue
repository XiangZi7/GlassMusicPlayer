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
  coverImgUrl?: string
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
  (e: 'mv', song: Song, index: number): void
  (e: 'download', song: Song, index: number): void
}

const props = withDefaults(defineProps<Props>(), {
  currentPlayingIndex: -1,
  showHeader: true,
  showControls: true,
  emptyMessage: '',
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

const openMV = (song: Song, index: number) => {
  emit('mv', song, index)
}

const downloadSong = (song: Song, index: number) => {
  emit('download', song, index)
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
<template>
  <div class="song-list h-full overflow-x-hidden">
    <!-- 操作栏 -->
    <div v-if="showControls" class="mb-6 flex items-center justify-end">
      <div class="flex items-center space-x-4">
        <button class="text-purple-300 transition-colors hover:text-white" @click="$emit('sort')">
          <span class="icon-[mdi--sort] h-5 w-5"></span>
        </button>
        <button class="text-purple-300 transition-colors hover:text-white" @click="$emit('filter')">
          <span class="icon-[mdi--filter] h-5 w-5"></span>
        </button>
      </div>
    </div>

    <div class="glass-card h-full p-6">
      <!-- 列表头部 -->
      <div
        v-if="showHeader"
        class="mb-4 hidden items-center border-b border-white/10 px-4 py-2 text-sm text-purple-300 md:flex"
      >
        <div class="w-12 text-center">#</div>
        <div class="min-w-0 flex-1 px-4">歌曲</div>
        <div class="w-32 text-center">专辑</div>
        <div class="w-24 text-center">时长</div>
        <div class="w-20 text-center">操作</div>
      </div>

      <!-- 歌曲列表 -->
      <div class="h-full space-y-2 overflow-x-hidden overflow-y-auto">
        <div
          v-for="(song, index) in songs"
          :key="song.id || index"
          class="song-item group flex cursor-pointer items-center rounded-lg p-4 transition-all duration-300 hover:bg-white/10"
          :class="currentPlayingIndex === index ? 'bg-white/10' : ''"
          @click="playSong(song, index)"
        >
          <!-- 序号/播放状态 -->
          <div class="w-12 shrink-0 text-center">
            <span v-if="currentPlayingIndex !== index" class="text-purple-300 group-hover:hidden">
              {{ index + 1 }}
            </span>
            <span
              v-if="currentPlayingIndex === index"
              class="icon-[mdi--volume-high] h-5 w-5 animate-pulse text-pink-400"
            ></span>
            <button
              v-if="currentPlayingIndex !== index"
              class="hidden text-white transition-colors group-hover:block hover:text-pink-400"
              @click.stop="playSong(song, index)"
            >
              <span class="icon-[mdi--play] h-5 w-5"></span>
            </button>
          </div>

          <div class="grid min-w-0 flex-1 grid-cols-12 items-center gap-4 px-4">
            <div class="col-span-4 flex items-center space-x-3">
              <div class="relative shrink-0">
                <img
                  :src="song.coverImgUrl + '?param=90y90'"
                  alt="封面"
                  class="h-12 w-12 rounded-lg object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                >
                  <span class="icon-[mdi--play] h-4 w-4 text-white"></span>
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="truncate font-medium text-white">{{ song.name }}</h3>
              </div>
            </div>

            <div class="col-span-3 hidden overflow-hidden md:block">
              <p class="truncate text-sm text-purple-300">{{ song.artist }}</p>
            </div>

            <div class="col-span-2 hidden overflow-hidden text-center md:block">
              <span class="truncate text-sm text-purple-300">{{ song.album || '-' }}</span>
            </div>
            <div class="col-span-1 flex items-center justify-end">
              <span class="hidden text-sm text-purple-300 md:inline-block">{{
                song.duration
              }}</span>
            </div>
            <!-- 操控按钮 -->
            <div class="col-span-2 flex items-center justify-center space-x-2">
              <button
                class="cursor-pointer text-purple-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                @click.stop="playSong(song, index)"
              >
                <span class="icon-[mdi--play-circle] h-7 w-7"></span>
              </button>
              <button
                class="cursor-pointer text-purple-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                @click.stop="openMV(song, index)"
              >
                <span class="icon-[mdi--filmstrip] h-7 w-7"></span>
              </button>
              <button
                class="cursor-pointer text-purple-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                @click.stop="downloadSong(song, index)"
              >
                <span class="icon-[mdi--download] h-7 w-7"></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!songs || songs.length === 0" class="py-12 text-center">
        <div class="mb-4 text-6xl">🎵</div>
        <p class="text-lg text-purple-300">暂无歌曲</p>
        <p class="mt-2 text-sm text-purple-400">{{ emptyMessage || '快来添加一些音乐吧！' }}</p>
      </div>
    </div>
  </div>
</template>
