<script setup lang="ts">
import { computed, ref, toRefs, useTemplateRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import TrackRow from '@/components/player/TrackRow.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { usePlayer } from '@/composables/usePlayer'

const props = defineProps<{
  indices: number[]
  listKey: string
  empty?: string
  emptyIcon?:
    | 'music'
    | 'search'
    | 'playlist'
    | 'download'
    | 'upload'
    | 'link'
    | 'heart'
    | 'history'
  playAsQueue?: boolean
  fitHeight?: boolean
}>()
const { state, tracks, controller } = usePlayer()
const viewport = useTemplateRef<HTMLElement>('viewport')
const height = ref(0)
const trackRowHeight = 52
const paginationHeight = 70

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
      :class="{ 'flex min-h-0 flex-1 flex-col overflow-y-auto': fitHeight }"
    >
      <!-- 满页平分剩余高度，短页保持原始行高，不把空白留在满页末尾。 -->
      <TrackRow
        v-for="(index, position) in visible"
        :key="`${index}:${position}`"
        :class="{ 'flex-1': fitHeight && visible.length === pageSize }"
        :track="tracks[index]!"
        :number="
          playAsQueue ? (current - 1) * pageSize + position + 1 : index + 1
        "
        :active="index === idx"
        @play="play(index)"
      />
      <EmptyState
        v-if="!indices.length"
        :class="{ 'min-h-[140px]': !fitHeight }"
        :icon="emptyIcon || 'music'"
        :label="empty || '暂无歌曲'"
      />
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
