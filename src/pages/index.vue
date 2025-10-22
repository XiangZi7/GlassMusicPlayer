<script setup lang="ts">
import SongList from '../components/SongList.vue'

// 轮播图数据
const banners = ref([
  {
    title: '二次元音乐节',
    description: '最新最热的动漫歌曲，带你进入二次元世界',
    gradient: 'from-pink-500 via-purple-500 to-indigo-600',
  },
  {
    title: '治愈系音乐',
    description: '温暖人心的旋律，陪伴你的每一个夜晚',
    gradient: 'from-blue-400 via-cyan-500 to-teal-600',
  },
  {
    title: '电子音乐专场',
    description: '节拍强劲的电子乐，点燃你的激情',
    gradient: 'from-purple-600 via-pink-500 to-red-500',
  },
])

const currentBannerIndex = ref(0)

// 推荐歌单
const recommendPlaylists = ref([
  { name: '二次元神曲', count: 50, emoji: '🎌', gradient: 'from-pink-400 to-purple-500' },
  { name: '治愈系音乐', count: 30, emoji: '🌸', gradient: 'from-blue-400 to-cyan-500' },
  { name: '电子音乐', count: 40, emoji: '⚡', gradient: 'from-purple-500 to-pink-500' },
  { name: '古风音乐', count: 25, emoji: '🏮', gradient: 'from-red-400 to-orange-500' },
  { name: '摇滚经典', count: 35, emoji: '🎸', gradient: 'from-gray-600 to-red-600' },
  { name: '流行金曲', count: 60, emoji: '🎤', gradient: 'from-yellow-400 to-pink-500' },
])

// 热门单曲
const hotSongs = ref([
  {
    id: 1,
    name: '残酷天使的行动纲领',
    artist: '高橋洋子',
    duration: '4:06',
    emoji: '👼',
    gradient: 'from-orange-400 to-red-500',
    liked: false,
  },
  {
    id: 2,
    name: '千本樱',
    artist: '初音未来',
    duration: '4:04',
    emoji: '🌸',
    gradient: 'from-pink-400 to-purple-500',
    liked: true,
  },
  {
    id: 3,
    name: '打上花火',
    artist: 'DAOKO',
    duration: '4:49',
    emoji: '🎆',
    gradient: 'from-blue-400 to-purple-500',
    liked: false,
  },
  {
    id: 4,
    name: 'Lemon',
    artist: '米津玄師',
    duration: '4:15',
    emoji: '🍋',
    gradient: 'from-yellow-400 to-orange-500',
    liked: false,
  },
  {
    id: 5,
    name: '夜に駆ける',
    artist: 'YOASOBI',
    duration: '4:23',
    emoji: '🌙',
    gradient: 'from-indigo-400 to-purple-500',
    liked: true,
  },
])

// 当前播放索引
const currentPlayingIndex = ref(-1)

// 处理播放歌曲
const handlePlaySong = (song: any, index: number) => {
  currentPlayingIndex.value = index
  console.log(`播放歌曲: ${song.name}`)
}

// 处理喜欢歌曲
const handleLikeSong = (song: any, index: number) => {
  hotSongs.value[index].liked = !hotSongs.value[index].liked
  console.log(`${hotSongs.value[index].liked ? '喜欢' : '取消喜欢'}: ${song.name}`)
}

// 处理更多选项
const handleMoreOptions = (song: any, index: number) => {
  console.log(`更多选项: ${song.name}`)
}

// 处理排序
const handleSort = () => {
  console.log('排序歌曲')
}

// 处理筛选
const handleFilter = () => {
  console.log('筛选歌曲')
}

// 最近播放
const recentPlayed = ref([
  {
    name: '千本樱',
    artist: '初音未来',
    playTime: '2小时前',
    emoji: '🌸',
    gradient: 'from-pink-400 to-purple-500',
  },
  {
    name: '残酷天使的行动纲领',
    artist: '高橋洋子',
    playTime: '昨天',
    emoji: '👼',
    gradient: 'from-orange-400 to-red-500',
  },
  {
    name: '打上花火',
    artist: 'DAOKO',
    playTime: '3天前',
    emoji: '🎆',
    gradient: 'from-blue-400 to-purple-500',
  },
])

// 轮播图自动切换
onMounted(() => {
  setInterval(() => {
    currentBannerIndex.value = (currentBannerIndex.value + 1) % banners.value.length
  }, 5000)
})
</script>
<template>
  <div class="mt-4 flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <!-- 轮播图区域 -->
      <section class="relative mb-8 h-96 overflow-hidden rounded-2xl px-4">
        <div class="carousel-container relative h-full">
          <div
            v-for="(banner, index) in banners"
            :key="index"
            class="carousel-slide absolute inset-0 overflow-hidden rounded-2xl transition-all duration-1000 ease-in-out"
            :class="currentBannerIndex === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0'"
          >
            <div class="relative h-full w-full overflow-hidden rounded-2xl">
              <!-- 背景渐变 -->
              <div
                class="absolute inset-0 bg-gradient-to-br opacity-90"
                :class="banner.gradient"
              ></div>

              <!-- 动画背景元素 -->
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

              <!-- 内容 -->
              <div class="relative z-10 flex h-full items-center overflow-hidden rounded-2xl p-8">
                <div class="flex-1">
                  <h2 class="animate-fade-in-up mb-4 text-4xl font-bold text-white drop-shadow-lg">
                    {{ banner.title }}
                  </h2>
                  <p
                    class="animate-fade-in-up mb-6 text-lg text-white/90 drop-shadow"
                    style="animation-delay: 0.2s"
                  >
                    {{ banner.description }}
                  </p>
                  <button
                    class="glass-button animate-fade-in-up bg-white/20 px-6 py-3 text-white hover:bg-white/30"
                    style="animation-delay: 0.4s"
                  >
                    <span class="icon-[mdi--play] mr-2 h-5 w-5"></span>
                    立即播放
                  </button>
                </div>
                <div class="hidden md:block">
                  <div class="relative">
                    <div
                      class="animate-float h-48 w-48 rounded-full bg-white/10 p-4 backdrop-blur-sm"
                    >
                      <div
                        class="animate-spin-slow flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 text-6xl"
                      >
                        🎧
                      </div>
                    </div>
                    <!-- 环绕粒子效果 -->
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
          </div>
        </div>

        <!-- 轮播指示器 -->
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
        <!-- 推荐歌单区域 -->
        <section class="mb-12">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="flex items-center text-2xl font-bold text-white">
              <span class="icon-[mdi--playlist-music] mr-3 h-6 w-6 text-pink-400"></span>
              推荐歌单
            </h2>
            <button class="text-purple-300 transition-colors hover:text-white">
              <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <div
              v-for="(playlist, index) in recommendPlaylists"
              :key="index"
              class="playlist-card group cursor-pointer"
            >
              <div
                class="glass-card h-full p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <div class="relative mb-3 overflow-hidden rounded-xl">
                  <div
                    class="flex aspect-square items-center justify-center bg-gradient-to-br text-4xl transition-transform duration-300 group-hover:scale-110"
                    :class="playlist.gradient"
                  >
                    {{ playlist.emoji }}
                  </div>
                  <!-- 播放按钮覆盖层 -->
                  <div
                    class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  >
                    <button class="glass-button flex h-12 w-12 items-center justify-center">
                      <span class="icon-[mdi--play] h-5 w-5 text-white"></span>
                    </button>
                  </div>
                </div>
                <h3 class="mb-1 truncate text-sm font-medium text-white">{{ playlist.name }}</h3>
                <p class="truncate text-xs text-purple-300">{{ playlist.count }}首歌曲</p>
              </div>
            </div>
          </div>
        </section>

        <!-- 热门单曲区域 -->
        <section class="mb-12">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="flex items-center text-2xl font-bold text-white">
              <span class="icon-[mdi--fire] mr-3 h-6 w-6 text-orange-400"></span>
              热门单曲
            </h2>
            <button class="text-purple-300 transition-colors hover:text-white">
              <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
            </button>
          </div>

          <SongList
            :songs="hotSongs"
            :current-playing-index="currentPlayingIndex"
            :show-header="false"
            :show-controls="false"
            @play="handlePlaySong"
            @like="handleLikeSong"
            @more="handleMoreOptions"
            @sort="handleSort"
            @filter="handleFilter"
          />
        </section>

        <!-- 最近播放区域 -->
        <section>
          <div class="mb-6 flex items-center justify-between">
            <h2 class="flex items-center text-2xl font-bold text-white">
              <span class="icon-[mdi--clock-outline] mr-3 h-6 w-6 text-blue-400"></span>
              最近播放
            </h2>
            <button class="text-purple-300 transition-colors hover:text-white">
              <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
            </button>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="(item, index) in recentPlayed"
              :key="index"
              class="recent-item glass-card cursor-pointer p-4 transition-all duration-300 hover:scale-105"
            >
              <div class="flex items-center space-x-3">
                <div
                  class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl"
                  :class="item.gradient"
                >
                  {{ item.emoji }}
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate font-medium text-white">{{ item.name }}</h3>
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
