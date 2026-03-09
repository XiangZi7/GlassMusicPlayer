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
const positionReady = ref(false)

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

watch(open, isOpen => {
  if (isOpen) {
    positionReady.value = false
    nextTick(() => {
      updateBubblePosition()
      requestAnimationFrame(() => {
        positionReady.value = true
      })
      window.addEventListener('scroll', updateBubblePosition, true)
      window.addEventListener('resize', updateBubblePosition)
    })
  } else {
    positionReady.value = false
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
  <div ref="triggerRef" class="relative inline-block">
    <div @click.stop="toggle" class="flex items-center justify-center">
      <slot name="trigger"></slot>
    </div>
    <Teleport to="body">
      <Transition name="bubble">
        <div
          v-if="open"
          ref="bubbleRef"
          :style="bubbleStyle"
          :class="{ 'bubble-positioning': !positionReady }"
        >
          <template v-if="$slots.default">
            <slot></slot>
          </template>
          <template v-else>
            <div class="playlist-bubble w-[400px] overflow-hidden rounded-2xl lg:w-[460px]">

              <!-- ═══ Header ═══ -->
              <div class="bubble-header flex items-center justify-between px-5 py-4">
                <div class="flex items-center gap-4">
                  <div class="header-icon flex h-11 w-11 items-center justify-center rounded-xl">
                    <span class="icon-[mdi--playlist-music] h-6 w-6 text-white"></span>
                  </div>
                  <div>
                    <h4 class="bubble-title text-base font-bold">
                      {{ $t('playlistBubble.title') }}
                    </h4>
                    <p class="bubble-subtitle mt-0.5 text-sm">
                      {{ playlist.length }} {{ $t('playlistBubble.tracks', '首') }}
                      <span class="mx-1 opacity-30">|</span>
                      {{ formatDuration(totalDuration) }}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-md"
                  rounded="full"
                  icon="icon-[mdi--close]"
                  icon-class="h-5 w-5"
                  class="bubble-close-btn"
                  @click="open = false"
                />
              </div>

              <!-- ═══ Toolbar ═══ -->
              <div class="bubble-toolbar flex items-center gap-1.5 px-4 py-2">
                <button class="tb-btn" @click="selectAll">
                  <span class="icon-[mdi--checkbox-multiple-outline] h-5 w-5"></span>
                  <span>{{ $t('playlistBubble.selectAll', '全选') }}</span>
                </button>
                <button
                  class="tb-btn"
                  :disabled="selectedCount === 0"
                  :title="$t('playlistBubble.queueNextSelected')"
                  @click="doQueueNextSelected"
                >
                  <span class="icon-[mdi--playlist-plus] h-5 w-5"></span>
                  <span>{{ $t('playlistBubble.queueNext', '下一首播放') }}</span>
                </button>
                <button
                  class="tb-btn tb-btn--danger"
                  :disabled="selectedCount === 0"
                  :title="$t('playlistBubble.deleteSelected')"
                  @click="doDeleteSelected"
                >
                  <span class="icon-[mdi--delete-outline] h-5 w-5"></span>
                  <span>{{ $t('playlistBubble.delete', '删除') }}</span>
                  <span v-if="selectedCount > 0" class="selected-badge">{{ selectedCount }}</span>
                </button>
                <div class="flex-1"></div>
                <button
                  class="tb-icon-btn"
                  :title="$t('playlistBubble.clearAll')"
                  @click="doClearAll"
                >
                  <span class="icon-[mdi--delete-sweep] h-5 w-5"></span>
                </button>
              </div>

              <!-- ═══ Song List ═══ -->
              <div
                v-if="playlist.length"
                class="bubble-list custom-scrollbar max-h-[440px] overflow-y-auto py-1.5"
              >
                <div
                  v-for="(s, i) in playlist"
                  :key="s.id || i"
                  class="playlist-item group relative flex cursor-pointer items-center gap-3.5 px-4 py-2.5 transition-all duration-150"
                  :class="{
                    'item-current': isCurrent(s),
                    'item-dragover': dragOverIndex === i && draggingIndex !== i,
                    'item-dragging': draggingIndex === i,
                  }"
                  draggable="true"
                  @dragstart="onDragStart(i)"
                  @dragover="e => onDragOver(e, i)"
                  @dragleave="onDragLeave"
                  @drop="onDrop(i)"
                  @dragend="onDragEnd"
                  @dblclick.stop="playByIndex(i)"
                >
                  <!-- Drag Handle -->
                  <div class="drag-handle shrink-0 cursor-grab opacity-0 transition-opacity duration-200 group-hover:opacity-60">
                    <span class="icon-[mdi--menu] block h-5 w-5"></span>
                  </div>

                  <!-- Checkbox -->
                  <input
                    type="checkbox"
                    :checked="selected[s.id as any]"
                    class="playlist-checkbox shrink-0"
                    @change="toggleSelect(s.id as any)"
                    @click.stop
                  />

                  <!-- Cover -->
                  <div class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                    <img
                      v-if="s.cover"
                      :src="s.cover + '?param=100y100'"
                      alt=""
                      class="h-full w-full object-cover"
                    />
                    <div v-else class="cover-fallback flex h-full w-full items-center justify-center">
                      <span class="icon-[mdi--music-note] h-6 w-6 text-white/70"></span>
                    </div>
                    <div
                      v-if="isCurrent(s)"
                      class="absolute inset-0 flex items-center justify-center bg-black/40"
                    >
                      <div v-if="isPlaying" class="playing-bars flex items-end gap-[3px]">
                        <span class="bar"></span>
                        <span class="bar"></span>
                        <span class="bar"></span>
                        <span class="bar"></span>
                      </div>
                      <span v-else class="icon-[mdi--pause] h-6 w-6 text-white"></span>
                    </div>
                  </div>

                  <!-- Song Info -->
                  <div class="min-w-0 flex-1">
                    <p
                      class="song-name truncate text-sm font-medium"
                      :class="{ 'song-name-active': isCurrent(s) }"
                    >
                      {{ s.name }}
                    </p>
                    <p class="song-artist mt-1 truncate text-xs">{{ s.artist }}</p>
                  </div>

                  <!-- Right: Duration + Actions -->
                  <div class="flex shrink-0 items-center">
                    <span class="song-duration text-xs tabular-nums transition-opacity duration-200 group-hover:opacity-0">
                      {{ formatDuration(s.duration) }}
                    </span>
                    <div class="item-actions absolute right-4 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <button
                        class="item-action-btn"
                        :title="$t('playlistBubble.actions.queueNext')"
                        @click.stop="queueNext(s.id as any)"
                      >
                        <span class="icon-[mdi--playlist-plus] h-5 w-5"></span>
                      </button>
                      <button
                        class="item-action-btn item-action-btn--danger"
                        :title="$t('playlistBubble.actions.delete')"
                        @click.stop="removeSong(s.id as any)"
                      >
                        <span class="icon-[mdi--delete-outline] h-5 w-5"></span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ═══ Empty State ═══ -->
              <div v-else class="flex flex-col items-center justify-center py-16">
                <div class="empty-icon mb-5 flex h-20 w-20 items-center justify-center rounded-full">
                  <span class="icon-[mdi--playlist-music-outline] h-10 w-10"></span>
                </div>
                <p class="empty-text text-sm font-medium">
                  {{ $t('playlistBubble.empty', '播放列表为空') }}
                </p>
                <p class="empty-hint mt-2 text-xs">
                  {{ $t('playlistBubble.emptyHint', '双击歌曲即可添加到播放列表') }}
                </p>
              </div>

            </div>
          </template>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════
   Container
   ═══════════════════════════════════ */
.playlist-bubble {
  background: var(--glass-bg-overlay);
  backdrop-filter: blur(var(--glass-blur-lg)) saturate(150%);
  -webkit-backdrop-filter: blur(var(--glass-blur-lg)) saturate(150%);
  border: 1px solid var(--glass-border-default);
  box-shadow: var(--glass-shadow-xl);
}

/* ═══════════════════════════════════
   Header
   ═══════════════════════════════════ */
.bubble-header {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(139, 92, 246, 0.1));
  border-bottom: 1px solid var(--glass-border-subtle);
}

.header-icon {
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  box-shadow: 0 4px 14px rgba(236, 72, 153, 0.35);
}

.bubble-title {
  color: var(--glass-text-contrast);
}

.bubble-subtitle {
  color: var(--glass-text-secondary);
}

.bubble-close-btn {
  color: var(--glass-text-muted);
}

.bubble-close-btn:hover {
  background: var(--glass-interactive-hover-muted);
  color: var(--glass-text-contrast);
}

/* ═══════════════════════════════════
   Toolbar
   ═══════════════════════════════════ */
.bubble-toolbar {
  border-bottom: 1px solid var(--glass-border-subtle);
}

.tb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--glass-text-secondary);
  transition: all 0.2s ease;
  cursor: pointer;
}

.tb-btn:hover {
  background: var(--glass-interactive-hover-muted);
  color: var(--glass-text-contrast);
}

.tb-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tb-btn:disabled:hover {
  background: transparent;
  color: var(--glass-text-secondary);
}

.tb-btn--danger:not(:disabled):hover {
  color: #f87171;
}

.tb-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--glass-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tb-icon-btn:hover {
  background: var(--glass-interactive-hover-muted);
  color: #f87171;
}

.selected-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: white;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  border-radius: 10px;
}

/* ═══════════════════════════════════
   Song List
   ═══════════════════════════════════ */
.bubble-list {
  background: var(--glass-bg-card);
}

.playlist-item:hover {
  background: var(--glass-interactive-hover-muted);
}

.playlist-item.item-current {
  background: var(--glass-interactive-hover-muted);
}

.playlist-item.item-current::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18%;
  bottom: 18%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, #ec4899, #8b5cf6);
}

.playlist-item.item-dragover {
  background: rgba(236, 72, 153, 0.08);
  box-shadow: inset 0 -2px 0 #ec4899;
}

.playlist-item.item-dragging {
  opacity: 0.35;
}

/* ═══════════════════════════════════
   Drag Handle
   ═══════════════════════════════════ */
.drag-handle {
  color: var(--glass-text-muted);
}

/* ═══════════════════════════════════
   Checkbox
   ═══════════════════════════════════ */
.playlist-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--glass-border-strong);
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.playlist-checkbox:hover {
  border-color: #ec4899;
}

.playlist-checkbox:checked {
  border-color: transparent;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
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

/* ═══════════════════════════════════
   Cover
   ═══════════════════════════════════ */
.cover-fallback {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.6), rgba(139, 92, 246, 0.6));
}

/* ═══════════════════════════════════
   Song Text
   ═══════════════════════════════════ */
.song-name {
  color: var(--glass-text-contrast);
}

.song-name-active {
  background: linear-gradient(135deg, #ec4899, #a855f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 600;
}

.song-artist {
  color: var(--glass-text-muted);
}

.song-duration {
  color: var(--glass-text-muted);
}

/* ═══════════════════════════════════
   Item Actions
   ═══════════════════════════════════ */
.item-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--glass-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.item-action-btn:hover {
  background: var(--glass-interactive-hover-muted);
  color: var(--glass-text-contrast);
}

.item-action-btn--danger:hover {
  color: #f87171;
}

/* ═══════════════════════════════════
   Empty State
   ═══════════════════════════════════ */
.empty-icon {
  background: var(--glass-interactive-hover-muted);
  color: var(--glass-text-muted);
}

.empty-text {
  color: var(--glass-text-secondary);
}

.empty-hint {
  color: var(--glass-text-muted);
}

/* ═══════════════════════════════════
   Playing Bars
   ═══════════════════════════════════ */
.playing-bars .bar {
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, #ec4899, #a855f6);
  animation: playing 0.8s ease-in-out infinite;
}

.playing-bars .bar:nth-child(1) { height: 10px; animation-delay: 0s; }
.playing-bars .bar:nth-child(2) { height: 16px; animation-delay: 0.15s; }
.playing-bars .bar:nth-child(3) { height: 12px; animation-delay: 0.3s; }
.playing-bars .bar:nth-child(4) { height: 14px; animation-delay: 0.45s; }

@keyframes playing {
  0%, 100% { height: 4px; }
  50% { height: 18px; }
}

/* ═══════════════════════════════════
   Transition
   ═══════════════════════════════════ */
.bubble-enter-active,
.bubble-leave-active {
  transition:
    opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.bubble-positioning {
  visibility: hidden !important;
  pointer-events: none;
}

/* ═══════════════════════════════════
   Scrollbar
   ═══════════════════════════════════ */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--glass-interactive-hover-muted);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--glass-interactive-hover);
}
</style>
