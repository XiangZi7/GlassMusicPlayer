<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { formatDuration } from '@/utils/time'
import Button from '@/components/Ui/Button.vue'

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
const bubblePosition = ref({ top: 0, left: 0 })

// 计算气泡的绝对位置
const updateBubblePosition = () => {
  if (!triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft
  const scrollY = window.pageYOffset || document.documentElement.scrollTop

  let top = 0
  let left = 0

  switch (props.placement) {
    case 'top-right':
      top = rect.top + scrollY - (bubbleRef.value?.offsetHeight || 0) - props.offsetY
      left = rect.right + scrollX - (bubbleRef.value?.offsetWidth || 0) - props.offsetX
      break
    case 'top-left':
      top = rect.top + scrollY - (bubbleRef.value?.offsetHeight || 0) - props.offsetY
      left = rect.left + scrollX + props.offsetX
      break
    case 'bottom-right':
      top = rect.bottom + scrollY + props.offsetY
      left = rect.right + scrollX - (bubbleRef.value?.offsetWidth || 0) - props.offsetX
      break
    case 'bottom-left':
      top = rect.bottom + scrollY + props.offsetY
      left = rect.left + scrollX + props.offsetX
      break
  }

  bubblePosition.value = { top, left }
}

// 监听打开状态，更新位置
watch(open, isOpen => {
  if (isOpen) {
    nextTick(() => {
      updateBubblePosition()
      window.addEventListener('scroll', updateBubblePosition, true)
      window.addEventListener('resize', updateBubblePosition)
    })
  } else {
    window.removeEventListener('scroll', updateBubblePosition, true)
    window.removeEventListener('resize', updateBubblePosition)
  }
})

const bubbleStyle = computed(() => ({
  position: 'absolute' as const,
  top: `${bubblePosition.value.top}px`,
  left: `${bubblePosition.value.left}px`,
  zIndex: 99999,
}))

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

const {
  playlist,
  playByIndex,
  moveSong,
  queueNext,
  removeSong,
  removeSongs,
  clearPlaylist,
  currentSong,
  isPlaying,
} = useAudio()

const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const selected = reactive<Record<string | number, boolean>>({})

const toggleSelect = (id: string | number) => (selected[id] = !selected[id])

const selectedIds = computed(
  () =>
    Object.keys(selected)
      .filter(k => selected[k as any])
      .map(k => (isNaN(Number(k)) ? k : Number(k))) as any
)

const selectedCount = computed(() => selectedIds.value.length)

const selectAll = () => {
  const allSelected = playlist.value.every(s => selected[s.id as any])
  playlist.value.forEach(s => (selected[s.id as any] = !allSelected))
}

const onDragStart = (i: number) => (draggingIndex.value = i)
const onDragOver = (e: DragEvent, i: number) => {
  e.preventDefault()
  dragOverIndex.value = i
}
const onDragLeave = () => (dragOverIndex.value = null)
const onDrop = (i: number) => {
  if (draggingIndex.value === null) return
  moveSong(draggingIndex.value, i)
  draggingIndex.value = null
  dragOverIndex.value = null
}
const onDragEnd = () => {
  draggingIndex.value = null
  dragOverIndex.value = null
}

const doQueueNextSelected = () => {
  selectedIds.value.forEach((id: any) => queueNext(id as any))
  Object.keys(selected).forEach(k => (selected[k as any] = false))
}

const doDeleteSelected = () => {
  removeSongs(selectedIds.value as any)
  Object.keys(selected).forEach(k => (selected[k as any] = false))
}

const doClearAll = () => {
  clearPlaylist()
  Object.keys(selected).forEach(k => (selected[k as any] = false))
}

const isCurrent = (s: any) => currentSong.value?.id === s.id

const totalDuration = computed(() => {
  return playlist.value.reduce((acc, s) => acc + (s.duration || 0), 0)
})
</script>

<template>
  <!-- 播放列表气泡 -->
  <div ref="triggerRef" class="relative inline-block">
    <div @click.stop="toggle" class="flex items-center justify-center">
      <slot name="trigger"></slot>
    </div>
    <Teleport to="body">
      <Transition name="bubble">
        <div v-if="open" ref="bubbleRef" :style="bubbleStyle">
          <template v-if="$slots.default">
            <slot></slot>
          </template>
          <template v-else>
          <div class="playlist-bubble w-[360px] overflow-hidden rounded-xl shadow-2xl lg:w-[420px]">
            <div class="bubble-header flex items-center justify-between px-4 py-3">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-pink-500 to-purple-600"
                >
                  <span class="icon-[mdi--playlist-music] h-5 w-5 text-white"></span>
                </div>
                <div>
                  <h4 class="bubble-title text-sm font-semibold">
                    {{ $t('playlistBubble.title') }}
                  </h4>
                  <p class="bubble-subtitle text-xs">
                    {{ playlist.length }} 首 · {{ formatDuration(totalDuration) }}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                rounded="lg"
                icon="mdi--close"
                icon-class="h-5 w-5"
                class="bubble-close-btn"
                @click="open = false"
              />
            </div>

            <div class="bubble-toolbar flex items-center gap-2 px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                rounded="lg"
                icon="mdi--checkbox-multiple-outline"
                icon-class="h-4 w-4"
                class="toolbar-btn"
                @click="selectAll"
              >
                全选
              </Button>
              <Button
                variant="ghost"
                size="sm"
                rounded="lg"
                icon="mdi--playlist-plus"
                icon-class="h-4 w-4"
                class="toolbar-btn"
                :class="{ 'cursor-not-allowed opacity-40': selectedCount === 0 }"
                :disabled="selectedCount === 0"
                :title="$t('playlistBubble.queueNextSelected')"
                @click="doQueueNextSelected"
              >
                下一首播放
              </Button>
              <Button
                variant="ghost"
                size="sm"
                rounded="lg"
                icon="mdi--delete-outline"
                icon-class="h-4 w-4"
                class="toolbar-btn toolbar-btn-delete"
                :class="{ 'cursor-not-allowed opacity-40': selectedCount === 0 }"
                :disabled="selectedCount === 0"
                :title="$t('playlistBubble.deleteSelected')"
                @click="doDeleteSelected"
              >
                删除
                <span v-if="selectedCount > 0" class="selected-badge rounded px-1.5 text-[10px]">{{
                  selectedCount
                }}</span>
              </Button>
              <div class="flex-1"></div>
              <Button
                variant="ghost"
                size="icon-sm"
                rounded="lg"
                icon="mdi--delete-sweep"
                icon-class="h-4 w-4"
                class="toolbar-btn-clear"
                :title="$t('playlistBubble.clearAll')"
                @click="doClearAll"
              />
            </div>

            <div
              v-if="playlist.length"
              class="bubble-list custom-scrollbar max-h-[400px] overflow-y-auto"
            >
              <div
                v-for="(s, i) in playlist"
                :key="s.id || i"
                class="playlist-item group relative flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-all"
                :class="{
                  'item-current': isCurrent(s),
                  'bg-pink-500/20': dragOverIndex === i && draggingIndex !== i,
                  'opacity-50': draggingIndex === i,
                }"
                draggable="true"
                @dragstart="onDragStart(i)"
                @dragover="e => onDragOver(e, i)"
                @dragleave="onDragLeave"
                @drop="onDrop(i)"
                @dragend="onDragEnd"
                @dblclick.stop="playByIndex(i)"
              >
                <div class="flex w-6 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    :checked="selected[s.id as any]"
                    class="playlist-checkbox h-4 w-4 cursor-pointer rounded border-2 bg-transparent transition-all checked:border-pink-500 checked:bg-pink-500"
                    @change="toggleSelect(s.id as any)"
                    @click.stop
                  />
                </div>

                <div class="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                  <img
                    v-if="s.cover"
                    :src="s.cover + '?param=100y100'"
                    alt=""
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center bg-linear-to-br from-pink-500 to-purple-600"
                  >
                    <span class="icon-[mdi--music-note] h-5 w-5 text-white"></span>
                  </div>
                  <div
                    v-if="isCurrent(s)"
                    class="absolute inset-0 flex items-center justify-center bg-black/50"
                  >
                    <div v-if="isPlaying" class="playing-bars flex items-end gap-0.5">
                      <span class="bar"></span>
                      <span class="bar"></span>
                      <span class="bar"></span>
                      <span class="bar"></span>
                    </div>
                    <span v-else class="icon-[mdi--pause] h-5 w-5 text-white"></span>
                  </div>
                </div>

                <div class="min-w-0 flex-1">
                  <p
                    class="song-name truncate text-sm font-medium"
                    :class="{ 'song-name-active': isCurrent(s) }"
                  >
                    {{ s.name }}
                  </p>
                  <p class="song-artist truncate text-xs">{{ s.artist }}</p>
                </div>

                <div class="flex shrink-0 items-center">
                  <span class="song-duration mr-2 text-xs">{{ formatDuration(s.duration) }}</span>
                  <div
                    class="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Button
                      variant="ghost"
                      size="none"
                      rounded="lg"
                      icon="mdi--playlist-plus"
                      icon-class="h-4 w-4"
                      class="action-btn p-1.5"
                      :title="$t('playlistBubble.actions.queueNext')"
                      @click.stop="queueNext(s.id as any)"
                    />
                    <Button
                      variant="ghost"
                      size="none"
                      rounded="lg"
                      icon="mdi--delete-outline"
                      icon-class="h-4 w-4"
                      class="action-btn action-btn-delete p-1.5"
                      :title="$t('playlistBubble.actions.delete')"
                      @click.stop="removeSong(s.id as any)"
                    />
                  </div>
                </div>

                <div
                  class="drag-handle absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <span class="icon-[mdi--drag-vertical] h-full w-full"></span>
                </div>
              </div>
            </div>

            <div v-else class="empty-state flex flex-col items-center justify-center py-16">
              <div class="empty-icon mb-3 rounded-full p-4">
                <span class="icon-[mdi--playlist-remove] h-10 w-10"></span>
              </div>
              <p class="empty-text text-sm">播放列表为空</p>
              <p class="empty-hint mt-1 text-xs">双击歌曲即可添加到播放列表</p>
            </div>
          </div>
        </template>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.playlist-bubble {
  background: var(--playlist-bubble-bg);
  backdrop-filter: blur(var(--glass-dropdown-blur)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--glass-dropdown-blur)) saturate(140%);
  border: 1px solid var(--glass-border);
}

.bubble-header {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15));
}

.bubble-title {
  color: var(--glass-dropdown-text);
}

.bubble-subtitle {
  color: var(--glass-text);
  opacity: 0.6;
}

.bubble-close-btn {
  color: var(--glass-text);
  opacity: 0.6;
}

.bubble-close-btn:hover {
  background: var(--glass-hover-item-bg);
  color: var(--glass-hover-text);
  opacity: 1;
}

.bubble-toolbar {
  background: var(--glass-hover-item-bg);
  border-bottom: 1px solid var(--glass-border);
}

.toolbar-btn {
  color: var(--glass-text);
  opacity: 0.7;
}

.toolbar-btn:hover {
  background: var(--glass-hover-item-bg);
  color: var(--glass-hover-text);
  opacity: 1;
}

.toolbar-btn-delete:hover {
  color: #f87171;
}

.toolbar-btn-clear {
  color: var(--glass-text);
  opacity: 0.5;
}

.toolbar-btn-clear:hover {
  background: var(--glass-hover-item-bg);
  color: #f87171;
}

.selected-badge {
  background: var(--glass-hover-item-bg);
}

.bubble-list {
  background: var(--glass-bg-card);
}

.playlist-item:hover {
  background: var(--glass-hover-item-bg);
}

.playlist-item.item-current {
  background: var(--glass-hover-item-bg);
}

.playlist-checkbox {
  appearance: none;
  -webkit-appearance: none;
  border-color: var(--glass-border);
}

.playlist-checkbox:checked::after {
  content: '';
  display: block;
  width: 100%;
  height: 100%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
  background-size: 12px;
  background-position: center;
  background-repeat: no-repeat;
}

.song-name {
  color: var(--glass-dropdown-text);
}

.song-name-active {
  color: #ec4899;
}

.song-artist {
  color: var(--glass-text);
  opacity: 0.5;
}

.song-duration {
  color: var(--glass-text);
  opacity: 0.4;
}

.action-btn {
  color: var(--glass-text);
  opacity: 0.6;
}

.action-btn:hover {
  background: var(--glass-hover-item-bg);
  color: var(--glass-hover-text);
  opacity: 1;
}

.action-btn-delete:hover {
  color: #f87171;
}

.drag-handle span {
  color: var(--glass-text);
  opacity: 0.3;
}

.empty-state {
  color: var(--glass-text);
}

.empty-icon {
  background: var(--glass-hover-item-bg);
}

.empty-icon span {
  color: var(--glass-text);
  opacity: 0.2;
}

.empty-text {
  color: var(--glass-text);
  opacity: 0.4;
}

.empty-hint {
  color: var(--glass-text);
  opacity: 0.3;
}

.playing-bars .bar {
  width: 3px;
  height: 12px;
  background: #ec4899;
  border-radius: 2px;
  animation: playing 0.8s ease-in-out infinite;
}

.playing-bars .bar:nth-child(1) {
  animation-delay: 0s;
}
.playing-bars .bar:nth-child(2) {
  animation-delay: 0.2s;
}
.playing-bars .bar:nth-child(3) {
  animation-delay: 0.4s;
}
.playing-bars .bar:nth-child(4) {
  animation-delay: 0.6s;
}

@keyframes playing {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 16px;
  }
}

.bubble-enter-active,
.bubble-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--glass-hover-item-bg);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--glass-hover-button-bg);
}
</style>
