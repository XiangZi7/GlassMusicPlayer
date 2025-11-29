<script setup lang="ts">
import { banner, personalized, personalizedNewsong, personalizedMv, topArtists } from '@/api'
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination, EffectFade } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/effect-fade'

const { setPlaylist, play } = useAudio()
const { t } = useI18n()

const state = reactive({
  banners: [] as Array<{
    title: string
    coverImgUrl: string
    targetId: number
    targetType: number
    url: string
  }>,
  playlists: [] as Array<{
    id: number | string
    name: string
    coverImgUrl: string
    playCount: number
  }>,
  newSongs: [] as Array<{
    id: number | string
    name: string
    artist: string
    album: string
    cover: string
    duration: number
  }>,
  mvs: [] as Array<{
    id: number | string
    name: string
    cover: string
    artistName: string
    playCount: number
  }>,
  artists: [] as Array<{
    id: number | string
    name: string
    picUrl: string
    alias: string[]
  }>,
  isPageLoading: true,
  activeTab: 0,
})

const { banners, playlists, newSongs, mvs, artists, isPageLoading, activeTab } = toRefs(state)

const formatPlayCount = (count: number) => {
  if (count >= 100000000) return (count / 100000000).toFixed(1) + '亿'
  if (count >= 10000) return (count / 10000).toFixed(1) + '万'
  return count.toString()
}

const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const loadDiscover = async () => {
  state.isPageLoading = true
  try {
    const [b, p, s, m, a] = await Promise.all([
      banner({ type: 0 }),
      personalized({ limit: 12 }),
      personalizedNewsong({ limit: 12 }),
      personalizedMv(),
      topArtists({ limit: 6 }),
    ])

    const bannerList: any[] = (b as any)?.data?.banners || (b as any)?.banners || []
    state.banners = bannerList.slice(0, 8).map((item: any) => ({
      title: item?.typeTitle || '',
      coverImgUrl: item?.imageUrl || '',
      targetId: item?.targetId || 0,
      targetType: item?.targetType || 0,
      url: item?.url || '',
    }))

    const playlistsList: any[] = (p as any)?.result || (p as any)?.data?.result || []
    state.playlists = playlistsList.slice(0, 12).map((pl: any) => ({
      id: pl?.id,
      name: pl?.name || t('home.playlistFallback'),
      coverImgUrl: pl?.picUrl || pl?.coverImgUrl || '',
      playCount: pl?.playCount || 0,
    }))

    const songData: any[] = (s as any)?.result || (s as any)?.data?.result || []
    state.newSongs = songData.slice(0, 12).map((it: any) => ({
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
    state.mvs = mvData.slice(0, 6).map((mv: any) => ({
      id: mv?.id,
      name: mv?.name,
      cover: mv?.picUrl || mv?.cover,
      artistName: mv?.artistName || '',
      playCount: mv?.playCount || 0,
    }))

    const artistData: any[] = (a as any)?.artists || (a as any)?.data?.artists || []
    state.artists = artistData.slice(0, 6).map((ar: any) => ({
      id: ar?.id,
      name: ar?.name,
      picUrl: ar?.picUrl || ar?.img1v1Url || '',
      alias: ar?.alias || [],
    }))
  } catch {
  } finally {
    state.isPageLoading = false
  }
}

onMounted(() => {
  loadDiscover()
})



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
  const list = state.newSongs.map(mapToStoreSong)
  const index = list.findIndex(it => it.id === song.id)
  setPlaylist(list, index >= 0 ? index : 0)
  play(list[index >= 0 ? index : 0], index >= 0 ? index : 0)
}

const swiperModules = [Autoplay, Pagination, EffectFade]
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <PageSkeleton
        v-if="isPageLoading"
        :sections="['hero', 'grid', 'list']"
        :grid-count="12"
        :list-count="12"
      />
      <template v-else>
        <section v-if="banners.length" class="relative mb-8">
          <Swiper
            :modules="swiperModules"
            :slides-per-view="1"
            :space-between="0"
            :autoplay="{ delay: 4000, disableOnInteraction: false }"
            :pagination="{ clickable: true }"
            effect="fade"
            :fade-effect="{ crossFade: true }"
            class="discover-swiper h-64 md:h-80 lg:h-96 rounded-3xl"
          >
            <SwiperSlide v-for="(item, i) in banners" :key="i">
              <a :href="item.url || '#'" target="_blank" class="relative block h-full w-full">
                <img :src="item.coverImgUrl" alt="banner" class="h-full w-full object-cover" />
                <div
                  class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"
                />
                <div class="absolute right-6 bottom-6 left-6">
                  <span
                    v-if="item.title"
                    class="inline-block rounded-full bg-white/20 px-3 py-1 text-xs text-primary backdrop-blur-sm"
                  >
                    {{ item.title }}
                  </span>
                </div>
              </a>
            </SwiperSlide>
          </Swiper>
        </section>

        <div class="px-6 pb-8">
          <div class="glass-nav mb-8 inline-flex gap-1 p-1.5">
            <button
              v-for="(tab, i) in [
                { icon: 'icon-[mdi--playlist-music]', label: t('components.discover.hotPlaylists') },
                { icon: 'icon-[mdi--music-note]', label: t('components.discover.newSongs') },
                { icon: 'icon-[mdi--video]', label: t('components.discover.recommendMv') },
                { icon: 'icon-[mdi--account-music]', label: t('components.discover.hotArtists') },
              ]"
              :key="i"
              class="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-300"
              :class="
                activeTab === i
                  ? 'bg-white/20 text-primary shadow-lg'
                  : 'text-primary/60 hover:bg-white/10 hover:text-primary/90'
              "
              @click="activeTab = i"
            >
              <span :class="tab.icon" class="h-4 w-4" />
              <span class="hidden sm:inline">{{ tab.label }}</span>
            </button>
          </div>

          <Transition name="fade" mode="out-in">
            <section v-if="activeTab === 0" key="playlists">
              <div
                class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              >
                <router-link
                  v-for="pl in playlists"
                  :key="pl.id"
                  :to="`/playlist/${pl.id}`"
                  class="group"
                >
                  <div class="relative mb-3 aspect-square overflow-hidden rounded-xl">
                    <img
                      :src="pl.coverImgUrl + '?param=300y300'"
                      :alt="pl.name"
                      class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div
                      class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                    <div
                      class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-xs text-primary backdrop-blur-sm"
                    >
                      <span class="icon-[mdi--play] h-3 w-3" />
                      {{ formatPlayCount(pl.playCount) }}
                    </div>
                    <div
                      class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    >
                      <div
                        class="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110"
                      >
                        <span class="icon-[mdi--play] h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </div>
                  <h3
                    class="line-clamp-2 text-sm text-primary/90 transition-colors group-hover:text-primary"
                  >
                    {{ pl.name }}
                  </h3>
                </router-link>
              </div>
            </section>

            <section v-else-if="activeTab === 1" key="songs">
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div
                  v-for="(song, i) in newSongs"
                  :key="song.id"
                  class="group flex cursor-pointer items-center gap-4 rounded-xl bg-white/5 p-3 transition-all duration-300 hover:bg-white/10"
                  @click="handlePlay(song)"
                >
                  <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                    <img
                      :src="song.cover + '?param=120y120'"
                      :alt="song.name"
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    >
                      <span class="icon-[mdi--play] h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="shrink-0 text-sm font-medium text-pink-400">{{
                        String(i + 1).padStart(2, '0')
                      }}</span>
                      <h4 class="truncate text-sm font-medium text-primary">{{ song.name }}</h4>
                    </div>
                    <p class="mt-1 truncate text-xs text-primary/50">{{ song.artist }}</p>
                  </div>
                  <span class="shrink-0 text-xs text-primary/40">{{
                    formatDuration(song.duration)
                  }}</span>
                </div>
              </div>
            </section>

            <section v-else-if="activeTab === 2" key="mvs">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <router-link
                  v-for="mv in mvs"
                  :key="mv.id"
                  :to="`/mv-player/${mv.id}`"
                  class="group"
                >
                  <div class="relative aspect-video overflow-hidden rounded-xl">
                    <img
                      :src="mv.cover + '?param=464y260'"
                      :alt="mv.name"
                      class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div
                      class="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent"
                    />
                    <div
                      class="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs text-primary backdrop-blur-sm"
                    >
                      <span class="icon-[mdi--play] h-3 w-3" />
                      {{ formatPlayCount(mv.playCount) }}
                    </div>
                    <div
                      class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    >
                      <div
                        class="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
                      >
                        <span class="icon-[mdi--play] h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <div class="absolute right-0 bottom-0 left-0 p-4">
                      <h4 class="truncate font-medium text-primary">{{ mv.name }}</h4>
                      <p class="mt-1 text-sm text-primary/70">{{ mv.artistName }}</p>
                    </div>
                  </div>
                </router-link>
              </div>
            </section>

            <section v-else-if="activeTab === 3" key="artists">
              <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                <router-link
                  v-for="artist in artists"
                  :key="artist.id"
                  :to="`/artist/${artist.id}`"
                  class="group text-center"
                >
                  <div
                    class="relative mx-auto mb-3 aspect-square w-full max-w-[160px] overflow-hidden rounded-full"
                  >
                    <img
                      :src="artist.picUrl + '?param=200y200'"
                      :alt="artist.name"
                      class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div
                      class="absolute inset-0 rounded-full bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                  </div>
                  <h4 class="truncate text-sm font-medium text-primary">{{ artist.name }}</h4>
                  <p v-if="artist.alias.length" class="mt-0.5 truncate text-xs text-primary/50">
                    {{ artist.alias[0] }}
                  </p>
                </router-link>
              </div>
            </section>
          </Transition>

          <section class="mt-12">
            <div class="mb-6 flex items-center justify-between">
              <h2 class="flex items-center gap-2 text-xl font-semibold text-primary">
                <span class="icon-[mdi--fire] h-6 w-6 text-orange-400" />
                {{ t('components.discover.quickPicks') }}
              </h2>
              <router-link
                to="/charts"
                class="flex items-center gap-1 text-sm text-primary/60 transition-colors hover:text-primary"
              >
                {{ t('components.discover.viewMore') }}
                <span class="icon-[mdi--chevron-right] h-4 w-4" />
              </router-link>
            </div>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              <router-link
                v-for="pl in playlists.slice(0, 6)"
                :key="'quick-' + pl.id"
                :to="`/playlist/${pl.id}`"
                class="group"
              >
                <div
                  class="glass-card overflow-hidden p-3 transition-all duration-300 hover:scale-105 hover:bg-white/10"
                >
                  <div class="relative mb-2 aspect-square overflow-hidden rounded-lg">
                    <img
                      :src="pl.coverImgUrl + '?param=200y200'"
                      :alt="pl.name"
                      class="h-full w-full object-cover"
                    />
                  </div>
                  <h4 class="line-clamp-1 text-xs text-primary/80">{{ pl.name }}</h4>
                </div>
              </router-link>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.discover-swiper :deep(.swiper-pagination) {
  bottom: 16px;
}

.discover-swiper :deep(.swiper-pagination-bullet) {
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.4);
  opacity: 1;
  transition: all 0.3s;
}

.discover-swiper :deep(.swiper-pagination-bullet-active) {
  background: white;
  width: 32px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
