<script setup lang="ts">
import { computed, ref, toRefs, useTemplateRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import TrackRow from '@/components/player/TrackRow.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { usePlayer } from '@/composables/usePlayer'

const props = defineProps<{
  indices: number[]
  listKey: string
  empty?: string
  playAsQueue?: boolean
  fitHeight?: boolean
}>()
const { state, tracks, controller } = usePlayer()
const viewport = useTemplateRef<HTMLElement>('viewport')
const height = ref(0)
const trackRowHeight = 52
const paginationHeight = 68

useResizeObserver(
  () => (props.fitHeight ? viewport.value : null),
  ([entry]) => {
    if (entry && entry.contentRect.height > 0)
      height.value = entry.contentRect.height
  }
)

const pageSize = computed(() => {
  if (!props.fitHeight || !height.value) return 10
  const availableRows = Math.floor(height.value / trackRowHeight)
  if (props.indices.length <= availableRows) return Math.max(1, availableRows)
  return Math.max(
    1,
    Math.floor((height.value - paginationHeight) / trackRowHeight)
  )
})
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
      Math.max(1, Math.ceil(sorted.value.length / pageSize.value))
    ),
  set: page => {
    state.pg[props.listKey] = page
  },
})
const visible = computed(() =>
  sorted.value.slice(
    (current.value - 1) * pageSize.value,
    current.value * pageSize.value
  )
)

// 选择曲目回到同一播放器，保留原稿自动播放与切歌动画的顺序。
function play(index: number): void {
  if (props.playAsQueue) controller()?.playTracks(sorted.value, index)
  else controller()?.selectTrack(index, true)
}
const { idx } = toRefs(state)
</script>

<template>
  <div
    ref="viewport"
    :class="{ 'flex min-h-0 flex-1 flex-col': fitHeight }"
  >
    <div
      data-vue-tracklist
      :class="{ 'min-h-0 overflow-y-auto': fitHeight }"
    >
      <!-- 本地或已导入的曲目共用相同播放行。 -->
      <TrackRow
        v-for="(index, position) in visible"
        :key="`${index}:${position}`"
        :track="tracks[index]!"
        :number="
          playAsQueue ? (current - 1) * pageSize + position + 1 : index + 1
        "
        :active="index === idx"
        @play="play(index)"
      />
      <div
        v-if="!indices.length && empty"
        class="empty-note p-[14px_4px] text-[13px] leading-[1.7] opacity-[.55]"
      >
        {{ empty }}
      </div>
    </div>
    <PaginationBar
      :class="{ 'shrink-0': fitHeight }"
      v-model:current="current"
      :page-key="listKey"
      :total="indices.length"
      :page-size="pageSize"
    />
  </div>
</template>
