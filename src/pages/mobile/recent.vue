<script setup lang="ts">
import { recordRecentSong } from '@/api'
import { useAudio } from '@/composables/useAudio'
import LazyImage from '@/components/Ui/LazyImage.vue'

const state = reactive({
  loading: true,
  songs: [] as Array<{ id: number | string; name: string; artist: string; album: string; duration: number; cover: string }>,
})

const { play } = useAudio()

const load = async () => {
  try {
    const res = await recordRecentSong({ limit: 50 })
    const list = (res as any)?.data || (res as any)?.songs || []
    state.songs = list.map((it: any) => ({
      id: it?.song?.id || it?.id || 0,
      name: it?.song?.name || it?.name || '',
      artist: Array.isArray(it?.song?.ar) ? it.song.ar.map((a: any) => a.name).join(' / ') : '',
      album: it?.song?.al?.name || '',
      duration: it?.song?.dt ?? 0,
      cover: it?.song?.al?.picUrl || '',
    }))
  } finally {
    state.loading = false
  }
}

onMounted(load)

const playSong = (s: any) => play({ id: s.id, name: s.name, artist: s.artist, album: s.album, duration: Math.floor((s.duration || 0) / 1000), cover: s.cover }, 0)
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div v-if="state.loading" class="py-6"><PageSkeleton :sections="['list']" :list-count="10" /></div>
    <div v-else class="space-y-3">
      <div v-for="s in state.songs" :key="s.id" class="glass-card flex items-center gap-3 p-3" @click="playSong(s)">
        <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
          <LazyImage v-if="s.cover" :src="s.cover+'?param=200y200'" alt="cover" imgClass="h-full w-full object-cover" />
          <div v-else class="flex h-full w-full items-center justify-center rounded-lg bg-white/10">🎵</div>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-white">{{ s.name }}</p>
          <p class="truncate text-xs text-purple-300">{{ s.artist }}</p>
        </div>
        <span class="icon-[mdi--play] h-5 w-5 text-primary/80"></span>
      </div>
    </div>
  </div>
</template>
