<script setup lang="ts">
import { computed, reactive, useTemplateRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { isTauri } from '@tauri-apps/api/core'
import { usePlayer } from '@/composables/usePlayer'

const { state, controller } = usePlayer()
const button = useTemplateRef<HTMLButtonElement>('button')
const host = computed(() => button.value?.closest<HTMLElement>('[data-player]'))
const offset = reactive({ x: 0, y: 0 })
const visible = computed(
  () =>
    state.settings.lyricIsland &&
    !(isTauri() && state.settings.lyricIslandDesktop)
)
let gesture:
  | { id: number; x: number; y: number; startX: number; startY: number }
  | undefined
let dragged = false

// 按宿主和胶囊当前尺寸限位，缩放窗口或歌词变长后也能抓到胶囊。
function moveTo(x: number, y: number): void {
  const bounds = host.value?.getBoundingClientRect()
  const element = button.value
  if (!bounds || !element) return
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const [appliedX = 0, appliedY = 0] = element.style.translate
    .split(' ')
    .map(parseFloat)
  const left = rect.left - appliedX
  const top = rect.top - appliedY
  offset.x = Math.min(
    Math.max(x, bounds.left - left + 8),
    bounds.right - left - rect.width - 8
  )
  offset.y = Math.min(
    Math.max(y, bounds.top - top + 8),
    bounds.bottom - top - rect.height - 8
  )
}

useResizeObserver([host, button], () => moveTo(offset.x, offset.y))

// 记录起点，轻点仍打开全屏播放。
function startDrag(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) return
  dragged = false
  gesture = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    startX: offset.x,
    startY: offset.y,
  }
  button.value?.setPointerCapture(event.pointerId)
}

// 移动超过阈值后才改变位置，避免轻点时误拖。
function drag(event: PointerEvent): void {
  if (!gesture || gesture.id !== event.pointerId) return
  const dx = event.clientX - gesture.x
  const dy = event.clientY - gesture.y
  if (!dragged && Math.hypot(dx, dy) < 5) return
  dragged = true
  moveTo(gesture.startX + dx, gesture.startY + dy)
}

// 指针被收回时结束本次拖动，保留点击抑制直到下一次操作。
function endDrag(event: PointerEvent): void {
  if (gesture?.id === event.pointerId) gesture = undefined
}

// 忽略拖动后产生的鼠标点击，保留键盘操作。
function openStage(event: MouseEvent): void {
  if (!dragged || event.detail === 0) controller()?.openStage()
}
</script>

<template>
  <button
    v-show="visible"
    ref="button"
    type="button"
    class="lyric-capsule absolute left-1/2 z-[6] flex max-w-[46%] cursor-grab touch-none items-center gap-[9px] rounded-full px-[15px] py-2 text-[12.5px] font-bold whitespace-nowrap text-white select-none active:cursor-grabbing"
    :style="{ translate: `${offset.x}px ${offset.y}px` }"
    :tabindex="state.stage ? -1 : undefined"
    aria-label="灵动岛，打开全屏播放"
    @pointerdown="startDrag"
    @pointermove="drag"
    @lostpointercapture="endDrag"
    @click="openStage"
  >
    <span
      class="cap-eq pointer-events-none flex h-3 flex-none items-end gap-[2.5px]"
      aria-hidden="true"
    >
      <i /><i /><i />
    </span>
    <span
      class="cap-text pointer-events-none overflow-hidden text-ellipsis"
      data-capsule-text
    />
    <span
      class="pointer-events-none flex-none text-[11px] opacity-65"
      aria-hidden="true"
      >▸</span
    >
  </button>
</template>
