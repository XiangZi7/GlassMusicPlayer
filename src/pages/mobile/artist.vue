<script setup lang="ts">
import { cloudSearch } from '@/api'
import { useAudio } from '@/composables/useAudio'

const route = useRoute()
const kw = computed(() => String(route.params.name || ''))

const state = reactive({ loading: true, songs: [] as any[] })
const { play } = useAudio()

const load = async (q: string) => {
  state.loading = true
  try {
    const res = await cloudSearch({ keywords: q, type: 1, limit: 30 })
    const list = (res as any)?.result?.songs || []
    state.songs = list.map((s: any, i: number) => ({
      id: s?.id || 0,
      name: s?.name || '',
      artist: Array.isArray(s?.ar)
        ? s.ar.map((a: any) => a.name).join(' / ')
        : Array.isArray(s?.artists)
          ? s.artists.map((a: any) => a.name).join(' / ')
          : '',
      album: s?.al?.name || s?.album?.name || '',
      duration: s?.dt ?? s?.duration ?? 0,
      emoji: ['🎵', '🎶', '♪', '♫', '🎼'][i % 5],
      gradient: ['from-pink-400 to-purple-500'][0],
      liked: false,
      cover: s?.al?.picUrl || s?.album?.picUrl || '',
    }))
  } finally {
    state.loading = false
  }
}

onMounted(() => {
  if (kw.value) load(kw.value)
})
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div class="mb-3 text-sm text-primary/80">搜索歌手：{{ kw }}</div>
    <div v-if="state.loading" class="py-6">
      <PageSkeleton :sections="['list']" :list-count="10" />
    </div>
    <div v-else>
      <HotSongsMobile :songs="state.songs" />
    </div>
  </div>
</template>
