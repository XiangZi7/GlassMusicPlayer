<script setup lang="ts">
import { gsap } from 'gsap'
import LazyImage from '@/components/Ui/LazyImage.vue'
import { formatCount } from '@/utils/time'

interface Props {
  id: number | string
  coverUrl: string
  title: string
  subtitle?: string
  playCount?: number
  trackCount?: number
  to: string
  aspectRatio?: 'square' | 'video'
  enableTilt?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: 'square',
  enableTilt: true,
})

const router = useRouter()
const cardRef = ref<HTMLElement | null>(null)
const isAnimating = ref(false)

// Tilt 效果相关
const tiltConfig = {
  max: 12,
  scale: 1.03,
  speed: 400,
  glareMax: 0.15,
}

// 创建光泽层
const glareRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (props.enableTilt && cardRef.value) {
    // 创建光泽层
    const glareEl = document.createElement('div')
    glareEl.className = 'tilt-glare'
    glareEl.style.cssText = `
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0) 50%,
        rgba(255, 255, 255, ${tiltConfig.glareMax}) 100%
      );
      opacity: 0;
      transition: opacity ${tiltConfig.speed}ms ease;
      z-index: 10;
    `
    const innerCard = cardRef.value.querySelector('.hero-card-inner')
    if (innerCard) {
      ;(innerCard as HTMLElement).style.overflow = 'hidden'
      innerCard.appendChild(glareEl)
      glareRef.value = glareEl
    }
  }
})

onUnmounted(() => {
  glareRef.value?.remove()
})

// Hero 展开动画
const handleClick = async (_event: MouseEvent) => {
  if (isAnimating.value || !cardRef.value) {
    router.push(props.to)
    return
  }

  isAnimating.value = true
  const card = cardRef.value
  const rect = card.getBoundingClientRect()

  // 创建克隆元素用于动画
  const clone = document.createElement('div')
  clone.className = 'hero-card-clone'
  clone.innerHTML = `
    <div class="hero-clone-bg" style="
      position: absolute;
      inset: 0;
      background-image: url(${props.coverUrl}?param=400y400);
      background-size: cover;
      background-position: center;
      filter: blur(40px) saturate(1.5);
      transform: scale(1.5);
      opacity: 0.4;
    "></div>
    <div class="hero-clone-content" style="
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 24px;
      opacity: 0;
    ">
      <img src="${props.coverUrl}?param=400y400" style="
        width: 200px;
        height: 200px;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        object-fit: cover;
      " />
      <h2 style="
        margin-top: 24px;
        font-size: 24px;
        font-weight: bold;
        color: white;
        text-align: center;
        max-width: 80%;
      ">${props.title}</h2>
      ${props.subtitle ? `<p style="margin-top: 8px; font-size: 14px; color: rgba(255,255,255,0.7);">${props.subtitle}</p>` : ''}
    </div>
  `
  clone.style.cssText = `
    position: fixed;
    z-index: 9999;
    width: ${rect.width}px;
    height: ${rect.height}px;
    left: ${rect.left}px;
    top: ${rect.top}px;
    border-radius: 16px;
    background: rgba(0,0,0,0.9);
    backdrop-filter: blur(20px);
    overflow: hidden;
    pointer-events: none;
    will-change: transform, width, height, left, top, border-radius;
  `

  // 创建背景遮罩
  const overlay = document.createElement('div')
  overlay.className = 'hero-card-overlay'
  overlay.style.cssText = `
    position: fixed;
    z-index: 9998;
    inset: 0;
    background: rgba(0,0,0,0);
    pointer-events: none;
  `

  document.body.appendChild(overlay)
  document.body.appendChild(clone)

  // 隐藏原始卡片
  card.style.opacity = '0'

  const content = clone.querySelector('.hero-clone-content') as HTMLElement

  // 创建动画时间线
  const tl = gsap.timeline({
    onComplete: () => {
      // 动画完成后跳转
      router.push(props.to)

      // 延迟清理
      setTimeout(() => {
        clone.remove()
        overlay.remove()
        card.style.opacity = '1'
        isAnimating.value = false
      }, 100)
    },
  })

  // 背景遮罩淡入
  tl.to(overlay, {
    background: 'rgba(0,0,0,0.6)',
    duration: 0.3,
    ease: 'power2.out',
  }, 0)

  // 卡片展开到屏幕中央
  tl.to(clone, {
    width: Math.min(600, window.innerWidth - 48),
    height: Math.min(500, window.innerHeight - 100),
    left: (window.innerWidth - Math.min(600, window.innerWidth - 48)) / 2,
    top: (window.innerHeight - Math.min(500, window.innerHeight - 100)) / 2,
    borderRadius: '24px',
    duration: 0.5,
    ease: 'power3.out',
  }, 0)

  // 内容淡入
  tl.to(content, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
  }, 0.2)

  // 短暂停留后淡出
  tl.to(clone, {
    opacity: 0,
    scale: 1.05,
    duration: 0.2,
    ease: 'power2.in',
  }, '+=0.15')

  tl.to(overlay, {
    background: 'rgba(0,0,0,0)',
    duration: 0.2,
    ease: 'power2.in',
  }, '-=0.2')
}

// 3D Tilt 悬停效果
const handleMouseMove = (e: MouseEvent) => {
  if (!props.enableTilt || !cardRef.value) return

  const card = cardRef.value
  const rect = card.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  // 计算鼠标相对于中心的位置 (-1 到 1)
  const mouseX = (e.clientX - centerX) / (rect.width / 2)
  const mouseY = (e.clientY - centerY) / (rect.height / 2)

  // 计算旋转角度
  const rotateX = -mouseY * tiltConfig.max
  const rotateY = mouseX * tiltConfig.max

  gsap.to(card, {
    rotateX,
    rotateY,
    scale: tiltConfig.scale,
    duration: 0.1,
    ease: 'power2.out',
    transformPerspective: 1000,
  })

  // 更新光泽
  if (glareRef.value) {
    const angle = Math.atan2(mouseY, mouseX) * (180 / Math.PI) + 135
    const intensity = Math.sqrt(mouseX ** 2 + mouseY ** 2)
    glareRef.value.style.background = `linear-gradient(${angle}deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, ${tiltConfig.glareMax * intensity}) 100%)`
    glareRef.value.style.opacity = '1'
  }
}

const handleMouseEnter = () => {
  if (!props.enableTilt && cardRef.value) {
    // 如果没有启用 tilt，使用简单的悬停效果
    gsap.to(cardRef.value, {
      scale: 1.02,
      y: -4,
      duration: 0.3,
      ease: 'power2.out',
    })
  }
}

const handleMouseLeave = () => {
  if (cardRef.value) {
    gsap.to(cardRef.value, {
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      y: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.5)',
      transformPerspective: 1000,
    })
  }
  if (glareRef.value) {
    glareRef.value.style.opacity = '0'
  }
}
</script>

<template>
  <div
    ref="cardRef"
    class="hero-card group cursor-pointer"
    @click="handleClick"
    @mousemove="handleMouseMove"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div
      class="hero-card-inner relative overflow-hidden rounded-2xl shadow-lg transition-shadow duration-300 group-hover:shadow-xl"
      :class="aspectRatio === 'video' ? 'aspect-video' : 'aspect-square'"
    >
      <LazyImage
        :src="coverUrl + '?param=300y300'"
        :alt="title"
        img-class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        wrapper-class="h-full w-full"
      />

      <!-- 渐变遮罩 -->
      <div class="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

      <!-- 播放量标签 -->
      <div
        v-if="playCount"
        class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
      >
        <span class="icon-[mdi--headphones] h-3 w-3" />
        {{ formatCount(playCount) }}
      </div>

      <!-- 底部信息 -->
      <div class="absolute right-0 bottom-0 left-0 p-2.5">
        <p class="line-clamp-2 text-xs leading-tight font-medium text-white">
          {{ title }}
        </p>
        <div v-if="trackCount" class="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/70">
          <span class="icon-[mdi--music-note] h-3 w-3" />
          <span>{{ trackCount }}首</span>
        </div>
      </div>

      <!-- 悬停播放按钮 -->
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-all duration-300 group-hover:opacity-100"
      >
        <div
          class="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white/90 shadow-xl transition-transform duration-300 group-hover:scale-100"
        >
          <span class="icon-[mdi--play] h-6 w-6 text-pink-500" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-card {
  will-change: transform;
  transform-origin: center center;
  transform-style: preserve-3d;
}

.hero-card-inner {
  transform-style: preserve-3d;
}
</style>
