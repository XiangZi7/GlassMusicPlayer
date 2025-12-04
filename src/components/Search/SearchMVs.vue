<script setup lang="ts">
import { cloudSearch } from '@/api'
import { formatCount } from '@/utils/time'
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
  playCount: number
}
const state = reactive<{ loading: boolean; results: MVResult[] }>({ loading: false, results: [] })
const { results } = toRefs(state)

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
      playCount: it?.playCount || 0,
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
  <div v-if="results.length > 0" class="custom-scrollbar h-full overflow-y-auto">
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <router-link v-for="mv in results" :key="mv.id" :to="`/mv-player/${mv.id}`" class="group">
        <div class="relative aspect-video overflow-hidden rounded-2xl shadow-xl">
          <LazyImage
            :src="mv.cover + '?param=400y225'"
            :alt="mv.title"
            img-class="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
          />
          <div class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
          <div
            class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
          >
            <span class="icon-[mdi--play] h-3 w-3" />
            {{ formatCount(mv.playCount) }}
          </div>
          <div
            class="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm"
          >
            {{ formatSec(mv.duration) }}
          </div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="flex h-14 w-14 scale-75 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
            >
              <span class="icon-[mdi--play] h-7 w-7 text-white" />
            </div>
          </div>
          <div class="absolute right-0 bottom-0 left-0 p-3">
            <p
              class="truncate text-sm font-medium text-white transition-colors group-hover:text-pink-300"
            >
              {{ mv.title }}
            </p>
            <p class="mt-0.5 truncate text-[11px] text-white/70">{{ mv.artist }}</p>
          </div>
        </div>
      </router-link>
    </div>
  </div>
  <div v-else-if="!keywords" class="flex h-full items-center justify-center">
    <div class="text-center">
      <div class="mb-4 inline-block rounded-full bg-white/5 p-6">
        <span class="icon-[mdi--movie-open-play] text-primary/20 h-12 w-12" />
      </div>
      <p class="text-primary/50">{{ $t('search.enterKeyword') }}</p>
    </div>
  </div>
</template>
