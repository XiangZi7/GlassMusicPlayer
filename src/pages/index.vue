<script setup lang="ts">
import { banner, topPlaylist, topSong } from '@/api'
import { useI18n } from 'vue-i18n'
import { BannerItem, PlaylistItem, SongItem, RecentItem } from '@/api/interface'

interface HomeState {
  banners: BannerItem[]
  currentBannerIndex: number
  recommendPlaylists: PlaylistItem[]
  hotSongs: SongItem[]
  currentPlayingIndex: number
  recentPlayed: RecentItem[]
  isHomeLoading: boolean
}
const { t } = useI18n()

const state = reactive<HomeState>({
  banners: [],
  currentBannerIndex: 0,
  recommendPlaylists: [],
  hotSongs: [],
  currentPlayingIndex: -1,
  recentPlayed: [],
  isHomeLoading: true,
})

const {
  banners,
  currentBannerIndex,
  recommendPlaylists,
  hotSongs,
  currentPlayingIndex,
  recentPlayed,
  isHomeLoading,
} = toRefs(state)

const gradients: string[] = [
  'from-pink-400 to-purple-500',
  'from-blue-400 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-red-400 to-orange-500',
  'from-gray-600 to-red-600',
  'from-yellow-400 to-pink-500',
]
const emojis: string[] = ['🎵', '🎶', '♪', '♫', '🎼', '🎤']

const formatPlayCount = (count: number): string => {
  const wan = Math.floor(count / 10000)
  if (wan > 0) {
    return t('common.playCount', { count: wan })
  }
  return t('common.playCountRaw', { count })
}

const loadHomeData = async () => {
  state.isHomeLoading = true
  try {
    const [b, p, s] = await Promise.all([
      banner({ type: 0 }),
      topPlaylist({ order: 'hot', limit: 12 }),
      topSong({ type: 0 }),
    ])

    const bannerList: any[] = (b as any)?.data?.banners || (b as any)?.banners || []
    if (Array.isArray(bannerList) && bannerList.length) {
      state.banners = bannerList.map(
        (item: any, i: number): BannerItem => ({
          title: item?.typeTitle || t('home.bannerTitleDefault'),
          description: item?.title || t('home.bannerDescDefault'),
          gradient: gradients[i % gradients.length],
          coverImgUrl: item?.imageUrl || '',
          url: item?.url || '',
        })
      )
    }

    const playlists: any[] = (p as any)?.data?.playlists || (p as any)?.playlists || []
    if (Array.isArray(playlists) && playlists.length) {
      state.recommendPlaylists = playlists.map(
        (pl: any, i: number): PlaylistItem => ({
          id: pl?.id || 0,
          name: pl?.name || t('home.playlistFallback'),
          count: pl?.playCount || pl?.trackCount || 0,
          emoji: emojis[i % emojis.length],
          gradient: gradients[i % gradients.length],
          coverImgUrl: pl?.coverImgUrl || '',
        })
      )
    }

    const songData =
      (s as any)?.data?.data ||
      (s as any)?.data?.songs ||
      (s as any)?.songs ||
      (s as any)?.data ||
      []
    if (Array.isArray(songData) && songData.length) {
      state.hotSongs = songData.map(
        (it: any, i: number): SongItem => ({
          id: (it?.id ?? '') as number | string,
          name: it?.name,
          artist: Array.isArray(it?.artists) ? it.artists.map((a: any) => a.name).join(' / ') : '',
          artistId: Array.isArray(it?.artists) && it.artists[0]?.id ? it.artists[0].id : 0,
          album: it?.album?.name || '',
          albumId: it?.album?.id || 0,
          duration: it?.duration || 0,
          emoji: emojis[i % emojis.length],
          gradient: gradients[i % gradients.length],
          liked: false,
          cover: it?.album?.picUrl || '',
        })
      )
    }
  } catch {
  } finally {
    state.isHomeLoading = false
  }
}

onMounted(() => {
  loadHomeData()
  setInterval(() => {
    if (state.banners.length > 0) {
      state.currentBannerIndex = (state.currentBannerIndex + 1) % state.banners.length
    }
  }, 5000)
})
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="custom-scrollbar h-full overflow-y-auto">
      <template v-if="isHomeLoading">
        <HomeSkeleton />
      </template>
      <template v-else>
        <div class="p-6">
          <!-- Bento Grid 主布局 -->
          <div class="bento-grid">
            <!-- 大Banner区域 - 占据左侧大块 -->
            <div class="bento-banner">
              <div class="relative h-full overflow-hidden rounded-3xl">
                <a
                  v-for="(item, index) in banners"
                  :key="index"
                  :href="item.url"
                  target="_blank"
                  class="absolute inset-0 transition-all duration-700 ease-out"
                  :class="currentBannerIndex === index ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-105'"
                >
                  <LazyImage
                    v-if="item.coverImgUrl"
                    :src="item.coverImgUrl"
                    :alt="t('home.bannerAlt')"
                    img-class="h-full w-full object-cover"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div class="absolute bottom-0 left-0 right-0 p-8">
                    <span class="mb-3 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                      {{ item.title }}
                    </span>
                    <h2 class="mb-4 line-clamp-2 text-2xl font-bold text-white drop-shadow-lg lg:text-3xl">
                      {{ item.description }}
                    </h2>
                    <router-link
                      to="/mv-list"
                      class="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                    >
                      <span class="icon-[mdi--play] h-5 w-5"></span>
                      {{ t('home.playNow') }}
                    </router-link>
                  </div>
                </a>
                <!-- 轮播指示器 -->
                <div class="absolute bottom-8 right-8 flex gap-2">
                  <button
                    v-for="(_, index) in banners"
                    :key="index"
                    @click="currentBannerIndex = index"
                    class="h-2 rounded-full transition-all duration-300"
                    :class="currentBannerIndex === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'"
                  ></button>
                </div>
              </div>
            </div>

            <!-- 快捷入口 - 右上角 2x2 网格 -->
            <router-link to="/discover" class="bento-quick bento-quick-1 group">
              <div class="bento-quick-inner from-pink-500/90 to-rose-600/90">
                <span class="icon-[mdi--compass] h-8 w-8 text-white/90 transition-transform group-hover:scale-110"></span>
                <div class="mt-auto">
                  <h3 class="text-lg font-bold text-white">{{ t('home.quickEntry.discover') }}</h3>
                  <p class="text-sm text-white/70">{{ t('home.quickEntry.discoverDesc') }}</p>
                </div>
              </div>
            </router-link>

            <router-link to="/charts" class="bento-quick bento-quick-2 group">
              <div class="bento-quick-inner from-orange-500/90 to-amber-600/90">
                <span class="icon-[mdi--trophy] h-8 w-8 text-white/90 transition-transform group-hover:scale-110"></span>
                <div class="mt-auto">
                  <h3 class="text-lg font-bold text-white">{{ t('home.quickEntry.charts') }}</h3>
                  <p class="text-sm text-white/70">{{ t('home.quickEntry.chartsDesc') }}</p>
                </div>
              </div>
            </router-link>

            <router-link to="/mv-list" class="bento-quick bento-quick-3 group">
              <div class="bento-quick-inner from-violet-500/90 to-purple-600/90">
                <span class="icon-[mdi--play-box] h-8 w-8 text-white/90 transition-transform group-hover:scale-110"></span>
                <div class="mt-auto">
                  <h3 class="text-lg font-bold text-white">{{ t('home.quickEntry.mv') }}</h3>
                  <p class="text-sm text-white/70">{{ t('home.quickEntry.mvDesc') }}</p>
                </div>
              </div>
            </router-link>

            <router-link to="/recent" class="bento-quick bento-quick-4 group">
              <div class="bento-quick-inner from-cyan-500/90 to-blue-600/90">
                <span class="icon-[mdi--history] h-8 w-8 text-white/90 transition-transform group-hover:scale-110"></span>
                <div class="mt-auto">
                  <h3 class="text-lg font-bold text-white">{{ t('home.quickEntry.recent') }}</h3>
                  <p class="text-sm text-white/70">{{ t('home.quickEntry.recentDesc') }}</p>
                </div>
              </div>
            </router-link>

            <!-- 特色歌单 - 大卡片 -->
            <router-link
              v-if="recommendPlaylists[0]"
              :to="`/playlist/${recommendPlaylists[0].id}`"
              class="bento-featured group"
            >
              <div class="relative h-full overflow-hidden rounded-3xl">
                <LazyImage
                  :src="recommendPlaylists[0].coverImgUrl + '?param=400y400'"
                  :alt="t('common.coverAlt')"
                  img-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                  <span class="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-2xl backdrop-blur-sm">
                    <span class="icon-[mdi--play] h-8 w-8 text-pink-500"></span>
                  </span>
                </div>
                <div class="absolute bottom-0 left-0 right-0 p-6">
                  <div class="mb-2 flex items-center gap-2">
                    <span class="rounded-full bg-pink-500/80 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      {{ t('home.recommendPlaylists') }}
                    </span>
                    <span class="flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-xs text-white backdrop-blur-sm">
                      <span class="icon-[mdi--play] h-3 w-3"></span>
                      {{ formatPlayCount(recommendPlaylists[0].count) }}
                    </span>
                  </div>
                  <h3 class="line-clamp-2 text-xl font-bold text-white">{{ recommendPlaylists[0].name }}</h3>
                </div>
              </div>
            </router-link>

            <!-- 热门单曲区域 -->
            <div class="bento-songs">
              <div class="mb-4 flex items-center justify-between">
                <h2 class="text-primary flex items-center gap-2 text-lg font-bold">
                  <span class="icon-[mdi--fire] h-5 w-5 text-orange-400"></span>
                  {{ t('home.hotSongs') }}
                </h2>
                <router-link
                  to="/charts"
                  class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm transition-colors"
                >
                  {{ t('common.viewAll') }}
                  <span class="icon-[mdi--chevron-right] h-4 w-4"></span>
                </router-link>
              </div>
              <div class="glass-card overflow-hidden rounded-2xl">
                <SongList
                  :songs="hotSongs.slice(0, 5)"
                  :current-playing-index="currentPlayingIndex"
                  :show-header="false"
                  :show-controls="false"
                />
              </div>
            </div>
          </div>

          <!-- 推荐歌单网格 -->
          <section class="mt-8">
            <div class="mb-5 flex items-center justify-between">
              <h2 class="text-primary flex items-center gap-3 text-xl font-bold">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30">
                  <span class="icon-[mdi--playlist-music] h-6 w-6 text-white"></span>
                </span>
                {{ t('home.recommendPlaylists') }}
              </h2>
              <router-link
                to="/discover"
                class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm font-medium transition-colors"
              >
                {{ t('common.viewAll') }}
                <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
              </router-link>
            </div>
            <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              <router-link
                v-for="(playlist, index) in recommendPlaylists.slice(1, 7)"
                :key="index"
                :to="`/playlist/${playlist.id}`"
                class="group"
              >
                <div class="relative mb-3 aspect-square overflow-hidden rounded-2xl shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-pink-500/20">
                  <LazyImage
                    :src="playlist.coverImgUrl + '?param=300y300'"
                    :alt="t('common.coverAlt')"
                    img-class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                    <span class="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-xl transition-transform group-hover:scale-110">
                      <span class="icon-[mdi--play] h-7 w-7 text-pink-500"></span>
                    </span>
                  </div>
                  <div class="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <span class="icon-[mdi--play] h-3 w-3"></span>
                    {{ formatPlayCount(playlist.count) }}
                  </div>
                </div>
                <h3 class="text-primary line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-pink-400">
                  {{ playlist.name }}
                </h3>
              </router-link>
            </div>
          </section>

          <!-- 更多歌单横向列表 -->
          <section class="mt-8">
            <div class="mb-5 flex items-center justify-between">
              <h2 class="text-primary flex items-center gap-3 text-xl font-bold">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/30">
                  <span class="icon-[mdi--music-box-multiple] h-6 w-6 text-white"></span>
                </span>
                {{ t('home.morePlaylists') }}
              </h2>
            </div>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <router-link
                v-for="(playlist, index) in recommendPlaylists.slice(7, 13)"
                :key="index"
                :to="`/playlist/${playlist.id}`"
                class="group block"
              >
                <div class="glass-card flex items-center gap-4 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg">
                  <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl shadow-md">
                    <LazyImage
                      :src="playlist.coverImgUrl + '?param=120y120'"
                      :alt="t('common.coverAlt')"
                      img-class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-primary line-clamp-1 font-medium transition-colors group-hover:text-violet-400">
                      {{ playlist.name }}
                    </h3>
                    <p class="text-primary/50 mt-1 flex items-center gap-1.5 text-sm">
                      <span class="icon-[mdi--play] h-3.5 w-3.5"></span>
                      {{ formatPlayCount(playlist.count) }}
                    </p>
                  </div>
                  <span class="icon-[mdi--play-circle] text-primary/20 h-10 w-10 shrink-0 transition-all group-hover:scale-110 group-hover:text-violet-400"></span>
                </div>
              </router-link>
            </div>
          </section>

          <!-- 最近播放 -->
          <section v-if="recentPlayed.length > 0" class="mt-8 pb-4">
            <div class="mb-5 flex items-center justify-between">
              <h2 class="text-primary flex items-center gap-3 text-xl font-bold">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30">
                  <span class="icon-[mdi--clock-outline] h-6 w-6 text-white"></span>
                </span>
                {{ t('home.recentPlayed') }}
              </h2>
              <router-link
                to="/recent"
                class="text-primary/50 hover:text-primary flex items-center gap-1 text-sm font-medium transition-colors"
              >
                {{ t('common.viewAll') }}
                <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
              </router-link>
            </div>
            <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div
                v-for="(item, index) in recentPlayed"
                :key="index"
                class="glass-card group cursor-pointer rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-lg"
              >
                <div class="flex items-center gap-4">
                  <div
                    class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow-lg"
                    :class="item.gradient"
                  >
                    {{ item.emoji }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-primary truncate font-medium group-hover:text-cyan-400">{{ item.name }}</h3>
                    <p class="text-primary/50 mt-0.5 truncate text-sm">{{ item.artist }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
@reference '../style/tailwind.css'

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Bento Grid 布局 */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(3, minmax(120px, auto));
  gap: 1rem;
}

/* Banner - 左侧大块 */
.bento-banner {
  grid-column: span 8;
  grid-row: span 2;
  min-height: 320px;
}

/* 快捷入口 - 右侧 2x2 */
.bento-quick {
  grid-column: span 2;
  grid-row: span 1;
}

.bento-quick-1 { grid-column: 9 / 11; grid-row: 1; }
.bento-quick-2 { grid-column: 11 / 13; grid-row: 1; }
.bento-quick-3 { grid-column: 9 / 11; grid-row: 2; }
.bento-quick-4 { grid-column: 11 / 13; grid-row: 2; }

.bento-quick-inner {
  @apply flex h-full flex-col rounded-2xl bg-gradient-to-br p-5 transition-all duration-300;
}

.bento-quick:hover .bento-quick-inner {
  @apply -translate-y-1 shadow-xl;
}

/* 特色歌单 */
.bento-featured {
  grid-column: span 4;
  grid-row: span 1;
  min-height: 200px;
}

/* 热门单曲 */
.bento-songs {
  grid-column: span 8;
  grid-row: span 1;
}

/* 响应式调整 */
@media (max-width: 1280px) {
  .bento-banner {
    grid-column: span 7;
  }
  .bento-quick-1 { grid-column: 8 / 10; }
  .bento-quick-2 { grid-column: 10 / 13; }
  .bento-quick-3 { grid-column: 8 / 10; }
  .bento-quick-4 { grid-column: 10 / 13; }
  .bento-featured {
    grid-column: span 5;
  }
  .bento-songs {
    grid-column: span 7;
  }
}

@media (max-width: 1024px) {
  .bento-grid {
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: auto;
  }
  .bento-banner {
    grid-column: span 6;
    grid-row: span 1;
    min-height: 280px;
  }
  .bento-quick {
    grid-column: span 3;
  }
  .bento-quick-1 { grid-column: 1 / 4; grid-row: 2; }
  .bento-quick-2 { grid-column: 4 / 7; grid-row: 2; }
  .bento-quick-3 { grid-column: 1 / 4; grid-row: 3; }
  .bento-quick-4 { grid-column: 4 / 7; grid-row: 3; }
  .bento-featured {
    grid-column: span 3;
    grid-row: 4;
  }
  .bento-songs {
    grid-column: span 3;
    grid-row: 4;
  }
}

@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .bento-banner {
    grid-column: span 2;
    min-height: 240px;
  }
  .bento-quick {
    grid-column: span 1;
  }
  .bento-quick-1 { grid-column: 1; grid-row: 2; }
  .bento-quick-2 { grid-column: 2; grid-row: 2; }
  .bento-quick-3 { grid-column: 1; grid-row: 3; }
  .bento-quick-4 { grid-column: 2; grid-row: 3; }
  .bento-featured {
    grid-column: span 2;
    grid-row: 4;
    min-height: 180px;
  }
  .bento-songs {
    grid-column: span 2;
    grid-row: 5;
  }
}
</style>
