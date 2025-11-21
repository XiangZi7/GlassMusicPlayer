<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import { formatDuration } from '@/utils/time'
import { RouterLink } from 'vue-router'

interface Song {
  id?: string | number
  mvId?: string | number
  name: string
  artist: string
  album?: string
  albumId?: string | number
  duration: number
  emoji?: string
  gradient?: string
  liked?: boolean
  cover?: string
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
const router = useRouter()
const { setPlaylist, play, currentSong } = useAudio()

const mapToStoreSong = (s: Song): StoreSong => ({
  id: s.id ?? String(Math.random()),
  name: s.name,
  artist: s.artist,
  album: s.album,
  duration: s.duration,
  emoji: s.emoji,
  gradient: s.gradient,
  liked: s.liked,
  cover: s.cover,
})
  console.log('🚀 ~ file: SongList.vue:65 ~ props.songs:', props.songs)

const playSong = async (song: Song, index: number) => {

  try {
    const playlistMapped: StoreSong[] = props.songs.map(mapToStoreSong)
    setPlaylist(playlistMapped, index)
    play(playlistMapped[index], index)
    emit('play', song, index)
  } catch {}
}

const isCurrent = (s: Song) => {
  const cur = currentSong.value
  if (!cur) return false
  return String(s.id ?? '') === String(cur.id ?? '')
}

const openMV = (song: Song, index: number) => {
  const id = song.mvId || song.id
  if (id) {
    router.push(`/mv-player/${id}`)
  } else {
    emit('mv', song, index)
  }
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
  <div class="flex h-full flex-col overflow-hidden">
    <!-- 操作栏 -->
    <!-- <div v-if="showControls" class="mb-6 flex items-center justify-end">
      <div class="flex items-center space-x-4">
        <button class="text-purple-300 transition-colors hover:text-white" @click="$emit('sort')">
          <span class="icon-[mdi--sort] h-5 w-5"></span>
        </button>
        <button class="text-purple-300 transition-colors hover:text-white" @click="$emit('filter')">
          <span class="icon-[mdi--filter] h-5 w-5"></span>
        </button>
      </div>
    </div> -->

    <div class="glass-card flex flex-1 flex-col overflow-hidden p-4 px-2">
      <!-- 列表头部 -->
      <div
        v-if="showHeader"
        class="mb-4 hidden items-center border-b border-white/10 py-2 text-sm text-purple-300 md:flex"
      >
        <div class="w-12 text-center">#</div>
        <div class="grid min-w-0 flex-1 grid-cols-12 items-center gap-4 px-4">
          <div class="col-span-4">歌曲</div>
          <div class="col-span-3 hidden md:block">歌手</div>
          <div class="col-span-2 hidden text-center md:block">专辑</div>
          <div class="col-span-1 text-right">时长</div>
          <div class="col-span-2 text-center">操作</div>
        </div>
      </div>

      <!-- 歌曲列表 -->
      <div v-if="songs.length > 0" class="h-full space-y-2 overflow-x-hidden overflow-y-auto">
        <div
          v-for="(song, index) in songs"
          :key="song.id || index"
          class="song-item group flex cursor-pointer items-center rounded-lg p-4 transition-all duration-300 hover:bg-white/10"
          :class="isCurrent(song) ? 'bg-white/10' : ''"
          @dblclick="playSong(song, index)"
        >
          <!-- 序号/播放状态 -->
          <div class="w-12 shrink-0 text-center">
            <span v-if="!isCurrent(song)" class="text-purple-300 group-hover:hidden">
              {{ index + 1 }}
            </span>
            <span
              v-if="isCurrent(song)"
              class="icon-[mdi--volume-high] h-5 w-5 animate-pulse text-pink-400"
            ></span>
            <button
              v-if="!isCurrent(song)"
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
                  :src="(song.cover || '') + '?param=90y90'"
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
                <h3 :title="song.name" class="truncate font-medium text-white">{{ song.name }}</h3>
              </div>
            </div>

            <div class="col-span-3 hidden overflow-hidden md:block">
              <RouterLink
                :to="`/artist/${(song.artist || '').split(' / ')[0]}`"
                :title="song.artist"
                class="truncate text-left text-sm text-purple-300 transition-colors hover:text-white"
              >
                {{ song.artist }}
              </RouterLink>
            </div>

            <div class="col-span-2 hidden overflow-hidden text-center md:block">
              <RouterLink
                v-if="song.albumId"
                :to="`/album/${song.albumId}`"
                :title="song.album || '-'"
                class="truncate text-sm text-purple-300 transition-colors hover:text-white"
              >
                {{ song.album || '-' }}
              </RouterLink>
              <span v-else :title="song.album || '-'" class="truncate text-sm text-purple-300">
                {{ song.album || '-' }}
              </span>
            </div>
            <div class="col-span-1 flex items-center justify-end">
              <span class="hidden text-sm text-purple-300 md:inline-block">{{
                formatDuration(song.duration)
              }}</span>
            </div>
            <!-- 操控按钮 -->
            <div class="col-span-2 flex items-center justify-center space-x-2">
              <button
                class="pointer-events-none flex h-9 w-9 translate-y-1 transform items-center justify-center rounded-full text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 hover:bg-white/20"
                @click.stop="playSong(song, index)"
              >
                <span class="icon-[mdi--play-circle] h-6 w-6"></span>
              </button>
              <button
                v-if="song.mvId"
                class="pointer-events-none flex h-9 w-9 translate-y-1 transform items-center justify-center rounded-full text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 hover:bg-white/20"
                @click.stop="openMV(song, index)"
              >
                <span class="icon-[mdi--video-youtube] h-6 w-6"></span>
              </button>
              <button
                v-if="song.id"
                class="pointer-events-none flex h-9 w-9 translate-y-1 transform items-center justify-center rounded-full text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 hover:bg-white/20"
                @click.stop="router.push(`/song/${song.id}`)"
              >
                <span class="icon-[mdi--file-document-outline] h-6 w-6"></span>
              </button>
              <button
                class="pointer-events-none flex h-9 w-9 translate-y-1 transform items-center justify-center rounded-full text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 hover:bg-white/20"
                @click.stop="downloadSong(song, index)"
              >
                <span class="icon-[mdi--download] h-6 w-6"></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="!songs || songs.length === 0"
        class="flex h-full flex-col items-center justify-center py-12 text-center"
      >
        <div class="mb-4 text-6xl">🎵</div>
        <p class="text-lg text-purple-300">{{ emptyMessage || '快来添加一些音乐吧！' }}</p>
      </div>
    </div>
  </div>
</template>
