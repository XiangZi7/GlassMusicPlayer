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

interface SongResult {
  id: number | string
  name: string
  artist: string
  artistId?: number | string
  album: string
  albumId?: number | string
  duration: number
  cover: string
}

interface SongsState {
  results: SongResult[]
}

const state = reactive<SongsState>({ results: [] })
const { results } = toRefs(state)

const fetchSongs = async () => {
  const term = props.keywords?.trim()
  if (!term) {
    state.results = []
    return
  }
  const res: any = await cloudSearch({
    keywords: term,
    type: 1,
    limit: props.limit ?? 40,
    offset: props.offset ?? 0,
  })
  const list: any[] = res?.result?.songs || []
  state.results = list.map(it => ({
    id: it?.id,
    name: it?.name || '',
    artist: Array.isArray(it?.artists || it?.ar)
      ? (it?.artists || it?.ar).map((a: any) => a.name).join(' / ')
      : '',
    artistId: Array.isArray(it?.artists || it?.ar) && (it?.artists || it?.ar)[0]?.id
      ? (it?.artists || it?.ar)[0].id
      : undefined,
    album: it?.album?.name || it?.al?.name || '',
    albumId: it?.album?.id || it?.al?.id,
    duration: it?.duration ?? it?.dt ?? 0,
    cover: it?.album?.picUrl || it?.al?.picUrl || '',
  }))
  emit('loaded', state.results.length)
  emit('total', Number(res?.result?.songCount ?? state.results.length))
}

watch(
  [() => props.keywords, () => props.limit, () => props.offset],
  () => {
    fetchSongs()
  },
  { immediate: true }
)
</script>
<template>
  <SongList :songs="results" :showHeader="true" :showControls="false" :emptyMessage="$t('components.songList.empty')" />
</template>
