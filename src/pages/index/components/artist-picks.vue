<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import type { CatalogPlaylist, CatalogTrack } from '@/api'
import { selectArtistPicks } from '@/pages/index/public-playlists'

const props = defineProps<{ playlists: CatalogPlaylist[]; preview: CatalogTrack[] }>()
const emit = defineEmits<{ play: [songs: CatalogTrack[]] }>()
const { state } = usePlayer()
const picks = computed(() => selectArtistPicks(props.playlists, props.preview))

// 封面失效时露出唱片中央的歌手首字，保持列表布局稳定。
function fallbackCover(event: Event): void {
  const cover = event.currentTarget as HTMLImageElement
  cover.hidden = true
}
</script>

<template>
  <section v-if="picks.length" class="home-artists min-w-0" aria-labelledby="home-artist-title">
    <div class="feat-head m-[22px_2px_8px] flex items-center">
      <h5 id="home-artist-title">歌手选听</h5>
    </div>
    <div class="artist-list" :class="{ 'artist-motion': state.settings.motion }">
      <BaseButton v-for="pick in picks" :key="pick.name" class="artist-pick"
        :aria-label="'播放' + pick.name + '的 ' + pick.songs.length + ' 首歌曲'" @click="emit('play', pick.songs)">
        <span class="record" aria-hidden="true">
          <span class="record-label">
            {{ [...pick.name][0] }}
            <img v-if="pick.cover" :key="pick.cover" :src="pick.cover" alt="" loading="lazy" decoding="async" @error="fallbackCover" />
          </span>
        </span>
        <span class="min-w-0">
          <b class="block truncate text-sm">{{ pick.name }}</b>
          <span class="mt-0.5 block text-xs text-white/65">选听 {{ pick.songs.length }} 首</span>
        </span>
        <span class="artist-play" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
        </span>
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.artist-list { overflow: hidden; border: 1px solid #ffffff22; border-radius: 16px; background: #ffffff0c; }
.liquid-win .artist-list { border-color: #ffffff42; background: linear-gradient(155deg, #ffffff20, #ffffff0a); box-shadow: inset 0 1px 0 #ffffff57; }
.artist-pick { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 61px; padding: 9px 14px; text-align: start; }
.artist-pick + .artist-pick { border-top: 1px solid #ffffff13; }
.artist-pick:hover, .artist-pick:focus-visible { background: #ffffff10; }
.artist-pick:focus-visible { outline: 2px solid white; outline-offset: -3px; }
.artist-play { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; border: 1px solid #ffffff33; }
.artist-pick:is(:hover, :focus-visible) .artist-play { background: #fff; color: #242329; }
.record { display: grid; place-items: center; aspect-ratio: 1; border-radius: 50%; border: 1px solid #ffffff27; background: repeating-radial-gradient(circle, #27272d 0 1px, #15151b 2px 3px); }
.record-label { position: relative; display: grid; place-items: center; width: 72%; height: 72%; overflow: hidden; border-radius: 50%; background: #b49473; color: #241c18; font-size: 13px; font-weight: 750; }
.artist-pick:nth-child(2) .record-label { background: #9fb7bc; }
.artist-pick:nth-child(3) .record-label { background: #b9a5bd; }
.record img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
@media (prefers-reduced-motion: no-preference) {
  .artist-motion .artist-pick, .artist-motion .artist-play { transition: background-color 150ms ease, color 150ms ease; }
}
</style>
