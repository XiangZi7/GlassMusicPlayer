<script setup lang="ts">
import { toRefs } from 'vue'
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'

const props = defineProps<{
  indices: number[]
  listKey: string
  empty?: string
}>()
const { state, tracks, controller } = usePlayer()
const sorted = computed(() => {
  const mode = state.sorts[props.listKey] || 'def'
  if (mode === 'def') return props.indices
  return [...props.indices].sort((a, b) => {
    const first = tracks[a]!,
      second = tracks[b]!
    if (mode === 'dur') return first.dur - second.dur || a - b
    const left = first[mode],
      right = second[mode]
    return (left < right ? -1 : left > right ? 1 : 0) || a - b
  })
})
const current = computed({
  get: () =>
    Math.min(
      state.pg[props.listKey] || 1,
      Math.max(1, Math.ceil(sorted.value.length / 10))
    ),
  set: page => {
    state.pg[props.listKey] = page
  },
})
const visible = computed(() =>
  sorted.value.slice((current.value - 1) * 10, current.value * 10)
)

// 选择曲目回到同一播放器，保留原稿自动播放与切歌动画的顺序。
function play(index: number): void {
  controller()?.selectTrack(index, true)
}
const { idx } = toRefs(state)
</script>

<template>
  <div data-vue-tracklist>
    <BaseButton
      v-for="index in visible"
      :key="index"
      class="trow grid min-h-[52px] w-full grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] rounded-[12px] border-none bg-transparent p-[0_10px] pt-[7px] pb-[7px] text-left text-[13px] text-inherit"
      :class="{ on: index === idx }"
      @click="play(index)"
    >
      <span class="num">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="tt"
        ><img
          :src="tracks[index]!.cover"
          alt=""
        /><span class="min-w-0"
          ><b>{{ tracks[index]!.title }}</b
          ><span>{{ tracks[index]!.artist }}</span></span
        ></span
      >
      <span class="alb">{{ tracks[index]!.album }}</span><span class="dur">{{
        formatTime(tracks[index]!.dur)
      }}</span>
      <span class="bars hidden h-[14px] items-end justify-center gap-[2.5px]"
        ><i /><i /><i
      /></span>
    </BaseButton>
    <div
      v-if="!indices.length && empty"
      class="empty-note p-[14px_4px] text-[13px] leading-[1.7] opacity-[.55]"
    >
      {{ empty }}
    </div>
  </div>
  <PaginationBar
    v-model:current="current"
    :page-key="listKey"
    :total="indices.length"
  />
</template>
