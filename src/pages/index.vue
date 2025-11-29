<script setup lang="ts">
import { banner, topPlaylist, topSong } from '@/api'
import { useI18n } from 'vue-i18n'
import { BannerItem, PlaylistItem, SongItem, RecentItem } from '@/api/interface'

interface HomeState {
  // 轮播图数据
  banners: BannerItem[]
  // 当前轮播索引
  currentBannerIndex: number
  // 推荐歌单列表
  recommendPlaylists: PlaylistItem[]
  // 热门单曲列表
  hotSongs: SongItem[]
  // 当前播放索引
  currentPlayingIndex: number
  // 最近播放列表
  recentPlayed: RecentItem[]
  // 首页加载状态
  isHomeLoading: boolean
}
const { t } = useI18n()

// 页面响应式状态容器（仅模板使用的变量通过 toRefs 解构）
const state = reactive<HomeState>({
  // 轮播图数据
  banners: [],
  // 当前轮播索引
  currentBannerIndex: 0,
  // 推荐歌单列表
  recommendPlaylists: [],
  // 热门单曲列表
  hotSongs: [],
  // 当前播放索引
  currentPlayingIndex: -1,
  // 最近播放列表
  recentPlayed: [],
  // 首页加载状态
  isHomeLoading: true,
})

// 模板中使用的变量解构为 ref（仅供 template 使用）
const {
  banners,
  currentBannerIndex,
  recommendPlaylists,
  hotSongs,
  currentPlayingIndex,
  recentPlayed,
  isHomeLoading,
} = toRefs(state)

// 推荐歌单横向滚动容器引用与左右按钮状态
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
  const amount = el.clientWidth
  const next = dir === 'left' ? el.scrollLeft - amount : el.scrollLeft + amount
  el.scrollTo({ left: next, behavior: 'smooth' })
  // 延迟更新按钮状态以匹配平滑滚动后的位置
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
  // 轮播图自动切换
  setInterval(() => {
    if (state.banners.length > 0) {
      state.currentBannerIndex = (state.currentBannerIndex + 1) % state.banners.length
    }
  }, 5000)
  // 初始更新推荐歌单滚动按钮状态
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
  <div class="mt-4 flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <template v-if="isHomeLoading">
        <HomeSkeleton />
      </template>
      <section class="relative mb-8 h-72 overflow-hidden rounded-2xl px-4" v-else>
        <div class="carousel-container relative h-full">
          <a
            :href="banner.url"
            v-for="(banner, index) in banners"
            :key="index"
            target="_blank"
            class="carousel-slide absolute inset-0 overflow-hidden rounded-2xl transition-all duration-1000 ease-in-out"
            :class="currentBannerIndex === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0'"
          >
            <div class="relative h-full w-full overflow-hidden rounded-2xl">
              <img
                v-if="banner.coverImgUrl"
                :src="banner.coverImgUrl"
                :alt="t('home.bannerAlt')"
                loading="lazy"
                class="absolute inset-0 h-full w-full object-cover"
              />
              <div
                class="absolute inset-0 bg-linear-to-br opacity-60"
                :class="banner.gradient"
              ></div>
              <div class="absolute inset-0">
                <div class="floating-notes">
                  <div
                    v-for="i in 6"
                    :key="i"
                    class="note"
                    :style="{ animationDelay: i * 0.5 + 's' }"
                  >
                    {{ ['🎵', '🎶', '♪', '♫', '🎼', '🎤'][i - 1] }}
                  </div>
                </div>
              </div>
              <div class="relative z-10 flex h-full items-center overflow-hidden rounded-2xl p-8">
                <div class="flex-1">
                  <h2
                    class="animate-fade-in-up text-primary mb-4 text-4xl font-bold drop-shadow-lg"
                  >
                    {{ banner.title }}
                  </h2>
                  <p
                    class="animate-fade-in-up text-primary/90 mb-6 text-lg drop-shadow"
                    style="animation-delay: 0.2s"
                  >
                    {{ banner.description }}
                  </p>
                  <router-link
                    to="/mv-list"
                    class="glass-button animate-fade-in-up text-primary inline-flex items-center gap-1 bg-white/20 px-6 py-3 hover:bg-white/30"
                    style="animation-delay: 0.4s"
                  >
                    <span class="icon-[mdi--play] mr-2 h-5 w-5"></span>
                    {{ t('home.playNow') }}
                  </router-link>
                </div>
                <div class="hidden md:block">
                  <div class="relative">
                    <div
                      class="animate-float h-48 w-48 rounded-full bg-white/10 p-4 backdrop-blur-sm"
                    >
                      <div
                        class="animate-spin-slow flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-pink-400 to-purple-600 text-6xl"
                      >
                        🎧
                      </div>
                    </div>
                    <div class="absolute inset-0">
                      <div
                        v-for="i in 8"
                        :key="i"
                        class="particle absolute h-2 w-2 rounded-full bg-white/60"
                        :style="{
                          top: '50%',
                          left: '50%',
                          transform: `rotate(${i * 45}deg) translateX(120px)`,
                          animationDelay: i * 0.2 + 's',
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </a>
        </div>
        <div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 space-x-2">
          <button
            v-for="(banner, index) in banners"
            :key="index"
            @click="currentBannerIndex = index"
            class="h-2 w-8 rounded-full transition-all duration-300"
            :class="currentBannerIndex === index ? 'bg-white' : 'bg-white/40'"
          ></button>
        </div>
      </section>

      <!-- 主要内容区域 -->
      <div class="px-4 pb-8">
        <section class="mb-12">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-primary flex items-center text-2xl font-bold">
              <span class="icon-[mdi--playlist-music] mr-3 h-6 w-6 text-pink-400"></span>
              {{ t('home.recommendPlaylists') }}
            </h2>
            <router-link
              to="/playlist/1"
              class="hover:text-primary text-purple-300 transition-colors"
            >
              <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
            </router-link>
          </div>
          <div class="relative">
            <button
              v-show="canScrollLeft"
              @click="scrollPlaylist('left')"
              class="glass-button absolute top-1/2 left-2 z-10 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              <span class="icon-[mdi--chevron-left] text-primary h-5 w-5"></span>
            </button>
            <button
              v-show="canScrollRight"
              @click="scrollPlaylist('right')"
              class="glass-button absolute top-1/2 right-2 z-10 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              <span class="icon-[mdi--chevron-right] text-primary h-5 w-5"></span>
            </button>
            <div
              ref="playlistScrollRef"
              @scroll="updatePlaylistScrollButtons"
              class="scrollbar-hide -my-5 flex items-center gap-4 overflow-x-auto px-5"
            >
              <router-link
                v-for="(playlist, index) in recommendPlaylists"
                :key="index"
                :to="`/playlist/${playlist.id}`"
                class="playlist-card group w-64 flex-none cursor-pointer"
              >
                <div class="glass-card h-full p-4 transition-all duration-300">
                  <div class="relative mb-3 w-full overflow-hidden rounded-xl">
                    <img
                      :src="playlist.coverImgUrl + '?param=500y500'"
                      alt="歌单封面"
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    >
                      <button class="glass-button flex h-12 w-12 items-center justify-center">
                        <span class="icon-[mdi--play] text-primary h-5 w-5"></span>
                      </button>
                    </div>
                  </div>
                  <h3 class="text-primary mb-1 truncate text-sm font-medium">
                    {{ playlist.name }}
                  </h3>
                  <p class="truncate text-xs text-purple-300">
                    {{ t('home.playlistCount', { count: playlist.count }) }}
                  </p>
                </div>
              </router-link>
            </div>
          </div>
        </section>

        <section class="mb-12">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-primary flex items-center text-2xl font-bold">
              <span class="icon-[mdi--fire] mr-3 h-6 w-6 text-orange-400"></span>
              {{ t('home.hotSongs') }}
            </h2>
          </div>
          <div class="h-[40vh] w-full overflow-hidden">
            <SongList
              :songs="hotSongs"
              :current-playing-index="currentPlayingIndex"
              :show-header="false"
              :show-controls="false"
            />
          </div>
        </section>

        <section v-if="recentPlayed.length > 0">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-primary flex items-center text-2xl font-bold">
              <span class="icon-[mdi--clock-outline] mr-3 h-6 w-6 text-blue-400"></span>
              {{ t('home.recentPlayed') }}
            </h2>
            <router-link to="/mv-list" class="hover:text-primary text-purple-300 transition-colors">
              <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
            </router-link>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="(item, index) in recentPlayed"
              :key="index"
              class="recent-item glass-card cursor-pointer p-4 transition-all duration-300 hover:scale-105"
            >
              <div class="flex items-center space-x-3">
                <div
                  class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-2xl"
                  :class="item.gradient"
                >
                  {{ item.emoji }}
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="text-primary truncate font-medium">{{ item.name }}</h3>
                  <p class="truncate text-sm text-purple-300">{{ item.artist }}</p>
                  <p class="text-xs text-purple-400">{{ item.playTime }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 动画定义 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
}

@keyframes spinSlow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes noteFloat {
  0% {
    transform: translateY(100vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) rotate(360deg);
    opacity: 0;
  }
}

@keyframes particleOrbit {
  from {
    transform: rotate(0deg) translateX(120px) rotate(0deg);
  }
  to {
    transform: rotate(360deg) translateX(120px) rotate(-360deg);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out forwards;
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

.animate-spin-slow {
  animation: spinSlow 20s linear infinite;
}

.floating-notes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.note {
  position: absolute;
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.3);
  animation: noteFloat 8s linear infinite;
  left: random(100) * 1%;
}

.note:nth-child(1) {
  left: 10%;
  animation-duration: 8s;
}
.note:nth-child(2) {
  left: 20%;
  animation-duration: 10s;
}
.note:nth-child(3) {
  left: 40%;
  animation-duration: 7s;
}
.note:nth-child(4) {
  left: 60%;
  animation-duration: 9s;
}
.note:nth-child(5) {
  left: 80%;
  animation-duration: 11s;
}
.note:nth-child(6) {
  left: 90%;
  animation-duration: 6s;
}

.particle {
  animation: particleOrbit 4s linear infinite;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .carousel-slide h2 {
    font-size: 2rem;
  }

  .carousel-slide p {
    font-size: 1rem;
  }
}
</style>
