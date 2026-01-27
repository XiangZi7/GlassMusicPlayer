<script setup lang="ts">
import { gsap } from 'gsap'
import LazyImage from '@/components/Ui/LazyImage.vue'
import { formatCount } from '@/utils/time'

interface Props {
  id: number | string
  name: string
  artist: string
  cover: string
  playCount?: number
  to: string
  enableTilt?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enableTilt: true,
})

const router = useRouter()
const cardRef = ref<HTMLElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const isHovering = ref(false)
const isAnimating = ref(false)

// Tilt 效果配置
const tiltConfig = {
  max: 15,
  scale: 1.04,
  speed: 400,
  glareMax: 0.2,
}

// 光泽层
const glareRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (props.enableTilt && cardRef.value) {
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
      z-index: 20;
    `
    const innerCard = cardRef.value.querySelector('.mv-card-inner')
    if (innerCard) {
      innerCard.appendChild(glareEl)
      glareRef.value = glareEl
    }
  }
})

onUnmounted(() => {
  glareRef.value?.remove()
})

// 3D Tilt 鼠标移动
const handleMouseMove = (e: MouseEvent) => {
  if (!cardRef.value) return

  const card = cardRef.value
  const rect = card.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const mouseX = (e.clientX - centerX) / (rect.width / 2)
  const mouseY = (e.clientY - centerY) / (rect.height / 2)

  if (props.enableTilt) {
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
}

// 悬停效果
const handleMouseEnter = () => {
  if (!cardRef.value) return
  isHovering.value = true

  if (!props.enableTilt) {
    // 如果没有启用 tilt，使用原来的效果
    gsap.to(cardRef.value, {
      scale: 1.03,
      y: -6,
      duration: 0.3,
      ease: 'power2.out',
    })
  }

  // 播放按钮出现动画
  const playBtn = cardRef.value.querySelector('.play-button')
  if (playBtn) {
    gsap.to(playBtn, {
      scale: 1,
      opacity: 1,
      duration: 0.3,
      ease: 'back.out(1.7)',
    })
  }

  // 播放图标脉冲
  const playIcon = cardRef.value.querySelector('.play-icon')
  if (playIcon) {
    gsap.to(playIcon, {
      scale: 1.1,
      duration: 0.6,
      yoyo: true,
      repeat: -1,
      ease: 'power1.inOut',
    })
  }
}

const handleMouseLeave = () => {
  if (!cardRef.value) return
  isHovering.value = false

  gsap.to(cardRef.value, {
    rotateX: 0,
    rotateY: 0,
    scale: 1,
    y: 0,
    duration: 0.5,
    ease: 'elastic.out(1, 0.5)',
    transformPerspective: 1000,
  })

  if (glareRef.value) {
    glareRef.value.style.opacity = '0'
  }

  const playBtn = cardRef.value.querySelector('.play-button')
  if (playBtn) {
    gsap.to(playBtn, {
      scale: 0.8,
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
    })
  }

  const playIcon = cardRef.value.querySelector('.play-icon')
  if (playIcon) {
    gsap.killTweensOf(playIcon)
    gsap.set(playIcon, { scale: 1 })
  }
}

// 点击动画
const handleClick = async () => {
  if (isAnimating.value || !cardRef.value) {
    router.push(props.to)
    return
  }

  isAnimating.value = true
  const card = cardRef.value
  const rect = card.getBoundingClientRect()

  // 创建展开遮罩
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    z-index: 9998;
    inset: 0;
    background: rgba(0,0,0,0);
    pointer-events: none;
  `
  document.body.appendChild(overlay)

  // 创建克隆视频框
  const clone = document.createElement('div')
  clone.innerHTML = `
    <div style="
      position: absolute;
      inset: 0;
      background-image: url(${props.cover}?param=800y450);
      background-size: cover;
      background-position: center;
    "></div>
    <div style="
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.4);
    ">
      <div style="
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 0;
          height: 0;
          border-left: 24px solid white;
          border-top: 14px solid transparent;
          border-bottom: 14px solid transparent;
          margin-left: 6px;
        "></div>
      </div>
      <p style="
        margin-top: 20px;
        font-size: 18px;
        font-weight: 600;
        color: white;
        text-align: center;
        max-width: 80%;
      ">${props.name}</p>
      <p style="
        margin-top: 8px;
        font-size: 14px;
        color: rgba(255,255,255,0.7);
      ">${props.artist}</p>
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
    overflow: hidden;
    pointer-events: none;
    will-change: transform, width, height, left, top;
  `
  document.body.appendChild(clone)

  // 隐藏原始卡片
  card.style.opacity = '0'

  // 目标尺寸（16:9 比例）
  const targetWidth = Math.min(800, window.innerWidth - 48)
  const targetHeight = targetWidth * 9 / 16
  const targetLeft = (window.innerWidth - targetWidth) / 2
  const targetTop = (window.innerHeight - targetHeight) / 2

  const tl = gsap.timeline({
    onComplete: () => {
      router.push(props.to)
      setTimeout(() => {
        clone.remove()
        overlay.remove()
        card.style.opacity = '1'
        isAnimating.value = false
      }, 50)
    },
  })

  // 背景淡入
  tl.to(overlay, {
    background: 'rgba(0,0,0,0.7)',
    duration: 0.3,
    ease: 'power2.out',
  }, 0)

  // 卡片展开
  tl.to(clone, {
    width: targetWidth,
    height: targetHeight,
    left: targetLeft,
    top: targetTop,
    borderRadius: '20px',
    duration: 0.5,
    ease: 'power3.out',
  }, 0)

  // 短暂停留后淡出
  tl.to([clone, overlay], {
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
  }, '+=0.1')
}
</script>

<template>
  <div
    ref="cardRef"
    class="mv-card group cursor-pointer"
    @click="handleClick"
    @mousemove="handleMouseMove"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="mv-card-inner relative aspect-video overflow-hidden rounded-2xl shadow-xl">
      <LazyImage
        :src="cover + '?param=400y225'"
        :alt="name"
        img-class="h-full w-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-75"
        wrapper-class="h-full w-full"
      />

      <!-- 渐变遮罩 -->
      <div class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      <!-- 播放量 -->
      <div
        v-if="playCount"
        class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
      >
        <span class="icon-[mdi--play] h-3 w-3" />
        {{ formatCount(playCount) }}
      </div>

      <!-- 悬停播放按钮 -->
      <div
        ref="overlayRef"
        class="absolute inset-0 flex items-center justify-center"
      >
        <div
          class="play-button flex h-14 w-14 scale-80 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-md transition-colors hover:bg-white/30"
        >
          <span class="play-icon icon-[mdi--play] h-7 w-7 text-white" />
        </div>
      </div>

      <!-- 底部信息 -->
      <div class="absolute right-0 bottom-0 left-0 p-3">
        <p class="truncate text-sm font-medium text-white">{{ name }}</p>
        <p class="mt-0.5 truncate text-[11px] text-white/70">{{ artist }}</p>
      </div>

      <!-- 悬停时的彩色边框动画 -->
      <div
        class="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style="
          background: linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(139, 92, 246, 0.3));
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          padding: 2px;
        "
      />
    </div>
  </div>
</template>

<style scoped>
.mv-card {
  will-change: transform;
  transform-origin: center center;
  transform-style: preserve-3d;
}

.mv-card-inner {
  transform-style: preserve-3d;
}
</style>
