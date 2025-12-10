<script setup lang="ts">
import LazyImage from '@/components/Ui/LazyImage.vue'
import { useAudio } from '@/composables/useAudio'
import type { Song } from '@/stores/interface'

type ListVariant = 'compact' | 'card'

interface Props {
  songs: Song[]
  variant?: ListVariant
  showIndex?: boolean
  context?: 'queue' | 'generic'
}
const { playByIndex, addSong, playlist } = useAudio()

const props = withDefaults(defineProps<Props>(), {
  variant: 'compact',
  showIndex: true,
  context: 'generic',
})

const emit = defineEmits<{
  play: [song: Song, index: number]
}>()

const { currentSong, isPlaying } = useAudio()

const isCurrent = (s: Song) => {
  const cur = currentSong.value
  if (!cur) return false
  return String(s.id) === String(cur.id)
}

const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const handleClick = (s: Song, i: number) => {
  if (props.context === 'queue') {
    playByIndex(i)
  } else {
    addSong(s as any)
    const idx = playlist.value.findIndex((p: any) => p.id === s.id)
    playByIndex(idx >= 0 ? idx : Math.max(0, playlist.value.length - 1))
  }
}
</script>

<template>
  <div v-if="variant === 'card'" class="space-y-2">
    <div
      v-for="(song, index) in songs"
      :key="song.id + '-' + index"
      class="group flex items-center gap-3 rounded-2xl p-3 transition-all duration-300"
      :class="isCurrent(song) ? 'song-item-active' : ''"
      @click="handleClick(song, index)"
    >
      <div class="song-cover relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <LazyImage
          v-if="song.cover"
          :src="song.cover + '?param=200y200'"
          alt="cover"
          imgClass="h-full w-full object-cover"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center bg-linear-to-br from-pink-500/30 to-purple-600/30"
        >
          <span class="icon-[mdi--music-note] h-6 w-6 opacity-60" />
        </div>
        <div
          v-if="isCurrent(song)"
          class="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <span
            class="text-primary h-6 w-6"
            :class="isPlaying ? 'icon-[mdi--pause] animate-pulse' : 'icon-[mdi--play]'"
          />
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <p
          class="song-name truncate text-sm font-medium"
          :class="isCurrent(song) ? 'text-pink-400' : ''"
        >
          {{ song.name }}
        </p>
        <p class="song-artist mt-0.5 truncate text-xs">
          {{ song.artist }}<template v-if="song.album"> - 《{{ song.album }}》</template>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span class="song-duration text-xs">{{ formatDuration(song.duration) }}</span>
        <div v-if="isCurrent(song)" class="playing-icon">
          <span class="bar" :class="{ animate: isPlaying }"></span>
          <span class="bar" :class="{ animate: isPlaying }"></span>
          <span class="bar" :class="{ animate: isPlaying }"></span>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="overflow-hidden py-2">
    <div
      v-for="(song, index) in songs"
      :key="song.id"
      class="song-item-compact group flex items-center gap-3 rounded-xl p-2.5 transition-all duration-200"
      :class="isCurrent(song) ? 'song-item-active' : ''"
      @click="handleClick(song, index)"
    >
      <div v-if="showIndex" class="w-6 shrink-0 text-center">
        <div v-if="isCurrent(song)" class="playing-icon">
          <span class="bar" :class="{ animate: isPlaying }"></span>
          <span class="bar" :class="{ animate: isPlaying }"></span>
          <span class="bar" :class="{ animate: isPlaying }"></span>
        </div>
        <span
          v-else
          class="song-index text-xs font-bold"
          :class="index < 3 ? 'text-pink-400' : ''"
          >{{ index + 1 }}</span
        >
      </div>
      <div class="song-cover-small relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
        <LazyImage
          v-if="song.cover"
          :src="song.cover + '?param=100y100'"
          alt="cover"
          imgClass="h-full w-full object-cover"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center bg-linear-to-br from-pink-500/30 to-purple-600/30"
        >
          <span class="icon-[mdi--music-note] h-5 w-5 opacity-50" />
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <p
          class="song-name truncate text-sm font-medium"
          :class="isCurrent(song) ? 'text-pink-400' : ''"
        >
          {{ song.name }}
        </p>
        <p class="song-artist mt-0.5 truncate text-xs">
          {{ song.artist }}<template v-if="song.album"> - 《{{ song.album }}》</template>
        </p>
      </div>
      <span class="song-duration shrink-0 text-xs">{{ formatDuration(song.duration) }}</span>
    </div>
  </div>
</template>

<style scoped>
.song-item {
  background: var(--glass-hover-item-bg);
}

.song-item:active:not(.song-item-active) {
  background: var(--glass-bg-button);
}

.song-item-active {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
}

:root.dark .song-item-active,
html.dark .song-item-active {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.25), rgba(139, 92, 246, 0.25));
}

.song-item-compact:not(.song-item-active):active {
  background: var(--glass-hover-item-bg);
}

.song-cover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:root.dark .song-cover,
html.dark .song-cover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.song-cover-small {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:root.dark .song-cover-small,
html.dark .song-cover-small {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.song-name {
  color: var(--glass-text);
}

.song-artist {
  color: var(--glass-text);
  opacity: 0.5;
}

.song-duration {
  color: var(--glass-text);
  opacity: 0.3;
}

.song-index {
  color: var(--glass-text);
  opacity: 0.3;
}
</style>
