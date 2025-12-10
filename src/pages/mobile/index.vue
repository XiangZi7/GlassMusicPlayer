<script setup lang="ts">
import { banner, personalized, personalizedNewsong, personalizedMv, topArtists } from '@/api'
import { useI18n } from 'vue-i18n'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination, EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/effect-cards'

import { formatCount } from '@/utils/time'

const { t } = useI18n()

interface BannerData {
  coverImgUrl: string
  title: string
  url: string
}

interface PlaylistData {
  id: number | string
  name: string
  coverImgUrl: string
  playCount: number
}

interface SongData {
  id: number | string
  name: string
  artist: string
  album: string
  cover: string
  duration: number
}

interface MvData {
  id: number | string
  name: string
  cover: string
  artistName: string
  playCount: number
}

interface ArtistData {
  id: number | string
  name: string
  picUrl: string
}

interface HomeState {
  banners: BannerData[]
  playlists: PlaylistData[]
  newSongs: SongData[]
  mvs: MvData[]
  artists: ArtistData[]
  isLoading: boolean
}

const state = reactive<HomeState>({
  banners: [],
  playlists: [],
  newSongs: [],
  mvs: [],
  artists: [],
  isLoading: true,
})

const { banners, playlists, newSongs, mvs, artists, isLoading } = toRefs(state)

const loadHomeData = async () => {
  state.isLoading = true
  try {
    const [b, p, s, m, a] = await Promise.all([
      banner({ type: 2 }),
      personalized({ limit: 6 }),
      personalizedNewsong({ limit: 6 }),
      personalizedMv(),
      topArtists({ limit: 10 }),
    ])

    const bannerList: any[] = (b as any)?.data?.banners || (b as any)?.banners || []
    state.banners = bannerList.slice(0, 5).map((item: any) => ({
      coverImgUrl: item?.pic || '',
      title: item?.typeTitle || '',
      url: item?.url || '',
    }))

    const playlistsList: any[] = (p as any)?.result || (p as any)?.data?.result || []
    state.playlists = playlistsList.slice(0, 6).map((pl: any) => ({
      id: pl?.id,
      name: pl?.name || t('home.playlistFallback'),
      coverImgUrl: pl?.picUrl || pl?.coverImgUrl || '',
      playCount: pl?.playCount || 0,
    }))

    const songData: any[] = (s as any)?.result || (s as any)?.data?.result || []
    state.newSongs = songData.slice(0, 6).map((it: any) => ({
      id: it?.id || it?.song?.id,
      name: it?.name || it?.song?.name,
      artist: Array.isArray(it?.song?.artists)
        ? it.song.artists.map((a: any) => a.name).join(' / ')
        : '',
      album: it?.song?.album?.name || it?.album?.name || '',
      cover: it?.song?.album?.picUrl || it?.picUrl || '',
      duration: it?.song?.duration || it?.duration || 0,
    }))

    const mvData: any[] = (m as any)?.result || (m as any)?.data?.result || []
    state.mvs = mvData.slice(0, 4).map((mv: any) => ({
      id: mv?.id,
      name: mv?.name,
      cover: mv?.picUrl || mv?.cover,
      artistName: mv?.artistName || '',
      playCount: mv?.playCount || 0,
    }))

    const artistData: any[] = (a as any)?.artists || (a as any)?.data?.artists || []
    state.artists = artistData.slice(0, 10).map((ar: any) => ({
      id: ar?.id,
      name: ar?.name,
      picUrl: ar?.picUrl || ar?.img1v1Url || '',
    }))
  } finally {
    state.isLoading = false
  }
}

onMounted(loadHomeData)

const swiperModules = [Autoplay, Pagination, EffectCards]
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto pb-4">
      <template v-if="isLoading">
        <MobileHomeSkeleton />
      </template>
      <template v-else>
        <section v-if="banners.length" class="mb-6 px-4 pt-2">
          <Swiper
            :modules="swiperModules"
            :slides-per-view="1"
            :space-between="12"
            :autoplay="{ delay: 4000, disableOnInteraction: false }"
            :pagination="{ clickable: true }"
            class="home-swiper h-44 overflow-visible rounded-2xl"
          >
            <SwiperSlide v-for="(item, i) in banners" :key="i" class="rounded-2xl">
              <a
                :href="item.url || '#'"
                target="_blank"
                class="relative block h-full w-full overflow-hidden rounded-2xl"
              >
                <LazyImage
                  :src="item.coverImgUrl"
                  alt="banner"
                  imgClass="h-full w-full object-cover"
                />
                <div
                  class="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent"
                ></div>
                <div v-if="item.title" class="absolute right-3 bottom-3 left-3">
                  <span
                    class="text-primary inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium backdrop-blur-md"
                  >
                    <span class="icon-[mdi--fire] h-3.5 w-3.5 text-orange-300"></span>
                    {{ item.title }}
                  </span>
                </div>
              </a>
            </SwiperSlide>
          </Swiper>
        </section>

        <section class="mb-6 px-4">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="section-title">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-pink-500 to-purple-600"
              >
                <span class="icon-[mdi--playlist-star] text-primary h-4 w-4"></span>
              </span>
              {{ t('home.recommendPlaylists') }}
            </h2>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <router-link
              v-for="pl in playlists"
              :key="pl.id"
              :to="`/playlist/${pl.id}`"
              class="group"
            >
              <div class="playlist-cover relative mb-2 aspect-square overflow-hidden rounded-xl">
                <LazyImage
                  :src="pl.coverImgUrl + '?param=200y200'"
                  :alt="pl.name"
                  imgClass="h-full w-full object-cover transition-transform duration-300 group-active:scale-105"
                />
                <div
                  class="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent"
                ></div>
                <div
                  class="bg-overlay/50 text-primary absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
                >
                  <span class="icon-[mdi--play] h-2.5 w-2.5"></span>
                  {{ formatCount(pl.playCount) }}
                </div>
                <div class="absolute right-1.5 bottom-1.5 left-1.5">
                  <div
                    class="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-md dark:bg-black/70"
                  >
                    <span class="icon-[mdi--play] h-3.5 w-3.5 text-pink-500"></span>
                  </div>
                </div>
              </div>
              <p class="playlist-name line-clamp-2 text-xs leading-tight">{{ pl.name }}</p>
            </router-link>
          </div>
        </section>

        <section v-if="artists.length" class="mb-6">
          <div class="mb-3 flex items-center justify-between px-4">
            <h2 class="section-title">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600"
              >
                <span class="icon-[mdi--account-music] text-primary h-4 w-4"></span>
              </span>
              {{ t('components.discover.hotArtists') }}
            </h2>
          </div>
          <div class="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-2">
            <router-link
              v-for="artist in artists"
              :key="artist.id"
              :to="`/artist/${artist.id}`"
              class="flex shrink-0 flex-col items-center"
            >
              <div class="artist-avatar relative mb-1.5 h-16 w-16 overflow-hidden rounded-full">
                <LazyImage
                  :src="artist.picUrl + '?param=100y100'"
                  :alt="artist.name"
                  imgClass="h-full w-full object-cover"
                />
              </div>
              <span class="artist-name w-16 truncate text-center text-[10px]">{{
                artist.name
              }}</span>
            </router-link>
          </div>
        </section>

        <section class="mb-6 px-4">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="section-title">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-blue-600"
              >
                <span class="icon-[mdi--music-note-plus] text-primary h-4 w-4"></span>
              </span>
              {{ t('components.discover.newSongs') }}
            </h2>
          </div>
          <MobileSongList :songs="newSongs" variant="compact" :show-index="true" />
        </section>

        <section v-if="mvs.length" class="px-4 pb-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="section-title">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-rose-500 to-red-600"
              >
                <span class="icon-[mdi--video] text-primary h-4 w-4"></span>
              </span>
              {{ t('components.discover.recommendMv') }}
            </h2>
            <router-link to="/mv-list" class="view-more-link">
              {{ t('components.discover.viewMore') }}
              <span class="icon-[mdi--chevron-right] h-4 w-4"></span>
            </router-link>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <router-link v-for="mv in mvs" :key="mv.id" :to="`/mv-player/${mv.id}`" class="group">
              <div class="mv-cover relative aspect-video overflow-hidden rounded-xl">
                <LazyImage
                  :src="mv.cover + '?param=320y180'"
                  :alt="mv.name"
                  imgClass="h-full w-full object-cover transition-transform duration-300 group-active:scale-105"
                />
                <div
                  class="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent"
                ></div>
                <div
                  class="bg-overlay/50 text-primary absolute top-2 right-2 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
                >
                  <span class="icon-[mdi--play] h-2.5 w-2.5"></span>
                  {{ formatCount(mv.playCount) }}
                </div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
                  >
                    <span class="icon-[mdi--play] text-primary h-5 w-5"></span>
                  </div>
                </div>
                <div class="absolute right-0 bottom-0 left-0 p-2">
                  <p class="text-primary truncate text-xs font-medium">{{ mv.name }}</p>
                  <p class="text-primary/60 truncate text-[10px]">{{ mv.artistName }}</p>
                </div>
              </div>
            </router-link>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.home-swiper :deep(.swiper-pagination) {
  bottom: 12px;
}

.home-swiper :deep(.swiper-pagination-bullet) {
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.4);
  opacity: 1;
  transition: all 0.3s;
}

.home-swiper :deep(.swiper-pagination-bullet-active) {
  background: white;
  width: 20px;
  border-radius: 3px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--glass-text);
}

.view-more-link {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  font-size: 0.75rem;
  color: var(--glass-text);
  opacity: 0.5;
  transition: opacity 0.2s;
}

.view-more-link:active {
  opacity: 0.7;
}

.playlist-cover {
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

:root.dark .playlist-cover,
html.dark .playlist-cover {
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.3),
    0 4px 6px -2px rgba(0, 0, 0, 0.2);
}

.playlist-name {
  color: var(--glass-text);
  opacity: 0.8;
}

.artist-avatar {
  box-shadow: 0 0 0 2px var(--glass-border);
}

:root.dark .artist-avatar,
html.dark .artist-avatar {
  box-shadow: 0 0 0 2px var(--glass-border);
}

.artist-name {
  color: var(--glass-text);
  opacity: 0.7;
}

.song-item:not(.song-item-active):active {
  background: var(--glass-hover-item-bg);
}

.song-item-active {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
}

:root.dark .song-item-active,
html.dark .song-item-active {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.3), rgba(139, 92, 246, 0.3));
}

.song-index {
  color: var(--glass-text);
  opacity: 0.3;
}

.song-cover {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

:root.dark .song-cover,
html.dark .song-cover {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

.song-name {
  color: var(--glass-text);
}

.song-artist {
  color: var(--glass-text);
  opacity: 0.4;
}

.song-duration {
  color: var(--glass-text);
  opacity: 0.3;
}

.mv-cover {
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

:root.dark .mv-cover,
html.dark .mv-cover {
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.3),
    0 4px 6px -2px rgba(0, 0, 0, 0.2);
}
</style>
