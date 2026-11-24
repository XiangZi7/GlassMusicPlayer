<script setup lang="ts">
import { computed, ref, toRefs, useTemplateRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import TrackRow from '@/components/player/TrackRow.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { usePlayer } from '@/composables/usePlayer'
import { sortTrackIndices } from '@/services/player/library'
import { catalogKey } from '@/services/player/catalog'
import type { SourceTrack } from '@/types/prototype'

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
  sourceTracks?: SourceTrack[]
}>()
const emit = defineEmits<{ playSource: [index: number, order: number[]] }>()
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
const rows = computed(() => props.sourceTracks ?? tracks)
const sorted = computed(() => sortTrackIndices(rows.value, props.indices, state.sorts[props.listKey]))
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
  if (props.sourceTracks) emit('playSource', index, sorted.value)
  else if (props.playAsQueue) controller()?.playTracks(sorted.value, index)
  else controller()?.selectTrack(index, true)
}
const { idx } = toRefs(state)
// 外部歌单以平台和曲目 ID 判断当前曲目，无需在浏览时写入曲库。
function isCurrent(index: number): boolean {
  if (!props.sourceTracks) return index === idx.value
  const song = rows.value[index]?.catalog
  const current = tracks[idx.value]?.catalog
  return !!song && !!current && catalogKey(song) === catalogKey(current)
}
// 信息区的播放全部使用此时列表显示的排序。
function playFirst(): void {
  if (sorted.value[0] !== undefined) play(sorted.value[0])
}
defineExpose({ playFirst })
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
        :track="rows[index]!"
        :number="
          playAsQueue ? (current - 1) * pageSize + position + 1 : index + 1
        "
        :active="isCurrent(index)"
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
