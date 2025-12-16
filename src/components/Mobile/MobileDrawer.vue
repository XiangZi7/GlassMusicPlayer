<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import Button from '@/components/Ui/Button.vue'

const props = defineProps<{
  title?: string
  height?: string
}>()

const isOpen = defineModel<boolean>('show', { default: false })
const drawerRef = useTemplateRef<HTMLElement>('drawerRef')

// 手动处理拖动逻辑
const isDragging = ref(false)
const startY = ref(0)
const currentY = ref(0)
const startTime = ref(0)

const onPointerDown = (e: PointerEvent) => {
  // 只处理左键或触摸
  if (e.button !== 0 && e.pointerType === 'mouse') return

  isDragging.value = true
  startY.value = e.clientY
  currentY.value = e.clientY
  startTime.value = Date.now()

  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
}

const onPointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return
  e.preventDefault()
  currentY.value = e.clientY
}

const onPointerUp = (e: PointerEvent) => {
  if (!isDragging.value) return

  const target = e.currentTarget as HTMLElement
  target.releasePointerCapture(e.pointerId)

  const distance = currentY.value - startY.value
  const time = Date.now() - startTime.value
  const velocity = distance / time

  isDragging.value = false

  // 关闭条件：
  // 1. 下拉距离超过 150px
  // 2. 快速下拉 (速度 > 0.5px/ms 且距离 > 50px)
  if (distance > 150 || (distance > 50 && velocity > 0.5)) {
    isOpen.value = false
  }
}

const currentTranslateY = computed(() => {
  if (!isDragging.value) return 0
  return Math.max(0, currentY.value - startY.value)
})

const drawerStyle = computed(() => {
  const style: Record<string, string> = {
    height: props.height || '70vh',
  }

  // 拖动时跟随手指，无过渡；释放后如果未关闭则平滑回弹
  if (isDragging.value) {
    style.transform = `translateY(${currentTranslateY.value}px)`
    style.transition = 'none'
  } else {
    style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  }
  return style
})

// 点击外部关闭
onClickOutside(drawerRef, () => {
  isOpen.value = false
})
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-10001 flex flex-col justify-end bg-black/40 backdrop-blur-sm transition-colors"
    >
      <div
        ref="drawerRef"
        class="glass-container-strong flex w-full flex-col rounded-t-3xl rounded-b-none border-t border-white/10 shadow-2xl backdrop-blur-xl transition-colors"
        :style="drawerStyle"
        @click.stop
      >
        <!-- 拖动条 -->
        <div
          class="flex w-full cursor-grab touch-none items-center justify-center py-5 active:cursor-grabbing"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <div class="h-1.5 w-12 rounded-full bg-primary/30"></div>
        </div>

        <!-- 头部 -->
        <div v-if="$slots.header" class="-mt-2">
          <slot name="header" :close="() => isOpen = false"></slot>
        </div>
        <div v-else class="-mt-2 flex items-center justify-between border-b border-white/5 px-4 pb-3">
          <h3 class="text-primary text-base font-bold">{{ title }}</h3>
          <Button
            variant="ghost"
            size="icon-md"
            rounded="full"
            icon="mdi--close"
            icon-class="h-6 w-6"
            @click="isOpen = false"
          />
        </div>

        <!-- 内容区域 -->
        <div class="flex-1 overflow-hidden">
          <slot></slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@reference "../../style/tailwind.css";

.glass-container-strong {
  background: var(--glass-container-strong-bg);
  border-top: 1px solid var(--glass-border);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
