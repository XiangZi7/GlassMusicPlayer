<script setup lang="ts">
import { gsap } from 'gsap'
import LazyImage from '@/components/Ui/LazyImage.vue'

interface Props {
  id: number | string
  name: string
  picUrl: string
  to: string
}

const props = defineProps<Props>()
const router = useRouter()
const cardRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLElement | null>(null)
const isAnimating = ref(false)

// 共享元素飞行动画
const handleClick = async () => {
  if (isAnimating.value || !cardRef.value || !imageRef.value) {
    router.push(props.to)
    return
  }

  isAnimating.value = true
  const imageEl = imageRef.value.querySelector('img') || imageRef.value
  const rect = imageEl.getBoundingClientRect()

  // 创建飞行克隆
  const clone = document.createElement('div')
  clone.className = 'artist-avatar-clone'
  clone.style.cssText = `
    position: fixed;
    z-index: 10000;
    width: ${rect.width}px;
    height: ${rect.height}px;
    left: ${rect.left}px;
    top: ${rect.top}px;
    border-radius: 50%;
    background-image: url(${props.picUrl}?param=400y400);
    background-size: cover;
    background-position: center;
    pointer-events: none;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    will-change: transform, width, height, left, top;
  `
  document.body.appendChild(clone)

  // 隐藏原始头像
  imageEl.style.opacity = '0'

  // 计算目标位置（屏幕中央偏上）
  const targetSize = Math.min(192, window.innerWidth * 0.4)
  const targetX = (window.innerWidth - targetSize) / 2
  const targetY = window.innerHeight * 0.15

  // 创建背景遮罩
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    z-index: 9999;
    inset: 0;
    background: rgba(0,0,0,0);
    pointer-events: none;
  `
  document.body.appendChild(overlay)

  const tl = gsap.timeline({
    onComplete: () => {
      router.push(props.to)
      setTimeout(() => {
        clone.remove()
        overlay.remove()
        imageEl.style.opacity = '1'
        isAnimating.value = false
      }, 50)
    },
  })

  // 背景淡入
  tl.to(overlay, {
    background: 'rgba(0,0,0,0.5)',
    duration: 0.3,
    ease: 'power2.out',
  }, 0)

  // 头像飞到中央并放大
  tl.to(clone, {
    width: targetSize,
    height: targetSize,
    left: targetX,
    top: targetY,
    duration: 0.45,
    ease: 'power3.out',
  }, 0)

  // 添加光环效果
  const ring = document.createElement('div')
  ring.style.cssText = `
    position: fixed;
    z-index: 9998;
    width: ${targetSize}px;
    height: ${targetSize}px;
    left: ${targetX}px;
    top: ${targetY}px;
    border-radius: 50%;
    border: 2px solid rgba(236, 72, 153, 0.6);
    pointer-events: none;
    opacity: 0;
  `
  document.body.appendChild(ring)

  tl.to(ring, {
    opacity: 1,
    scale: 1.3,
    duration: 0.3,
    ease: 'power2.out',
  }, 0.2)

  tl.to(ring, {
    opacity: 0,
    scale: 1.5,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => ring.remove(),
  }, 0.4)

  // 淡出过渡到新页面
  tl.to([clone, overlay], {
    opacity: 0,
    duration: 0.15,
    ease: 'power2.in',
  }, '+=0.05')
}

// 悬停效果
const handleMouseEnter = () => {
  if (imageRef.value) {
    gsap.to(imageRef.value, {
      scale: 1.08,
      duration: 0.3,
      ease: 'power2.out',
    })
  }
}

const handleMouseLeave = () => {
  if (imageRef.value) {
    gsap.to(imageRef.value, {
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
    class="group flex cursor-pointer flex-col items-center"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div
      ref="imageRef"
      class="border-glass relative mb-2.5 aspect-square w-full overflow-hidden rounded-full border-2 shadow-lg transition-all duration-300 group-hover:border-pink-500 group-hover:shadow-pink-500/20"
    >
      <LazyImage
        :src="picUrl + '?param=150y150'"
        :alt="name"
        img-class="h-full w-full object-cover"
      />
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100"
      >
        <span
          class="icon-[mdi--play] h-6 w-6 scale-50 text-white transition-transform group-hover:scale-100"
        />
      </div>
    </div>
    <span
      class="text-primary/70 group-hover:text-primary w-full truncate text-center text-xs transition-colors"
    >
      {{ name }}
    </span>
  </div>
</template>

<style scoped>
.artist-avatar-clone {
  transition: box-shadow 0.3s ease;
}
</style>
