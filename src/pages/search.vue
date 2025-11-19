<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'

const route = useRoute()
const router = useRouter()

const q = computed(() => String(route.query.q || '').trim())
const { playlist, play } = useAudio()

const normalized = (s: string) => s.toLowerCase()
const results = computed(() => {
  const term = normalized(q.value)
  if (!term) return []
  return (playlist.value || []).filter((song: any) => {
    const name = normalized(String(song.name || ''))
    const artist = normalized(String(song.artist || ''))
    const album = normalized(String(song.album || ''))
    return name.includes(term) || artist.includes(term) || album.includes(term)
  })
})

const playingIndex = computed(() => {
  return -1
})

const onPlay = (song: any, index: number) => {
  const idx = playlist.value.findIndex((s: any) => s.id === song.id)
  play(song, idx !== -1 ? idx : index)
}

const onLike = () => {}
const onMore = () => {}
const onSort = () => {}
const onFilter = () => {}

const state = reactive({
  // 本地搜索输入
  localQuery: '',
})
const { localQuery } = toRefs(state)
watch(
  q,
  val => {
    state.localQuery = val
  },
  { immediate: true }
)

const submitSearch = () => {
  const term = state.localQuery.trim()
  router.replace({ path: '/search', query: { q: term } })
}

const applyQuick = (term: string) => {
  state.localQuery = term
  submitSearch()
}
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto px-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">搜索</h1>
          <p class="mt-1 text-sm text-white/70">关键词：{{ q || '请输入搜索内容' }}</p>
        </div>
        <div class="glass-card flex min-w-96 items-center px-5 py-3">
          <span class="icon-[mdi--magnify] mr-3 h-5 w-5 text-white/60"></span>
          <input
            v-model="localQuery"
            @keyup.enter="submitSearch"
            type="text"
            placeholder="搜索音乐、歌手、专辑..."
            class="min-w-0 flex-1 bg-transparent text-base text-white placeholder-white/50 outline-none"
          />
          <button class="glass-button ml-3 px-4 py-2 text-sm text-white" @click="submitSearch">
            搜索
          </button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="glass-button px-3 py-1 text-xs text-white/80" @click="applyQuick('流行')">
            流行
          </button>
          <button class="glass-button px-3 py-1 text-xs text-white/80" @click="applyQuick('摇滚')">
            摇滚
          </button>
          <button class="glass-button px-3 py-1 text-xs text-white/80" @click="applyQuick('电子')">
            电子
          </button>
          <button
            class="glass-button px-3 py-1 text-xs text-white/80"
            @click="applyQuick('Hip-Hop')"
          >
            Hip-Hop
          </button>
          <button class="glass-button px-3 py-1 text-xs text-white/80" @click="applyQuick('民谣')">
            民谣
          </button>
        </div>
      </div>

      <div class="pb-10">
        <div class="w-full">
          <SongList
            :songs="results"
            :currentPlayingIndex="playingIndex"
            :showHeader="true"
            :showControls="true"
            emptyMessage="未找到匹配的歌曲"
            @play="onPlay"
            @like="onLike"
            @more="onMore"
            @sort="onSort"
            @filter="onFilter"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
