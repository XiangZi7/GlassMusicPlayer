<script setup lang="ts">
import { reactive } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { searchCatalog, type MusicPlatform } from '@/api'
import { usePlayer } from '@/composables/usePlayer'
import { notify } from '@/services/notification'
import { usePlayerStore } from '@/stores/player'

const { state, controller } = usePlayer()
const { registerCatalogTracks } = usePlayerStore()

// 场景与流派共用一条通道：关键词 → 平台搜索 → 首个结果作电台种子。
const view = reactive({
  /** 正在进入电台的场景名，切换期间禁用重复点击。 */
  pending: '',
})

// 打开心情电台：依次在网易云、酷我搜关键词（酷狗源当前不可用），
// 以第一个有结果平台的第一首歌为种子播放并开启电台续播；全无结果时明确提示。
async function openMood(name: string, keyword: string): Promise<void> {
  if (view.pending) return
  view.pending = name
  try {
    for (const platform of ['netease', 'kuwo'] as MusicPlatform[]) {
      try {
        const page = await searchCatalog(platform, keyword, 1, 10, new AbortController().signal)
        if (!page.tracks.length) continue
        const indices = registerCatalogTracks(page.tracks)
        const seed = indices[0]
        if (seed === undefined) continue
        controller()?.playTracks([seed], seed)
        // 电台已开时先关再开，让种子换成本次选中的歌；未开时直接开启。
        if (state.radioOn) controller()?.toggleRadio()
        controller()?.toggleRadio()
        controller()?.navigate('radio')
        return
      } catch {
        /* 单个平台失败时继续试下一个平台。 */
      }
    }
    notify(`没有找到「${name}」相关的歌曲，换个心情试试。`, 'error')
  } finally {
    view.pending = ''
  }
}

// 场景定义：名称、副标题、搜索关键词与插画（与效果图同一套波普平涂插画）。
const moods = [
  { name: '专注', sub: '沉浸深度专注 · 轻电音', keyword: 'lofi 专注', art: '/images/mood/focus.webp' },
  { name: '夜驾', sub: '深夜街景 · 氛围合成', keyword: '夜驾 synthwave', art: '/images/mood/drive.webp' },
  { name: '运动', sub: '活力节奏 · 鼓点能量', keyword: '运动 燃曲', art: '/images/mood/sport.webp' },
  { name: '雨天', sub: '舒缓静谧 · lofi 雨声', keyword: '雨天 lofi', art: '/images/mood/rain.webp' },
  { name: '学习', sub: '安静平和 · 钢琴轻曲', keyword: '学习 钢琴', art: '/images/mood/study.webp' },
  { name: '派对', sub: '热闹欢快 · 舞曲混剪', keyword: '派对 舞曲', art: '/images/mood/party.webp' },
]
// 流派 pill：与场景同一通道，点选直接以流派名搜索起电台。
const genres = ['流行', '摇滚', '电子', '古风', 'R&B']
// 场景歌单卡：与场景 tile 同一通道，点选以对应关键词起电台。
const scenes = [
  { name: '咖啡馆午后', sub: '慵懒休闲 · 咖啡馆爵士', keyword: '咖啡馆 爵士', art: '/images/mood/scene-cafe.webp', wide: false },
  { name: '公路旅程', sub: '公路旅程 · 自驾摇滚', keyword: '公路 摇滚', art: '/images/mood/scene-road.webp', wide: true },
  { name: '睡前放松', sub: '助眠舒缓 · 睡前轻音乐', keyword: '睡前 放松', art: '/images/mood/scene-sleep.webp', wide: true },
]
</script>

<template>
  <div class="page-panel hidden h-full" data-panel="mood">
    <div class="mood-page" :class="{ 'mood-in': state.settings.motion }">
      <h3 class="mood-title">心情电台</h3>

      <!-- 场景卡：插画在上、名称与副标题居中在下，整卡可点进对应电台。 -->
      <div class="mood-grid">
        <BaseButton
          v-for="(mood, index) in moods"
          :key="mood.name"
          class="mood-tile fade-item"
          :style="{ '--i': index }"
          :disabled="!!view.pending"
          :aria-label="'开启' + mood.name + '电台'"
          @click="openMood(mood.name, mood.keyword)"
        >
          <img :src="mood.art" alt="" loading="lazy" decoding="async" />
          <b>{{ mood.name }}</b>
          <span>{{ mood.sub }}</span>
          <small v-if="view.pending === mood.name" role="status">正在开启…</small>
        </BaseButton>
      </div>

      <!-- 流派 pill 行：居中排列，与场景共用搜索电台通道。 -->
      <div class="mood-genres" role="group" aria-label="按流派开启电台">
        <BaseButton
          v-for="genre in genres"
          :key="genre"
          class="mood-pill"
          :disabled="!!view.pending"
          @click="openMood(genre, genre)"
        >{{ genre }}</BaseButton>
      </div>

      <!-- 场景歌单卡行：咖啡馆为缩略图卡，公路与睡前为整幅插画卡（标题已在插画内）。 -->
      <div class="mood-scenes">
        <BaseButton
          v-for="(scene, index) in scenes"
          :key="scene.name"
          class="mood-scene fade-item"
          :class="{ 'mood-scene-wide': scene.wide }"
          :style="{ '--i': index + 6 }"
          :disabled="!!view.pending"
          :aria-label="'开启' + scene.name + '电台'"
          @click="openMood(scene.name, scene.keyword)"
        >
          <img :src="scene.art" alt="" loading="lazy" decoding="async" />
          <span v-if="!scene.wide" class="mood-scene-text">
            <b>{{ scene.name }}</b>
            <span>{{ scene.sub }}</span>
          </span>
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mood-page { padding: 0 4px 10px; }
/* 大标题：与效果图同规格，页面主标题 34px/800。 */
.mood-title { margin: 2px 0 0; font-size: 34px; font-weight: 800; letter-spacing: .01em; }
/* 整页与卡片淡入：只动 opacity/transform，卡片按 --i 依次错开 40ms；关动效时不加 mood-in 类。 */
@media (prefers-reduced-motion: no-preference) {
  .mood-in { animation: mood-page-in 200ms ease-out both; }
  .mood-in .fade-item {
    animation: mood-item-in 220ms ease-out both;
    animation-delay: calc(var(--i) * 40ms);
  }
  .mood-tile, .mood-scene { transition: transform 150ms ease, filter 150ms ease; }
  .mood-pill { transition: filter 150ms ease, border-color 150ms ease; }
}
@keyframes mood-page-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes mood-item-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
/* 场景卡：暗玻璃卡面包住插画，插画 2:1 圆角在上，名称副标题居中在下。 */
.mood-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.mood-tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  padding: 10px 10px 14px;
  border: 1px solid rgb(255 255 255 / 9%);
  border-radius: 20px;
  background: rgb(255 255 255 / 4.5%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
  color: inherit;
  text-align: center;
}
.liquid-win .mood-tile {
  border-color: rgb(255 255 255 / 26%);
  background: linear-gradient(155deg, rgb(255 255 255 / 13%), rgb(255 255 255 / 4.5%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 24%);
}
.mood-tile img {
  width: 100%;
  aspect-ratio: 2 / 1;
  border-radius: 13px;
  object-fit: cover;
}
.mood-tile b { margin-top: 11px; font-size: 19px; font-weight: 800; }
.mood-tile span { margin-top: 3px; font-size: 12px; font-weight: 600; opacity: .62; }
.mood-tile small { margin-top: 4px; font-size: 11px; font-weight: 700; }
.mood-tile:hover:not(:disabled), .mood-scene:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-2px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%), 0 12px 26px rgb(0 0 0 / 28%);
}
.mood-tile:active:not(:disabled), .mood-scene:active:not(:disabled) { transform: scale(0.98); }
.mood-tile:disabled, .mood-scene:disabled { opacity: .8; }
/* 流派 pill：居中大胶囊，与效果图同尺寸感。 */
.mood-genres {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}
.mood-pill {
  padding: 10px 30px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 999px;
  background: rgb(255 255 255 / 5%);
  font-size: 14.5px;
  font-weight: 700;
}
.liquid-win .mood-pill {
  border-color: rgb(255 255 255 / 26%);
  background: linear-gradient(155deg, rgb(255 255 255 / 13%), rgb(255 255 255 / 5%));
}
.mood-pill:hover:not(:disabled) { filter: brightness(1.3); border-color: rgb(255 255 255 / 28%); }
/* 场景歌单卡行：三列等宽；宽幅卡整幅插画，咖啡馆卡为左缩略图右文案。 */
.mood-scenes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.mood-scene {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 118px;
  padding: 10px;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 9%);
  border-radius: 20px;
  background: rgb(255 255 255 / 4.5%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
  color: inherit;
  text-align: left;
}
.liquid-win .mood-scene {
  border-color: rgb(255 255 255 / 26%);
  background: linear-gradient(155deg, rgb(255 255 255 / 13%), rgb(255 255 255 / 4.5%));
}
.mood-scene img {
  width: 84px;
  height: 84px;
  flex: none;
  border-radius: 13px;
  object-fit: cover;
}
.mood-scene-wide { padding: 0; }
.mood-scene-wide img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
}
.mood-scene-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mood-scene-text b { font-size: 16.5px; font-weight: 800; }
.mood-scene-text span { font-size: 11.5px; font-weight: 600; opacity: .62; }
@media (max-width: 900px) {
  .mood-grid, .mood-scenes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
