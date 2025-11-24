<script setup lang="ts">
import { banner, topPlaylist, topSong } from '@/api'
import { BannerItem, PlaylistItem, SongItem, RecentItem } from '@/api/interface'

interface HomeState {
  banners: BannerItem[]
  currentBannerIndex: number
  recommendPlaylists: PlaylistItem[]
  hotSongs: SongItem[]
  recentPlayed: RecentItem[]
  isHomeLoading: boolean
}

const state = reactive<HomeState>({
  banners: [],
  currentBannerIndex: 0,
  recommendPlaylists: [],
  hotSongs: [],
  recentPlayed: [],
  isHomeLoading: true,
})

const { banners, currentBannerIndex, recommendPlaylists, hotSongs, recentPlayed, isHomeLoading } =
  toRefs(state)

const playlistScrollRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const updatePlaylistScrollButtons = () => {
  const el = playlistScrollRef.value
  if (!el) return
  const { scrollLeft, scrollWidth, clientWidth } = el
  canScrollLeft.value = scrollLeft > 0
  canScrollRight.value = scrollLeft + clientWidth < scrollWidth - 1
}

const scrollPlaylist = (dir: 'left' | 'right') => {
  const el = playlistScrollRef.value
  if (!el) return
  const amount = Math.floor(el.clientWidth * 0.9)
  const next = dir === 'left' ? el.scrollLeft - amount : el.scrollLeft + amount
  el.scrollTo({ left: next, behavior: 'smooth' })
  setTimeout(updatePlaylistScrollButtons, 300)
}

const gradients: string[] = [
  'from-pink-400 to-purple-500',
  'from-blue-400 to-cyan-500',
  'from-purple-500 to-pink-500',
  'from-red-400 to-orange-500',
  'from-gray-600 to-red-600',
  'from-yellow-400 to-pink-500',
]
const emojis: string[] = ['🎵', '🎶', '♪', '♫', '🎼', '🎤']

const loadHomeData = async () => {
  state.isHomeLoading = true
  try {
    const [b, p, s] = await Promise.all([
      banner({ type: 0 }),
      topPlaylist({ order: 'hot', limit: 10 }),
      topSong({ type: 0 }),
    ])

    const bannerList: any[] = (b as any)?.data?.banners || (b as any)?.banners || []
    if (Array.isArray(bannerList) && bannerList.length) {
      state.banners = bannerList.map(
        (item: any, i: number): BannerItem => ({
          title: item?.typeTitle || '精选推荐',
          description: item?.title || '为你推荐的精彩内容',
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
          name: pl?.name || '歌单',
          count: pl?.trackCount || 0,
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
          album: it?.album?.name || '',
          duration: it?.duration || 0,
          emoji: emojis[i % emojis.length],
          gradient: gradients[i % gradients.length],
          liked: false,
          cover: it?.album?.picUrl || '',
        })
      )
    }
  } finally {
    state.isHomeLoading = false
  }
}

onMounted(() => {
  loadHomeData()
  setInterval(() => {
    if (state.banners.length > 0)
      state.currentBannerIndex = (state.currentBannerIndex + 1) % state.banners.length
  }, 5000)
  nextTick(updatePlaylistScrollButtons)
})

watch(
  () => recommendPlaylists.value.length,
  async () => {
    await nextTick()
    updatePlaylistScrollButtons()
  }
)
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <template v-if="isHomeLoading">
        <HomeSkeleton />
      </template>
      <section v-else class="relative mb-4 h-48 overflow-hidden rounded-2xl px-3">
        <div class="relative h-full w-full overflow-hidden rounded-2xl">
          <img
            v-if="banners[currentBannerIndex]?.coverImgUrl"
            :src="banners[currentBannerIndex]?.coverImgUrl"
            alt="轮播封面"
            loading="lazy"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <div
            class="absolute inset-0 bg-linear-to-br opacity-60"
            :class="banners[currentBannerIndex]?.gradient"
          ></div>
          <div class="relative z-10 flex h-full items-center rounded-2xl p-4">
            <div class="flex-1">
              <h2 class="mb-2 text-2xl font-bold text-white">
                {{ banners[currentBannerIndex]?.title }}
              </h2>
              <p class="mb-3 text-sm text-white/90">
                {{ banners[currentBannerIndex]?.description }}
              </p>
              <router-link
                to="/mv-list"
                class="glass-button inline-flex items-center gap-1 bg-white/20 px-4 py-2 text-sm text-white hover:bg-white/30"
              >
                <span class="icon-[mdi--play] mr-1 h-4 w-4"></span>
                立即播放
              </router-link>
            </div>
          </div>
        </div>
      </section>

      <div class="px-3 pb-6">
        <section class="mb-8">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="flex items-center text-lg font-bold text-white">
              <span class="icon-[mdi--playlist-music] mr-2 h-5 w-5 text-pink-400"></span>
              推荐歌单
            </h2>
            <router-link
              to="/playlist/1"
              class="text-purple-300 transition-colors hover:text-white"
            >
              <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
            </router-link>
          </div>
          <div class="relative">
            <button
              v-show="canScrollLeft"
              @click="scrollPlaylist('left')"
              class="glass-button absolute top-1/2 left-1 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              <span class="icon-[mdi--chevron-left] h-5 w-5 text-white"></span>
            </button>
            <button
              v-show="canScrollRight"
              @click="scrollPlaylist('right')"
              class="glass-button absolute top-1/2 right-1 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              <span class="icon-[mdi--chevron-right] h-5 w-5 text-white"></span>
            </button>
            <div
              ref="playlistScrollRef"
              @scroll="updatePlaylistScrollButtons"
              class="scrollbar-hide flex items-center gap-3 overflow-x-auto"
            >
              <router-link
                v-for="(playlist, index) in recommendPlaylists"
                :key="index"
                :to="`/playlist/${playlist.id}`"
                class="group w-40 flex-none cursor-pointer"
              >
                <div
                  class="glass-card h-full p-3 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                >
                  <div class="relative mb-2 w-full overflow-hidden rounded-lg">
                    <img
                      :src="playlist.coverImgUrl + '?param=300y300'"
                      alt="歌单封面"
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    >
                      <button class="glass-button flex h-10 w-10 items-center justify-center">
                        <span class="icon-[mdi--play] h-4 w-4 text-white"></span>
                      </button>
                    </div>
                  </div>
                  <h3 class="mb-1 truncate text-xs font-medium text-white">{{ playlist.name }}</h3>
                  <p class="truncate text-[11px] text-purple-300">{{ playlist.count }}首歌曲</p>
                </div>
              </router-link>
            </div>
          </div>
        </section>

        <section class="mb-8">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="flex items-center text-lg font-bold text-white">
              <span class="icon-[mdi--fire] mr-2 h-5 w-5 text-orange-400"></span>
              热门单曲
            </h2>
          </div>
          <div class="w-full overflow-hidden">
            <HotSongsMobile :songs="hotSongs" />
          </div>
        </section>

        <section v-if="recentPlayed.length > 0">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="flex items-center text-lg font-bold text-white">
              <span class="icon-[mdi--clock-outline] mr-2 h-5 w-5 text-blue-400"></span>
              最近播放
            </h2>
            <router-link to="/mv-list" class="text-purple-300 transition-colors hover:text-white">
              <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
            </router-link>
          </div>
          <div class="grid grid-cols-1 gap-3">
            <div
              v-for="(item, index) in recentPlayed"
              :key="index"
              class="glass-card cursor-pointer p-3 transition-all duration-300 hover:scale-105"
            >
              <div class="flex items-center space-x-3">
                <div
                  class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-xl"
                  :class="item.gradient"
                >
                  {{ item.emoji }}
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate text-sm font-medium text-white">{{ item.name }}</h3>
                  <p class="truncate text-xs text-purple-300">{{ item.artist }}</p>
                  <p class="text-[11px] text-purple-400">{{ item.playTime }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
