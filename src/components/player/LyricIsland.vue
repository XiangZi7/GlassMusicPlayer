<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, useTemplateRef, watch } from 'vue'
import {
  useElementSize,
  onClickOutside,
  StorageSerializers,
  useLocalStorage,
  usePreferredReducedMotion,
  useResizeObserver,
} from '@vueuse/core'
import { isTauri } from '@tauri-apps/api/core'
import IslandCover from '@/components/player/IslandCover.vue'
import IslandPlayer from '@/components/player/IslandPlayer.vue'
import { usePlayer } from '@/composables/usePlayer'
import { useIslandKeyboardFocus } from '@/composables/useIslandKeyboardFocus'

const { state, tracks, controller } = usePlayer()
const button = useTemplateRef<HTMLButtonElement>('button')
const measure = useTemplateRef<HTMLElement>('measure')
const { width: lyricWidth } = useElementSize(measure)
const reducedMotion = usePreferredReducedMotion()
const keyboardFocus = useIslandKeyboardFocus()
const panel = useTemplateRef<InstanceType<typeof IslandPlayer>>('panel')
const popup = reactive({
  // 是否展开胶囊内的播放控件。
  open: false,
  // 面板在所属玻璃窗口中的水平位置。
  left: 0,
  // 面板在所属玻璃窗口中的垂直位置。
  top: 0,
})
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
useResizeObserver([host, button], () => {
  restorePosition()
  if (popup.open) placePanel()
})
watch([visible, () => state.stage], restorePosition, { flush: 'post' })
watch([visible, () => state.stage], ([shown, stage]) => {
  if (!shown || stage) popup.open = false
})
onClickOutside(() => panel.value?.$el as HTMLElement | undefined, () => { popup.open = false }, { ignore: [button] })

// 记录起点，轻点展开播放器，拖动只移动胶囊。
function startDrag(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) return
  event.preventDefault()
  button.value?.focus({ preventScroll: true })
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

// 从胶囊向可用空间展开，拖到窗口四角也能点到所有控件。
function placePanel(): void {
  const bounds = host.value?.getBoundingClientRect()
  const rect = button.value?.getBoundingClientRect()
  if (!bounds || !rect) return
  const width = Math.min(320, bounds.width - 16)
  const height = Math.min(158, bounds.height - 16)
  popup.left = Math.max(8, Math.min(rect.left - bounds.left + (rect.width - width) / 2, bounds.width - width - 8))
  popup.top = Math.max(8, Math.min(rect.bottom - bounds.top - height, bounds.height - height - 8))
}

// 键盘激活和轻点展开同一面板，拖动后的合成点击不会展开。
function openPanel(event: MouseEvent): void {
  if (dragged && event.detail !== 0) return
  placePanel()
  popup.open = true
}

// 主动收起后把键盘焦点交还胶囊。
async function closePanel(): Promise<void> {
  popup.open = false
  await nextTick()
  if (!popup.open) button.value?.focus({ preventScroll: true })
}

// 全屏仍由主播放器管理，退出舞台后焦点回到紧凑胶囊。
function openStage(): void {
  popup.open = false
  controller()?.openStage(button.value ?? undefined)
}
</script>

<template>
  <button
    v-show="visible"
    ref="button"
    type="button"
    class="lyric-capsule absolute left-1/2 z-[6] flex w-max max-w-[46%] cursor-default touch-none items-center gap-[9px] rounded-full py-1 pr-[12px] pl-[5px] text-[12.5px] font-bold whitespace-nowrap text-white select-none"
    :class="{ 'keyboard-focus': keyboardFocus }"
    :style="{ translate: `${offset.x}px ${offset.y}px`, opacity: popup.open ? 0 : undefined }"
    :inert="popup.open"
    :tabindex="state.stage ? -1 : undefined"
    aria-label="展开灵动岛播放器"
    aria-haspopup="dialog"
    :aria-expanded="popup.open"
    :aria-controls="popup.open ? 'island-player' : undefined"
    :aria-busy="state.stageLoading || undefined"
    @pointerdown="startDrag"
    @pointermove="drag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @lostpointercapture="endDrag"
    @click="openPanel"
  >
    <IslandCover :src="tracks[state.idx]?.cover" :motion="state.settings.motion" />
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
      class="cap-eq pointer-events-none flex h-3 flex-none items-end gap-[2.5px]"
      aria-hidden="true"
    >
      <i /><i /><i />
    </span>
    <span
      class="pointer-events-none flex-none text-[11px] opacity-65"
      aria-hidden="true"
      >▸</span
    >
  </button>
  <Transition name="island-expand" :css="animateLyrics">
    <IslandPlayer
      v-if="popup.open && visible && !state.stage"
      :class="{ 'pointer-controls': !keyboardFocus }"
      ref="panel"
      class="absolute z-[12]"
      :style="{ left: popup.left + 'px', top: popup.top + 'px' }"
      :track="tracks[state.idx]"
      :time="state.t"
      :duration="state.streamDuration || tracks[state.idx]?.dur || 0"
      :playing="state.playing"
      :loading="state.audioLoading"
      :playable="!!tracks[state.idx]?.catalog || (!tracks[state.idx] && !!state.queue?.length)"
      :motion="state.settings.motion"
      open-label="打开全屏播放"
      @action="controller()?.dispatch($event)"
      @close="closePanel"
      @open="openStage"
    />
  </Transition>
</template>

<style scoped>
.lyric-capsule:focus { outline: none; }
.lyric-capsule.keyboard-focus:focus-visible { outline: 2px solid white; outline-offset: 2px; }
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
