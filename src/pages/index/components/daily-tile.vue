<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { CSSProperties } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TrackPlaybackBars from '@/components/player/TrackPlaybackBars.vue'
import CoverThumbnail from '@/components/player/CoverThumbnail.vue'
import { usePlayer } from '@/composables/usePlayer'
import { defaultCover } from '@/constants/music'
import { catalogKey } from '@/services/player/catalog'
import { artworkColor } from '@/services/player/artwork-color'
import { formatTime } from '@/utils/format'
import { useDailyMix } from '@/pages/index/use-daily-mix'
import type { SourceTrack } from '@/types/prototype'

const props = defineProps<{
  songs: SourceTrack[]
  sourceLabel: string
  retryAccount: boolean
  loading: boolean
  // 当前曲目的目录键，用于在迷你行里标出正在播放的那一首。
  currentKey: string
}>()
const emit = defineEmits<{ play: []; retry: []; open: []; playTrack: [position: number] }>()
const { state: playerState } = usePlayer()
const state = reactive({
  // 已加载失败的封面地址，大封面与迷你行统一回退通用封面。
  failedCovers: [] as string[],
  // 第一首封面的主色，驱动 tile 背景的色wash渐变。
  accent: '',
})
const { duration, playing, pending, actionLabel, playFeatured } = useDailyMix(
  () => props.songs,
  () => props.loading
)
// 主打大封面取第一首，失败或缺失时回退通用封面。
const cover = computed(() => {
  const source = props.songs[0]?.cover
  return source && !state.failedCovers.includes(source) ? source : defaultCover
})
// tile 下半部的迷你行展示前六首，两列三行铺满下半区，与顶部条的整单播放互补。
const preview = computed(() => props.songs.slice(0, 6))
// 背景色wash跟随主打封面的主色，无真实封面时保持中性深底。
const washStyle = computed<CSSProperties | undefined>(() =>
  state.accent ? ({ '--tile-accent': state.accent } as CSSProperties) : undefined
)

// 记录加载失败的封面地址，tile 内所有使用处随之回退。
function markCoverFailed(source?: string): void {
  if (source && source !== defaultCover && !state.failedCovers.includes(source))
    state.failedCovers.push(source)
}

// 解析一张封面的实际地址，已失败或缺失时回退通用封面。
function coverSource(source?: string): string {
  return source && !state.failedCovers.includes(source) ? source : defaultCover
}

// 判断一首迷你行是否为当前曲目，命中时行高亮并显示律动条。
function isActive(song: SourceTrack): boolean {
  return !!props.currentKey && !!song.catalog && catalogKey(song.catalog) === props.currentKey
}

// 只取第一首封面的颜色，换单后忽略上一次取色结果。
watch(
  cover,
  async (source, _, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    if (source === defaultCover) {
      state.accent = ''
      return
    }
    const rgb = await artworkColor(source, document)
    if (current) state.accent = rgb ? `rgb(${rgb.join(' ')})` : ''
  },
  { immediate: true }
)

// 主按钮点击：已是当前队列时切换播放状态，否则交给首页按日推顺序起播。
function onPlay(): void {
  playFeatured(() => emit('play'))
}
</script>

<template>
  <article class="tile daily-tile" :style="washStyle" aria-labelledby="daily-tile-title">
    <!-- 背景：主打封面重模糊压暗作色wash，内容层在其上保持可读。 -->
    <div class="daily-wash" aria-hidden="true">
      <CoverThumbnail v-if="cover !== defaultCover" :src="cover" :size="152" alt="" @error="markCoverFailed(songs[0]?.cover)" />
    </div>
    <div class="daily-body">
      <div class="daily-head">
        <span class="tile-kicker">每日推荐</span>
        <span class="daily-source">{{ sourceLabel }}</span>
      </div>
      <div class="daily-main">
        <CoverThumbnail class="daily-cover" :src="cover" :size="152" alt="" @error="markCoverFailed(songs[0]?.cover)" />
        <div class="daily-info">
          <h3 id="daily-tile-title">今日主打歌单</h3>
          <p class="daily-meta">
            <template v-if="songs.length">{{ songs.length }} 首歌<template v-if="duration"> · 共 {{ duration }}</template></template>
            <template v-else>{{ loading ? '正在读取推荐…' : '暂无可播放的推荐曲目' }}</template>
            <button v-if="retryAccount" class="ml-2 rounded underline underline-offset-2 focus-visible:outline-2" @click="emit('retry')">重试账号推荐</button>
          </p>
          <div class="daily-actions">
            <BaseButton
              class="banner-play daily-play"
              :loading="loading"
              :disabled="!songs.length"
              :aria-busy="pending || loading"
              :title="pending ? '正在获取音频，点击取消' : undefined"
              @click="onPlay"
            >
              <span v-if="pending" class="banner-pending" aria-hidden="true"></span>
              <svg v-else-if="!loading" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path :d="playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5.5v13l11-6.5z'" />
              </svg>
              {{ actionLabel }}
            </BaseButton>
            <BaseButton class="daily-ghost" @click="emit('open')">
              查看歌单
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
            </BaseButton>
          </div>
        </div>
      </div>
      <!-- 前六首迷你行：两列三行，点行按位起播整份日推，与顶部条主按钮共用同一队列顺序。 -->
      <div v-if="preview.length" class="daily-rows">
        <BaseButton
          v-for="(song, position) in preview"
          :key="(song.catalog ? song.catalog.platform + ':' + song.catalog.id : song.title) + '-' + position"
          class="daily-row"
          :class="{ on: isActive(song), 'daily-row-motion': playerState.settings.motion }"
          :aria-current="isActive(song) ? 'true' : undefined"
          :title="song.title + ' · ' + song.artist"
          @click="emit('playTrack', position)"
        >
          <span class="daily-row-cover">
            <CoverThumbnail :src="coverSource(song.cover)" :size="36" alt="" loading="lazy" @error="markCoverFailed(song.cover)" />
            <span class="daily-row-play" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
            </span>
          </span>
          <span class="daily-row-text">
            <b>{{ song.title }}</b>
            <span>{{ song.artist }}</span>
          </span>
          <TrackPlaybackBars v-if="isActive(song)" :active="playerState.playing" />
          <span v-else class="daily-row-dur">{{ song.dur ? formatTime(song.dur) : '—' }}</span>
        </BaseButton>
      </div>
      <div v-else-if="!loading" class="daily-empty">
        <EmptyState label="暂无推荐曲目" aria-hidden="true" />
        <p>暂无可播放的推荐曲目，导入或连接平台后这里会生成今日主打。</p>
      </div>
      <div v-else class="daily-rows" aria-hidden="true">
        <div v-for="slot in 6" :key="slot" class="daily-row daily-skeleton"></div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* 主打 tile：占 bento 左列两行高，背景色wash来自封面主色。 */
.daily-tile {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: flex;
}
.daily-wash {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--tile-accent, #3a3454) 44%, #17141f), #17141f 78%);
  transition: background 220ms ease;
}
.daily-wash img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(42px) saturate(1.22) brightness(0.46);
  transform: scale(1.18);
  opacity: 0.55;
}
.daily-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.daily-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.tile-kicker {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: rgb(255 255 255 / 88%);
}
.daily-source {
  overflow: hidden;
  font-size: 12px;
  color: rgb(255 255 255 / 62%);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daily-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}
.daily-cover {
  width: clamp(118px, 15cqw, 152px);
  aspect-ratio: 1;
  flex: none;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 16px;
  object-fit: cover;
  box-shadow:
    0 16px 32px rgb(0 0 0 / 42%),
    0 4px 14px color-mix(in srgb, var(--tile-accent, transparent) 32%, transparent);
}
.liquid-win .daily-cover {
  border-color: rgb(255 255 255 / 38%);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 25%),
    0 18px 38px rgb(0 0 0 / 36%);
}
.daily-info {
  min-width: 0;
}
.daily-info h3 {
  margin: 0;
  overflow: hidden;
  font-size: clamp(22px, 2.6cqw, 28px);
  font-weight: 750;
  line-height: 1.25;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daily-meta {
  margin: 8px 0 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 550;
  color: rgb(255 255 255 / 74%);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daily-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}
/* 主按钮沿用全局 .banner-play 的双材质底色，只在本 tile 内定尺寸。 */
.daily-play {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 17px;
  border: 1px solid rgb(255 255 255 / 55%);
  border-radius: 99px;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.25;
  cursor: pointer;
}
.daily-play svg,
.daily-play .banner-pending {
  width: 13px;
  height: 13px;
}
.daily-play:focus-visible {
  outline: 2px solid white;
  outline-offset: 4px;
}
.daily-play:active {
  transform: scale(0.96);
}
.daily-ghost {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 40px;
  padding: 0 15px;
  border: 1px solid rgb(255 255 255 / 32%);
  border-radius: 99px;
  background: rgb(255 255 255 / 9%);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.25;
  cursor: pointer;
  transition:
    background 140ms ease,
    transform 140ms ease;
}
.daily-ghost:hover {
  background: rgb(255 255 255 / 16%);
}
.daily-ghost:active {
  transform: scale(0.96);
}
.daily-ghost:focus-visible {
  outline: 2px solid white;
  outline-offset: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .daily-ghost {
    transition: none;
  }
}
/* 迷你行：两列三行贴 tile 底部，行间以发丝线分隔，hover 浅底并在封面上淡入播放钮。 */
.daily-rows {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
  margin-top: auto;
  padding-top: 16px;
}
.daily-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 6px 8px;
  border-radius: 10px;
  color: inherit;
  text-align: start;
  cursor: pointer;
}
.daily-row:nth-child(n + 3) {
  border-top: 1px solid rgb(255 255 255 / 7%);
}
.daily-row-cover {
  position: relative;
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  background: rgb(255 255 255 / 8%);
}
.daily-row-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.daily-row-play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 45%);
  color: #fff;
  opacity: 0;
}
.daily-row:hover .daily-row-play,
.daily-row:focus-visible .daily-row-play {
  opacity: 1;
}
.daily-row.on {
  background: rgb(255 255 255 / 9%);
}
.daily-row.on .daily-row-text b {
  color: #fff;
}
.daily-row.on :deep(.bars) {
  color: #fff;
}
.daily-row-text {
  min-width: 0;
  flex: 1;
}
.daily-row-text b,
.daily-row-text span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daily-row-text b {
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
}
.daily-row-text span {
  font-size: 11.5px;
  color: rgb(255 255 255 / 60%);
}
.daily-row-dur {
  flex: none;
  font: 11px var(--font-mono);
  color: rgb(255 255 255 / 62%);
  font-variant-numeric: tabular-nums;
}
.daily-row:hover,
.daily-row:focus-visible {
  background: rgb(255 255 255 / 8%);
}
.daily-row:focus-visible {
  outline: 2px solid white;
  outline-offset: -2px;
}
.daily-row-motion {
  transition: background-color 160ms ease;
}
.daily-row-motion .daily-row-play {
  transition: opacity 160ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .daily-row,
  .daily-row .daily-row-play {
    transition: none;
  }
}
.daily-empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin-top: auto;
  padding: 18px 0 6px;
  text-align: center;
}
.daily-empty p {
  margin: 0;
  font-size: 12.5px;
  color: rgb(255 255 255 / 62%);
}
.daily-skeleton {
  border: 1px dashed rgb(255 255 255 / 12%);
  background: rgb(255 255 255 / 3%);
  cursor: default;
}
/* 窄窗时主打区改为封面在上、信息在下，迷你行退回单列，避免横排挤压。 */
@container (max-width: 560px) {
  .daily-main {
    flex-direction: column;
    align-items: flex-start;
  }
  .daily-rows {
    grid-template-columns: minmax(0, 1fr);
  }
  .daily-row:nth-child(n + 2) {
    border-top: 1px solid rgb(255 255 255 / 7%);
  }
}
</style>
