<script setup lang="ts">
import { toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackPlaybackBars from '@/components/player/TrackPlaybackBars.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'
// 拖拽排序为可选能力：只有传入 dragEnabled 的列表（如电台队列）才整行可拖，事件交回父级按队列位置处理。
const props = defineProps<{
  index: number
  meta: string
  showAlbum?: boolean
  dragEnabled?: boolean
  dragging?: boolean
  dropBefore?: boolean
  dropAfter?: boolean
}>()
const emit = defineEmits<{
  dragstart: [event: DragEvent]
  dragover: [event: DragEvent]
  dragleave: []
  dragend: []
  drop: [event: DragEvent]
}>()
const { state, tracks, controller } = usePlayer()
const { idx } = toRefs(state)
// 未开启拖拽的列表不转发任何拖拽事件，保持原有点播行为。
function onDragStart(event: DragEvent): void {
  if (props.dragEnabled) emit('dragstart', event)
}
// 悬停事件原样交回父级，由父级按行中线判断前插或后插。
function onDragOver(event: DragEvent): void {
  if (props.dragEnabled) emit('dragover', event)
}
// 放置事件原样交回父级完成队列重排。
function onDrop(event: DragEvent): void {
  if (props.dragEnabled) emit('drop', event)
}
</script>
<template>
  <div
    class="srow flex min-h-[48px] w-full cursor-pointer items-center gap-[10px] rounded-[13px] border border-transparent p-[7px]"
    :class="{
      on: index === idx,
      dragging: dragging,
      'drop-before': dropBefore,
      'drop-after': dropAfter,
    }"
    :aria-current="index === idx ? 'true' : undefined"
    :draggable="dragEnabled ? true : undefined"
    role="button"
    tabindex="0"
    @click="controller()?.selectTrack(index, true)"
    @keydown.enter="controller()?.selectTrack(index, true)"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="dragEnabled && emit('dragleave')"
    @dragend="dragEnabled && emit('dragend')"
    @drop="onDrop"
  >
    <span
      v-if="dragEnabled"
      class="qdrag grid w-[13px] flex-none cursor-grab place-items-center opacity-[.35]"
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
    <img decoding="async" loading="lazy"
      :src="tracks[index]!.cover"
      alt=""
    /><span class="qt"
      ><b>{{ tracks[index]!.title }}</b
      ><span
        >{{ tracks[index]!.artist
        }}{{ showAlbum ? ' · ' + tracks[index]!.album : '' }}</span
      ></span
    ><span
      class="stag flex-none rounded-full p-[4px_8px] text-[10px] font-extrabold tracking-[.03em] whitespace-nowrap opacity-[.85]"
      >{{ meta }}</span
    >
    <BaseButton
      class="qnext"
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
        <path d="M21 5v14" /></svg></BaseButton
    ><span class="qd">{{ formatTime(tracks[index]!.dur) }}</span>
    <TrackPlaybackBars :active="index === idx" />
  </div>
</template>
