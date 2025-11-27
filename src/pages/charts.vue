<script setup lang="ts">
import SongList from '@/components/SongList.vue'
import { topSong } from '@/api'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const state = reactive({
  activeType: 0 as 0 | 7 | 96 | 8 | 16,
  songs: [] as any[],
  isLoading: false,
})
const { activeType } = toRefs(state)


const types = [
  { key: 0, labelKey: 'charts.types.all' },
  { key: 7, labelKey: 'charts.types.mandarin' },
  { key: 96, labelKey: 'charts.types.west' },
  { key: 8, labelKey: 'charts.types.japan' },
  { key: 16, labelKey: 'charts.types.korea' },
]

const load = async () => {
  try {
    state.isLoading = true
    const res: any = await topSong({ type: activeType.value })
    const list: any[] = res?.data?.data || res?.data?.songs || res?.songs || res?.data || []
    state.songs = list.map((it: any) => ({
      id: it?.id,
      name: it?.name,
      artist: Array.isArray(it?.artists) ? it.artists.map((a: any) => a.name).join(' / ') : '',
      album: it?.album?.name || '',
      albumId: it?.album?.id,
      duration: it?.duration || 0,
      cover: it?.album?.picUrl || '',
    }))
  } finally {
    state.isLoading = false
  }
}

watch(activeType, () => load())
onMounted(() => load())
</script>

<template>
  <div class="flex-1 overflow-hidden text-white">
    <div class="h-full overflow-auto p-6">
      <div class="mb-4 flex items-center gap-2">
        <div class="glass-nav inline-flex gap-2 rounded-2xl p-2">
          <button
            v-for="type in types"
            :key="type.key"
            class="glass-button px-4 py-2 text-sm"
            :class="activeType === type.key ? 'bg-white/25 text-white ring-1 ring-pink-300/40' : 'text-white/80'"
            @click="activeType = type.key as any"
          >
            {{ t(type.labelKey) }}
          </button>
        </div>
      </div>
      <PageSkeleton v-if="state.isLoading" :sections="['list']" :list-count="12" />
      <SongList v-else :songs="state.songs" :current-playing-index="-1" :show-header="true" />
    </div>
  </div>
</template>
