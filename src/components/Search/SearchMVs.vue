<script setup lang="ts">
import { cloudSearch } from '@/api'

interface Props {
  keywords: string
  limit?: number
  offset?: number
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'loaded', count: number): void
  (e: 'total', count: number): void
}>()

interface MVResult {
  id: number
  title: string
  artist: string
  cover: string
  duration: number
  playCount: string
}
const state = reactive<{ loading: boolean; results: MVResult[] }>({ loading: false, results: [] })
const { loading, results } = toRefs(state)

const formatSec = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

const fetchMVs = async () => {
  const term = props.keywords?.trim()
  if (!term) {
    state.results = []
    return
  }
  try {
    state.loading = true
    const res: any = await cloudSearch({
      keywords: term,
      type: 1004,
      limit: props.limit ?? 24,
      offset: props.offset ?? 0,
    })
    const list: any[] = res?.result?.mvs || []
    state.results = list.map(it => ({
      id: Number(it?.id),
      title: it?.name || it?.title || '',
      artist: it?.artistName || it?.artists?.[0]?.name || '',
      cover: it?.cover || it?.coverImg || it?.picUrl || '',
      duration: Math.floor((it?.duration || 0) / 1000),
      playCount: String(it?.playCount || ''),
    }))
    emit('loaded', state.results.length)
    emit('total', Number(res?.result?.mvCount ?? res?.result?.songCount ?? state.results.length))
  } finally {
    state.loading = false
  }
}
watch(
  [() => props.keywords, () => props.limit, () => props.offset],
  () => {
    fetchMVs()
  },
  { immediate: true }
)
</script>
<template>
  <div
    class="grid h-full grid-cols-1 gap-6 overflow-auto md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <router-link
      v-for="mv in results"
      :key="mv.id"
      :to="`/mv-player/${mv.id}`"
      class="mv-card glass-card group cursor-pointer transition-all duration-500 hover:scale-105 hover:shadow-2xl"
    >
      <div class="relative overflow-hidden rounded-t-2xl">
        <img
          :src="mv.cover + '?param=480y270'"
          alt="mv"
          class="h-full w-full rounded-t-2xl object-cover"
        />
        <div
          class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          <button
            class="glass-button flex h-16 w-16 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <span class="icon-[mdi--play] h-8 w-8 text-white"></span>
          </button>
        </div>
        <div
          class="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-sm text-white backdrop-blur-sm"
        >
          {{ formatSec(mv.duration) }}
        </div>
        <div
          class="absolute top-2 left-2 flex items-center rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm"
        >
          <span class="icon-[mdi--play] mr-1 h-3 w-3"></span>{{ mv.playCount }}
        </div>
      </div>
      <div class="p-4">
        <h3
          class="mb-2 truncate text-lg font-semibold text-white transition-colors group-hover:text-pink-300"
        >
          {{ mv.title }}
        </h3>
        <p class="mb-3 truncate text-sm text-purple-300">{{ mv.artist }}</p>
      </div>
    </router-link>
  </div>
</template>
