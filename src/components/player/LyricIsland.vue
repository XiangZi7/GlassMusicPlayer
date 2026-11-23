<script setup lang="ts">
import { computed, onMounted, reactive, useTemplateRef, watch } from 'vue'
import {
  useElementSize,
  StorageSerializers,
  useLocalStorage,
  usePreferredReducedMotion,
  useResizeObserver,
} from '@vueuse/core'
import { isTauri } from '@tauri-apps/api/core'
import { usePlayer } from '@/composables/usePlayer'

const { state, controller } = usePlayer()
const button = useTemplateRef<HTMLButtonElement>('button')
const measure = useTemplateRef<HTMLElement>('measure')
const { width: lyricWidth } = useElementSize(measure)
const reducedMotion = usePreferredReducedMotion()
const host = computed(() => button.value?.closest<HTMLElement>('[data-player]'))
const offset = reactive({
  // 水平拖动相对胶囊默认中心的位移。
  x: 0,
  // 垂直拖动相对底栏默认位置的位移。
  y: 0,
})
const savedCenter = useLocalStorage<{ x: number; y: number } | null>(
  'miraiMusic.lyricIsland.center.v1', null,
  { serializer: StorageSerializers.object, writeDefaults: false, flush: 'sync' }
)
const visible = computed(
  () =>
    state.settings.lyricIsland &&
    !(isTauri() && state.settings.lyricIslandDesktop)
)
const animateLyrics = computed(
  () =>
    visible.value &&
    !state.stage &&
    state.settings.motion &&
    reducedMotion.value !== 'reduce'
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

// 按窗口比例恢复胶囊中心；暂时缩小窗口只做限位，不覆盖用户保存的位置。
function restorePosition(): void {
  const bounds = host.value?.getBoundingClientRect()
  const element = button.value
  const center = savedCenter.value
  if (!bounds || !element || gesture || !visible.value || state.stage) return
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    moveTo(offset.x, offset.y)
    return
  }
  const rect = element.getBoundingClientRect()
  const [x = 0, y = 0] = element.style.translate.split(' ').map(parseFloat)
  moveTo(
    x + bounds.left + center.x * bounds.width - rect.left - rect.width / 2,
    y + bounds.top + center.y * bounds.height - rect.top - rect.height / 2
  )
}
onMounted(restorePosition)
useResizeObserver([host, button], restorePosition)
watch([visible, () => state.stage], restorePosition, { flush: 'post' })

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

// 拖动完成只保存一次，轻点、取消或歌词伸缩都不会改写用户选定的位置。
function endDrag(event: PointerEvent): void {
  if (gesture?.id !== event.pointerId) return
  gesture = undefined
  const bounds = host.value?.getBoundingClientRect()
  const element = button.value
  if (!dragged || !bounds?.width || !bounds.height || !element) return
  if (event.type === 'pointercancel') {
    restorePosition()
    return
  }
  const rect = element.getBoundingClientRect()
  const [x = 0, y = 0] = element.style.translate.split(' ').map(parseFloat)
  savedCenter.value = {
    x: (rect.left - x + offset.x + rect.width / 2 - bounds.left) / bounds.width,
    y: (rect.top - y + offset.y + rect.height / 2 - bounds.top) / bounds.height,
  }
}

// 忽略拖动后产生的鼠标点击，保留键盘操作。
function openStage(event: MouseEvent): void {
  if (!dragged || event.detail === 0) controller()?.openStage(event.currentTarget as HTMLElement)
}
</script>

<template>
  <button
    v-show="visible"
    ref="button"
    type="button"
    class="lyric-capsule absolute left-1/2 z-[6] flex w-max max-w-[46%] cursor-grab touch-none items-center gap-[9px] rounded-full px-[15px] py-2 text-[12.5px] font-bold whitespace-nowrap text-white select-none active:cursor-grabbing"
    :style="{ translate: `${offset.x}px ${offset.y}px` }"
    :tabindex="state.stage ? -1 : undefined"
    aria-label="灵动岛，打开全屏播放"
    :aria-busy="state.stageLoading || undefined"
    @pointerdown="startDrag"
    @pointermove="drag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
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
      class="pointer-events-none relative h-[1lh] min-w-0 overflow-hidden"
      :class="{ 'transition-[width] duration-[160ms] ease-out': animateLyrics }"
      :style="{ width: lyricWidth + 'px' }"
    >
      <!-- 独立测量新句，旧句淡出期间胶囊即可向目标宽度过渡。 -->
      <span
        ref="measure"
        class="invisible absolute top-0 left-0 w-max"
        aria-hidden="true"
        >{{ state.capsuleLyric }}</span
      >
      <Transition
        :key="animateLyrics ? 'animated' : 'static'"
        name="capsule-line"
        mode="out-in"
        :css="animateLyrics"
      >
        <span
          :key="state.capsuleLyric"
          class="block truncate"
          data-capsule-text
          >{{ state.capsuleLyric }}</span
        >
      </Transition>
    </span>
    <span
      class="pointer-events-none flex-none text-[11px] opacity-65"
      aria-hidden="true"
      >▸</span
    >
  </button>
</template>

<style scoped>
.capsule-line-leave-active {
  transition: opacity 70ms ease-in;
}
.capsule-line-enter-active {
  transition: opacity 90ms ease-out;
}
.capsule-line-leave-to,
.capsule-line-enter-from {
  opacity: 0;
}
</style>
