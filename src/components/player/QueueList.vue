<script setup lang="ts">
import { toRefs } from 'vue'
import { reactive } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'

defineProps<{ fullscreen?: boolean }>()
const { state, tracks, controller } = usePlayer()
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
function drop(event: DragEvent, position: number): void {
  event.preventDefault()
  if (drag.from !== null)
    controller()?.moveQueue(drag.from, position + (drag.after ? 1 : 0))
  end()
}
const { queue, idx } = toRefs(state)
</script>

<template>
  <div :class="fullscreen ? 'fsq-list' : 'queue'">
    <div
      v-for="(index, position) in queue || []"
      :key="`${position}-${index}`"
      class="qrow cursor-pointer"
      :class="[
        fullscreen ? 'fsq-item' : 'qitem',
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
      @keydown.enter="controller()?.selectTrack(index, true)"
      @dragstart="start($event, position)"
      @dragover="hover($event, position)"
      @dragleave="drag.over = null"
      @dragend="end"
      @drop="drop($event, position)"
    >
      <span
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
      <img
        :src="tracks[index]!.cover"
        alt=""
      /><span class="qt"
        ><b>{{ tracks[index]!.title }}</b
        ><span>{{ tracks[index]!.artist }}</span></span
      >
      <span
        v-if="!fullscreen"
        class="bars hidden h-[14px] items-end justify-center gap-[2.5px]"
        ><i /><i /><i
      /></span>
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
    </div>
  </div>
</template>
