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
const { playlist, playByIndex, moveSong, queueNext, removeSong, removeSongs } = useAudio()
const draggingIndex = ref<number | null>(null)
const selected = reactive<Record<string | number, boolean>>({})
const toggleSelect = (id: string | number) => (selected[id] = !selected[id])
const selectedIds = computed(
  () =>
    Object.keys(selected)
      .filter(k => selected[k as any])
      .map(k => (isNaN(Number(k)) ? k : Number(k))) as any
)
const onDragStart = (i: number) => (draggingIndex.value = i)
const onDragOver = (e: DragEvent) => e.preventDefault()
const onDrop = (i: number) => {
  if (draggingIndex.value === null) return
  moveSong(draggingIndex.value, i)
  draggingIndex.value = null
}
const doQueueNextSelected = () => {
  selectedIds.value.forEach((id: any) => queueNext(id as any))
}
const doDeleteSelected = () => {
  removeSongs(selectedIds.value as any)
}
</script>
<template>
  <div ref="triggerRef" class="relative inline-block">
    <div @click.stop="toggle">
      <slot name="trigger"></slot>
    </div>
    <Transition name="bubble">
      <div v-if="open" ref="bubbleRef" class="min-w-lg" :class="positionClass" :style="offsetStyle">
        <template v-if="$slots.default">
          <slot></slot>
        </template>
        <template v-else>
          <div class="glass-card relative z-99999 min-h-64 w-full p-3 bg-(--glass-bg-base)">
            <h4 class="mb-2 text-sm font-medium text-white/80">播放列表</h4>
            <div class="mb-2 flex items-center gap-2">
              <button
                class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
                title="下一首播放选中"
                @click="doQueueNextSelected"
              >
                <span class="icon-[mdi--skip-next] h-4 w-4"></span>
              </button>
              <button
                class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
                title="删除选中"
                @click="doDeleteSelected"
              >
                <span class="icon-[mdi--delete] h-4 w-4"></span>
              </button>
            </div>
            <div class="max-h-64 space-y-2 overflow-auto">
              <div
                v-for="(s, i) in playlist"
                :key="s.id || i"
                class="flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/10"
                draggable="true"
                @dragstart="onDragStart(i)"
                @dragover="onDragOver"
                @drop="onDrop(i)"
                @dblclick.stop="playByIndex(i)"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    :checked="selected[s.id as any]"
                    @change="toggleSelect(s.id as any)"
                  />
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
                  <button
                    class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
                    title="播放"
                    @click.stop="playByIndex(i)"
                  >
                    <span class="icon-[mdi--play] h-4 w-4"></span>
                  </button>
                  <button
                    class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
                    title="下一首"
                    @click.stop="queueNext(s.id as any)"
                  >
                    <span class="icon-[mdi--skip-next] h-4 w-4"></span>
                  </button>
                  <button
                    class="glass-button flex h-8 w-8 items-center justify-center rounded-full"
                    title="删除"
                    @click.stop="removeSong(s.id as any)"
                  >
                    <span class="icon-[mdi--delete] h-4 w-4"></span>
                  </button>
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
