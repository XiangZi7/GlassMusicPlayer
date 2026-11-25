<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import type { CatalogPlaylist, CatalogTrack } from '@/api'
import { selectArtistPicks } from '@/pages/index/public-playlists'

const props = defineProps<{
  playlists: CatalogPlaylist[]
  preview: CatalogTrack[]
  // 公开歌单尚未返回时先显示骨架位。
  loading: boolean
}>()
const emit = defineEmits<{ play: [songs: CatalogTrack[]] }>()
const { state } = usePlayer()
const picks = computed(() => selectArtistPicks(props.playlists, props.preview))

// 封面失效时露出唱片中央的歌手首字，保持头像布局稳定。
function fallbackCover(event: Event): void {
  const cover = event.currentTarget as HTMLImageElement
  cover.hidden = true
}
</script>

<template>
  <article class="tile home-artists artist-tile" aria-labelledby="home-artist-title">
    <div class="artist-head">
      <h3 id="home-artist-title">歌手选听</h3>
      <span class="artist-sub">来自公开歌单的高频歌手</span>
    </div>
    <!-- 歌手以圆形头像横排，点任意一位直接播放其选听曲目。 -->
    <div v-if="picks.length" class="artist-strip">
      <BaseButton
        v-for="pick in picks"
        :key="pick.name"
        class="artist-pick"
        :class="{ 'artist-motion': state.settings.motion }"
        :aria-label="'播放' + pick.name + '的 ' + pick.songs.length + ' 首歌曲'"
        @click="emit('play', pick.songs)"
      >
        <span class="record" aria-hidden="true">
          <span class="record-label">
            {{ [...pick.name][0] }}
            <img v-if="pick.cover" :key="pick.cover" :src="pick.cover" alt="" loading="lazy" decoding="async" @error="fallbackCover" />
          </span>
        </span>
        <span class="artist-meta">
          <b>{{ pick.name }}</b>
          <span>选听 {{ pick.songs.length }} 首</span>
        </span>
        <span class="artist-play" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
        </span>
      </BaseButton>
    </div>
    <div v-else-if="loading" class="artist-strip" aria-hidden="true">
      <div v-for="slot in 3" :key="slot" class="artist-pick artist-skeleton"></div>
    </div>
    <p v-else class="artist-empty">暂无歌手选听，公开歌单恢复后这里会按歌手聚合曲目。</p>
  </article>
</template>

<style scoped>
.artist-tile {
  display: flex;
  flex-direction: column;
}
.artist-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.artist-head h3 {
  margin: 0;
  flex: none;
  font-size: 15px;
  font-weight: 750;
  color: #fff;
}
.artist-sub {
  overflow: hidden;
  font-size: 12px;
  color: rgb(255 255 255 / 55%);
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 头像条：三位歌手等分横排，窄窗改为纵排。 */
.artist-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
@container (max-width: 700px) {
  .artist-strip {
    grid-template-columns: minmax(0, 1fr);
  }
}
.artist-pick {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 64px;
  padding: 8px 12px;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 14px;
  background: rgb(255 255 255 / 4%);
  color: inherit;
  text-align: start;
  cursor: pointer;
}
.liquid-win .artist-pick {
  border-color: rgb(255 255 255 / 22%);
  background: linear-gradient(155deg, rgb(255 255 255 / 12%), rgb(255 255 255 / 4%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 20%);
}
.artist-pick:hover,
.artist-pick:focus-visible {
  background: rgb(255 255 255 / 9%);
}
.artist-pick:focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}
/* 歌手名与选听数纵向居中成组，小字与名字共用同一基线节奏。 */
.artist-meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}
.artist-meta b,
.artist-meta span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.artist-meta b {
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.35;
}
.artist-meta span {
  font-size: 12px;
  line-height: 1.4;
  color: rgb(255 255 255 / 60%);
}
.artist-play {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
}
.artist-pick:is(:hover, :focus-visible) .artist-play {
  background: #fff;
  color: #242329;
}
/* 唱片头像沿用原歌手选听的同心纹与首字兜底，外加一圈发丝描边，hover 时轻放大。 */
.record {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
  background: repeating-radial-gradient(circle, #27272d 0 1px, #15151b 2px 3px);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 6%),
    inset 0 1px 0 rgb(255 255 255 / 14%);
}
.liquid-win .record {
  border-color: rgb(255 255 255 / 32%);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 10%),
    inset 0 1px 0 rgb(255 255 255 / 22%);
}
.artist-motion .record {
  transition: transform 200ms ease;
}
.artist-motion:hover .record,
.artist-motion:focus-visible .record {
  transform: scale(1.06);
}
.record-label {
  position: relative;
  display: grid;
  place-items: center;
  width: 74%;
  height: 74%;
  overflow: hidden;
  border-radius: 50%;
  background: #b49473;
  color: #241c18;
  font-size: 14px;
  font-weight: 750;
}
.artist-pick:nth-child(2) .record-label {
  background: #9fb7bc;
}
.artist-pick:nth-child(3) .record-label {
  background: #b9a5bd;
}
.record img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.artist-motion {
  transition:
    background-color 150ms ease,
    color 150ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .artist-pick,
  .artist-pick .record {
    transition: none;
  }
  .artist-pick:hover .record,
  .artist-pick:focus-visible .record {
    transform: none;
  }
}
.artist-empty {
  margin: 0;
  padding: 14px 2px 4px;
  font-size: 12.5px;
  line-height: 1.6;
  color: rgb(255 255 255 / 58%);
}
.artist-skeleton {
  border-style: dashed;
  background: rgb(255 255 255 / 3%);
  cursor: default;
}
</style>
