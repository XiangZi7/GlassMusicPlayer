<script setup lang="ts">
import { topSong } from '@/api'

import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const types = [
  { key: 0, labelKey: 'charts.types.all' },
  { key: 7, labelKey: 'charts.types.mandarin' },
  { key: 96, labelKey: 'charts.types.west' },
  { key: 8, labelKey: 'charts.types.japan' },
  { key: 16, labelKey: 'charts.types.korea' },
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
      emoji: ['🎵', '🎶', '♪', '♫', '🎼'][i % 5],
      gradient: ['from-pink-400 to-purple-500'][0],
      liked: false,
      cover: it?.album?.picUrl || '',
    }))
  } finally {
    state.loading = false
  }
}

onMounted(() => load(state.tab))

const handleTabClick = (t: any) => {
  state.tab = t
  load(t)
}
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div class="glass-nav sticky top-0 z-10 pt-2 pb-3">
      <div class="glass-nav sticky top-0 z-10 pt-2 pb-3">
        <div class="flex items-center gap-2">
          <button
            v-for="type in types"
            :key="type.key"
            class="rounded-md px-3 py-1 text-sm"
            :class="state.tab === type.key ? 'text-primary' : 'text-primary/60'"
            @click="handleTabClick(type.key)"
          >
            {{ t(type.labelKey) }}
          </button>
        </div>
      </div>
      <div v-if="state.loading" class="py-6">
        <PageSkeleton :sections="['list']" :list-count="10" />
      </div>
      <div v-if="state.loading" class="py-6">
        <PageSkeleton :sections="['list']" :list-count="10" />
      </div>
      <div v-else>
        <HotSongsMobile :songs="state.songs" />
      </div>
    </div>
  </div>
</template>
