<script setup lang="ts">
import { topSong } from '@/api'

const types = [
  { key: 0, label: '全部' },
  { key: 7, label: '华语' },
  { key: 96, label: '欧美' },
  { key: 8, label: '日本' },
  { key: 16, label: '韩国' },
]

const state = reactive({ tab: 0 as 0 | 7 | 96 | 8 | 16, loading: true, songs: [] as any[] })

const load = async (t: 0 | 7 | 96 | 8 | 16) => {
  state.loading = true
  try {
    const res = await topSong({ type: t })
    const list = (res as any)?.data?.data || (res as any)?.data?.songs || (res as any)?.songs || []
    state.songs = list.map((it: any, i: number) => ({
      id: it?.id || 0,
      name: it?.name || '',
      artist: Array.isArray(it?.artists) ? it.artists.map((a: any) => a.name).join(' / ') : '',
      album: it?.album?.name || '',
      duration: it?.duration || 0,
      emoji: ['🎵','🎶','♪','♫','🎼'][i % 5],
      gradient: ['from-pink-400 to-purple-500'][0],
      liked: false,
      cover: it?.album?.picUrl || '',
    }))
  } finally {
    state.loading = false
  }
}

onMounted(() => load(state.tab))
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div class="sticky top-0 z-10 glass-nav pb-3 pt-2">
      <div class="flex items-center gap-2">
        <button v-for="t in types" :key="t.key" class="rounded-md px-3 py-1 text-sm" :class="state.tab===t.key ? 'text-primary' : 'text-primary/60'" @click="state.tab=t.key; load(state.tab)">{{ t.label }}</button>
      </div>
    </div>
    <div v-if="state.loading" class="py-6"><PageSkeleton :sections="['list']" :list-count="10" /></div>
    <div v-else>
      <HotSongsMobile :songs="state.songs" />
    </div>
  </div>
</template>
