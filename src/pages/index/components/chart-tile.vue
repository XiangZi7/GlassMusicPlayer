<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import type { CatalogPlaylist, CatalogTrack } from '@/api'
import { defaultCover, platformNames } from '@/services/player/catalog'
import { formatTime } from '@/utils/format'

const props = defineProps<{
  playlists: CatalogPlaylist[]
  // 公开歌单尚未返回时先显示骨架行。
  loading: boolean
}>()
const emit = defineEmits<{ play: [songs: CatalogTrack[], position: number] }>()
const { state } = usePlayer()
// 榜单优先取标题带「榜」的公开歌单，没有时退回第一份有曲目的歌单作迷你榜。
const chart = computed(() => {
  const withTracks = props.playlists.filter(list => list.tracks.length)
  return withTracks.find(list => (list.title ?? '').includes('榜')) ?? withTracks[0]
})
// 无可用榜单曲目时，用发现歌单前四张卡竖排兜底，点卡按预览曲目起播。
const fallbackLists = computed(() => (chart.value ? [] : props.playlists.slice(0, 4)))

// 点榜单行按该歌单预览顺序起播整单。
function playRow(position: number): void {
  if (chart.value) emit('play', chart.value.tracks, position)
}

// 点兜底歌单卡按其预览曲目起播。
function playList(list: CatalogPlaylist): void {
  if (list.tracks.length) emit('play', list.tracks, 0)
}

// 封面加载失败时换上通用封面，避免兜底卡出现破图。
function fallbackCover(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  if (!image.src.endsWith(defaultCover)) image.src = defaultCover
}
</script>

<template>
  <article class="tile chart-tile" aria-labelledby="chart-tile-title">
    <!-- 波普贴纸：全页唯一一枚，黄星粗描边加白边，轻微旋转压在 tile 右上角。 -->
    <span class="chart-sticker pop-sticker" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path class="sticker-halo" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
        <path class="sticker-star" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
      </svg>
    </span>
    <div class="chart-head">
      <h3 id="chart-tile-title">榜单</h3>
      <span v-if="chart" class="chart-name">{{ chart.title || '公开歌单' }} · {{ platformNames[chart.platform] }}</span>
    </div>
    <!-- 榜单前四：名次数字与歌名歌手成行，前三名以亮色标出。 -->
    <div v-if="chart" class="chart-rows">
      <BaseButton
        v-for="(track, position) in chart.tracks.slice(0, 4)"
        :key="track.platform + ':' + track.id"
        class="chart-row"
        :class="{ 'chart-row-motion': state.settings.motion }"
        :title="track.title + ' · ' + track.artists.join(' / ')"
        @click="playRow(position)"
      >
        <span class="chart-rank" :class="{ hot: position < 3 }">{{ position + 1 }}</span>
        <span class="chart-text">
          <b>{{ track.title }}</b>
          <span>{{ track.artists.join(' / ') }}</span>
        </span>
        <span class="chart-dur">{{ track.durationMs ? formatTime(track.durationMs / 1000) : '—' }}</span>
      </BaseButton>
    </div>
    <!-- 兜底：没有榜单曲目时竖排发现歌单前四张卡。 -->
    <div v-else-if="fallbackLists.length" class="chart-rows">
      <BaseButton
        v-for="list in fallbackLists"
        :key="list.platform + ':' + list.id"
        class="chart-row chart-list-row"
        :class="{ 'chart-row-motion': state.settings.motion }"
        :title="list.title"
        @click="playList(list)"
      >
        <img :src="list.coverUrl || list.tracks[0]?.coverUrl || defaultCover" alt="" loading="lazy" decoding="async" @error="fallbackCover" />
        <span class="chart-text">
          <b>{{ list.title }}</b>
          <span>{{ platformNames[list.platform] }}<template v-if="list.total != null"> · {{ list.total }} 首</template></span>
        </span>
      </BaseButton>
    </div>
    <div v-else-if="loading" class="chart-rows" aria-hidden="true">
      <div v-for="slot in 4" :key="slot" class="chart-row chart-skeleton"></div>
    </div>
    <p v-else class="chart-empty">榜单暂不可用，公开歌单恢复后这里会列出前四名。</p>
  </article>
</template>

<style scoped>
.chart-tile {
  position: relative;
  display: flex;
  flex-direction: column;
}
/* 贴纸徽章：外圈白星作贴纸白边，内星黄底粗黑描边；倾斜与投影走共享 .pop-sticker，这里只管位置与尺寸，压住 tile 右上角。 */
.chart-sticker {
  position: absolute;
  top: -11px;
  right: 18px;
  z-index: 2;
  width: 37px;
  height: 37px;
}
.chart-sticker svg {
  display: block;
  width: 100%;
  height: 100%;
}
.chart-sticker .sticker-halo {
  fill: #fff;
}
.chart-sticker .sticker-star {
  fill: var(--pop-yellow);
  stroke: var(--pop-ink);
  stroke-width: 1.4;
  transform: scale(0.76);
  transform-origin: center;
}
.chart-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.chart-head h3 {
  margin: 0;
  flex: none;
  font-size: 15px;
  font-weight: 750;
  color: #fff;
}
.chart-name {
  overflow: hidden;
  font-size: 12px;
  color: rgb(255 255 255 / 58%);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chart-rows {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-evenly;
  margin-top: 8px;
}
/* 行间发丝线分隔，与主打 tile 迷你行同一语言。 */
.chart-row + .chart-row {
  border-top: 1px solid rgb(255 255 255 / 7%);
}
/* 榜单行：名次列定宽，歌名歌手截断，时长右对齐。 */
.chart-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 44px;
  padding: 4px 8px;
  border-radius: 10px;
  color: inherit;
  text-align: start;
  cursor: pointer;
}
.chart-rank {
  width: 18px;
  flex: none;
  font: 700 14px var(--font-mono);
  color: rgb(255 255 255 / 45%);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.chart-rank.hot {
  color: #ffb86b;
}
.liquid-win .chart-rank.hot {
  color: #ffd9a0;
}
.chart-text {
  min-width: 0;
  flex: 1;
}
.chart-text b,
.chart-text span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chart-text b {
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
}
.chart-text span {
  font-size: 11.5px;
  color: rgb(255 255 255 / 58%);
}
.chart-dur {
  flex: none;
  min-width: 32px;
  font: 11px var(--font-mono);
  color: rgb(255 255 255 / 58%);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.chart-list-row img {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
}
.chart-row:hover,
.chart-row:focus-visible {
  background: rgb(255 255 255 / 8%);
}
.chart-row:focus-visible {
  outline: 2px solid white;
  outline-offset: -2px;
}
.chart-row-motion {
  transition: background-color 150ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .chart-row {
    transition: none;
  }
}
.chart-empty {
  margin: auto 0;
  padding: 14px 2px;
  font-size: 12.5px;
  line-height: 1.6;
  color: rgb(255 255 255 / 58%);
}
.chart-skeleton {
  border: 1px dashed rgb(255 255 255 / 12%);
  border-radius: 10px;
  background: rgb(255 255 255 / 3%);
  cursor: default;
}
</style>
