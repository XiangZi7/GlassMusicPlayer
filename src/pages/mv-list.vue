<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <!-- 页面头部 -->
      <section class="relative mb-8 overflow-hidden">
        <!-- 背景模糊效果 -->
        <div class="absolute inset-0">
          <div
            class="h-full w-full scale-110 bg-linear-to-br from-purple-500 via-pink-500 to-indigo-600 opacity-30 blur-3xl"
          ></div>
        </div>

        <!-- 浮动音符背景 -->
        <div class="absolute inset-0 overflow-hidden">
          <div class="floating-notes">
            <div v-for="i in 8" :key="i" class="note" :style="{ animationDelay: i * 0.8 + 's' }">
              {{ ['🎬', '🎥', '📹', '🎞️', '🎪', '🌟', '✨', '💫'][i - 1] }}
            </div>
          </div>
        </div>

        <div class="relative z-10 p-8">
          <div class="text-center">
            <h1 class="animate-fade-in-up mb-4 text-5xl font-bold text-white">🎬 MV 精选</h1>
            <p class="animate-fade-in-up mb-6 text-xl text-white/80" style="animation-delay: 0.2s">
              精彩的音乐视频，带给你视听双重享受
            </p>

            <!-- 筛选标签 -->
            <div
              class="animate-fade-in-up flex flex-wrap justify-center gap-3"
              style="animation-delay: 0.4s"
            >
              <button
                v-for="category in categories"
                :key="category.name"
                class="glass-button px-6 py-2 text-white transition-all duration-300"
                :class="
                  selectedCategory === category.name
                    ? 'bg-white/30'
                    : 'bg-white/10 hover:bg-white/20'
                "
                @click="selectCategory(category.name)"
              >
                {{ category.emoji }} {{ category.name }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- MV网格列表 -->
      <section class="px-8 pb-8">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="mv in filteredMVs"
            :key="mv.id"
            class="mv-card glass-card group cursor-pointer transition-all duration-500 hover:scale-105 hover:shadow-2xl"
            @click="playMV(mv)"
          >
            <!-- MV封面 -->
            <div class="relative overflow-hidden rounded-t-2xl">
              <div
                class="relative flex aspect-video items-center justify-center bg-linear-to-br text-6xl"
                :class="mv.gradient"
              >
                {{ mv.emoji }}

                <!-- 播放按钮覆盖层 -->
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                >
                  <button
                    class="glass-button flex h-16 w-16 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
                  >
                    <span class="icon-[mdi--play] h-8 w-8 text-white"></span>
                  </button>
                </div>

                <!-- 时长标签 -->
                <div
                  class="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-sm text-white backdrop-blur-sm"
                >
                  {{ mv.duration }}
                </div>

                <!-- 播放次数 -->
                <div
                  class="absolute top-2 left-2 flex items-center rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm"
                >
                  <span class="icon-[mdi--play] mr-1 h-3 w-3"></span>
                  {{ mv.playCount }}
                </div>
              </div>
            </div>

            <!-- MV信息 -->
            <div class="p-4">
              <h3
                class="mb-2 truncate text-lg font-semibold text-white transition-colors group-hover:text-pink-300"
              >
                {{ mv.title }}
              </h3>
              <p class="mb-3 truncate text-sm text-purple-300">
                {{ mv.artist }}
              </p>

              <!-- 标签和操作 -->
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="inline-block rounded-full bg-white/10 px-2 py-1 text-xs text-white">
                    {{ mv.category }}
                  </span>
                  <span
                    v-if="mv.isNew"
                    class="inline-block rounded-full bg-red-500 px-2 py-1 text-xs text-white"
                  >
                    NEW
                  </span>
                </div>

                <div
                  class="flex items-center space-x-2 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <button
                    class="text-purple-300 transition-colors hover:text-white"
                    @click.stop="toggleLike(mv)"
                  >
                    <span
                      class="h-4 w-4"
                      :class="
                        mv.liked ? 'icon-[mdi--heart] text-red-400' : 'icon-[mdi--heart-outline]'
                      "
                    ></span>
                  </button>
                  <button
                    class="text-purple-300 transition-colors hover:text-white"
                    @click.stop="shareMV(mv)"
                  >
                    <span class="icon-[mdi--share] h-4 w-4"></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div class="mt-12 text-center">
          <button
            v-if="hasMore"
            class="glass-button bg-linear-to-r from-purple-500 to-pink-500 px-8 py-3 font-medium text-white transition-transform hover:scale-105"
            @click="loadMore"
          >
            <span class="icon-[mdi--refresh] mr-2 h-5 w-5"></span>
            加载更多
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 分类数据
const categories = ref([
  { name: '全部', emoji: '🎬' },
  { name: '二次元', emoji: '🎌' },
  { name: '流行', emoji: '🎤' },
  { name: '电子', emoji: '⚡' },
  { name: '摇滚', emoji: '🎸' },
  { name: '古风', emoji: '🏮' },
  { name: '治愈', emoji: '🌸' },
])

const selectedCategory = ref('全部')

// MV数据
const mvList = ref([
  {
    id: 1,
    title: '残酷天使的行动纲领',
    artist: '高橋洋子',
    duration: '4:06',
    playCount: '1.2M',
    category: '二次元',
    emoji: '👼',
    gradient: 'from-orange-400 to-red-500',
    liked: false,
    isNew: false,
  },
  {
    id: 2,
    title: '千本樱',
    artist: '初音未来',
    duration: '4:04',
    playCount: '2.8M',
    category: '二次元',
    emoji: '🌸',
    gradient: 'from-pink-400 to-purple-500',
    liked: true,
    isNew: true,
  },
  {
    id: 3,
    title: '打上花火',
    artist: 'DAOKO',
    duration: '4:49',
    playCount: '3.5M',
    category: '流行',
    emoji: '🎆',
    gradient: 'from-blue-400 to-purple-500',
    liked: false,
    isNew: false,
  },
  {
    id: 4,
    title: 'Lemon',
    artist: '米津玄師',
    duration: '4:15',
    playCount: '5.2M',
    category: '流行',
    emoji: '🍋',
    gradient: 'from-yellow-400 to-orange-500',
    liked: false,
    isNew: false,
  },
  {
    id: 5,
    title: '夜に駆ける',
    artist: 'YOASOBI',
    duration: '4:23',
    playCount: '4.1M',
    category: '流行',
    emoji: '🌙',
    gradient: 'from-indigo-400 to-purple-500',
    liked: true,
    isNew: true,
  },
  {
    id: 6,
    title: 'Shelter',
    artist: 'Porter Robinson',
    duration: '3:37',
    playCount: '1.8M',
    category: '电子',
    emoji: '🏠',
    gradient: 'from-cyan-400 to-blue-500',
    liked: false,
    isNew: false,
  },
  {
    id: 7,
    title: '青花瓷',
    artist: '周杰伦',
    duration: '3:58',
    playCount: '6.7M',
    category: '古风',
    emoji: '🏺',
    gradient: 'from-blue-600 to-indigo-700',
    liked: true,
    isNew: false,
  },
  {
    id: 8,
    title: 'Your Name',
    artist: 'RADWIMPS',
    duration: '4:44',
    playCount: '2.3M',
    category: '治愈',
    emoji: '⭐',
    gradient: 'from-purple-400 to-pink-400',
    liked: false,
    isNew: true,
  },
])

const hasMore = ref(true)

// 筛选后的MV列表
const filteredMVs = computed(() => {
  if (selectedCategory.value === '全部') {
    return mvList.value
  }
  return mvList.value.filter(mv => mv.category === selectedCategory.value)
})

// 选择分类
const selectCategory = (category: string) => {
  selectedCategory.value = category
}

// 播放MV
const playMV = (mv: any) => {
  router.push(`/mv-player/${mv.id}`)
}

// 切换喜欢状态
const toggleLike = (mv: any) => {
  mv.liked = !mv.liked
  console.log(`${mv.liked ? '喜欢' : '取消喜欢'}: ${mv.title}`)
}

// 分享MV
const shareMV = (mv: any) => {
  console.log(`分享MV: ${mv.title}`)
  // 这里可以实现分享功能
}

// 加载更多
const loadMore = () => {
  // 模拟加载更多数据
  console.log('加载更多MV...')
  // 实际项目中这里会调用API获取更多数据
  hasMore.value = false
}
</script>

<style scoped>
/* 浮动音符动画 */
.floating-notes {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.note {
  position: absolute;
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.1);
  animation: float-note 15s linear infinite;
}

.note:nth-child(1) {
  left: 10%;
  animation-delay: 0s;
}
.note:nth-child(2) {
  left: 20%;
  animation-delay: 2s;
}
.note:nth-child(3) {
  left: 30%;
  animation-delay: 4s;
}
.note:nth-child(4) {
  left: 40%;
  animation-delay: 6s;
}
.note:nth-child(5) {
  left: 50%;
  animation-delay: 8s;
}
.note:nth-child(6) {
  left: 60%;
  animation-delay: 10s;
}
.note:nth-child(7) {
  left: 70%;
  animation-delay: 12s;
}
.note:nth-child(8) {
  left: 80%;
  animation-delay: 14s;
}

@keyframes float-note {
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

/* 淡入动画 */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.8s ease-out forwards;
}

/* MV卡片悬停效果 */
.mv-card:hover {
  transform: translateY(-8px) scale(1.02);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .floating-notes .note {
    font-size: 1.5rem;
  }
}
</style>
