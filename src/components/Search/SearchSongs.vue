<script setup lang="ts">
import { cloudSearch } from '@/api'
import { useAudio } from '@/composables/useAudio'
import { transformSearchSongs, type SongData } from '@/utils/transformers'

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

interface SongsState {
  results: SongData[]
  isLoading: boolean
}

const state = reactive<SongsState>({ results: [], isLoading: false })
const { results, isLoading } = toRefs(state)

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
  state.isLoading = true
  try {
    const res = await cloudSearch({
      keywords: term,
      type: 1,
      limit: props.limit ?? 40,
      offset: props.offset ?? 0,
    })
    const { songs, total } = transformSearchSongs(res as Record<string, unknown>)
    state.results = songs
    emit('loaded', state.results.length)
    emit('total', total)
  } finally {
    state.isLoading = false
  }
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
      :loading="isLoading"
      :showHeader="true"
      :showControls="false"
      :emptyMessage="$t('components.songList.empty')"
    />
  </div>
</template>
