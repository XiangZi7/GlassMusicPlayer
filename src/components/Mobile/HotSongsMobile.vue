<script setup lang="ts">
import { formatTime } from '@/utils/audioUtils'
import { useAudio } from '@/composables/useAudio'

type SongItem = {
  id: number | string
  name: string
  artist: string
  album: string
  duration: number
  emoji: string
  gradient: string
  liked: boolean
  cover: string
}

const props = defineProps<{ songs: SongItem[] }>()

const { play } = useAudio()

const toSong = (s: SongItem) => ({
  id: s.id,
  name: s.name,
  artist: s.artist,
  album: s.album,
  duration: Math.floor((s.duration || 0) / 1000),
  cover: s.cover,
  emoji: s.emoji,
  gradient: s.gradient,
  liked: s.liked,
})

const formatDuration = (ms: number) => formatTime(Math.floor((ms || 0) / 1000))
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(song, i) in songs"
      :key="song.id ?? i"
      class="glass-card flex items-center gap-3 p-3"
      @click="play(toSong(song))"
    >
      <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <img v-if="song.cover" :src="song.cover + '?param=200y200'" alt="cover" class="h-full w-full object-cover" />
        <div v-else class="flex h-full w-full items-center justify-center rounded-lg bg-linear-to-br" :class="song.gradient">
          <span class="text-lg">{{ song.emoji }}</span>
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-white">{{ song.name }}</p>
        <p class="truncate text-xs text-purple-300">{{ song.artist }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button class="glass-button flex h-8 w-8 items-center justify-center rounded-full">
          <span class="icon-[mdi--play] h-4 w-4 text-white"></span>
        </button>
        <span class="text-[11px] text-white/70">{{ formatDuration(song.duration) }}</span>
      </div>
    </div>
  </div>
</template>

