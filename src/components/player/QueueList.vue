<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, toRefs, watch } from 'vue'
import { useVirtualList } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackPlaybackBars from '@/components/player/TrackPlaybackBars.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'

const props = defineProps<{ compact?: boolean; showCurrent?: boolean }>()
const { state, tracks, controller } = usePlayer()
const rowHeight = 53
const indices = computed(() => [...(state.queue ?? [])])
const { list, wrapperProps, containerProps, scrollTo } = useVirtualList(
  indices,
  {
    itemHeight: rowHeight,
    overscan: 4,
  }
)
// 根据真实队列位置滚动，再将焦点交给已挂载行。
async function reveal(position: number, focus = false): Promise<void> {
  const viewport = containerProps.ref.value
  if (!viewport || position < 0 || position >= indices.value.length) return
  const top = position * rowHeight
  if (
    top < viewport.scrollTop ||
    top + rowHeight > viewport.scrollTop + viewport.clientHeight
  )
    scrollTo(position, { block: 'nearest', behavior: 'instant' })
  await nextTick()
  if (focus)
    viewport
      .querySelector<HTMLElement>(`[data-qpos="${position}"]`)
      ?.focus({ preventScroll: true })
}
// 弹出队列直接显示当前曲目，侧栏保持自己的滚动位置。
onMounted(() => {
  if (props.compact) void reveal(indices.value.indexOf(state.idx))
})
// 用绝对队列位置导航，Home 和 End 也能访问屏幕以外的曲目。
function browse(event: KeyboardEvent): void {
  if (!['Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.stopPropagation()
  event.preventDefault()
  const length = indices.value.length
  if (!length) return
  const position = Number(
    (event.target as HTMLElement)?.closest?.<HTMLElement>('[data-qpos]')
      ?.dataset.qpos ?? -1
  )
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? length - 1
        : event.key === 'ArrowUp'
          ? position <= 0
            ? length - 1
            : position - 1
          : (position + 1) % length
  void reveal(target, true)
}
// 全屏气泡的离场期间保留内容，下次展开时重新定位。
watch(
  () => props.showCurrent,
  visible => {
    if (visible) void reveal(indices.value.indexOf(state.idx))
  },
  { flush: 'post' }
)
defineExpose({ browse })
const drag = reactive({
  /** 正在拖拽的队列位置。 */ from: null as number | null,
  /** 放置位置。 */ over: null as number | null,
  /** 是否放到目标之后。 */ after: false,
})

// 拖拽只改变原稿队列顺序，不改变正在播放的曲目。
function start(event: DragEvent, position: number): void {
  drag.from = position
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(position))
  }
}

// 按原稿目标行中线判断前插或后插。
function hover(event: DragEvent, position: number): void {
  if (drag.from === null || drag.from === position) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  drag.over = position
  drag.after = event.clientY - rect.top > rect.height / 2
}

// 结束拖拽后清除拖放标记，防止残留高亮。
function end(): void {
  drag.from = null
  drag.over = null
}

// 放置位置统一交给播放器队列方法，两个队列面板同步更新。
async function drop(event: DragEvent, position: number): Promise<void> {
  event.preventDefault()
  const viewport = containerProps.ref.value
  const focused = viewport?.contains(document.activeElement)
    ? document.activeElement?.closest<HTMLElement>('[data-ti]')?.dataset.ti
    : undefined
  if (drag.from !== null)
    controller()?.moveQueue(drag.from, position + (drag.after ? 1 : 0))
  end()
  await nextTick()
  if (focused !== undefined && document.activeElement === document.body)
    void reveal(indices.value.indexOf(Number(focused)), true)
}
const { idx } = toRefs(state)
</script>

<template>
  <div
    v-bind="containerProps"
    class="queue-viewport panel-scroll min-h-0"
    :class="{ 'sidebar-queue': !compact }"
    @keydown="browse"
  >
    <div
      v-bind="wrapperProps"
      :class="compact ? 'fsq-list' : 'queue'"
    >
      <div
        v-for="{ data: index, index: position } in list"
        :key="index"
        class="qrow cursor-default"
        :class="[
          compact ? 'fsq-item' : 'qitem',
          {
            on: index === idx,
            dragging: drag.from === position,
            'drop-before': drag.over === position && !drag.after,
            'drop-after': drag.over === position && drag.after,
          },
        ]"
        :data-ti="index"
        :data-qpos="position"
        draggable="true"
        role="button"
        tabindex="0"
        @click="controller()?.selectTrack(index, true)"
        :aria-current="index === idx ? 'true' : undefined"
        @keydown.enter.self.stop.prevent="
          controller()?.selectTrack(index, true)
        "
        @keydown.space.self.stop.prevent="
          controller()?.selectTrack(index, true)
        "
        @dragstart="start($event, position)"
        @dragover="hover($event, position)"
        @dragleave="drag.over = null"
        @dragend="end"
        @drop="drop($event, position)"
      >
        <span
          class="qdrag grid w-[13px] flex-none cursor-default place-items-center opacity-[.35]"
          aria-hidden="true"
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle
              cx="9"
              cy="6"
              r="1.6"
            />
            <circle
              cx="15"
              cy="6"
              r="1.6"
            />
            <circle
              cx="9"
              cy="12"
              r="1.6"
            />
            <circle
              cx="15"
              cy="12"
              r="1.6"
            />
            <circle
              cx="9"
              cy="18"
              r="1.6"
            />
            <circle
              cx="15"
              cy="18"
              r="1.6"
            /></svg
        ></span>
        <img
          decoding="async"
          loading="lazy"
          :src="tracks[index]!.cover"
          alt=""
        /><span class="qt"
          ><b>{{ tracks[index]!.title }}</b
          ><span>{{ tracks[index]!.artist }}</span></span
        >
        <BaseButton
          class="qnext grid h-[26px] w-[26px] flex-none place-items-center rounded-[8px] border-none bg-transparent p-0 text-inherit opacity-[.5]"
          title="下一首播放"
          :aria-label="`下一首播放《${tracks[index]!.title}》`"
          @click.stop="controller()?.playNext(index)"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M5 5v14l7-7z"
              fill="currentColor"
              stroke="none"
            />
            <path
              d="M13 5v14l7-7z"
              fill="currentColor"
              stroke="none"
              opacity=".55"
            />
            <path d="M21 5v14" /></svg
        ></BaseButton>
        <span class="qd">{{ formatTime(tracks[index]!.dur) }}</span>
        <TrackPlaybackBars :active="index === idx" />
      </div>
    </div>
  </div>
</template>
<style scoped>
.queue-viewport {
  overflow-anchor: none;
  overscroll-behavior: contain;
}
.sidebar-queue {
  max-height: max(240px, 55vh);
}
.queue,
.fsq-list {
  display: block;
}
.queue-viewport .qrow {
  box-sizing: border-box;
  height: 49px;
  margin-bottom: 4px;
}
.qt span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
