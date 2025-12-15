<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import type { Song } from '@/stores/interface'
import { formatDuration } from '@/utils/time'
import { RouterLink, useRouter } from 'vue-router'
import LazyImage from '@/components/Ui/LazyImage.vue'
import Button from '@/components/Ui/Button.vue'
import { useI18n } from 'vue-i18n'

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
const { setPlaylist, play, currentSong, isPlaying } = useAudio()
const { t } = useI18n()

const playSong = async (song: Song, index: number) => {
  try {
    setPlaylist(props.songs, index)
    play(props.songs[index], index)
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
/* 歌曲项悬停效果 - 移除位移，改用更平滑的背景过渡 */
.song-item {
  transition: all 0.2s ease;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .song-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
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
    <div class="glass-card flex flex-1 flex-col overflow-hidden p-2">
      <!-- 列表头部 -->
      <div
        v-if="showHeader"
        class="text-primary/60 mb-2 hidden items-center border-b border-white/5 py-3 text-xs font-medium tracking-wider uppercase md:flex"
      >
        <div class="w-14 text-center">#</div>
        <div class="grid min-w-0 flex-1 grid-cols-12 items-center gap-4 px-4">
          <div class="col-span-4">{{ t('components.songList.headers.song') }}</div>
          <div class="col-span-3 hidden md:block">
            {{ t('components.songList.headers.artist') }}
          </div>
          <div class="col-span-2 hidden text-center md:block">
            {{ t('components.songList.headers.album') }}
          </div>
          <div class="col-span-1 text-right">{{ t('components.songList.headers.duration') }}</div>
          <div class="col-span-2 text-center">{{ t('components.songList.headers.actions') }}</div>
        </div>
      </div>

      <!-- 歌曲列表 -->
      <div
        v-if="songs.length > 0"
        class="custom-scrollbar h-full space-y-1 overflow-x-hidden overflow-y-auto pr-2"
      >
        <div
          v-for="(song, index) in songs"
          :key="song.id || index"
          class="song-item group flex cursor-pointer items-center rounded-xl p-2 hover:bg-white/10"
          :class="isCurrent(song) ? 'bg-white/10' : ''"
          @dblclick="playSong(song, index)"
        >
          <!-- 序号/播放状态 -->
          <div class="flex w-14 shrink-0 items-center justify-center text-center">
            <span
              v-if="!isCurrent(song)"
              class="text-primary/60 text-sm font-medium group-hover:hidden"
            >
              {{ index + 1 }}
            </span>
            <div v-if="isCurrent(song)" class="playing-icon">
              <span class="bar" :class="{ animate: isPlaying }"></span>
              <span class="bar" :class="{ animate: isPlaying }"></span>
              <span class="bar" :class="{ animate: isPlaying }"></span>
            </div>
            <Button
              v-if="!isCurrent(song)"
              variant="text"
              size="none"
              class="hidden! transition-colors group-hover:block! hover:text-pink-400"
              @click.stop="playSong(song, index)"
            >
              <span class="icon-[mdi--play] h-6 w-6"></span>
            </Button>
          </div>

          <div class="grid min-w-0 flex-1 grid-cols-12 items-center gap-4">
            <div class="col-span-4 flex items-center space-x-4">
              <div
                class="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg shadow-md transition-shadow group-hover:shadow-lg"
              >
                <LazyImage
                  :src="(song.cover || '') + '?param=90y90'"
                  :alt="t('components.songList.coverAlt')"
                  imgClass="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  wrapperClass="h-full w-full"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                ></div>
              </div>
              <div class="min-w-0 flex-1">
                <h3
                  :title="song.name"
                  class="text-primary truncate text-base font-medium transition-colors group-hover:text-pink-300"
                >
                  {{ song.name }}
                </h3>
                <div class="mt-0.5 flex items-center gap-2 md:hidden">
                  <span class="text-primary/60 truncate text-xs">{{ song.artist }}</span>
                </div>
              </div>
            </div>

            <div class="col-span-3 hidden overflow-hidden md:block">
              <template v-if="song.artists && song.artists.length > 0">
                <span class="text-primary/80 truncate text-sm">
                  <template v-for="(ar, idx) in song.artists" :key="ar.id">
                    <RouterLink
                      :to="`/artist/${ar.id}`"
                      :title="ar.name"
                      class="transition-colors hover:text-pink-400"
                    >
                      {{ ar.name }}
                    </RouterLink>
                    <span v-if="idx < song.artists.length - 1" class="text-primary/50"> / </span>
                  </template>
                </span>
              </template>
              <template v-else-if="song.artistId">
                <RouterLink
                  :to="`/artist/${song.artistId}`"
                  :title="song.artist"
                  class="text-primary/80 truncate text-sm transition-colors hover:text-pink-400"
                >
                  {{ song.artist }}
                </RouterLink>
              </template>
              <span v-else :title="song.artist" class="text-primary/80 truncate text-sm">
                {{ song.artist }}
              </span>
            </div>

            <div class="col-span-2 hidden overflow-hidden text-center md:block">
              <RouterLink
                v-if="song.albumId"
                :to="`/album/${song.albumId}`"
                :title="song.album || '-'"
                class="text-primary/60 hover:text-primary truncate text-sm transition-colors"
              >
                {{ song.album || '-' }}
              </RouterLink>
              <span v-else :title="song.album || '-'" class="text-primary/60 truncate text-sm">
                {{ song.album || '-' }}
              </span>
            </div>
            <div class="col-span-1 flex items-center justify-end">
              <span class="text-primary/50 hidden font-mono text-sm md:inline-block">{{
                formatDuration(song.duration)
              }}</span>
            </div>
            <!-- 操控按钮 -->
            <div
              class="col-span-2 flex items-center justify-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            >
              <Button
                v-if="song.mvId"
                variant="ghost"
                size="icon-md"
                rounded="full"
                class="h-9 w-9"
                icon="mdi--movie-open-play"
                iconClass="h-5 w-5"
                :title="t('common.playMV')"
                @click.stop="openMV(song, index)"
              />
              <Button
                v-if="song.id"
                variant="ghost"
                size="icon-md"
                rounded="full"
                class="h-9 w-9"
                icon="mdi--information-outline"
                iconClass="h-5 w-5"
                :title="t('common.detail')"
                @click.stop="router.push(`/song/${song.id}`)"
              />
              <Button
                variant="ghost"
                size="icon-md"
                rounded="full"
                class="h-9 w-9"
                icon="mdi--tray-arrow-down"
                iconClass="h-5 w-5"
                :title="t('common.download')"
                @click.stop="downloadSong(song, index)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="!songs || songs.length === 0"
        class="flex h-full flex-col items-center justify-center py-12 text-center"
      >
        <div class="mb-6 rounded-full bg-white/5 p-6">
          <span class="icon-[mdi--music-note-off] text-primary/20 h-12 w-12"></span>
        </div>
        <p class="text-primary/60 text-lg font-medium">
          {{ emptyMessage || t('components.songList.empty') }}
        </p>
      </div>
    </div>
  </div>
</template>
