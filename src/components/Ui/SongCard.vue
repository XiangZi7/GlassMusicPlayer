<script setup lang="ts">
import { gsap } from 'gsap'
import LazyImage from '@/components/Ui/LazyImage.vue'
import { formatDuration } from '@/utils/time'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'

interface Props {
  song: {
    id: number | string
    name: string
    artist: string
    cover: string
    duration: number
    album?: string
  }
  index: number
  to?: string
}

const props = defineProps<Props>()
const router = useRouter()
const cardRef = ref<HTMLElement | null>(null)
const coverRef = ref<HTMLElement | null>(null)
const { setPlaylist, play } = useAudio()

// 播放歌曲并执行封面飞行动画
const handleClick = async (_event: MouseEvent) => {
  if (!cardRef.value || !coverRef.value) {
    if (props.to) router.push(props.to)
    return
  }

  const coverEl = coverRef.value
  const footerCover = document.getElementById('footer-cover')
  const rect = coverEl.getBoundingClientRect()

  // 播放歌曲
  const storeSong: StoreSong = {
    id: props.song.id as number,
    name: props.song.name,
    artist: props.song.artist,
    album: props.song.album || '',
    duration: props.song.duration,
    cover: props.song.cover,
  }
  setPlaylist([storeSong], 0)
  play(storeSong, 0)

  // 如果能找到 footer 封面，执行抛物线飞行动画
  if (footerCover && props.song.cover) {
    const targetRect = footerCover.getBoundingClientRect()

    // 计算起点和终点中心
    const startX = rect.left + rect.width / 2
    const startY = rect.top + rect.height / 2
    const endX = targetRect.left + targetRect.width / 2
    const endY = targetRect.top + targetRect.height / 2

    const deltaX = endX - startX
    const deltaY = endY - startY
    // 抛物线高度（向上弯曲）
    const arcHeight = Math.min(Math.abs(deltaX) * 0.5, 120) * -1

    // 创建飞行克隆
    const clone = document.createElement('div')
    clone.className = 'song-cover-clone'
    clone.style.cssText = `
      position: fixed;
      z-index: 10000;
      width: ${rect.width}px;
      height: ${rect.height}px;
      left: ${rect.left}px;
      top: ${rect.top}px;
      border-radius: 12px;
      background-image: url(${props.song.cover}?param=100y100);
      background-size: cover;
      background-position: center;
      pointer-events: none;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      will-change: transform, width, height, left, top;
    `
    document.body.appendChild(clone)

    // 添加涟漪效果
    const ripple = document.createElement('div')
    ripple.style.cssText = `
      position: fixed;
      z-index: 9999;
      width: ${rect.width}px;
      height: ${rect.height}px;
      left: ${rect.left}px;
      top: ${rect.top}px;
      border-radius: 12px;
      border: 2px solid rgba(236, 72, 153, 0.6);
      pointer-events: none;
    `
    document.body.appendChild(ripple)

    // 涟漪扩散
    gsap.to(ripple, {
      scale: 1.5,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => ripple.remove(),
    })

    // 抛物线飞行动画
    const progress = { t: 0 }
    gsap.to(progress, {
      t: 1,
      duration: 0.55,
      ease: 'power2.out',
      onUpdate: () => {
        const t = progress.t

        // 线性插值 X 和尺寸
        const currentX = startX + deltaX * t
        const currentWidth = rect.width + (targetRect.width - rect.width) * t
        const currentHeight = rect.height + (targetRect.height - rect.height) * t

        // 抛物线 Y：4*t*(1-t) 在 t=0.5 时达到最大值 1
        const parabola = 4 * t * (1 - t)
        const currentY = startY + deltaY * t + arcHeight * parabola

        // 旋转角度（增加动感）
        const rotation = (1 - t) * (deltaX > 0 ? 12 : -12)

        clone.style.left = `${currentX - currentWidth / 2}px`
        clone.style.top = `${currentY - currentHeight / 2}px`
        clone.style.width = `${currentWidth}px`
        clone.style.height = `${currentHeight}px`
        clone.style.transform = `rotate(${rotation}deg)`
        clone.style.borderRadius = `${12 + (8 - 12) * t}px`
      },
      onComplete: () => {
        gsap.to(clone, {
          opacity: 0,
          scale: 0.8,
          duration: 0.15,
          onComplete: () => clone.remove(),
        })
      },
    })
  }
}

// 悬停效果
const handleMouseEnter = () => {
  if (cardRef.value) {
    gsap.to(cardRef.value, {
      x: 4,
      duration: 0.2,
      ease: 'power2.out',
    })
  }
  if (coverRef.value) {
    gsap.to(coverRef.value, {
      scale: 1.1,
      duration: 0.3,
      ease: 'power2.out',
    })
  }
}

const handleMouseLeave = () => {
  if (cardRef.value) {
    gsap.to(cardRef.value, {
      x: 0,
      duration: 0.2,
      ease: 'power2.out',
    })
  }
  if (coverRef.value) {
    gsap.to(coverRef.value, {
      scale: 1,
      duration: 0.3,
      ease: 'power2.out',
    })
  }
}
</script>

<template>
  <div
    ref="cardRef"
    class="song-card group flex cursor-pointer items-center gap-4 rounded-xl p-4 transition-colors hover:bg-white/5"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 排名 -->
    <span
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
      :class="
        index < 3
          ? 'bg-linear-to-t from-rose-500 to-pink-600 text-white'
          : 'bg-primary/5 text-primary/40'
      "
    >
      {{ index + 1 }}
    </span>

    <!-- 封面 -->
    <div ref="coverRef" class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-md">
      <LazyImage
        :src="song.cover + '?param=100y100'"
        alt="cover"
        img-class="h-full w-full object-cover"
      />
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
      >
        <span class="icon-[mdi--play] h-5 w-5 text-white" />
      </div>
    </div>

    <!-- 信息 -->
    <div class="min-w-0 flex-1">
      <p class="text-primary truncate text-sm font-medium transition-colors group-hover:text-pink-500">
        {{ song.name }}
      </p>
      <p class="text-primary/50 mt-0.5 truncate text-xs">{{ song.artist }}</p>
    </div>

    <!-- 时长 -->
    <span class="text-primary/30 shrink-0 text-xs">
      {{ formatDuration(song.duration) }}
    </span>
  </div>
</template>

<style scoped>
.song-card {
  will-change: transform;
}
</style>
