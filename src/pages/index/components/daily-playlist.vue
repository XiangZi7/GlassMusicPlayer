<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackRow from '@/components/player/TrackRow.vue'
import { catalogKey } from '@/services/player/catalog'
import type { SourceTrack } from '@/types/prototype'

defineProps<{
  songs: SourceTrack[]
  date: string
  source: string
  official: boolean
  loading: boolean
  failed: boolean
  current?: SourceTrack['catalog']
}>()
const emit = defineEmits<{ play: [position: number]; retry: []; home: [] }>()
</script>

<template>
  <section class="daily-playlist" aria-labelledby="daily-heading">
    <header class="daily-header">
      <div class="daily-title">
        <time :datetime="date" :aria-label="date"><strong>{{ date.slice(8) }}</strong> / {{ date.slice(5, 7) }}</time>
        <h1 id="daily-heading" tabindex="-1" data-daily-title>每日推荐</h1>
      </div>
      <p class="daily-source">
        {{ official ? '根据你的网易云音乐口味生成，每天 06:00（北京时间）更新' : source }}
      </p>
      <div class="daily-actions">
        <BaseButton class="daily-play" :disabled="!songs.length" @click="emit('play', 0)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>
          播放全部
        </BaseButton>
        <span v-if="songs.length">{{ songs.length }} 首</span>
      </div>
    </header>
    <template v-if="songs.length">
      <div class="daily-columns table-head" aria-hidden="true">
        <span>#</span><span>标题</span><span>专辑</span><span class="text-right">时长</span><span></span>
      </div>
      <ol class="m-0 list-none p-0" aria-label="每日推荐曲目">
        <li v-for="(song, position) in songs" :key="position + ':' + catalogKey(song.catalog!)">
          <TrackRow :track="song" :number="position + 1"
            :active="!!current && catalogKey(current) === catalogKey(song.catalog!)"
            @play="emit('play', position)" />
        </li>
      </ol>
    </template>
    <div v-else class="daily-empty">
      <p role="status">{{ loading ? '正在读取推荐歌单…' : failed ? '暂时无法获取推荐歌单' : '今天暂无推荐曲目' }}</p>
      <BaseButton v-if="failed" class="daily-secondary" @click="emit('retry')">重新获取</BaseButton>
    </div>
    <BaseButton class="daily-secondary mt-3" @click="emit('home')">返回首页</BaseButton>
  </section>
</template>

<style scoped>
.daily-playlist { container-type: inline-size; }
.daily-header { padding: 26px clamp(16px, 3%, 32px); border: 1px solid #ffffff24; border-radius: 18px; background: linear-gradient(115deg, #a9a8ce20, #ffffff04 70%); }
.liquid-win .daily-header { border-color: #ffffff49; background: linear-gradient(125deg, #bbb1e32b, #ced5ed0b); box-shadow: inset 0 1px 0 #ffffff40; }
.daily-title, .daily-actions { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; }
.daily-title time { font: 650 15px/1 var(--font-mono); white-space: nowrap; }
.daily-title strong { font-size: clamp(32px, 6cqw, 52px); font-weight: 600; letter-spacing: -.06em; }
.daily-title h1 { margin: 0; font-size: clamp(20px, 4cqw, 28px); line-height: 1.2; }
.daily-title h1:focus { outline: none; }
.daily-source, .daily-actions span, .daily-empty { color: #ffffffbe; font-size: 13px; }
.daily-source { margin: 12px 0 20px; }
.daily-actions { align-items: center; }
.daily-play, .daily-secondary { border-radius: 999px; font: 700 13px/1.45 var(--font-sans); }
.daily-play { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; background: #f7f5fa; color: #191921; }
.daily-play:not(:disabled):hover { background: white; }
.daily-play:disabled { opacity: .5; }
.daily-secondary { padding: 7px 13px; background: #ffffff10; border: 1px solid #ffffff29; }
.daily-secondary:hover { background: #ffffff20; }
.daily-columns { display: grid; grid-template-columns: 28px minmax(0,1.6fr) minmax(0,1fr) 52px 34px; align-items: center; gap: 10px; padding: 18px 10px 9px; font-size: 11px; color: #ffffff95; }
.daily-empty { display: grid; min-height: 135px; justify-items: center; align-content: center; gap: 10px; }
.daily-empty p { margin: 0; }
.daily-playlist button:focus-visible { outline: 2px solid #ffffffc9; outline-offset: 2px; }
@container (max-width: 580px) {
  .daily-columns, .daily-playlist :deep(.trow .alb), .daily-playlist :deep(.trow .num) { display: none; }
  .daily-playlist :deep(.trow) { grid-template-columns: minmax(0,1fr) 46px 16px; }
  .daily-header { margin-bottom: 10px; }
}
</style>
