<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { gsap } from 'gsap'

type ClassBinding = string | Record<string, boolean> | (string | Record<string, boolean>)[]

interface Props {
  variant?: 'glass' | 'solid' | 'soft' | 'ghost' | 'gradient' | 'text'
  size?: 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md' | 'icon-lg' | 'none'
  rounded?: 'default' | 'full' | 'lg' | 'xl' | '2xl' | 'none'
  block?: boolean
  loading?: boolean
  disabled?: boolean
  to?: string | object
  href?: string
  icon?: string
  iconClass?: ClassBinding
  type?: 'button' | 'submit' | 'reset'
  gradientColors?: string[]
  ripple?: boolean
  pulse?: boolean // 脉冲光环效果
  press3d?: boolean // 3D 按压效果
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'glass',
  size: 'md',
  rounded: 'default',
  block: false,
  loading: false,
  disabled: false,
  type: 'button',
  iconClass: 'h-5 w-5',
  ripple: true,
  pulse: false,
  press3d: false,
})

// 波纹效果
const buttonRef = ref<HTMLElement>()
const ripples = ref<{ id: number; x: number; y: number; size: number }[]>([])
let rippleId = 0

const createRipple = (e: MouseEvent) => {
  if (!props.ripple || props.disabled || props.loading) return

  const el = buttonRef.value
  if (!el) return

  // 确保按钮有定位上下文（如果还没有的话）
  const computedStyle = window.getComputedStyle(el)
  if (computedStyle.position === 'static') {
    el.style.position = 'relative'
  }

  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 2
  const x = e.clientX - rect.left - size / 2
  const y = e.clientY - rect.top - size / 2

  const id = rippleId++
  ripples.value.push({ id, x, y, size })

  // 动画结束后移除
  setTimeout(() => {
    ripples.value = ripples.value.filter(r => r.id !== id)
  }, 600)
}

// 3D 按压效果
const handleMouseDown = () => {
  if (!props.press3d || !buttonRef.value || props.disabled || props.loading) return

  gsap.to(buttonRef.value, {
    scale: 0.92,
    rotateX: 8,
    rotateY: -3,
    duration: 0.1,
    ease: 'power2.out',
  })
}

const handleMouseUp = () => {
  if (!props.press3d || !buttonRef.value) return

  gsap.to(buttonRef.value, {
    scale: 1,
    rotateX: 0,
    rotateY: 0,
    duration: 0.4,
    ease: 'elastic.out(1, 0.4)',
  })
}

// 脉冲效果
const createPulse = () => {
  if (!props.pulse || !buttonRef.value || props.disabled || props.loading) return

  const el = buttonRef.value
  const parent = el.parentElement
  if (!parent) return

  const rect = el.getBoundingClientRect()
  const parentRect = parent.getBoundingClientRect()

  const pulse = document.createElement('div')
  pulse.className = 'btn-pulse-ring'
  pulse.style.cssText = `
    position: absolute;
    width: ${rect.width}px;
    height: ${rect.height}px;
    left: ${rect.left - parentRect.left}px;
    top: ${rect.top - parentRect.top}px;
    border-radius: 100%;
    border: 2px solid currentColor;
    pointer-events: none;
    z-index: -1;
    opacity: 0.6;
  `

  parent.style.position = parent.style.position || 'relative'
  parent.appendChild(pulse)

  gsap.to(pulse, {
    scale: 1.6,
    opacity: 0,
    duration: 0.7,
    ease: 'power2.out',
    onComplete: () => pulse.remove(),
  })
}

// 处理点击，添加脉冲效果
const handleClick = (e: MouseEvent) => {
  createRipple(e)
  createPulse()
}

onMounted(() => {
  if (props.press3d && buttonRef.value) {
    buttonRef.value.style.transformStyle = 'preserve-3d'
    buttonRef.value.style.perspective = '800px'
  }
})

const componentType = computed(() => {
  if (props.to) return RouterLink
  if (props.href) return 'a'
  return 'button'
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'glass':
      return 'glass-button text-primary active:scale-95'
    case 'solid':
      return 'bg-pink-500 text-white shadow-lg shadow-pink-500/25 hover:bg-pink-600 hover:shadow-xl hover:shadow-pink-500/30'
    case 'soft':
      return 'bg-white/10 text-primary backdrop-blur-sm hover:bg-white/20 hover:scale-110'
    case 'ghost':
      return 'text-primary/70 hover:text-primary bg-transparent hover:bg-white/5'
    case 'text':
      return 'text-primary/70 hover:text-primary bg-transparent p-0'
    case 'gradient':
      return 'play-btn'
    default:
      return ''
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-3 py-1.5 text-sm'
    case 'md':
      return 'px-5 py-2.5 text-sm'
    case 'lg':
      return 'px-6 py-3 text-base'
    case 'icon-sm':
      return 'h-8 w-8 p-0 justify-center'
    case 'icon-md':
      return 'h-9 w-9 p-0 justify-center'
    case 'icon-lg':
      return 'h-12 w-12 p-0 justify-center'
    case 'none':
      return 'p-0'
    default:
      return 'px-5 py-2.5'
  }
})

const roundedClasses = computed(() => {
  if (props.rounded === 'default') {
    // glass-button has its own radius (12px), others might default to lg or full
    if (props.variant === 'glass') return '' // Inherit from class
    return 'rounded-xl' // Default for others
  }
  return `rounded-${props.rounded}`
})

const classes = computed(() => {
  return [
    'inline-flex items-center font-medium transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none',
    variantClasses.value,
    sizeClasses.value,
    roundedClasses.value,
    props.block ? 'w-full justify-center' : '',
  ]
})
const iconName = computed(() => {
  if (!props.icon) return ''
  // 如果已经包含了 icon-[...] 格式，则直接返回
  if (props.icon.startsWith('icon-[')) return props.icon

  // 注意：Tailwind JIT 编译器需要在编译时扫描到完整的类名才能生成 CSS。
  // 如果传入 "mdi--shuffle-variant"，JIT 编译器看不到 "icon-[mdi--shuffle-variant]" 这个字符串，
  // 因此不会生成对应的 CSS 类，导致图标无法显示。
  // 解决方案：
  // 1. 在使用组件时直接传入完整的类名：icon="icon-[mdi--shuffle-variant]]"
  // 2. 或者确保该图标类名在项目的其他地方（如注释或 safelist）中出现过。

  // 否则包装成 icon-[...] 格式
  return `icon-[${props.icon}]`
})

// 生成动态渐变样式
const gradientStyle = computed(() => {
  if (props.variant !== 'gradient') return {}

  if (!props.gradientColors || props.gradientColors.length === 0) {
    // 使用默认渐变
    return {}
  }

  // 使用传入的颜色数组生成渐变
  return {
    background: `linear-gradient(135deg, ${props.gradientColors.join(', ')})`,
  }
})
</script>

<template>
  <component
    :is="componentType"
    ref="buttonRef"
    :to="to"
    :href="href"
    :type="!to && !href ? type : undefined"
    :class="[classes, { 'overflow-hidden': ripple, 'btn-3d': press3d }]"
    :style="gradientStyle"
    :disabled="disabled || loading"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <!-- 波纹效果 -->
    <span
      v-for="r in ripples"
      :key="r.id"
      class="ripple-effect"
      :style="{
        left: `${r.x}px`,
        top: `${r.y}px`,
        width: `${r.size}px`,
        height: `${r.size}px`,
      }"
    />

    <!-- Loading State -->
    <span v-if="loading" class="icon-[mdi--loading] animate-spin" :class="[iconClass]"></span>

    <!-- Icon Prop -->
    <span v-else-if="icon" :class="[iconName, iconClass]"></span>

    <!-- Default Slot (Text) -->
    <slot></slot>
  </component>
</template>

<style>
@reference "../../style/tailwind.css";
.play-btn {
  @apply flex items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300;
  background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  box-shadow: 0 8px 32px rgba(236, 72, 153, 0.4);
}

.play-btn:hover {
  @apply scale-110;
  box-shadow: 0 12px 40px rgba(236, 72, 153, 0.5);
}
.play-btn.loading {
  @apply cursor-wait opacity-70;
}

/* 波纹效果 */
.ripple-effect {
  position: absolute;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.2;
  pointer-events: none;
  transform: scale(0);
  animation: ripple-animation 0.6s ease-out forwards;
}

@keyframes ripple-animation {
  to {
    transform: scale(1);
    opacity: 0;
  }
}

/* 3D 按压效果 */
.btn-3d {
  transform-style: preserve-3d;
  perspective: 800px;
  will-change: transform;
}

/* 渐变播放按钮增强 */
.play-btn {
  position: relative;
}

.play-btn::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: linear-gradient(135deg, #ec4899, #8b5cf6, #ec4899);
  background-size: 200% 200%;
  opacity: 0;
  z-index: -1;
  transition: opacity 0.3s ease;
  animation: gradient-rotate 3s ease infinite;
}

.play-btn:hover::before {
  opacity: 0.6;
}

@keyframes gradient-rotate {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
</style>
