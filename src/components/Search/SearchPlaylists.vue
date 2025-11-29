<script setup lang="ts">
import { cloudSearch } from '@/api'

interface Props {
  keywords: string
  limit?: number
  offset?: number
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'loaded', count: number): void; (e: 'total', count: number): void }>()

interface PLResult {
  id: number | string
  name: string
  coverImgUrl: string
  trackCount: number
}
const state = reactive<{ loading: boolean; results: PLResult[] }>({ loading: false, results: [] })
const {  results } = toRefs(state)

const fetchPlaylists = async () => {
  const term = props.keywords?.trim()
  if (!term) {
    state.results = []
    return
  }
  try {
    state.loading = true
    const res: any = await cloudSearch({ keywords: term, type: 1000, limit: props.limit ?? 30, offset: props.offset ?? 0 })
    const list: any[] = res?.result?.playlists || []
    state.results = list.map(pl => ({
      id: pl?.id,
      name: pl?.name || '',
      coverImgUrl: pl?.coverImgUrl || '',
      trackCount: pl?.trackCount || 0,
    }))
    emit('loaded', state.results.length)
    emit('total', Number(res?.result?.playlistCount ?? state.results.length))
  } finally {
    state.loading = false
  }
}
watch([() => props.keywords, () => props.limit, () => props.offset], () => { fetchPlaylists() }, { immediate: true })
</script>
<template>
  <div class="h-full overflow-auto grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <router-link v-for="pl in results" :key="pl.id" :to="`/playlist/${pl.id}`" class="group">
      <div
        class="glass-card h-full p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
      >
        <div class="relative mb-3 overflow-hidden rounded-xl">
          <img
            :src="pl.coverImgUrl + '?param=500y500'"
            alt="cover"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          <div
            class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            <button class="glass-button flex h-10 w-10 items-center justify-center">
              <span class="icon-[mdi--play] h-5 w-5 text-primary"></span>
            </button>
          </div>
        </div>
        <h3 class="mb-1 truncate text-sm font-medium text-primary">{{ pl.name }}</h3>
        <p class="truncate text-xs text-primary/50">{{ $t('components.discover.playlistCount', { count: pl.trackCount }) }}</p>
      </div>
    </router-link>
  </div>
</template>
