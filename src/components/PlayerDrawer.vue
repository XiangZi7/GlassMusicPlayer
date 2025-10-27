<script setup lang="ts">
import { gsap } from 'gsap'
import { useAudio } from '@/composables/useAudio'

interface LyricLine {
  time: number
  text: string
}

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  showPlaylist: []
}>()

// 使用音频播放器
const {
  currentSong,
  isPlaying,
  volume,
  isMuted,
  currentTime,
  duration,
  progress,
  playMode,
  togglePlay,
  nextSong,
  previousSong,
  setVolume,
  toggleMute,
  setProgress,
  togglePlayMode,
  toggleLike,
} = useAudio()

// 响应式状态
const drawerRef = ref<HTMLElement>()
const albumCoverRef = ref<HTMLElement>()
const lyricsRef = ref<HTMLElement>()
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

// 方法
const handleTogglePlay = () => {
  togglePlay()
  if (isPlaying.value) {
    startAlbumRotation()
    startLyricsScroll()
  } else {
    stopAlbumRotation()
    stopLyricsScroll()
  }
}

const handleToggleLike = () => {
  toggleLike()
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

const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newVolume = parseInt(target.value) / 100
  setVolume(newVolume)
}

const handleProgressClick = (event: MouseEvent) => {
  const progressBar = event.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newProgress = (clickX / rect.width) * 100

  setProgress(newProgress / 100)
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
      const targetScrollTop =
        currentLyricElement.offsetTop - containerHeight / 2 + currentLyricElement.clientHeight / 2

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
<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      ref="drawerRef"
      class="anime-gradient fixed inset-0 z-50 flex backdrop-blur-xl"
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
        <!-- 专辑封面区域（黑胶风格） -->
        <div class="mb-8 flex flex-col items-center">
          <div class="relative mb-6 h-72 w-72">
            <!-- 黑胶盘：外层为黑胶，内层为封面标签 -->
            <div
              ref="albumCoverRef"
              class="album-cover vinyl-disc relative h-72 w-72 overflow-hidden rounded-full shadow-2xl"
            >
              <!-- 封面标签（纸质质感 + 内外圈） -->
              <div
                class="vinyl-label absolute top-1/2 left-1/2 flex h-24 w-24 -translate-1/2 items-center justify-center rounded-full bg-cover text-center"
                :style="{
                  backgroundImage: currentSong?.cover
                    ? `url(${currentSong.cover})`
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }"
              ></div>

              <!-- 中心金属轴 -->
              <div
                class="spindle absolute top-1/2 left-1/2 h-3 w-3 -translate-1/2 rounded-full"
              ></div>
            </div>

            <!-- 黑胶指针（写实：底座 + 手臂 + 唱头 + 配重） -->
            <div
              class="tonearm absolute -top-12 -right-14 z-10 origin-top-left transition-transform duration-500 ease-out"
              :class="isPlaying ? 'rotate-16' : 'rotate-[-28deg]'"
            >
              <!-- 轴心底座 -->
              <div class="arm-pivot relative h-10 w-10 rounded-full shadow-xl"></div>
              <!-- 手臂主体 -->
              <div class="arm-shaft mt-[-2px] h-36 w-2 rounded-full"></div>
              <!-- 配重块 -->
              <div class="counterweight -mt-4 ml-2 h-6 w-6 rounded-full shadow-md"></div>
              <!-- 唱头与针 -->
              <div class="headshell relative mt-1 h-8 w-14 rounded-md shadow-md">
                <div
                  class="cartridge absolute top-1/2 left-1/2 h-4 w-8 -translate-x-1/2 -translate-y-1/2 rounded-sm"
                ></div>
                <div class="stylus absolute top-full left-1/2 h-4 w-[2px] -translate-x-1/2"></div>
              </div>
            </div>
          </div>

          <!-- 歌曲信息 -->
          <div class="text-center">
            <h2 class="mb-2 text-2xl font-bold text-white">
              {{ currentSong?.name || '未知歌曲' }}
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
            class="relative h-2 cursor-pointer rounded-full bg-white/20"
            @click="handleProgressClick"
          >
            <div
              class="absolute top-0 left-0 h-full rounded-full bg-linear-to-r from-pink-400 to-purple-500 transition-all duration-300"
              :style="{ width: progress * 100 + '%' }"
            ></div>
            <div
              class="absolute top-1/2 h-4 w-4 -translate-y-1/2 cursor-grab rounded-full bg-white shadow-lg transition-all duration-300 active:cursor-grabbing"
              :style="{
                left: progress * 100 + '%',
                transform: 'translateX(-50%) translateY(-50%)',
              }"
            ></div>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="mb-8 flex items-center space-x-6">
          <!-- 播放模式 -->
          <button
            @click="togglePlayMode"
            class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
            :class="{ 'bg-pink-500/30': playMode !== 'LIST' }"
          >
            <span
              v-if="playMode === 'SINGLE'"
              class="icon-[mdi--repeat-once] h-5 w-5 text-white"
            ></span>
            <span
              v-else-if="playMode === 'SHUFFLE'"
              class="icon-[mdi--shuffle] h-5 w-5 text-white"
            ></span>
            <span v-else class="icon-[mdi--repeat] h-5 w-5 text-white"></span>
          </button>

          <!-- 上一首 -->
          <button
            @click="previousSong"
            class="glass-button flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          >
            <span class="icon-[mdi--skip-previous] h-6 w-6 text-white"></span>
          </button>

          <!-- 播放/暂停 -->
          <button
            @click="handleTogglePlay"
            class="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-600 shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-pink-500/25"
          >
            <span v-if="!isPlaying" class="icon-[mdi--play] ml-1 h-8 w-8 text-white"></span>
            <span v-else class="icon-[mdi--pause] h-8 w-8 text-white"></span>
          </button>

          <!-- 下一首 -->
          <button
            @click="nextSong"
            class="glass-button flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          >
            <span class="icon-[mdi--skip-next] h-6 w-6 text-white"></span>
          </button>

          <!-- 播放列表 -->
          <button
            @click="$emit('showPlaylist')"
            class="glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          >
            <span class="icon-[mdi--playlist-music] h-5 w-5 text-white"></span>
          </button>
        </div>

        <!-- 底部控制栏 -->
        <div class="flex w-full max-w-md items-center justify-between">
          <!-- 喜欢按钮 -->
          <button
            @click="handleToggleLike"
            class="like-button glass-button flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300"
            :class="{ 'bg-red-500/50': currentSong?.liked }"
          >
            <span
              class="icon-[mdi--heart] h-6 w-6"
              :class="{ 'text-red-400': currentSong?.liked, 'text-white/70': !currentSong?.liked }"
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
                v-else-if="volume < 0.5"
                class="icon-[mdi--volume-medium] h-5 w-5 text-white/80"
              ></span>
              <span v-else class="icon-[mdi--volume-high] h-5 w-5 text-white/80"></span>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              :value="isMuted ? 0 : volume * 100"
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
            <div class="mx-auto mt-2 h-px w-16 bg-linear-to-r from-pink-400 to-purple-500"></div>
          </div>

          <!-- 歌词滚动区域 -->
          <div class="lyrics-container relative flex-1 overflow-hidden">
            <div ref="lyricsRef" class="lyrics-scroll h-full">
              <div
                v-for="(line, index) in lyrics"
                :key="index"
                class="lyric-line mb-6 cursor-pointer text-center transition-all duration-500"
                :class="{
                  'scale-110 transform text-xl font-semibold text-white':
                    index === currentLyricIndex,
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
            <div
              class="pointer-events-none absolute top-1/2 right-0 left-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent"
            ></div>
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
      <div class="particle-container pointer-events-none absolute inset-0 overflow-hidden">
        <div
          v-for="i in 20"
          :key="i"
          class="particle absolute"
          :style="{
            left: Math.random() * 100 + '%',
            animationDelay: Math.random() * 6 + 's',
            width: Math.random() * 4 + 2 + 'px',
            height: Math.random() * 4 + 2 + 'px',
          }"
        ></div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.vinyl-disc {
  background: radial-gradient(circle at 50% 50%, #161616 0%, #0b0b0b 60%, #000 100%);
}

.vinyl-disc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: repeating-radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.06) 0px,
    rgba(255, 255, 255, 0.06) 1px,
    transparent 3px
  );
  opacity: 0.25;
  pointer-events: none;
}

.vinyl-disc::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: radial-gradient(
    ellipse at 30% 15%,
    rgba(255, 255, 255, 0.18),
    rgba(255, 255, 255, 0.02) 40%,
    transparent 60%
  );
  mix-blend-mode: screen;
  pointer-events: none;
}

.vinyl-label {
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 2px 16px rgba(0, 0, 0, 0.25);
  position: relative;
  overflow: hidden;
}

.vinyl-label::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: repeating-radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.12) 0px,
    rgba(255, 255, 255, 0.12) 1px,
    transparent 2px
  );
  opacity: 0.25;
  pointer-events: none;
}

.vinyl-label::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 70%;
  height: 70%;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  opacity: 0.6;
}

.label-mark {
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.spindle {
  background: radial-gradient(circle at 30% 30%, #c9c9c9, #9a9a9a 60%, #6f6f6f);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.45),
    inset 0 1px 2px rgba(255, 255, 255, 0.35);
}

/* 指针在移动时更自然的微小阴影 */
.tonearm {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
}

.arm-pivot {
  background: conic-gradient(from 180deg at 50% 50%, #d7d7d7, #bdbdbd, #9f9f9f, #d7d7d7);
}

.arm-shaft {
  background: linear-gradient(180deg, #d6d6d6 0%, #bfbfbf 40%, #9c9c9c 100%);
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.2);
}

.counterweight {
  background: radial-gradient(circle at 30% 30%, #bfbfbf, #8f8f8f 60%, #6f6f6f);
}

.headshell {
  background: linear-gradient(135deg, #6b7280, #374151);
}

.cartridge {
  background: linear-gradient(180deg, #8b8b8b, #5f5f5f);
}

.stylus {
  background: linear-gradient(180deg, #e5e7eb, #9ca3af);
}

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
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 255, 255, 0.2) 70%,
    transparent 100%
  );
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
