<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import { localDayKey, readPlayStats } from '@/services/player/play-stats'
import { preferenceTrackKey } from '@/services/player/preferences'

const { state, tracks, controller } = usePlayer()

// 副标题：当前年月 + 本月数据，与效果图同文案结构。
const monthLabel = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月 · 本月数据`
})

// 真实播放统计：播放次数与聆听时长从启用统计后积累，启用前为空，不回填、不编造。
const playStats = computed(() => readPlayStats())

// 本月听歌分钟：按本地日期前缀汇总本月真实聆听秒数。
const monthMinutes = computed(() => {
  const prefix = localDayKey().slice(0, 7)
  let seconds = 0
  for (const [day, value] of Object.entries(playStats.value.days)) {
    if (day.startsWith(prefix)) seconds += value
  }
  return Math.round(seconds / 60)
})

// 较上月增幅：上月有真实记录时才显示百分比，没有基数就不编造。
const monthGrowth = computed(() => {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prefix = localDayKey(last).slice(0, 7)
  let seconds = 0
  for (const [day, value] of Object.entries(playStats.value.days)) {
    if (day.startsWith(prefix)) seconds += value
  }
  const lastMinutes = Math.round(seconds / 60)
  if (!lastMinutes) return ''
  const delta = ((monthMinutes.value - lastMinutes) / lastMinutes) * 100
  return `${delta >= 0 ? '↑' : '↓'}${Math.abs(delta).toFixed(1)}% 较上月`
})

// 过去 7 天听歌时长：按本地日期取最近七天，缺失天按 0 分钟，柱高按最大值归一，柱色按效果图粉彩轮换。
const barColors = ['#2ec4b6', '#7ea8ff', '#8b5cf6', '#f78fb3', '#ffa94d', '#b197fc', '#63e6be']
const last7Days = computed(() => {
  const rows: { label: string; minutes: number; color: string }[] = []
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    rows.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      minutes: Math.round((playStats.value.days[localDayKey(date)] || 0) / 60),
      color: barColors[6 - offset]!,
    })
  }
  return rows
})
const maxMinutes = computed(() => Math.max(1, ...last7Days.value.map(row => row.minutes)))

// 热门歌手（曲库口径）：按曲库内歌曲数排序取前四，头像取该歌手第一首歌封面。
const topArtists = computed(() => {
  const counts = new Map<string, { count: number; cover: string }>()
  for (const track of tracks) {
    if (!track.artist) continue
    const entry = counts.get(track.artist) ?? { count: 0, cover: track.cover }
    entry.count += 1
    counts.set(track.artist, entry)
  }
  return [...counts.entries()]
    .map(([name, entry]) => ({ name, count: entry.count, cover: entry.cover }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
})

// 最常播放 TOP5：按真实播放次数映射回曲库曲目，找不到的旧记录跳过。
const topPlayed = computed(() => {
  const byKey = new Map(tracks.map((track, index) => [preferenceTrackKey(track), index]))
  return Object.entries(playStats.value.counts)
    .map(([key, count]) => ({ index: byKey.get(key), count }))
    .filter((row): row is { index: number; count: number } => row.index !== undefined)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
})
</script>

<template>
  <div class="page-panel hidden h-full" data-panel="stats">
    <div class="stats-page" :class="{ 'stats-in': state.settings.motion }">
      <h3 class="stats-title">听歌报告</h3>
      <p class="stats-sub">{{ monthLabel }}</p>

      <div class="stats-cols">
        <div class="stats-main">
          <!-- 本月听歌分钟卡：大数字 + 过去 7 天粉彩柱图，与效果图同版式。 -->
          <section class="stats-card fade-item" style="--i: 0">
            <h4 class="stats-card-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              本月听歌分钟
            </h4>
            <div class="stats-big">
              <b>{{ monthMinutes.toLocaleString('en-US') }}</b>
              <span class="stats-unit">分钟</span>
              <span v-if="monthGrowth" class="stats-growth">{{ monthGrowth }}</span>
              <span v-else-if="monthMinutes > 0" class="stats-note">本月开始积累</span>
            </div>
            <p v-if="!monthMinutes" class="stats-empty">从本月开始积累 — 播放歌曲后，这里会记下你的每一分钟。</p>
            <h5 class="stats-bars-title">过去7天听歌时长</h5>
            <div class="stats-bars" aria-hidden="true">
              <div v-for="row in last7Days" :key="row.label" class="stats-bar-col">
                <span class="stats-bar-track">
                  <span
                    class="stats-bar"
                    :style="{ height: Math.max(0, (row.minutes / maxMinutes) * 100) + '%', background: row.color }"
                  />
                </span>
                <small>{{ row.label }}</small>
              </div>
            </div>
          </section>

          <!-- 热门歌手卡：大圆形头像横排，名字与在库数在下。 -->
          <section class="stats-card fade-item" style="--i: 1">
            <h4 class="stats-plain-title">热门歌手</h4>
            <div v-if="topArtists.length" class="stats-artists">
              <div v-for="artist in topArtists" :key="artist.name" class="stats-artist">
                <img :src="artist.cover" alt="" loading="lazy" decoding="async" />
                <b :title="artist.name">{{ artist.name }}</b>
                <span>曲库 {{ artist.count }} 首</span>
              </div>
            </div>
            <p v-else class="stats-empty">曲库还是空的。</p>
          </section>
        </div>

        <!-- 最常播放 TOP5 卡：大封面行 + 右侧播放三角，与效果图同版式。 -->
        <section class="stats-card fade-item stats-top" style="--i: 2">
          <h4 class="stats-card-head">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 18.5a3 3 0 1 1-2-2.83V5.2c0-.4.27-.76.65-.87l10-2.5A1 1 0 0 1 19 2.8v11.7a3 3 0 1 1-2-2.83V6.1l-8 2z" /></svg>
            最常播放 TOP5
          </h4>
          <template v-if="topPlayed.length">
            <BaseButton
              v-for="row in topPlayed"
              :key="row.index"
              class="stats-row"
              @click="controller()?.selectTrack(row.index, true)"
            >
              <img :src="tracks[row.index]!.cover" alt="" loading="lazy" decoding="async" />
              <span class="stats-row-text">
                <b :title="tracks[row.index]!.title">{{ tracks[row.index]!.title }}</b>
                <span>{{ tracks[row.index]!.artist }} · {{ row.count }}次</span>
              </span>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
            </BaseButton>
          </template>
          <div v-else class="stats-top-empty">
            <span class="stats-top-empty-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 18.5a3 3 0 1 1-2-2.83V5.2c0-.4.27-.76.65-.87l10-2.5A1 1 0 0 1 19 2.8v11.7a3 3 0 1 1-2-2.83V6.1l-8 2z" /></svg>
            </span>
            <p>还没有播放记录 — 播几首歌，这里就会出现你的 TOP5。</p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-page { padding: 0 4px 10px; }
/* 大标题与日期副标题：与效果图同规格。 */
.stats-title { margin: 2px 0 0; font-size: 34px; font-weight: 800; letter-spacing: .01em; }
.stats-sub { margin: 6px 0 0; font-size: 13px; font-weight: 600; opacity: .55; }
/* 整页与卡片淡入：只动 opacity/transform，卡片按 --i 依次错开 40ms；关动效时不加 stats-in 类。 */
@media (prefers-reduced-motion: no-preference) {
  .stats-in { animation: stats-page-in 200ms ease-out both; }
  .stats-in .fade-item {
    animation: stats-item-in 220ms ease-out both;
    animation-delay: calc(var(--i) * 40ms);
  }
}
@keyframes stats-page-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes stats-item-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
/* 双栏：左栏分钟卡与歌手卡，右栏 TOP5 高卡。 */
.stats-cols {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 14px;
  margin-top: 18px;
  align-items: stretch;
}
.stats-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.stats-card {
  padding: 20px 22px;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 22px;
  background: rgb(255 255 255 / 4.5%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
}
.liquid-win .stats-card {
  border-color: rgb(255 255 255 / 26%);
  background: linear-gradient(155deg, rgb(255 255 255 / 13%), rgb(255 255 255 / 4.5%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 24%);
}
.stats-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 800;
}
.stats-card-head svg { width: 17px; height: 17px; flex: none; }
.stats-plain-title { margin: 0 0 16px; font-size: 16px; font-weight: 800; }
/* 本月分钟大数字：56px/800，单位与增幅跟在数字右下。 */
.stats-big { display: flex; align-items: baseline; gap: 9px; margin-top: 12px; }
.stats-big b { font-size: 56px; font-weight: 800; line-height: 1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.stats-unit { font-size: 14px; font-weight: 700; opacity: .75; }
.stats-growth { font-size: 13px; font-weight: 700; color: #3ddc84; }
.stats-note { font-size: 12px; font-weight: 600; opacity: .5; }
.stats-empty { margin: 10px 0 0; font-size: 12.5px; line-height: 1.65; opacity: .6; }
/* 过去 7 天柱图：全高轨道衬底 + 粉彩柱锚底，0 分钟时只剩轨道，不塌成一条线。 */
.stats-bars-title { margin: 20px 0 10px; font-size: 13px; font-weight: 800; }
.stats-bars { display: flex; align-items: flex-end; gap: 12px; height: 118px; }
.stats-bar-col {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  height: 100%;
}
.stats-bar-track {
  display: flex;
  flex: 1;
  align-items: flex-end;
  width: 100%;
  max-width: 40px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(255 255 255 / 5%);
}
.stats-bar { width: 100%; border-radius: 999px; }
.stats-bar-col small { font-size: 10.5px; opacity: .55; font-variant-numeric: tabular-nums; }
/* 热门歌手：84px 圆形头像横排，名字在下单行省略。 */
.stats-artists { display: flex; gap: 20px; flex-wrap: wrap; }
.stats-artist {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 88px;
  text-align: center;
}
.stats-artist img {
  width: 84px;
  height: 84px;
  border: 2px solid rgb(255 255 255 / 12%);
  border-radius: 50%;
  object-fit: cover;
}
.stats-artist b {
  max-width: 100%;
  margin-top: 3px;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stats-artist span { font-size: 11px; font-weight: 600; opacity: .5; }
/* TOP5 行：56px 圆角封面 + 标题歌手 + 右侧播放三角，整行可点播。 */
.stats-top { display: flex; flex-direction: column; gap: 6px; }
.stats-row {
  display: flex;
  align-items: center;
  gap: 13px;
  width: 100%;
  padding: 8px 6px;
  border: none;
  border-radius: 15px;
  background: transparent;
  color: inherit;
  text-align: left;
}
.stats-row:hover { background: rgb(255 255 255 / 6%); }
.stats-row img { width: 56px; height: 56px; flex: none; border-radius: 13px; object-fit: cover; }
.stats-row-text { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.stats-row-text b {
  overflow: hidden;
  font-size: 15.5px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stats-row-text span { font-size: 12.5px; font-weight: 600; opacity: .58; }
.stats-row > svg { width: 15px; height: 15px; flex: none; opacity: .55; }
/* TOP5 空态：居中图标圈 + 说明，与卡片等高区域内不贴边。 */
.stats-top-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 26px 10px;
  text-align: center;
}
.stats-top-empty-icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 50%;
  background: rgb(255 255 255 / 7%);
}
.stats-top-empty-icon svg { width: 22px; height: 22px; opacity: .65; }
.stats-top-empty p { margin: 0; max-width: 260px; font-size: 12.5px; line-height: 1.65; opacity: .6; }
@media (max-width: 900px) {
  .stats-cols { grid-template-columns: minmax(0, 1fr); }
}
</style>
