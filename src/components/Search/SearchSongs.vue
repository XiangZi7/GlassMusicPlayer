<script setup lang="ts">
import { cloudSearch } from '@/api'
import { useAudio } from '@/composables/useAudio'
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

const { setPlaylist, play } = useAudio()

const playAll = () => {
  if (state.results.length === 0) return
  const playlist = state.results
  setPlaylist(playlist, 0)
  play(playlist[0], 0)
}

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
    artists: Array.isArray(it?.artists || it?.ar)
      ? (it?.artists || it?.ar).map((a: any) => ({ id: a.id, name: a.name }))
      : [],
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

defineExpose({
  playAll,
})
</script>
<template>
  <div class="flex h-full flex-col overflow-hidden">
    <SongList
      :songs="results"
      :showHeader="true"
      :showControls="false"
      :emptyMessage="$t('components.songList.empty')"
    />
  </div>
</template>
