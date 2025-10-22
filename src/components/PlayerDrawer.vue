<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      ref="drawerRef"
      class="fixed inset-0 z-50 flex backdrop-blur-xl anime-gradient"
      style="display: none"
    >
      <!-- 关闭按钮 -->
      <div class="absolute top-6 right-6 z-10">
        <button
          @click="$emit('close')"
          class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
        >
          <span class="icon-[mdi--close] h-6 w-6 text-white"></span>
        </button>
      </div>

      <!-- 左侧：歌曲信息和控件 -->
      <div class="flex w-1/2 flex-col items-center justify-center px-12 py-16">
        <!-- 专辑封面区域 -->
        <div class="mb-8 flex flex-col items-center">
          <div
            ref="albumCoverRef"
            class="album-cover glass-card relative mb-6 h-72 w-72 overflow-hidden shadow-2xl"
            :style="{
              background:
                currentSong?.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }"
          >
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-7xl">{{ currentSong?.emoji || '🎵' }}</span>
            </div>
            <!-- 播放状态指示器 -->
            <div
              v-if="isPlaying"
              class="absolute inset-0 flex items-center justify-center bg-black/20"
            >
              <div class="flex space-x-1">
                <div class="sound-wave h-6 w-1 rounded-full bg-white"></div>
                <div
                  class="sound-wave h-10 w-1 rounded-full bg-white"
                  style="animation-delay: 0.1s"
                ></div>
                <div
                  class="sound-wave h-4 w-1 rounded-full bg-white"
                  style="animation-delay: 0.2s"
                ></div>
                <div
                  class="sound-wave h-8 w-1 rounded-full bg-white"
                  style="animation-delay: 0.3s"
                ></div>
              </div>
            </div>
          </div>

          <!-- 歌曲信息 -->
          <div class="text-center">
            <h2 class="mb-2 text-2xl font-bold text-white">
              {{ currentSong?.title || '未知歌曲' }}
            </h2>
            <p class="text-lg text-white/80">{{ currentSong?.artist || '未知歌手' }}</p>
            <p class="mt-1 text-sm text-white/60">{{ currentSong?.album || '未知专辑' }}</p>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="mb-8 w-full max-w-md">
          <div class="mb-2 flex justify-between text-sm text-white/80">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ formatTime(duration) }}</span>
          </div>
          <div 
            class="relative h-2 rounded-full bg-white/20 cursor-pointer"
            @click="handleProgressClick"
          >
            <div
              class="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500 transition-all duration-300"
              :style="{ width: progress + '%' }"
            ></div>
            <div
              class="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-lg transition-all duration-300 cursor-grab active:cursor-grabbing"
              :style="{ left: progress + '%', transform: 'translateX(-50%) translateY(-50%)' }"
            ></div>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="mb-8 flex items-center space-x-6">
          <!-- 随机播放 -->
          <button
            @click="toggleShuffle"
            class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
            :class="{ 'bg-pink-500/30': isShuffle }"
          >
            <span class="icon-[mdi--shuffle] h-5 w-5 text-white"></span>
          </button>

          <!-- 上一首 -->
          <button
            @click="$emit('previous')"
            class="glass-button flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
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
            class="glass-button flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          >
            <span class="icon-[mdi--skip-next] h-6 w-6 text-white"></span>
          </button>

          <!-- 循环模式 -->
          <button
            @click="toggleRepeat"
            class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
            :class="{ 'bg-pink-500/30': repeatMode !== 'none' }"
          >
            <span 
              v-if="repeatMode === 'one'" 
              class="icon-[mdi--repeat-once] h-5 w-5 text-white"
            ></span>
            <span 
              v-else 
              class="icon-[mdi--repeat] h-5 w-5 text-white"
            ></span>
          </button>
        </div>

        <!-- 底部控制栏 -->
        <div class="flex w-full max-w-md items-center justify-between">
          <!-- 喜欢按钮 -->
          <button
            @click="toggleLike"
            class="like-button glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300"
            :class="{ 'bg-red-500/50': isLiked }"
          >
            <span
              class="icon-[mdi--heart] h-6 w-6"
              :class="{ 'text-red-400': isLiked, 'text-white/70': !isLiked }"
            ></span>
          </button>

          <!-- 音量控制 -->
          <div class="flex items-center space-x-3">
            <button @click="toggleMute" class="transition-colors duration-200">
              <span 
                v-if="volume === 0 || isMuted" 
                class="icon-[mdi--volume-off] h-5 w-5 text-white/80"
              ></span>
              <span 
                v-else-if="volume < 50" 
                class="icon-[mdi--volume-medium] h-5 w-5 text-white/80"
              ></span>
              <span 
                v-else 
                class="icon-[mdi--volume-high] h-5 w-5 text-white/80"
              ></span>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              :value="isMuted ? 0 : volume"
              @input="handleVolumeChange"
              class="slider h-2 w-20 appearance-none rounded-full bg-white/20 outline-none"
            />
          </div>

          <!-- 播放列表 -->
          <button
            @click="$emit('showPlaylist')"
            class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          >
            <span class="icon-[mdi--playlist-music] h-6 w-6 text-white/80"></span>
          </button>
        </div>
      </div>

      <!-- 右侧：歌词区域 -->
      <div class="flex w-1/2 flex-col px-12 py-16">
        <div class="glass-container flex h-full flex-col p-8">
          <!-- 歌词标题 -->
          <div class="mb-6 text-center">
            <h3 class="text-xl font-semibold text-white/90">歌词</h3>
            <div class="mt-2 h-px w-16 bg-gradient-to-r from-pink-400 to-purple-500 mx-auto"></div>
          </div>

          <!-- 歌词滚动区域 -->
          <div class="lyrics-container flex-1 overflow-hidden relative">
            <div ref="lyricsRef" class="lyrics-scroll h-full">
              <div
                v-for="(line, index) in lyrics"
                :key="index"
                class="lyric-line mb-6 text-center transition-all duration-500 cursor-pointer"
                :class="{
                  'scale-110 text-xl font-semibold text-white transform': index === currentLyricIndex,
                  'text-white/50 hover:text-white/70': index !== currentLyricIndex,
                }"
                @click="seekToLyric(index)"
              >
                {{ line.text }}
              </div>
              <!-- 空白占位，确保最后一句歌词能滚动到中心 -->
              <div class="h-64"></div>
            </div>
            
            <!-- 中心指示线 -->
            <div class="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"></div>
          </div>

          <!-- 歌词控制 -->
          <div class="mt-6 flex items-center justify-center space-x-4">
            <button
              @click="adjustLyricsOffset(-0.5)"
              class="glass-button flex h-10 w-10 items-center justify-center rounded-full text-sm transition-all duration-300 hover:scale-110"
              title="歌词提前0.5秒"
            >
              <span class="icon-[mdi--minus] h-4 w-4 text-white/80"></span>
            </button>
            
            <span class="text-sm text-white/60">歌词同步</span>
            
            <button
              @click="adjustLyricsOffset(0.5)"
              class="glass-button flex h-10 w-10 items-center justify-center rounded-full text-sm transition-all duration-300 hover:scale-110"
              title="歌词延后0.5秒"
            >
              <span class="icon-[mdi--plus] h-4 w-4 text-white/80"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- 粒子效果 -->
      <div class="particle-container absolute inset-0 pointer-events-none overflow-hidden">
        <div
          v-for="i in 20"
          :key="i"
          class="particle absolute"
          :style="{
            left: Math.random() * 100 + '%',
            animationDelay: Math.random() * 6 + 's',
            width: (Math.random() * 4 + 2) + 'px',
            height: (Math.random() * 4 + 2) + 'px',
          }"
        ></div>
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
  showPlaylist: []
}>()

// 响应式状态
const drawerRef = ref<HTMLElement>()
const albumCoverRef = ref<HTMLElement>()
const lyricsRef = ref<HTMLElement>()
const isPlaying = ref(false)
const isLiked = ref(false)
const isShuffle = ref(false)
const repeatMode = ref<'none' | 'all' | 'one'>('none')
const volume = ref(50)
const isMuted = ref(false)
const previousVolume = ref(50)
const currentTime = ref(0)
const duration = ref(240) // 4分钟示例
const currentLyricIndex = ref(0)
const lyricsOffset = ref(0) // 歌词同步偏移量（秒）

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
  { time: 50, text: '跟随着音符的指引' },
  { time: 55, text: '穿越时空的界限' },
  { time: 60, text: '每一个音符都是故事' },
  { time: 65, text: '每一段旋律都是回忆' },
  { time: 70, text: '让音乐带我们飞翔' },
  { time: 75, text: '在无尽的天空中遨游' },
  { time: 80, text: '这是属于我们的时刻' },
  { time: 85, text: '永远不会结束的梦' },
])

// 计算属性
const progress = computed(() => (currentTime.value / duration.value) * 100)

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

const toggleShuffle = () => {
  isShuffle.value = !isShuffle.value
}

const toggleRepeat = () => {
  const modes: Array<'none' | 'all' | 'one'> = ['none', 'all', 'one']
  const currentIndex = modes.indexOf(repeatMode.value)
  repeatMode.value = modes[(currentIndex + 1) % modes.length]
}

const toggleMute = () => {
  if (isMuted.value) {
    isMuted.value = false
    volume.value = previousVolume.value
  } else {
    isMuted.value = true
    previousVolume.value = volume.value
    volume.value = 0
  }
  emit('volumeChange', volume.value)
}

const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newVolume = parseInt(target.value)
  volume.value = newVolume
  
  if (newVolume > 0 && isMuted.value) {
    isMuted.value = false
  }
  
  emit('volumeChange', newVolume)
}

const handleProgressClick = (event: MouseEvent) => {
  const progressBar = event.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newProgress = (clickX / rect.width) * 100
  const newTime = (newProgress / 100) * duration.value
  
  currentTime.value = newTime
  updateCurrentLyric()
}

const seekToLyric = (index: number) => {
  const targetTime = lyrics.value[index].time
  currentTime.value = targetTime
  currentLyricIndex.value = index
  scrollToCurrentLyric()
}

const adjustLyricsOffset = (offset: number) => {
  lyricsOffset.value += offset
  updateCurrentLyric()
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
    updateCurrentLyric()
  }, 1000)
}

const stopLyricsScroll = () => {
  if (lyricsScrollInterval) {
    clearInterval(lyricsScrollInterval)
    lyricsScrollInterval = null
  }
}

const updateCurrentLyric = () => {
  const adjustedTime = currentTime.value + lyricsOffset.value
  
  const currentLyric = lyrics.value.findIndex((lyric, index) => {
    const nextLyric = lyrics.value[index + 1]
    return adjustedTime >= lyric.time && (!nextLyric || adjustedTime < nextLyric.time)
  })

  if (currentLyric !== -1 && currentLyric !== currentLyricIndex.value) {
    currentLyricIndex.value = currentLyric
    scrollToCurrentLyric()
  }
}

const scrollToCurrentLyric = () => {
  if (lyricsRef.value && currentLyricIndex.value >= 0) {
    const lyricsContainer = lyricsRef.value
    const currentLyricElement = lyricsContainer.children[currentLyricIndex.value] as HTMLElement
    
    if (currentLyricElement) {
      const containerHeight = lyricsContainer.parentElement?.clientHeight || 0
      const targetScrollTop = currentLyricElement.offsetTop - containerHeight / 2 + currentLyricElement.clientHeight / 2
      
      gsap.to(lyricsContainer, {
        y: -targetScrollTop,
        duration: 0.8,
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
  mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
}

.lyrics-scroll {
  transform: translateY(0);
  transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.lyric-line {
  line-height: 1.8;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.lyric-line:hover {
  background: rgba(255, 255, 255, 0.05);
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

/* 专辑封面旋转动画 */
.album-cover {
  transition: transform 0.3s ease;
}

.album-cover:hover {
  transform: scale(1.05);
}

/* 粒子效果增强 */
.particle-container .particle {
  background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.2) 70%, transparent 100%);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

/* 歌词高亮效果 */
.lyric-line.scale-110 {
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(139, 92, 246, 0.1));
}

/* 按钮悬停效果增强 */
.glass-button:active {
  transform: scale(0.95);
}

/* 进度条增强样式 */
.progress-bar-thumb {
  transition: all 0.2s ease;
}

.progress-bar-thumb:hover {
  transform: translateX(-50%) translateY(-50%) scale(1.2);
  box-shadow: 0 0 15px rgba(236, 72, 153, 0.6);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .drawer-content {
    flex-direction: column;
  }
  
  .left-panel,
  .right-panel {
    width: 100%;
  }
  
  .album-cover {
    width: 16rem;
    height: 16rem;
  }
}

@media (max-width: 768px) {
  .album-cover {
    width: 12rem;
    height: 12rem;
  }
  
  .lyric-line {
    font-size: 0.875rem;
  }
}
</style>
