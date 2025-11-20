<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { formatDuration } from '@/utils/time'
const props = withDefaults(
  defineProps<{
    show?: boolean
    placement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
    offsetX?: number
    offsetY?: number
    closeOnClickOutside?: boolean
  }>(),
  { placement: 'top-right', offsetX: 8, offsetY: 8, closeOnClickOutside: true }
)
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()
const localOpen = ref(false)
const open = computed({
  get: () => (props.show !== undefined ? props.show : localOpen.value),
  set: v => {
    if (props.show !== undefined) emit('update:show', v)
    else localOpen.value = v
  },
})
const triggerRef = ref<HTMLElement>()
const bubbleRef = ref<HTMLElement>()
const positionClass = computed(() => {
  switch (props.placement) {
    case 'top-right':
      return 'absolute bottom-full right-0'
    case 'top-left':
      return 'absolute bottom-full left-0'
    case 'bottom-right':
      return 'absolute top-full right-0'
    case 'bottom-left':
      return 'absolute top-full left-0'
    default:
      return 'absolute bottom-full right-0'
  }
})
const offsetStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.placement?.startsWith('top')) style.marginBottom = `${props.offsetY}px`
  if (props.placement?.startsWith('bottom')) style.marginTop = `${props.offsetY}px`
  if (props.placement?.endsWith('right')) style.marginRight = `${props.offsetX}px`
  if (props.placement?.endsWith('left')) style.marginLeft = `${props.offsetX}px`
  return style
})
const onDocClick = (e: Event) => {
  if (!props.closeOnClickOutside) return
  const t = e.target as Node
  if (triggerRef.value && triggerRef.value.contains(t)) return
  if (bubbleRef.value && bubbleRef.value.contains(t)) return
  open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocClick))
onUnmounted(() => document.removeEventListener('pointerdown', onDocClick))
const toggle = () => (open.value = !open.value)
const { playlist, playByIndex } = useAudio()
</script>
<template>
  <div ref="triggerRef" class="relative inline-block">
    <div @click.stop="toggle">
      <slot name="trigger"></slot>
    </div>
    <Transition name="bubble">
      <div v-if="open" ref="bubbleRef" :class="positionClass" :style="offsetStyle">
        <template v-if="$slots.default">
          <slot></slot>
        </template>
        <template v-else>
          <div class="w-72 rounded-2xl bg-black/60 p-3 shadow-xl backdrop-blur">
            <div class="relative">
              <div class="absolute right-5 -top-2 h-3 w-3 rotate-45 rounded-sm bg-black/70"></div>
            </div>
            <h4 class="mb-2 text-sm font-medium text-white/80">播放列表</h4>
            <div class="max-h-64 space-y-2 overflow-auto">
              <div
                v-for="(s, i) in playlist"
                :key="s.id || i"
                class="flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/10"
                @click="playByIndex(i)"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <div class="h-10 w-10 shrink-0 overflow-hidden rounded-md">
                    <img
                      v-if="s.cover"
                      :src="s.cover + '?param=100y100'"
                      alt="cover"
                      class="h-full w-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-full w-full items-center justify-center rounded-md bg-linear-to-br from-pink-400 to-purple-500"
                    >
                      <span class="icon-[mdi--music] h-5 w-5 text-white"></span>
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-sm text-white">{{ s.name }}</p>
                    <p class="truncate text-xs text-purple-300">{{ s.artist }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-white/60">{{ formatDuration(s.duration) }}</span>
                  <span class="icon-[mdi--play] h-4 w-4 text-white/70"></span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>
<style scoped>
.bubble-enter-active,
.bubble-leave-active {
  transition: all 0.18s ease;
}
.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
