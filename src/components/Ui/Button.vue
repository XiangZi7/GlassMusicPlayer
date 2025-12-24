<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

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
  // 1. 在使用组件时直接传入完整的类名：icon="icon-[mdi--shuffle-variant]"
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
    :to="to"
    :href="href"
    :type="!to && !href ? type : undefined"
    :class="classes"
    :style="gradientStyle"
    :disabled="disabled || loading"
  >
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
</style>
