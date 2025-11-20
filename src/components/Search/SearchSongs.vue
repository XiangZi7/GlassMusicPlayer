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
  album: string
  duration: number
  cover: string
}

interface SongsState {
  loading: boolean
  results: SongResult[]
}

const state = reactive<SongsState>({ loading: false, results: [] })
const { loading, results } = toRefs(state)

const fetchSongs = async () => {
  const term = props.keywords?.trim()
  if (!term) {
    state.results = []
    return
  }
  try {
    state.loading = true
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
      album: it?.album?.name || it?.al?.name || '',
      duration: it?.duration ?? it?.dt ?? 0,
      cover: it?.album?.picUrl || it?.al?.picUrl || '',
    }))
    emit('loaded', state.results.length)
    emit('total', Number(res?.result?.songCount ?? state.results.length))
  } finally {
    state.loading = false
  }
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
  <SongList :songs="results" :showHeader="true" :showControls="false" emptyMessage="暂无歌曲" />
</template>
