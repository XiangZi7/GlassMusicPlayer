<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <!-- 返回按钮 -->
      <div class="p-4">
        <button 
          class="glass-button bg-white/10 hover:bg-white/20 px-4 py-2 text-white flex items-center space-x-2 transition-all duration-300"
          @click="goBack"
        >
          <span class="icon-[mdi--arrow-left] w-5 h-5"></span>
          <span>返回</span>
        </button>
      </div>

      <!-- MV播放器区域 -->
      <section class="px-8 pb-8">
        <div class="glass-card overflow-hidden">
          <!-- 视频播放器 -->
          <div class="relative bg-black">
            <div class="aspect-video bg-linear-to-br flex items-center justify-center relative" :class="currentMV.gradient">
              <!-- 模拟视频播放器 -->
              <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div class="text-center">
                  <div class="text-8xl mb-4">{{ currentMV.emoji }}</div>
                  <div class="text-white text-2xl font-bold mb-2">{{ currentMV.title }}</div>
                  <div class="text-white/80 text-lg">{{ currentMV.artist }}</div>
                </div>
              </div>

              <!-- 播放控制覆盖层 -->
              <div 
                v-if="!isPlaying"
                class="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                @click="togglePlay"
              >
                <button class="glass-button w-24 h-24 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300 hover:scale-110">
                  <span class="icon-[mdi--play] w-12 h-12 text-white"></span>
                </button>
              </div>

              <!-- 播放中的控制栏 -->
              <div 
                v-if="isPlaying"
                class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-6"
                :class="{ 'opacity-0': !showControls, 'opacity-100': showControls }"
              >
                <!-- 进度条 -->
                <div class="mb-4">
                  <div class="flex items-center space-x-3 text-white text-sm mb-2">
                    <span>{{ formatTime(currentTime) }}</span>
                    <div class="flex-1 bg-white/20 rounded-full h-1 cursor-pointer" @click="seekTo">
                      <div 
                        class="bg-linear-to-r from-pink-500 to-purple-600 h-full rounded-full transition-all duration-300"
                        :style="{ width: progressPercentage + '%' }"
                      ></div>
                    </div>
                    <span>{{ formatTime(totalTime) }}</span>
                  </div>
                </div>

                <!-- 控制按钮 -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-4">
                    <button 
                      class="text-white hover:text-pink-400 transition-colors"
                      @click="togglePlay"
                    >
                      <span 
                        class="w-8 h-8"
                        :class="isPlaying ? 'icon-[mdi--pause]' : 'icon-[mdi--play]'"
                      ></span>
                    </button>
                    <button class="text-white hover:text-pink-400 transition-colors">
                      <span class="icon-[mdi--volume-high] w-6 h-6"></span>
                    </button>
                    <div class="w-20 bg-white/20 rounded-full h-1">
                      <div class="bg-white h-full rounded-full w-3/4"></div>
                    </div>
                  </div>

                  <div class="flex items-center space-x-4">
                    <button class="text-white hover:text-pink-400 transition-colors">
                      <span class="icon-[mdi--cog] w-6 h-6"></span>
                    </button>
                    <button 
                      class="text-white hover:text-pink-400 transition-colors"
                      @click="toggleFullscreen"
                    >
                      <span class="icon-[mdi--fullscreen] w-6 h-6"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- MV信息区域 -->
          <div class="p-6">
            <div class="flex flex-col lg:flex-row lg:items-start lg:space-x-8">
              <!-- 左侧：MV信息 -->
              <div class="flex-1 mb-6 lg:mb-0">
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <h1 class="text-3xl font-bold text-white mb-2">{{ currentMV.title }}</h1>
                    <p class="text-xl text-purple-300 mb-4">{{ currentMV.artist }}</p>
                    
                    <!-- 统计信息 -->
                    <div class="flex flex-wrap items-center gap-6 text-white/70 mb-4">
                      <div class="flex items-center space-x-2">
                        <span class="icon-[mdi--play] w-5 h-5"></span>
                        <span>{{ currentMV.playCount }} 次播放</span>
                      </div>
                      <div class="flex items-center space-x-2">
                        <span class="icon-[mdi--heart] w-5 h-5 text-red-400"></span>
                        <span>{{ currentMV.likes }} 点赞</span>
                      </div>
                      <div class="flex items-center space-x-2">
                        <span class="icon-[mdi--calendar] w-5 h-5"></span>
                        <span>{{ currentMV.publishDate }}</span>
                      </div>
                    </div>

                    <!-- 标签 -->
                    <div class="flex flex-wrap gap-2 mb-4">
                      <span class="inline-block px-3 py-1 text-sm bg-white/10 text-white rounded-full">
                        {{ currentMV.category }}
                      </span>
                      <span v-if="currentMV.isNew" class="inline-block px-3 py-1 text-sm bg-red-500 text-white rounded-full">
                        NEW
                      </span>
                      <span class="inline-block px-3 py-1 text-sm bg-purple-500/50 text-white rounded-full">
                        高清
                      </span>
                    </div>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="flex flex-col space-y-3">
                    <button 
                      class="glass-button bg-linear-to-r from-pink-500 to-purple-600 px-6 py-3 text-white font-medium hover:scale-105 transition-transform"
                      @click="toggleLike"
                    >
                      <span 
                        class="w-5 h-5 mr-2"
                        :class="currentMV.liked ? 'icon-[mdi--heart] text-red-400' : 'icon-[mdi--heart-outline]'"
                      ></span>
                      {{ currentMV.liked ? '已点赞' : '点赞' }}
                    </button>
                    <button class="glass-button bg-white/10 hover:bg-white/20 px-6 py-3 text-white">
                      <span class="icon-[mdi--share] w-5 h-5 mr-2"></span>
                      分享
                    </button>
                    <button class="glass-button bg-white/10 hover:bg-white/20 px-6 py-3 text-white">
                      <span class="icon-[mdi--download] w-5 h-5 mr-2"></span>
                      下载
                    </button>
                  </div>
                </div>

                <!-- MV描述 -->
                <div class="mb-6">
                  <h3 class="text-lg font-semibold text-white mb-3">MV简介</h3>
                  <p class="text-white/80 leading-relaxed">
                    {{ currentMV.description }}
                  </p>
                </div>
              </div>

              <!-- 右侧：相关推荐 -->
              <div class="w-full lg:w-80">
                <h3 class="text-lg font-semibold text-white mb-4">相关推荐</h3>
                <div class="space-y-4">
                  <div 
                    v-for="relatedMV in relatedMVs" 
                    :key="relatedMV.id"
                    class="flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-300 hover:bg-white/10"
                    @click="playRelatedMV(relatedMV)"
                  >
                    <!-- 缩略图 -->
                    <div class="relative shrink-0">
                      <div 
                        class="w-20 h-12 rounded-lg bg-linear-to-br flex items-center justify-center text-lg"
                        :class="relatedMV.gradient"
                      >
                        {{ relatedMV.emoji }}
                      </div>
                      <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-lg">
                        <span class="icon-[mdi--play] w-4 h-4 text-white"></span>
                      </div>
                      <div class="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                        {{ relatedMV.duration }}
                      </div>
                    </div>
                    
                    <!-- 信息 -->
                    <div class="flex-1 min-w-0">
                      <h4 class="text-white font-medium text-sm truncate mb-1">{{ relatedMV.title }}</h4>
                      <p class="text-purple-300 text-xs truncate mb-1">{{ relatedMV.artist }}</p>
                      <p class="text-white/60 text-xs">{{ relatedMV.playCount }} 播放</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// 播放状态
const isPlaying = ref(false)
const showControls = ref(true)
const currentTime = ref(0)
const totalTime = ref(245) // 4:05
let controlsTimer: NodeJS.Timeout | null = null

// 当前MV数据
const currentMV = ref({
  id: 1,
  title: '残酷天使的行动纲领',
  artist: '高橋洋子',
  duration: '4:06',
  playCount: '1.2M',
  likes: '85K',
  publishDate: '2023-12-15',
  category: '二次元',
  emoji: '👼',
  gradient: 'from-orange-400 to-red-500',
  liked: false,
  isNew: false,
  description: '《新世纪福音战士》的经典主题曲，由高橋洋子演唱。这首歌曲以其激昂的旋律和深刻的歌词，完美诠释了动画的主题思想，成为了无数动漫迷心中的经典之作。MV画面精美，将动画中的经典场景与现实演出完美结合。',
})

// 相关推荐MV
const relatedMVs = ref([
  {
    id: 2,
    title: '千本樱',
    artist: '初音未来',
    duration: '4:04',
    playCount: '2.8M',
    emoji: '🌸',
    gradient: 'from-pink-400 to-purple-500',
  },
  {
    id: 3,
    title: '打上花火',
    artist: 'DAOKO',
    duration: '4:49',
    playCount: '3.5M',
    emoji: '🎆',
    gradient: 'from-blue-400 to-purple-500',
  },
  {
    id: 4,
    title: 'Lemon',
    artist: '米津玄師',
    duration: '4:15',
    playCount: '5.2M',
    emoji: '🍋',
    gradient: 'from-yellow-400 to-orange-500',
  },
  {
    id: 5,
    title: '夜に駆ける',
    artist: 'YOASOBI',
    duration: '4:23',
    playCount: '4.1M',
    emoji: '🌙',
    gradient: 'from-indigo-400 to-purple-500',
  },
])

// 进度百分比
const progressPercentage = computed(() => {
  return (currentTime.value / totalTime.value) * 100
})

// 格式化时间
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 返回上一页
const goBack = () => {
  router.go(-1)
}

// 切换播放状态
const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    startPlayback()
    hideControlsAfterDelay()
  } else {
    stopPlayback()
    showControls.value = true
  }
}

// 切换点赞状态
const toggleLike = () => {
  currentMV.value.liked = !currentMV.value.liked
  console.log(`${currentMV.value.liked ? '点赞' : '取消点赞'}: ${currentMV.value.title}`)
}

// 切换全屏
const toggleFullscreen = () => {
  console.log('切换全屏')
  // 实际项目中这里会实现全屏功能
}

// 跳转到指定时间
const seekTo = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percentage = (event.clientX - rect.left) / rect.width
  currentTime.value = Math.floor(totalTime.value * percentage)
}

// 播放相关MV
const playRelatedMV = (mv: any) => {
  router.push(`/mv-player/${mv.id}`)
}

// 开始播放
const startPlayback = () => {
  // 模拟播放进度
  const interval = setInterval(() => {
    if (currentTime.value < totalTime.value) {
      currentTime.value++
    } else {
      clearInterval(interval)
      isPlaying.value = false
      showControls.value = true
    }
  }, 1000)
}

// 停止播放
const stopPlayback = () => {
  // 实际项目中这里会停止播放
}

// 延迟隐藏控制栏
const hideControlsAfterDelay = () => {
  if (controlsTimer) {
    clearTimeout(controlsTimer)
  }
  controlsTimer = setTimeout(() => {
    if (isPlaying.value) {
      showControls.value = false
    }
  }, 3000)
}

// 鼠标移动时显示控制栏
const handleMouseMove = () => {
  if (isPlaying.value) {
    showControls.value = true
    hideControlsAfterDelay()
  }
}

onMounted(() => {
  // 根据路由参数加载对应的MV数据
  const mvId = route.params.id
  console.log('加载MV:', mvId)
  
  // 监听鼠标移动
  document.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  if (controlsTimer) {
    clearTimeout(controlsTimer)
  }
  document.removeEventListener('mousemove', handleMouseMove)
})
</script>

<style scoped>
/* 控制栏过渡动画 */
.absolute.bottom-0 {
  transition: opacity 0.3s ease-in-out;
}

/* 响应式调整 */
@media (max-width: 1024px) {
  .flex-col.lg\\:flex-row {
    flex-direction: column;
  }
  
  .w-full.lg\\:w-80 {
    width: 100%;
    margin-top: 2rem;
  }
}

@media (max-width: 768px) {
  .aspect-video .text-8xl {
    font-size: 4rem;
  }
  
  .aspect-video .text-2xl {
    font-size: 1.5rem;
  }
  
  .aspect-video .text-lg {
    font-size: 1rem;
  }
}
</style>