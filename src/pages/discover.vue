<script setup lang="ts">
import { banner, topPlaylist, topSong } from '@/api'
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'

const state = reactive({
  banners: [] as Array<{
    title: string
    description: string
    coverImgUrl: string
    gradient: string
    url: string
  }>,
  playlists: [] as Array<{
    id: number | string
    name: string
    coverImgUrl: string
    trackCount: number
  }>,
  songs: [] as Array<{
    id: number | string
    name: string
    artist: string
    album: string
    cover: string
    duration: number
  }>,
  isPageLoading: true,
})
const { banners, playlists, songs, isPageLoading } = toRefs(state)

const gradients = [
  'from-pink-400 to-purple-500',
  'from-blue-400 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-red-400 to-orange-500',
  'from-yellow-400 to-pink-500',
]

const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const loadDiscover = async () => {
  state.isPageLoading = true
  try {
    const [b, p, s] = await Promise.all([
      banner({ type: 0 }),
      topPlaylist({ order: 'hot', limit: 12 }),
      topSong({ type: 0 }),
    ])
    const bannerList: any[] = (b as any)?.data?.banners || (b as any)?.banners || []
    state.banners = bannerList.slice(0, 6).map((item: any, i: number) => ({
      title: item?.typeTitle || t('home.bannerTitleDefault'),
      description: item?.title || t('home.bannerDescDefault'),
      coverImgUrl: item?.imageUrl || '',
      gradient: gradients[i % gradients.length],
      url: item?.url || '',
    }))

    const playlistsList: any[] = (p as any)?.data?.playlists || (p as any)?.playlists || []
    state.playlists = playlistsList.slice(0, 12).map((pl: any) => ({
      id: pl?.id,
      name: pl?.name || t('home.playlistFallback'),
      coverImgUrl: pl?.coverImgUrl || '',
      trackCount: pl?.trackCount || 0,
    }))

    const songData: any[] =
      (s as any)?.data?.data ||
      (s as any)?.data?.songs ||
      (s as any)?.songs ||
      (s as any)?.data ||
      []
    state.songs = songData.slice(0, 12).map((it: any) => ({
      id: it?.id,
      name: it?.name,
      artist: Array.isArray(it?.artists) ? it.artists.map((a: any) => a.name).join(' / ') : '',
      album: it?.album?.name || '',
      cover: it?.album?.picUrl || '',
      duration: it?.duration || 0,
    }))
  } catch {}
  finally {
    state.isPageLoading = false
  }
}

onMounted(() => {
  loadDiscover()
})

const { setPlaylist, play } = useAudio()
const { t } = useI18n()
const mapToStoreSong = (s: {
  id: number | string
  name: string
  artist: string
  album: string
  cover: string
  duration: number
}) => ({
  id: s.id,
  name: s.name,
  artist: s.artist,
  album: s.album,
  duration: s.duration,
  cover: s.cover,
})
const handlePlay = (song: { id: number | string }) => {
  const list = state.songs.map(mapToStoreSong)
  const index = list.findIndex(it => it.id === song.id)
  setPlaylist(list, index >= 0 ? index : 0)
  play(list[index >= 0 ? index : 0], index >= 0 ? index : 0)
}
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto p-6">
      <PageSkeleton v-if="isPageLoading" :sections="['hero','grid','list']" :grid-count="12" :list-count="12" />
      <template v-else>
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-white">{{ t('components.discover.title') }}</h1>
        <p class="mt-1 text-sm text-white/70">{{ t('components.discover.subtitle') }}</p>
      </div>

      <!-- 轮播推荐 -->
      <section v-if="banners.length" class="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <a
          v-for="(banner, i) in banners"
          :key="i"
          :href="banner.url"
          target="_blank"
          class="group relative overflow-hidden rounded-2xl"
        >
          <img :src="banner.coverImgUrl" alt="banner" class="h-48 w-full object-cover md:h-56" />
          <div class="absolute inset-0 bg-linear-to-br opacity-60" :class="banner.gradient"></div>
          <div class="absolute inset-0 p-4">
            <h3 class="mb-2 text-lg font-semibold text-white">{{ banner.title }}</h3>
            <p class="text-sm text-white/80">{{ banner.description }}</p>
          </div>
        </a>
      </section>

      <!-- 热门歌单 -->
      <section class="mb-10">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-white">{{ t('components.discover.hotPlaylists') }}</h2>
          <router-link to="/mv-list" class="text-purple-300 transition-colors hover:text-white">
            <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
          </router-link>
        </div>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <router-link
            v-for="pl in playlists"
            :key="pl.id"
            :to="`/playlist/${pl.id}`"
            class="group"
          >
            <div
              class="glass-card h-full p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <div class="relative mb-3 overflow-hidden rounded-xl">
                <img
                  :src="pl.coverImgUrl + '?param=500y500'"
                  :alt="t('components.songList.coverAlt')"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                >
                  <button class="glass-button flex h-10 w-10 items-center justify-center">
                    <span class="icon-[mdi--play] h-5 w-5 text-white"></span>
                  </button>
                </div>
              </div>
              <h3 class="mb-1 truncate text-sm font-medium text-white">{{ pl.name }}</h3>
              <p class="truncate text-xs text-purple-300">{{ t('components.discover.playlistCount', { count: pl.trackCount }) }}</p>
            </div>
          </router-link>
        </div>
      </section>

      <!-- 新歌速递 -->
      <section>
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-white">{{ t('components.discover.newSongs') }}</h2>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="song in songs"
            :key="song.id"
            class="group relative overflow-hidden rounded-xl bg-white/5 p-4 backdrop-blur transition-all duration-300 hover:scale-[1.02] hover:bg-white/10"
            @click="handlePlay(song)"
          >
            <div class="flex items-center gap-3">
              <div class="relative">
                <img
                  :src="song.cover + '?param=200y200'"
                  alt="cover"
                  class="h-16 w-16 rounded-lg object-cover"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                >
                  <button
                    class="glass-button flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
                  >
                    <span class="icon-[mdi--play] h-4 w-4 text-white"></span>
                  </button>
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="truncate text-sm font-medium text-white">{{ song.name }}</h4>
                <p class="truncate text-xs text-purple-300">{{ song.artist }}</p>
              </div>
              <span class="text-xs text-white/60">{{ formatDuration(song.duration) }}</span>
            </div>
          </div>
        </div>
      </section>
      </template>
    </div>
  </div>
</template>
