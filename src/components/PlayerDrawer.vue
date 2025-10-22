<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      ref="drawerRef"
      class="fixed inset-0 z-50 flex flex-col backdrop-blur-xl"
      style="display: none"
    >
      <!-- 关闭按钮 -->
      <div class="absolute top-6 right-6 z-10">
        <button
          @click="$emit('close')"
          class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white/20"
        >
          <span class="icon-[mdi--close] h-6 w-6 text-white"></span>
        </button>
      </div>

      <!-- 主要内容区域 -->
      <div class="flex flex-1 flex-col items-center justify-center px-8 py-12">
        <!-- 专辑封面区域 -->
        <div class="mb-8 flex flex-col items-center">
          <div
            ref="albumCoverRef"
            class="album-cover relative mb-6 h-80 w-80 overflow-hidden rounded-3xl shadow-2xl"
            :style="{
              background:
                currentSong?.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }"
          >
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-8xl">{{ currentSong?.emoji || '🎵' }}</span>
            </div>
            <!-- 播放状态指示器 -->
            <div
              v-if="isPlaying"
              class="absolute inset-0 flex items-center justify-center bg-black/20"
            >
              <div class="flex space-x-1">
                <div class="sound-wave h-8 w-1 rounded-full bg-white"></div>
                <div
                  class="sound-wave h-12 w-1 rounded-full bg-white"
                  style="animation-delay: 0.1s"
                ></div>
                <div
                  class="sound-wave h-6 w-1 rounded-full bg-white"
                  style="animation-delay: 0.2s"
                ></div>
                <div
                  class="sound-wave h-10 w-1 rounded-full bg-white"
                  style="animation-delay: 0.3s"
                ></div>
              </div>
            </div>
          </div>

          <!-- 歌曲信息 -->
          <div class="text-center">
            <h2 class="mb-2 text-3xl font-bold text-white">
              {{ currentSong?.title || '未知歌曲' }}
            </h2>
            <p class="text-xl text-white/80">{{ currentSong?.artist || '未知歌手' }}</p>
            <p class="mt-1 text-lg text-white/60">{{ currentSong?.album || '未知专辑' }}</p>
          </div>
        </div>

        <!-- 歌词滚动区域 -->
        <div class="lyrics-container mb-8 h-48 w-full max-w-2xl overflow-hidden">
          <div ref="lyricsRef" class="lyrics-scroll space-y-4 text-center">
            <div
              v-for="(line, index) in lyrics"
              :key="index"
              class="lyric-line text-lg transition-all duration-500"
              :class="{
                'scale-110 text-2xl font-semibold text-white': index === currentLyricIndex,
                'text-white/60': index !== currentLyricIndex,
              }"
            >
              {{ line.text }}
            </div>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="mb-8 w-full max-w-2xl">
          <div class="mb-2 flex justify-between text-sm text-white/80">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ formatTime(duration) }}</span>
          </div>
          <div class="relative h-2 rounded-full bg-white/20">
            <div
              class="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500 transition-all duration-300"
              :style="{ width: progress + '%' }"
            ></div>
            <div
              class="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-lg transition-all duration-300"
              :style="{ left: progress + '%', transform: 'translateX(-50%) translateY(-50%)' }"
            ></div>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="mb-8 flex items-center space-x-8">
          <!-- 上一首 -->
          <button
            @click="$emit('previous')"
            class="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white/20"
          >
            <span class="icon-[mdi--skip-previous] h-6 w-6 text-white"></span>
          </button>

          <!-- 播放/暂停 -->
          <button
            @click="togglePlay"
            class="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-600 shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-pink-500/25"
          >
            <span v-if="!isPlaying" class="icon-[mdi--play] ml-1 h-8 w-8 text-white"></span>
            <span v-else class="icon-[mdi--pause] h-8 w-8 text-white"></span>
          </button>

          <!-- 下一首 -->
          <button
            @click="$emit('next')"
            class="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white/20"
          >
            <span class="icon-[mdi--skip-next] h-6 w-6 text-white"></span>
          </button>
        </div>

        <!-- 底部控制栏 -->
        <div class="flex w-full max-w-2xl items-center justify-between">
          <!-- 喜欢按钮 -->
          <button
            @click="toggleLike"
            class="like-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300"
            :class="
              isLiked ? 'bg-red-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
            "
          >
            <span
              class="icon-[mdi--heart] h-6 w-6"
              :class="{ 'text-red-500': isLiked, 'text-white/70': !isLiked }"
            ></span>
          </button>

          <!-- 音量控制 -->
          <div class="flex items-center space-x-3">
            <span class="icon-[mdi--volume-high] h-5 w-5 text-white/80"></span>
            <input
              type="range"
              min="0"
              max="100"
              :value="volume"
              @input="handleVolumeChange"
              class="slider h-2 w-24 appearance-none rounded-full bg-white/20 outline-none"
            />
          </div>

          <!-- 更多选项 -->
          <button
            class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all duration-300 hover:bg-white/20"
          >
            <span class="icon-[mdi--dots-vertical] h-6 w-6"></span>
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { gsap } from 'gsap'

interface Song {
  title: string
  artist: string
  album?: string
  emoji?: string
  gradient?: string
}

interface LyricLine {
  time: number
  text: string
}

const props = defineProps<{
  isOpen: boolean
  currentSong?: Song
}>()

const emit = defineEmits<{
  close: []
  play: []
  pause: []
  next: []
  previous: []
  volumeChange: [value: number]
}>()

// 响应式状态
const drawerRef = ref<HTMLElement>()
const albumCoverRef = ref<HTMLElement>()
const lyricsRef = ref<HTMLElement>()
const isPlaying = ref(false)
const isLiked = ref(false)
const volume = ref(50)
const currentTime = ref(0)
const duration = ref(240) // 4分钟示例
const currentLyricIndex = ref(0)

// 示例歌词数据
const lyrics = ref<LyricLine[]>([
  { time: 0, text: '在这个美好的夜晚' },
  { time: 5, text: '音乐响起的瞬间' },
  { time: 10, text: '所有的烦恼都消散' },
  { time: 15, text: '让我们一起摇摆' },
  { time: 20, text: '感受这节拍的律动' },
  { time: 25, text: '心跳与音乐同步' },
  { time: 30, text: '这就是青春的模样' },
  { time: 35, text: '永远不会褪色的梦想' },
  { time: 40, text: '在音乐中找到自己' },
  { time: 45, text: '在旋律中释放灵魂' },
])

// 计算属性
const progress = ref(0)

// 方法
const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    emit('play')
    startAlbumRotation()
    startLyricsScroll()
  } else {
    emit('pause')
    stopAlbumRotation()
    stopLyricsScroll()
  }
}

const toggleLike = () => {
  isLiked.value = !isLiked.value
  if (isLiked.value) {
    gsap.fromTo(
      '.like-button',
      {
        scale: 1,
      },
      {
        scale: 1.3,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      }
    )
  }
}

const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  volume.value = parseInt(target.value)
  emit('volumeChange', volume.value)
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 动画相关
let albumRotationTween: gsap.core.Tween | null = null
let lyricsScrollInterval: number | null = null

const startAlbumRotation = () => {
  if (albumCoverRef.value) {
    albumRotationTween = gsap.to(albumCoverRef.value, {
      rotation: 360,
      duration: 10,
      repeat: -1,
      ease: 'none',
    })
  }
}

const stopAlbumRotation = () => {
  if (albumRotationTween) {
    albumRotationTween.kill()
    albumRotationTween = null
  }
}

const startLyricsScroll = () => {
  lyricsScrollInterval = setInterval(() => {
    currentTime.value += 1
    progress.value = (currentTime.value / duration.value) * 100

    // 更新当前歌词索引
    const currentLyric = lyrics.value.findIndex((lyric, index) => {
      const nextLyric = lyrics.value[index + 1]
      return currentTime.value >= lyric.time && (!nextLyric || currentTime.value < nextLyric.time)
    })

    if (currentLyric !== -1 && currentLyric !== currentLyricIndex.value) {
      currentLyricIndex.value = currentLyric
      scrollToCurrentLyric()
    }
  }, 1000)
}

const stopLyricsScroll = () => {
  if (lyricsScrollInterval) {
    clearInterval(lyricsScrollInterval)
    lyricsScrollInterval = null
  }
}

const scrollToCurrentLyric = () => {
  if (lyricsRef.value) {
    const currentLyricElement = lyricsRef.value.children[currentLyricIndex.value] as HTMLElement
    if (currentLyricElement) {
      gsap.to(lyricsRef.value, {
        y: -currentLyricElement.offsetTop + 100,
        duration: 0.5,
        ease: 'power2.out',
      })
    }
  }
}

// 抽屉动画
const openDrawer = () => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value, { display: 'flex' })

    const tl = gsap.timeline()
    tl.fromTo(
      drawerRef.value,
      {
        y: '-100%',
        opacity: 0,
      },
      {
        y: '0%',
        opacity: 1,
        duration: 0.6,
        ease: 'power3.out',
      }
    )
      .fromTo(
        '.album-cover',
        {
          scale: 0.5,
          opacity: 0,
        },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: 'back.out(1.7)',
        },
        '-=0.3'
      )
      .fromTo(
        '.lyric-line',
        {
          y: 30,
          opacity: 0,
        },
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          stagger: 0.1,
          ease: 'power2.out',
        },
        '-=0.2'
      )

    // 启动粒子动画
    animateParticles()
  }
}

const closeDrawer = () => {
  if (drawerRef.value) {
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(drawerRef.value, { display: 'none' })
      },
    })

    tl.to(drawerRef.value, {
      y: '-100%',
      opacity: 0,
      duration: 0.4,
      ease: 'power3.in',
    })

    stopAlbumRotation()
    stopLyricsScroll()
  }
}

const animateParticles = () => {
  gsap.fromTo(
    '.particle',
    {
      y: '100vh',
      opacity: 0,
    },
    {
      y: '-100px',
      opacity: 0.3,
      duration: 'random(3, 6)',
      repeat: -1,
      ease: 'none',
      stagger: {
        amount: 2,
        from: 'random',
      },
    }
  )
}

// 监听器
watch(
  () => props.isOpen,
  newVal => {
    if (newVal) {
      nextTick(() => {
        openDrawer()
      })
    } else {
      closeDrawer()
    }
  }
)

// 生命周期
onMounted(() => {
  gsap.set(drawerRef.value, { display: 'none' })
})

onUnmounted(() => {
  stopAlbumRotation()
  stopLyricsScroll()
})
</script>

<style scoped>
.particle {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(180deg);
  }
}

.sound-wave {
  animation: soundWave 0.8s ease-in-out infinite alternate;
}

@keyframes soundWave {
  0% {
    height: 1rem;
  }
  100% {
    height: 3rem;
  }
}

.lyrics-container {
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 20%,
    black 80%,
    transparent 100%
  );
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
