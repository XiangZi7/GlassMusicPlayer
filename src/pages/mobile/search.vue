<script setup lang="ts">
import { cloudSearch, searchSuggest, searchDefault } from '@/api'
import { useAudio } from '@/composables/useAudio'

const state = reactive({
  q: '',
  tab: 'song' as 'song' | 'playlist' | 'mv',
  suggest: [] as string[],
  loading: false,
  songs: [] as Array<{
    id: number | string
    name: string
    artist: string
    album: string
    duration: number
    cover: string
  }>,
  playlists: [] as Array<{
    id: number | string
    name: string
    coverImgUrl: string
    trackCount: number
  }>,
  mvs: [] as Array<{ id: number | string; name: string; cover: string; artist: string }>,
})

const { play } = useAudio()

const fetchDefault = async () => {
  const res = await searchDefault()
  const def = (res as any)?.data?.realkeyword || (res as any)?.data?.showKeyword || ''
  state.q = def || ''
}

const fetchSuggest = async () => {
  if (!state.q.trim()) return (state.suggest = [])
  const res = await searchSuggest({ keywords: state.q, type: 'mobile' })
  const list = (res as any)?.result?.allMatch || []
  state.suggest = list.map((i: any) => i.keyword).slice(0, 8)
}

const searchAll = async () => {
  if (!state.q.trim()) return
  state.loading = true
  try {
    const [songRes, plRes, mvRes] = await Promise.all([
      cloudSearch({ keywords: state.q, type: 1, limit: 20 }),
      cloudSearch({ keywords: state.q, type: 1000, limit: 12 }),
      cloudSearch({ keywords: state.q, type: 1004, limit: 12 }),
    ])
    const songs = (songRes as any)?.result?.songs || []
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
    const playlists = (plRes as any)?.result?.playlists || []
    state.playlists = playlists.map((p: any) => ({
      id: p?.id || 0,
      name: p?.name || '',
      coverImgUrl: p?.coverImgUrl || '',
      trackCount: p?.trackCount || 0,
    }))
    const mvs = (mvRes as any)?.result?.mvs || []
    state.mvs = mvs.map((m: any) => ({
      id: m?.id || 0,
      name: m?.name || '',
      cover: m?.cover || m?.imgurl || '',
      artist: m?.artistName || '',
    }))
  } finally {
    state.loading = false
  }
}

onMounted(async () => {
  await fetchDefault()
  await searchAll()
})

watch(() => state.q, fetchSuggest)

  const playSong = (s: any) =>
    play(
      {
        id: s.id,
        name: s.name,
        artist: s.artist,
        album: s.album,
        duration: Math.floor((s.duration || 0) / 1000),
        cover: s.cover,
      },
      0
    )

  const handleSuggestClick = (s: string) => {
    state.q = s
    searchAll()
  }
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div class="sticky top-0 z-10 bg-[#0f0f1a] pt-2 pb-3">
      <div class="glass-card flex items-center gap-2 px-3 py-2">
        <span class="icon-[mdi--magnify] h-5 w-5 text-white/70"></span>
        <input
          v-model="state.q"
          @keyup.enter="searchAll"
          type="text"
          placeholder="搜索音乐、歌单、MV"
          class="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/50 outline-none"
        />
        <button class="rounded-md p-2 hover:bg-white/10" title="搜索" @click="searchAll">
          <span class="icon-[mdi--arrow-right] h-5 w-5 text-white"></span>
        </button>
      </div>
      <div v-if="state.suggest.length" class="mt-2 flex items-center gap-2 overflow-x-auto">
        <button
          v-for="s in state.suggest"
          :key="s"
          class="glass-button rounded-full px-3 py-1 text-xs text-white/80"
          @click="handleSuggestClick(s)"
        >
          {{ s }}
        </button>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <button
          :class="state.tab === 'song' ? 'text-white' : 'text-white/60'"
          class="rounded-md px-3 py-1 text-sm"
          @click="state.tab = 'song'"
        >
          单曲
        </button>
        <button
          :class="state.tab === 'playlist' ? 'text-white' : 'text-white/60'"
          class="rounded-md px-3 py-1 text-sm"
          @click="state.tab = 'playlist'"
        >
          歌单
        </button>
        <button
          :class="state.tab === 'mv' ? 'text-white' : 'text-white/60'"
          class="rounded-md px-3 py-1 text-sm"
          @click="state.tab = 'mv'"
        >
          MV
        </button>
      </div>
    </div>

    <div v-if="state.loading" class="py-6">
      <PageSkeleton :sections="['list']" :list-count="10" />
    </div>

    <div v-else>
      <section v-show="state.tab === 'song'" class="space-y-3">
        <div
          v-for="s in state.songs"
          :key="s.id"
          class="glass-card flex items-center gap-3 p-3"
          @click="playSong(s)"
        >
          <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
            <img
              v-if="s.cover"
              :src="s.cover + '?param=200y200'"
              alt="cover"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center rounded-lg bg-white/10"
            >
              🎵
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">{{ s.name }}</p>
            <p class="truncate text-xs text-purple-300">{{ s.artist }}</p>
          </div>
          <span class="icon-[mdi--play] h-5 w-5 text-white/80"></span>
        </div>
      </section>

      <section v-show="state.tab === 'playlist'" class="grid grid-cols-2 gap-3">
        <router-link
          v-for="p in state.playlists"
          :key="p.id"
          :to="`/playlist/${p.id}`"
          class="group"
        >
          <div class="glass-card p-3">
            <div class="relative mb-2 overflow-hidden rounded-lg">
              <img
                :src="p.coverImgUrl + '?param=300y300'"
                alt="cover"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div
                class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              >
                <span class="icon-[mdi--play] h-5 w-5 text-white"></span>
              </div>
            </div>
            <h3 class="truncate text-xs font-medium text-white">{{ p.name }}</h3>
            <p class="truncate text-[11px] text-purple-300">{{ p.trackCount }}首</p>
          </div>
        </router-link>
      </section>

      <section v-show="state.tab === 'mv'" class="grid grid-cols-2 gap-3">
        <router-link v-for="m in state.mvs" :key="m.id" :to="`/mv-player/${m.id}`" class="group">
          <div class="glass-card p-3">
            <div class="relative mb-2 overflow-hidden rounded-lg">
              <img :src="m.cover" alt="cover" class="h-full w-full object-cover" />
            </div>
            <h3 class="truncate text-xs font-medium text-white">{{ m.name }}</h3>
            <p class="truncate text-[11px] text-purple-300">{{ m.artist }}</p>
          </div>
        </router-link>
      </section>
    </div>
  </div>
</template>
