<script setup lang="ts">
import { formatTime } from '@/utils/audioUtils'
import { useAudio } from '@/composables/useAudio'
import { Song, PlayMode } from '@/stores/interface'

const props = withDefaults(defineProps<{ songs: Song[]; context?: 'queue' | 'generic' }>(), {
  context: 'generic',
})

const { play, playByIndex, queueNext, removeSong } = useAudio()

const toSong = (s: Song) => ({
  id: s.id,
  name: s.name,
  artist: s.artist,
  album: s.album,
  duration: Math.floor((s.duration || 0) / 1000),
  cover: s.cover,
})

const handlePlay = (i: number, s: Song) => {
  if (props.context === 'queue') playByIndex(i)
  else play(toSong(s))
}

const formatDuration = (ms: number) => formatTime(Math.floor((ms || 0) / 1000))
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(song, i) in songs"
      :key="song.id ?? i"
      class="glass-card flex items-center gap-3 p-3"
    >
      <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <img
          v-if="song.cover"
          :src="song.cover + '?param=200y200'"
          alt="cover"
          class="h-full w-full object-cover"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center rounded-lg bg-linear-to-br"
          :class="song.gradient"
        >
          <span class="text-lg">{{ song.emoji }}</span>
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-white">{{ song.name }}</p>
        <p class="truncate text-xs text-purple-300">{{ song.artist }}</p>
      </div>
      <span class="text-[11px] text-white/70">{{ formatDuration(song.duration) }}</span>
      <div class="flex items-center gap-3">
        <button
          class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
          title="播放"
          @click.stop="handlePlay(i, song)"
        >
          <span class="icon-[mdi--play] h-4 w-4 text-(--glass-text)"></span>
        </button>
        <button
          class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
          title="下一首"
          @click.stop="queueNext(song.id as any)"
        >
          <span class="icon-[mdi--skip-next] h-4 w-4 text-(--glass-text)"></span>
        </button>
        <button
          class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
          title="删除"
          @click.stop="removeSong(song.id as any)"
        >
          <span class="icon-[mdi--delete] h-4 w-4 text-(--glass-text)"></span>
        </button>
      </div>
    </div>
  </div>
</template>
