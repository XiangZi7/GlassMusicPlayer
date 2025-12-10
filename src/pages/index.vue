<script setup lang="ts">
import { banner, topPlaylist, topSong, topArtists, personalizedMv } from '@/api'
import { useI18n } from 'vue-i18n'
import { BannerItem, PlaylistItem, SongItem } from '@/api/interface'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination, Autoplay, EffectCoverflow } from 'swiper/modules'
import type SwiperClass from 'swiper'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import 'swiper/css/effect-coverflow'

import { formatCount, formatDuration } from '@/utils/time'
const { t } = useI18n()

interface ArtistData {
  id: number | string
  name: string
  picUrl: string
}

interface MvData {
  id: number | string
  name: string
  cover: string
  artistName: string
  playCount: number
}

const state = reactive({
  banners: [] as BannerItem[],
  recommendPlaylists: [] as PlaylistItem[],
  hotSongs: [] as SongItem[],
  artists: [] as ArtistData[],
  mvs: [] as MvData[],
  isLoading: true,
  swiper: null as SwiperClass | null,
})

const { banners, recommendPlaylists, hotSongs, artists, mvs, isLoading } = toRefs(state)

const loadData = async () => {
  state.isLoading = true
  try {
    const [b, p, s, a, m] = await Promise.all([
      banner({ type: 0 }),
      topPlaylist({ order: 'hot', limit: 20 }),
      topSong({ type: 0 }),
      topArtists({ limit: 16 }),
      personalizedMv(),
    ])

    const bannerList: any[] = (b as any)?.data?.banners || (b as any)?.banners || []
    state.banners = bannerList.slice(0, 6).map((item: any, i: number) => ({
      title: item?.typeTitle || '',
      description: item?.title || '',
      coverImgUrl: item?.imageUrl || '',
      url: item?.url || '',
    }))

    const playlists: any[] = (p as any)?.data?.playlists || (p as any)?.playlists || []
    state.recommendPlaylists = playlists.map((pl: any, i: number) => ({
      id: pl?.id || 0,
      name: pl?.name || '',
      count: pl?.playCount || 0,
      trackCount: pl?.trackCount || 0,
      coverImgUrl: pl?.coverImgUrl || '',
      creatorName: pl?.creator?.nickname || '',
      description: pl?.description || '',
    }))

    const songData = (s as any)?.data.slice(0, 12) || []
    state.hotSongs = songData.map((it: any, i: number) => ({
      id: it?.id,
      name: it?.name,
      artist: Array.isArray(it?.artists) ? it.artists.map((a: any) => a.name).join(' / ') : '',
      artistId: it?.artists?.[0]?.id || 0,
      album: it?.album?.name || '',
      albumId: it?.album?.id || 0,
      duration: it?.duration || 0,
      liked: false,
      cover: it?.album?.picUrl || '',
    }))

    const artistData: any[] = (a as any)?.artists || (a as any)?.data?.artists || []
    state.artists = artistData.map((ar: any) => ({
      id: ar?.id,
      name: ar?.name,
      picUrl: ar?.picUrl || ar?.img1v1Url || '',
    }))

    const mvData: any[] = (m as any)?.result || (m as any)?.data?.result || []
    state.mvs = mvData.slice(0, 6).map((mv: any) => ({
      id: mv?.id,
      name: mv?.name,
      cover: mv?.picUrl || mv?.cover,
      artistName: mv?.artistName || '',
      playCount: mv?.playCount || 0,
    }))
  } finally {
    state.isLoading = false
  }
}

const onSwiper = (sw: SwiperClass) => {
  state.swiper = sw
}

const swiperModules = [Navigation, Pagination, Autoplay, EffectCoverflow]

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="custom-scrollbar h-full overflow-y-auto">
      <HomeSkeleton v-if="isLoading" />
      <div v-else class="space-y-8 p-4">
        <section v-if="banners.length" class="relative">
          <Swiper
            @swiper="onSwiper"
            :modules="swiperModules"
            :slides-per-view="1"
            :space-between="24"
            :centered-slides="true"
            :loop="true"
            :autoplay="{ delay: 5000, disableOnInteraction: false }"
            :pagination="{ clickable: true, el: '.home-pagination' }"
            :breakpoints="{
              640: { slidesPerView: 1.2 },
              1024: { slidesPerView: 1.5 },
              1280: { slidesPerView: 1.8 },
            }"
            class="overflow-hidden rounded-3xl"
          >
            <SwiperSlide v-for="(item, idx) in banners" :key="idx">
              <a
                :href="item.url"
                target="_blank"
                class="group relative block aspect-[2.1/0.5] overflow-hidden rounded-3xl"
              >
                <LazyImage
                  :src="item.coverImgUrl"
                  alt="banner"
                  img-class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"
                />
                <div class="absolute right-0 bottom-0 left-0 p-6">
                  <span
                    v-if="item.title"
                    class="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
                  >
                    <span class="icon-[mdi--fire] h-3.5 w-3.5 text-orange-400" />
                    {{ item.title }}
                  </span>
                  <h3 class="line-clamp-2 text-xl font-bold text-white drop-shadow-lg lg:text-2xl">
                    {{ item.description }}
                  </h3>
                </div>
              </a>
            </SwiperSlide>
          </Swiper>
          <div class="home-pagination mt-5 flex justify-center gap-2"></div>
        </section>

        <!-- 推荐歌单 -->
        <section v-if="recommendPlaylists.length">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-primary flex items-center gap-2.5 text-lg font-bold">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-linear-to-t from-pink-500 to-rose-600 shadow-lg"
              >
                <span class="icon-[mdi--playlist-star] h-4 w-4 text-white" />
              </span>
              {{ t('home.recommendPlaylists') }}
            </h2>
          </div>
          <div class="grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            <router-link
              v-for="item in recommendPlaylists"
              :key="item.id"
              :to="`/playlist/${item.id}`"
              class="group"
            >
              <div class="relative aspect-square overflow-hidden rounded-2xl shadow-lg">
                <LazyImage
                  :src="item.coverImgUrl + '?param=300y300'"
                  alt="cover"
                  img-class="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
                />
                <div
                  class="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"
                />
                <div
                  class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
                >
                  <span class="icon-[mdi--headphones] h-3 w-3" />
                  {{ formatCount(item.count) }}
                </div>
                <div class="absolute right-0 bottom-0 left-0 p-2.5">
                  <p class="line-clamp-2 text-xs leading-tight font-medium text-white">
                    {{ item.name }}
                  </p>
                  <div class="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/70">
                    <span class="icon-[mdi--music-note] h-3 w-3" />
                    <span>{{ item.trackCount }}首</span>
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
            </router-link>
          </div>
        </section>

        <!-- 热门歌手 -->
        <section v-if="artists.length">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-primary flex items-center gap-2.5 text-lg font-bold">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-linear-to-t from-amber-500 to-orange-600 shadow-lg"
              >
                <span class="icon-[mdi--account-music] h-4 w-4 text-white" />
              </span>
              {{ t('components.discover.hotArtists') }}
            </h2>
            <router-link
              to="/artists"
              class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            >
              {{ t('common.viewAll') }}
              <span class="icon-[mdi--arrow-right] h-4 w-4" />
            </router-link>
          </div>
          <div
            class="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12"
          >
            <router-link
              v-for="artist in artists.slice(0, 12)"
              :key="artist.id"
              :to="`/artist/${artist.id}`"
              class="group flex flex-col items-center"
            >
              <div
                class="relative mb-2.5 aspect-square w-full overflow-hidden rounded-full border-2 border-(--glass-border) shadow-lg transition-all duration-300 group-hover:border-pink-500 group-hover:shadow-pink-500/20"
              >
                <LazyImage
                  :src="artist.picUrl + '?param=150y150'"
                  :alt="artist.name"
                  img-class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100"
                >
                  <span
                    class="icon-[mdi--play] h-6 w-6 scale-50 text-white transition-transform group-hover:scale-100"
                  />
                </div>
              </div>
              <span
                class="text-primary/70 group-hover:text-primary w-full truncate text-center text-xs transition-colors"
                >{{ artist.name }}</span
              >
            </router-link>
          </div>
        </section>

        <!-- 热门歌曲 -->
        <section v-if="hotSongs.length">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-primary flex items-center gap-2.5 text-lg font-bold">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-linear-to-t from-cyan-500 to-blue-600 shadow-lg"
              >
                <span class="icon-[mdi--fire] h-4 w-4 text-white" />
              </span>
              {{ t('home.hotSongs') }}
            </h2>
            <router-link
              to="/charts"
              class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            >
              {{ t('common.viewAll') }}
              <span class="icon-[mdi--arrow-right] h-4 w-4" />
            </router-link>
          </div>
          <div class="glass-card overflow-hidden">
            <div class="grid md:grid-cols-2">
              <router-link
                v-for="(song, idx) in hotSongs"
                :key="song.id"
                :to="`/song/${song.id}`"
                class="group hover:bg-hover-glass flex items-center gap-4 border-b border-(--glass-border) p-4 transition-all last:border-b-0 odd:last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
              >
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                  :class="
                    idx < 3
                      ? 'bg-linear-to-t from-rose-500 to-pink-600 text-white'
                      : 'bg-primary/5 text-primary/40'
                  "
                >
                  {{ idx + 1 }}
                </span>
                <div class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-md">
                  <LazyImage
                    :src="song.cover + '?param=100y100'"
                    alt="cover"
                    img-class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div
                    class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
                  >
                    <span class="icon-[mdi--play] h-5 w-5 text-white" />
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <p
                    class="text-primary truncate text-sm font-medium transition-colors group-hover:text-pink-500"
                  >
                    {{ song.name }}
                  </p>
                  <p class="text-primary/50 mt-0.5 truncate text-xs">{{ song.artist }}</p>
                </div>
                <span class="text-primary/30 shrink-0 text-xs">{{
                  formatDuration(song.duration)
                }}</span>
              </router-link>
            </div>
          </div>
        </section>

        <!-- 推荐MV -->
        <section v-if="mvs.length">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-primary flex items-center gap-2.5 text-lg font-bold">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-linear-to-t from-rose-500 to-red-600 shadow-lg"
              >
                <span class="icon-[mdi--video] h-4 w-4 text-white" />
              </span>
              {{ t('components.discover.recommendMv') }}
            </h2>
            <router-link
              to="/mv-list"
              class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            >
              {{ t('common.viewAll') }}
              <span class="icon-[mdi--arrow-right] h-4 w-4" />
            </router-link>
          </div>
          <div class="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <router-link v-for="mv in mvs" :key="mv.id" :to="`/mv-player/${mv.id}`" class="group">
              <div class="relative aspect-video overflow-hidden rounded-2xl shadow-xl">
                <LazyImage
                  :src="mv.cover + '?param=400y225'"
                  :alt="mv.name"
                  img-class="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
                />
                <div
                  class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"
                />
                <div
                  class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
                >
                  <span class="icon-[mdi--play] h-3 w-3" />
                  {{ formatCount(mv.playCount) }}
                </div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <div
                    class="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
                  >
                    <span class="icon-[mdi--play] h-6 w-6 text-white" />
                  </div>
                </div>
                <div class="absolute right-0 bottom-0 left-0 p-3">
                  <p class="truncate text-sm font-medium text-white">{{ mv.name }}</p>
                  <p class="mt-0.5 truncate text-[11px] text-white/70">{{ mv.artistName }}</p>
                </div>
              </div>
            </router-link>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 轮播图指示点样式 */
.home-pagination :deep(.swiper-pagination-bullet) {
  width: 8px;
  height: 8px;
  background: rgba(17, 24, 39, 0.2);
  opacity: 1;
  border-radius: 9999px;
  transition: all 0.3s ease;
}

/* 轮播图激活指示点样式 */
.home-pagination :deep(.swiper-pagination-bullet-active) {
  width: 24px;
  background: #ec4899; /* pink-500 */
  border-radius: 4px;
}
</style>
