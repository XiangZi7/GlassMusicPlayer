<script setup lang="ts">
import { cloudSearch, searchSuggest, searchDefault } from '@/api'
import LazyImage from '@/components/Ui/LazyImage.vue'
import Pagination from '@/components/Ui/Pagination.vue'
import { Song } from '@/stores/interface'
type SearchTab = 'song' | 'playlist' | 'mv'
type PlaylistItem = {
  id: number | string
  name: string
  coverImgUrl: string
  trackCount: number
}
type MVItem = { id: number | string; name: string; cover: string; artist: string }
interface MobileSearchState {
  q: string
  placeholder: string
  tab: SearchTab
  suggest: string[]
  loading: boolean
  suggestVisible: boolean
  songs: Song[]
  songPage: number
  songPageSize: number
  songTotal: number
  playlists: PlaylistItem[]
  playlistPage: number
  playlistPageSize: number
  playlistTotal: number
  mvs: MVItem[]
  mvPage: number
  mvPageSize: number
  mvTotal: number
}
const state = reactive<MobileSearchState>({
  // 搜索关键词
  q: '',
  // 输入框默认占位文案
  placeholder: '',
  // 当前选中的搜索类型 Tab（单曲/歌单/MV）
  tab: 'song',
  // 联想词列表（来自 suggest 接口）
  suggest: [],
  // 是否处于加载中（请求三类结果时）
  loading: false,
  // 是否显示联想下拉
  suggestVisible: false,
  // 单曲搜索结果列表
  songs: [],
  // 单曲分页页码
  songPage: 1,
  // 单曲每页数量
  songPageSize: 20,
  // 单曲总条数
  songTotal: 0,
  // 歌单搜索结果列表
  playlists: [],
  // 歌单分页页码
  playlistPage: 1,
  // 歌单每页数量
  playlistPageSize: 12,
  // 歌单总条数
  playlistTotal: 0,
  // MV 搜索结果列表
  mvs: [],
  // MV 分页页码
  mvPage: 1,
  // MV 每页数量
  mvPageSize: 12,
  // MV 总条数
  mvTotal: 0,
})
const {
  q,
  placeholder,
  tab,
  suggest,
  loading,
  suggestVisible,
  songs,
  songPage,
  songPageSize,
  songTotal,
  playlists,
  playlistPage,
  playlistPageSize,
  playlistTotal,
  mvs,
  mvPage,
  mvPageSize,
  mvTotal,
} = toRefs(state)

const fetchDefault = async () => {
  const res = await searchDefault()
  const def = (res as any)?.data?.realkeyword || (res as any)?.data?.showKeyword || ''
  state.placeholder = def || ''
}

const fetchSuggest = async () => {
  if (!state.q.trim()) return (state.suggest = [])
  const res = await searchSuggest({ keywords: state.q, type: 'mobile' })
  const list = (res as any)?.result?.allMatch || []
  state.suggest = list.map((i: any) => i.keyword).slice(0, 8)
}

const fetchSongs = async () => {
  if (!state.q.trim()) return
  const res: any = await cloudSearch({
    keywords: state.q,
    type: 1,
    limit: state.songPageSize,
    offset: (state.songPage - 1) * state.songPageSize,
  })
  const songs = res?.result?.songs || []
  state.songs = songs.map((s: any) => ({
    id: s?.id || 0,
    name: s?.name || '',
    artist: Array.isArray(s?.ar)
      ? s.ar.map((a: any) => a.name).join(' / ')
      : Array.isArray(s?.artists)
        ? s.artists.map((a: any) => a.name).join(' / ')
        : '',
    album: s?.al?.name || s?.album?.name || '',
    duration: s?.dt ?? s?.duration ?? 0,
    cover: s?.al?.picUrl || s?.album?.picUrl || '',
  }))
  state.songTotal = Number(res?.result?.songCount ?? state.songs.length)
}

const fetchPlaylists = async () => {
  if (!state.q.trim()) return
  const res: any = await cloudSearch({
    keywords: state.q,
    type: 1000,
    limit: state.playlistPageSize,
    offset: (state.playlistPage - 1) * state.playlistPageSize,
  })
  const playlists = res?.result?.playlists || []
  state.playlists = playlists.map((p: any) => ({
    id: p?.id || 0,
    name: p?.name || '',
    coverImgUrl: p?.coverImgUrl || '',
    trackCount: p?.trackCount || 0,
  }))
  state.playlistTotal = Number(res?.result?.playlistCount ?? state.playlists.length)
}

const fetchMVs = async () => {
  if (!state.q.trim()) return
  const res: any = await cloudSearch({
    keywords: state.q,
    type: 1004,
    limit: state.mvPageSize,
    offset: (state.mvPage - 1) * state.mvPageSize,
  })
  const mvs = res?.result?.mvs || []
  state.mvs = mvs.map((m: any) => ({
    id: m?.id || 0,
    name: m?.name || '',
    cover: m?.cover || m?.imgurl || '',
    artist: m?.artistName || '',
  }))
  state.mvTotal = Number(res?.result?.mvCount ?? res?.result?.songCount ?? state.mvs.length)
}

const searchAll = async () => {
  if (!state.q.trim()) return
  state.loading = true
  try {
    await Promise.all([fetchSongs(), fetchPlaylists(), fetchMVs()])
  } finally {
    state.loading = false
  }
}

onMounted(async () => {
  await fetchDefault()
  await searchAll()
  document.addEventListener('click', handleDocClick)
})

watch(() => state.q, fetchSuggest)
watch(
  () => state.songPage,
  () => {
    fetchSongs()
  }
)
watch(
  () => state.playlistPage,
  () => {
    fetchPlaylists()
  }
)
watch(
  () => state.mvPage,
  () => {
    fetchMVs()
  }
)

const handleSuggestClick = (s: string) => {
  state.q = s
  state.songPage = 1
  state.playlistPage = 1
  state.mvPage = 1
  state.suggestVisible = false
  searchAll()
}

const clearQuery = () => {
  state.q = ''
  state.suggest = []
  state.suggestVisible = false
}

const inputRef = useTemplateRef('inputRef')
const handleSearchClick = () => {
  if (!state.q.trim()) state.q = state.placeholder || ''
  state.songPage = 1
  state.playlistPage = 1
  state.mvPage = 1
  searchAll()
  state.suggestVisible = false
  inputRef.value?.blur()
}

const searchBoxRef = ref<HTMLElement | null>(null)
const handleInputFocus = () => {
  state.suggestVisible = true
}
const handleDocClick = (e: MouseEvent) => {
  const el = searchBoxRef.value
  const target = e.target as Node | null
  if (el && target && !el.contains(target)) state.suggestVisible = false
}
onUnmounted(() => {
  document.removeEventListener('click', handleDocClick)
})
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div class="glass-nav sticky top-0 z-10 pt-2 pb-3">
      <div ref="searchBoxRef" class="glass-card relative flex items-center gap-2 px-3 py-2">
        <span class="icon-[mdi--magnify] text-primary/70 h-5 w-5"></span>
        <input
          ref="inputRef"
          v-model="q"
          @keyup.enter="handleSearchClick"
          @focus="handleInputFocus"
          type="text"
          :placeholder="placeholder || $t('common.search.placeholder')"
          class="placeholder-glass-50 text-primary min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button
          v-if="q"
          class="hover:bg-hover-glass rounded-md p-2"
          :title="$t('common.clear')"
          @click="clearQuery"
        >
          <span class="icon-[mdi--close-circle-outline] text-primary/70 h-5 w-5"></span>
        </button>
        <button class="hover:bg-hover-glass rounded-md p-2" :title="$t('common.search.label')" @click="handleSearchClick">
          <span class="icon-[mdi--arrow-right] text-primary h-5 w-5"></span>
        </button>
        <div
          v-if="suggestVisible && suggest.length"
          class="glass-dropdown absolute top-full right-0 left-0 z-20 mt-2 rounded-xl p-3 backdrop-blur-md"
        >
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="s in suggest"
              :key="s"
              class="glass-button text-primary/80 min-w-0 truncate rounded-full px-3 py-1 text-xs"
              @click="handleSuggestClick(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <button
          :class="tab === 'song' ? 'text-primary' : 'text-primary/60'"
          class="rounded-md px-3 py-1 text-sm"
          @click="state.tab = 'song'"
        >
          {{ $t('search.tabs.song') }}
        </button>
        <button
          :class="tab === 'playlist' ? 'text-primary' : 'text-primary/60'"
          class="rounded-md px-3 py-1 text-sm"
          @click="state.tab = 'playlist'"
        >
          {{ $t('search.tabs.playlist') }}
        </button>
        <button
          :class="tab === 'mv' ? 'text-primary' : 'text-primary/60'"
          class="rounded-md px-3 py-1 text-sm"
          @click="state.tab = 'mv'"
        >
          MV
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-6">
      <PageSkeleton :sections="['list']" :list-count="10" />
    </div>

    <div v-else>
      <section v-show="tab === 'song'" class="space-y-3">
        <HotSongsMobile :songs="songs" context="generic" />
        <Pagination
          v-if="songTotal > songPageSize"
          v-model="songPage"
          :total="songTotal"
          :page-size="songPageSize"
        />
      </section>

      <section v-show="tab === 'playlist'" class="grid grid-cols-2 gap-3">
        <router-link
          v-for="p in playlists"
          :key="p.id"
          :to="`/playlist/${p.id}`"
          class="group"
        >
          <div class="glass-card p-3">
            <div class="relative mb-2 overflow-hidden rounded-lg">
              <LazyImage
                :src="p.coverImgUrl + '?param=300y300'"
                alt="cover"
                imgClass="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div
                class="bg-hover-glass absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              >
                <span class="icon-[mdi--play] text-primary h-5 w-5"></span>
              </div>
            </div>
            <h3 class="text-primary truncate text-xs font-medium">{{ p.name }}</h3>
            <p class="text-primary/70 truncate text-[11px]">{{ $t('commonUnits.songsShort', { count: p.trackCount }) }}</p>
          </div>
        </router-link>
        <div class="col-span-2">
          <Pagination
            v-if="playlistTotal > playlistPageSize"
            v-model="playlistPage"
            :total="playlistTotal"
            :page-size="playlistPageSize"
          />
        </div>
      </section>

      <section v-show="tab === 'mv'" class="grid grid-cols-2 gap-3">
        <router-link v-for="m in mvs" :key="m.id" :to="`/mv-player/${m.id}`" class="group">
          <div class="glass-card p-3">
            <div class="relative mb-2 overflow-hidden rounded-lg">
              <LazyImage :src="m.cover" alt="cover" imgClass="h-full w-full object-cover" />
            </div>
            <h3 class="text-primary truncate text-xs font-medium">{{ m.name }}</h3>
            <p class="text-primary/70 truncate text-[11px]">{{ m.artist }}</p>
          </div>
        </router-link>
        <div class="col-span-2">
          <Pagination
            v-if="mvTotal > mvPageSize"
            v-model="mvPage"
            :total="mvTotal"
            :page-size="mvPageSize"
          />
        </div>
      </section>
    </div>
  </div>
</template>
