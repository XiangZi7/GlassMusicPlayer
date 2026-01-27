<script setup lang="ts">
import { gsap } from 'gsap'

// 全局共享元素状态
interface SharedElementState {
  id: string
  rect: DOMRect
  imageUrl: string
  borderRadius: string
  element?: HTMLElement
}

const sharedElementStore = reactive<{
  source: SharedElementState | null
  target: SharedElementState | null
  isAnimating: boolean
  clone: HTMLElement | null
}>({
  source: null,
  target: null,
  isAnimating: false,
  clone: null,
})

// 提供全局方法
const setSource = (id: string, element: HTMLElement, imageUrl: string, borderRadius: string = '12px') => {
  sharedElementStore.source = {
    id,
    rect: element.getBoundingClientRect(),
    imageUrl,
    borderRadius,
    element,
  }
}

const setTarget = (id: string, element: HTMLElement, borderRadius: string = '12px') => {
  if (sharedElementStore.source?.id !== id) return

  sharedElementStore.target = {
    id,
    rect: element.getBoundingClientRect(),
    imageUrl: sharedElementStore.source.imageUrl,
    borderRadius,
  }

  // 开始动画
  runTransition()
}

const runTransition = async () => {
  const { source, target } = sharedElementStore
  if (!source || !target || sharedElementStore.isAnimating) return

  sharedElementStore.isAnimating = true

  // 创建克隆元素
  const clone = document.createElement('div')
  clone.className = 'page-transition-clone'
  clone.style.cssText = `
    position: fixed;
    z-index: 10000;
    width: ${source.rect.width}px;
    height: ${source.rect.height}px;
    left: ${source.rect.left}px;
    top: ${source.rect.top}px;
    border-radius: ${source.borderRadius};
    background-image: url(${source.imageUrl});
    background-size: cover;
    background-position: center;
    pointer-events: none;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    will-change: transform, width, height, left, top, border-radius;
  `
  document.body.appendChild(clone)
  sharedElementStore.clone = clone

  // 隐藏目标元素
  if (sharedElementStore.target?.element) {
    sharedElementStore.target.element.style.opacity = '0'
  }

  // 执行动画
  await gsap.to(clone, {
    width: target.rect.width,
    height: target.rect.height,
    left: target.rect.left,
    top: target.rect.top,
    borderRadius: target.borderRadius,
    duration: 0.5,
    ease: 'power3.out',
  })

  // 淡出克隆，显示目标
  gsap.to(clone, {
    opacity: 0,
    duration: 0.15,
    ease: 'power2.out',
    onComplete: () => {
      clone.remove()
      if (sharedElementStore.target?.element) {
        sharedElementStore.target.element.style.opacity = '1'
      }
      sharedElementStore.source = null
      sharedElementStore.target = null
      sharedElementStore.clone = null
      sharedElementStore.isAnimating = false
    },
  })
}

const clearTransition = () => {
  if (sharedElementStore.clone) {
    sharedElementStore.clone.remove()
  }
  sharedElementStore.source = null
  sharedElementStore.target = null
  sharedElementStore.clone = null
  sharedElementStore.isAnimating = false
}

// 提供给子组件
provide('sharedElement', {
  setSource,
  setTarget,
  clearTransition,
  isAnimating: computed(() => sharedElementStore.isAnimating),
})

// 路由变化时清理
const router = useRouter()
router.beforeEach(() => {
  // 保留 source 状态用于目标页面
})

router.afterEach(() => {
  // 给目标页面时间来注册目标元素
  setTimeout(() => {
    if (sharedElementStore.source && !sharedElementStore.target) {
      clearTransition()
    }
  }, 500)
})
</script>

<template>
  <slot />
</template>
