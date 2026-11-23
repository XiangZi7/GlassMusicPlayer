<script setup lang="ts">
import { computed, nextTick, onActivated, reactive, useTemplateRef, watch } from 'vue'
import { useEventListener, useMediaQuery, useResizeObserver } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
import { firstTrackIndices } from '@/services/player/library'
import { formatTime } from '@/utils/format'

const props = defineProps<{ kind: 'album' | 'artist' }>()
const { state: player, tracks, controller } = usePlayer()
const indices = computed(() => firstTrackIndices(tracks, props.kind))
const viewport = useTemplateRef<HTMLElement>('viewport')
const grid = useTemplateRef<HTMLElement>('grid')
const narrow = useMediaQuery('(max-width: 640px)')
const columns = computed(() => (narrow.value ? 2 : 4))
const rowGap = 14
const overscan = 2
const state = reactive({
  // 滚动内容距可视区顶部的距离。
  scrollTop: 0,
  // 实际内容视口的高度，供每次滚动计算可见行数。
  height: 0,
  // 首次测量后随封面宽度、本地字体及窗口缩放更新的卡片高度。
  cardHeight: 180,
  // 鼠标滚动时保留拥有键盘焦点的卡片，避免焦点掉回页面。
  focused: -1,
})
const pitch = computed(() => state.cardHeight + rowGap)
const rowCount = computed(() => Math.ceil(indices.value.length / columns.value))
const totalHeight = computed(() =>
  Math.max(0, rowCount.value * pitch.value - rowGap)
)
const visibleCards = computed(() => {
  const top = Math.min(
    state.scrollTop,
    Math.max(0, totalHeight.value - state.height)
  )
  const start =
    Math.max(0, Math.floor(top / pitch.value) - overscan) * columns.value
  const end = Math.min(
    indices.value.length,
    (Math.ceil((top + state.height) / pitch.value) + overscan) * columns.value
  )
  const visible = Array.from(
    { length: Math.max(0, end - start) },
    (_, i) => start + i
  )
  if (state.focused >= 0 && state.focused < start)
    visible.unshift(state.focused)
  if (state.focused >= end && state.focused < indices.value.length)
    visible.push(state.focused)
  return visible.map(position => {
    const index = indices.value[position]!
    return { position, index, track: tracks[index]! }
  })
})

// 从原稿卡片实测行高；缓存页面隐藏时保留已有尺寸。
function measure(): void {
  const element = viewport.value
  const first = grid.value?.firstElementChild
  if (!element?.clientHeight || !first) return
  state.height = element.clientHeight
  state.cardHeight = first.getBoundingClientRect().height
  state.scrollTop = element.scrollTop
}

useResizeObserver(viewport, measure)
useEventListener(document.fonts, 'loadingdone', measure)
onActivated(measure)
watch([grid, columns, () => player.page], measure, { flush: 'post' })

// 同步真实滚动位置，隐藏的缓存页面保留上次的可见范围。
function syncScroll(): void {
  if (viewport.value?.clientHeight) state.scrollTop = viewport.value.scrollTop
}

// 在完整集合内移动焦点；抵达两端时保留 Tab 的原生离开行为。
async function browse(event: KeyboardEvent): Promise<void> {
  if (event.ctrlKey || event.altKey || event.metaKey || !(event.target instanceof HTMLButtonElement))
    return
  const last = indices.value.length - 1
  const current = Number(event.target.dataset.position)
  const targets: Record<string, number> = {
    Home: 0,
    End: last,
    ArrowLeft: current - 1,
    ArrowRight: current + 1,
    ArrowUp: current - columns.value,
    ArrowDown: current + columns.value,
    Tab: current + (event.shiftKey ? -1 : 1),
  }
  const target = targets[event.key]
  const element = viewport.value
  if (target === undefined || !element) return
  if (event.key === 'Tab' && (target < 0 || target > last)) return
  event.preventDefault()
  event.stopPropagation()
  measure()
  const position = Math.max(0, Math.min(last, target))
  // 先挂载目标再滚动；即使浏览器合并滚动事件，连续 Home/End 也可立即移交焦点。
  state.focused = position
  await nextTick()
  const card = element.querySelector<HTMLButtonElement>(`[data-position="${position}"]`)
  if (!card || state.focused !== position) return
  card.focus({ preventScroll: true })
  const top = card.offsetTop
  if (top < element.scrollTop) element.scrollTop = top
  else if (top + card.offsetHeight > element.scrollTop + element.clientHeight)
    element.scrollTop = top + card.offsetHeight - element.clientHeight
  syncScroll()
}
</script>

<template>
  <div
    ref="viewport"
    class="collection-viewport panel-scroll mt-4 min-h-0 flex-1 overflow-y-auto"
    @scroll.passive="syncScroll"
    @keydown="browse"
  >
    <EmptyState
      v-if="!indices.length"
      :icon="kind === 'album' ? 'playlist' : 'music'"
      :label="kind === 'album' ? '暂无专辑' : '暂无歌手'"
    />
    <div
      v-else
      ref="grid"
      class="relative grid gap-x-[14px]"
      :class="kind === 'album' ? 'feat-grid' : 'artist-row'"
      :style="{
        height: totalHeight + 'px',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }"
    >
      <BaseButton
        v-for="{ position, index, track } in visibleCards"
        :key="index"
        class="absolute inset-x-0 min-w-0 cursor-pointer rounded-[18px] border border-transparent p-[10px_10px_12px] text-left text-inherit focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/80"
        :class="kind === 'album' ? 'feat bg-transparent' : 'artist-card'"
        :data-position="position"
        :style="{
          gridColumn: `${(position % columns) + 1} / span 1`,
          top: Math.floor(position / columns) * pitch + 'px',
        }"
        @focus="state.focused = position"
        @blur="state.focused === position && (state.focused = -1)"
        @click="controller()?.navigate(kind, index)"
      >
        <img
          :src="track.cover"
          alt=""
          loading="lazy"
          decoding="async"
        />
        <b :title="track[kind]">{{ track[kind] }}</b>
        <span class="block truncate">{{
          kind === 'album'
            ? track.artist + ' · ' + track.q
            : track.album + ' · ' + formatTime(track.dur)
        }}</span>
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.collection-viewport {
  overflow-anchor: none;
}
</style>
