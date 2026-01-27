<script setup lang="ts">
import { banner, topPlaylist, topSong, topArtists, personalizedMv } from '@/api'
import { useI18n } from 'vue-i18n'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination, Autoplay, EffectCoverflow } from 'swiper/modules'
import type SwiperClass from 'swiper'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import 'swiper/css/effect-coverflow'

import HeroCard from '@/components/Ui/HeroCard.vue'
import ArtistCard from '@/components/Ui/ArtistCard.vue'
import MVCard from '@/components/Ui/MVCard.vue'
import SongCard from '@/components/Ui/SongCard.vue'
import {
  transformBanners,
  transformPlaylists,
  transformTopSongs,
  transformArtists,
  transformMVs,
  type BannerData,
  type PlaylistData,
  type SongData,
  type ArtistData,
  type MVData,
} from '@/utils/transformers'

const { t } = useI18n()

const state = reactive({
  banners: [] as BannerData[],
  recommendPlaylists: [] as PlaylistData[],
  hotSongs: [] as SongData[],
  artists: [] as ArtistData[],
  mvs: [] as MVData[],
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

    state.banners = transformBanners(b as Record<string, unknown>, 6)
    state.recommendPlaylists = transformPlaylists(
      p as Record<string, unknown>,
      20,
      t('home.playlistFallback')
    )
    state.hotSongs = transformTopSongs(s as Record<string, unknown>, 12)
    state.artists = transformArtists(a as Record<string, unknown>, 16)
    state.mvs = transformMVs(m as Record<string, unknown>, 6)
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
        <!-- 轮播图 -->
        <section v-if="banners.length" v-scroll-in="{ direction: 'up', duration: 0.8 }" class="relative">
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
        <section v-if="recommendPlaylists.length" v-scroll-in="{ direction: 'up', delay: 0.1 }">
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
          <div
            v-scroll-in="{ stagger: true, staggerDelay: 0.04 }"
            class="grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
          >
            <HeroCard
              v-for="item in recommendPlaylists"
              :key="item.id"
              :id="item.id"
              :cover-url="item.coverImgUrl"
              :title="item.name"
              :play-count="item.playCount"
              :track-count="item.trackCount"
              :to="`/playlist/${item.id}`"
              class="stagger-item"
            />
          </div>
        </section>

        <!-- 热门歌手 -->
        <section v-if="artists.length" v-scroll-in="{ direction: 'up', delay: 0.1 }">
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
              v-magnetic="{ strength: 0.3, distance: 60 }"
              to="/artists"
              class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            >
              {{ t('common.viewAll') }}
              <span class="icon-[mdi--arrow-right] h-4 w-4" />
            </router-link>
          </div>
          <div
            v-scroll-in="{ stagger: true, staggerDelay: 0.03 }"
            class="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12"
          >
            <ArtistCard
              v-for="artist in artists.slice(0, 12)"
              :key="artist.id"
              :id="artist.id"
              :name="artist.name"
              :pic-url="artist.picUrl"
              :to="`/artist/${artist.id}`"
              class="stagger-item"
            />
          </div>
        </section>

        <!-- 热门歌曲 -->
        <section v-if="hotSongs.length" v-scroll-in="{ direction: 'up', delay: 0.1 }">
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
              v-magnetic="{ strength: 0.3, distance: 60 }"
              to="/charts"
              class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            >
              {{ t('common.viewAll') }}
              <span class="icon-[mdi--arrow-right] h-4 w-4" />
            </router-link>
          </div>
          <div v-spotlight="{ color: 'rgba(236, 72, 153, 0.1)', size: 350 }" class="glass-card overflow-hidden">
            <div
              v-scroll-in="{ stagger: true, staggerDelay: 0.03, distance: 20 }"
              class="grid md:grid-cols-2"
            >
              <SongCard
                v-for="(song, idx) in hotSongs"
                :key="song.id"
                :song="song"
                :index="idx"
                :to="`/song/${song.id}`"
                class="stagger-item border-glass border-b last:border-b-0 odd:last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
              />
            </div>
          </div>
        </section>

        <!-- 推荐MV -->
        <section v-if="mvs.length" v-scroll-in="{ direction: 'up', delay: 0.1 }">
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
              v-magnetic="{ strength: 0.3, distance: 60 }"
              to="/mv-list"
              class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            >
              {{ t('common.viewAll') }}
              <span class="icon-[mdi--arrow-right] h-4 w-4" />
            </router-link>
          </div>
          <div
            v-scroll-in="{ stagger: true, staggerDelay: 0.06 }"
            class="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          >
            <MVCard
              v-for="mv in mvs"
              :key="mv.id"
              :id="mv.id"
              :name="mv.name"
              :artist="mv.artist"
              :cover="mv.cover"
              :play-count="mv.playCount as number"
              :to="`/mv-player/${mv.id}`"
              class="stagger-item"
            />
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
