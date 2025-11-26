<script setup lang="ts">
import { formatTime } from '@/utils/audioUtils'
import { useAudio } from '@/composables/useAudio'
import { Song } from '@/stores/interface'
import LazyImage from '@/components/Ui/LazyImage.vue'

const props = withDefaults(defineProps<{ songs: Song[]; context?: 'queue' | 'generic' }>(), {
  context: 'generic',
})

const { playByIndex, queueNext, removeSong, addSong, playlist } = useAudio()

const handlePlay = (i: number, s: Song) => {
  if (props.context === 'queue') {
    playByIndex(i)
  } else {
    addSong(s as any)
    const idx = playlist.value.findIndex((p: any) => p.id === s.id)
    playByIndex(idx >= 0 ? idx : Math.max(0, playlist.value.length - 1))
  }
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
        <LazyImage
          :src="song.cover + '?param=200y200'"
          alt="cover"
          imgClass="h-full w-full object-cover"
        />
        {{ song.cover }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-primary truncate text-sm font-medium">{{ song.name }}</p>
        <p class="text-primary/70 truncate text-xs">{{ song.artist }}</p>
      </div>
      <span class="text-primary/70 text-[11px]">{{ formatDuration(song.duration) }}</span>
      <div class="flex items-center gap-3">
        <button
          class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
          title="播放"
          @click.stop="handlePlay(i, song)"
        >
          <span class="icon-[mdi--play] text-primary h-4 w-4"></span>
        </button>
        <button
          class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
          title="下一首"
          @click.stop="queueNext(song.id as any)"
        >
          <span class="icon-[mdi--skip-next] text-primary h-4 w-4"></span>
        </button>
        <template v-if="context === 'queue'">
          <button
            class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
            title="删除"
            @click.stop="removeSong(song.id as any)"
          >
            <span class="icon-[mdi--delete] text-primary h-4 w-4"></span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
