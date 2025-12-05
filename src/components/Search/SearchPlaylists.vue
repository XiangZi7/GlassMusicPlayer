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

interface PLResult {
  id: number | string
  name: string
  coverImgUrl: string
  trackCount: number
  playCount: number
  creator: string
}
const state = reactive<{ loading: boolean; results: PLResult[] }>({ loading: false, results: [] })
const { results } = toRefs(state)

const fetchPlaylists = async () => {
  const term = props.keywords?.trim()
  if (!term) {
    state.results = []
    return
  }
  try {
    state.loading = true
    const res: any = await cloudSearch({
      keywords: term,
      type: 1000,
      limit: props.limit ?? 30,
      offset: props.offset ?? 0,
    })
    const list: any[] = res?.result?.playlists || []
    state.results = list.map(pl => ({
      id: pl?.id,
      name: pl?.name || '',
      coverImgUrl: pl?.coverImgUrl || '',
      trackCount: pl?.trackCount || 0,
      playCount: pl?.playCount || 0,
      creator: pl?.creator?.nickname || '',
    }))
    emit('loaded', state.results.length)
    emit('total', Number(res?.result?.playlistCount ?? state.results.length))
  } finally {
    state.loading = false
  }
}
watch(
  [() => props.keywords, () => props.limit, () => props.offset],
  () => {
    fetchPlaylists()
  },
  { immediate: true }
)
</script>
<template>
  <div v-if="results.length > 0" class="custom-scrollbar h-full overflow-y-auto">
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      <router-link v-for="pl in results" :key="pl.id" :to="`/playlist/${pl.id}`" class="group">
        <div class="relative aspect-square overflow-hidden rounded-2xl shadow-lg">
          <LazyImage
            :src="pl.coverImgUrl + '?param=300y300'"
            alt="cover"
            img-class="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
          />
          <div class="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
          <div
            class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
          >
            <span class="icon-[mdi--headphones] h-3 w-3" />
            {{ formatCount(pl.playCount) }}
          </div>
          <div class="absolute right-0 bottom-0 left-0 p-2.5">
            <p class="line-clamp-2 text-xs leading-tight font-medium text-white">{{ pl.name }}</p>
            <div class="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/70">
              <span class="icon-[mdi--music-note] h-3 w-3" />
              <span>{{ $t('commonUnits.songsShort', pl.trackCount) }}</span>
            </div>
          </div>
          <div
            class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-all duration-300 group-hover:opacity-100"
          >
            <div
              class="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-xl"
            >
              <span class="icon-[mdi--play] h-6 w-6 text-pink-500" />
            </div>
          </div>
        </div>
        <div class="mt-2 px-1">
          <p class="text-primary/50 mt-0.5 truncate text-xs">{{ pl.creator }}</p>
        </div>
      </router-link>
    </div>
  </div>
  <div v-else-if="!keywords" class="flex h-full items-center justify-center">
    <div class="text-center">
      <div class="mb-4 inline-block rounded-full bg-white/5 p-6">
        <span class="icon-[mdi--playlist-music] text-primary/20 h-12 w-12" />
      </div>
      <p class="text-primary/50">{{ $t('search.enterKeyword') }}</p>
    </div>
  </div>
</template>
