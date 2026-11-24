<script setup lang="ts">
import { computed } from 'vue'
import type { CatalogPlaylist, CatalogTrack } from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlatformIcon from '@/components/player/PlatformIcon.vue'
import { usePlayer } from '@/composables/usePlayer'
import { platformSelections } from '@/pages/index/public-playlists'
import { catalogKey, defaultCover, platformNames } from '@/services/player/catalog'
import { formatTime } from '@/utils/format'

const props = defineProps<{ playlists: CatalogPlaylist[]; preview: CatalogTrack[] }>()
const emit = defineEmits<{ play: [songs: CatalogTrack[], position: number] }>()
const { state, tracks, controller } = usePlayer()
const groups = computed(() => platformSelections(props.playlists, props.preview))
const recent = computed(() => state.recent.filter(index => tracks[index]?.catalog).slice(0, 4))
const playIcon = {
  播放: 'M8 5.5v13l11-6.5z',
  暂停: 'M6 5h4v14H6zm8 0h4v14h-4z',
  取消加载: 'M6 6h12v12H6z',
}
// 只在当前队列确实来自本站选曲时切换暂停或继续，否则按选中的歌曲建立新队列。
const currentGroup = computed(() => {
  const queue = state.queue
  if (state.radioOn || !queue?.includes(state.idx)) return
  return groups.value.find(group => group.songs.length === queue.length && group.songs.every((song, position) => {
    const track = tracks[queue[position]!]?.catalog
    return track && catalogKey(track) === catalogKey(song)
  }))
})
// 根据当前队列区分本站分组和正在播放的歌曲。
function controlsCurrent(songs: CatalogTrack[], position?: number): boolean {
  if (currentGroup.value?.songs !== songs) return false
  return position === undefined || state.queue?.[position] === state.idx
}
// 让可见图标、键盘读屏标签和实际播放动作一致。
function actionName(songs: CatalogTrack[], position?: number): keyof typeof playIcon {
  if (controlsCurrent(songs, position)) {
    if (state.audioLoading) return '取消加载'
    if (state.playing) return '暂停'
  }
  return '播放'
}
// 平台标题的按钮控制整组选曲。
function playStation(songs: CatalogTrack[]): void {
  if (controlsCurrent(songs)) controller()?.dispatch({ type: 'toggle' })
  else emit('play', songs, 0)
}
// 鼠标单击只聚焦，键盘和辅助技术触发的原生点击仍可直接播放。
function activateRow(event: MouseEvent, songs: CatalogTrack[], position: number): void {
  if (event.detail === 0) emit('play', songs, position)
}
</script>

<template>
  <section v-if="groups.length" class="platform-picks" aria-labelledby="platform-picks-title">
    <div class="feat-head m-[24px_2px_12px]"><h5 id="platform-picks-title">分站选听</h5></div>
    <div class="station-grid">
      <article v-for="group in groups" :key="group.platform" class="station">
        <header class="station-heading flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
          <PlatformIcon :platform="group.platform" /><h6 class="min-w-0 flex-1 text-sm">{{ platformNames[group.platform] }}</h6>
          <BaseButton class="station-action" :aria-label="actionName(group.songs) + platformNames[group.platform] + '选曲'"
            :title="actionName(group.songs) + '本站选曲'" @click="playStation(group.songs)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path :d="playIcon[actionName(group.songs)]" />
            </svg>
          </BaseButton>
        </header>
        <div class="p-1">
          <BaseButton v-for="(song, position) in group.songs" :key="song.id" class="shelf-track station-track"
            :aria-current="controlsCurrent(group.songs, position) || undefined"
            :aria-label="'播放《' + song.title + '》 · ' + song.artists.join(' / ')"
            :title="'双击播放《' + song.title + '》 · ' + song.artists.join(' / ')"
            @click="activateRow($event, group.songs, position)" @dblclick="emit('play', group.songs, position)">
            <img :src="song.coverUrl || defaultCover" alt="" loading="lazy" decoding="async" />
            <span class="min-w-0"><b>{{ song.title }}</b><small>{{ song.artists.join(' / ') }}</small></span>
            <span class="station-duration">{{ song.durationMs && song.durationMs > 0 ? formatTime(song.durationMs / 1000) : '—' }}</span>
          </BaseButton>
        </div>
      </article>
    </div>
  </section>
  <section v-if="recent.length" aria-labelledby="recent-picks-title" class="recent-picks">
    <div class="feat-head m-[24px_2px_8px] flex items-center justify-between">
      <h5 id="recent-picks-title">最近播放</h5>
      <BaseButton class="rounded-md px-2 py-1 text-xs text-white/75 hover:bg-white/10" @click="controller()?.navigate('recent')">查看全部 ›</BaseButton>
    </div>
    <div class="recent-grid">
      <BaseButton v-for="index in recent" :key="index" class="shelf-track" @click="controller()?.playTracks(recent, index)">
        <img :src="tracks[index]!.cover || defaultCover" alt="" loading="lazy" decoding="async" />
        <span class="min-w-0"><b>{{ tracks[index]!.title }}</b><small>{{ tracks[index]!.artist }}</small></span>
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.station-grid, .recent-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 195px), 1fr)); }
.station-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
.station-heading :deep(.plat-logo) { width: 25px; height: 25px; }
.station-action { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid #ffffff38; border-radius: 50%; background: #ffffff0e; }
.station-action:is(:hover, :focus-visible) { background: #f8f8f9; color: #1d1d23; }
.station-action:focus-visible { outline: 2px solid white; outline-offset: 2px; }
.station-duration { font: 11px var(--font-mono); color: #ffffffad; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.station { overflow: hidden; min-width: 0; border: 1px solid #ffffff21; border-radius: 16px; background: #ffffff09; }
.liquid-win .station { border-color: #ffffff38; background: linear-gradient(155deg, #ffffff1c, #ffffff09); box-shadow: inset 0 1px #ffffff40; }
.shelf-track { display: flex; align-items: center; gap: 10px; min-width: 0; width: 100%; min-height: 48px; padding: 6px 9px; border-radius: 10px; text-align: start; }
.station-track { display: grid; grid-template-columns: 34px minmax(0,1fr) auto; gap: 8px; touch-action: manipulation; }
.station-track[aria-current=true] { background: #ffffff12; }
.shelf-track:hover, .shelf-track:focus-visible { background: #ffffff12; }
.shelf-track:focus-visible { outline: 2px solid white; outline-offset: -2px; }
.shelf-track img { width: 34px; height: 34px; flex: none; border-radius: 7px; object-fit: cover; }
.shelf-track b, .shelf-track small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shelf-track b { font-size: 13px; }
.shelf-track small { color: #ffffffad; font-size: 11.5px; }
</style>
