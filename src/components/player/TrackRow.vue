<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackPlaybackBars from '@/components/player/TrackPlaybackBars.vue'
import { usePlayer } from '@/composables/usePlayer'
import type { SourceTrack } from '@/types/prototype'
import { formatTime } from '@/utils/format'

defineProps<{ track: SourceTrack; number: number; active: boolean }>()
const emit = defineEmits<{ play: [] }>()
const { state } = usePlayer()
</script>

<template>
  <!-- 曲目行同时用于在线搜索和曲库，点击交给上层选择播放队列。 -->
  <BaseButton
    class="trow grid min-h-[52px] w-full grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] rounded-[12px] border-none bg-transparent p-[0_10px] pt-[7px] pb-[7px] text-left text-[13px] text-inherit"
    :class="{ on: active }"
    :aria-current="active ? 'true' : undefined"
    :disabled="!!track.mine && !track.catalog"
    :title="track.mine && !track.catalog ? '已登记曲目信息，暂无音源' : undefined"
    @click="emit('play')"
  >
    <span class="num">{{ String(number).padStart(2, '0') }}</span>
    <span class="tt">
      <!-- 正在播放的行：封面位换绿色均衡器条，与效果图一致；暂停时仍显示封面。 -->
      <span v-if="active && state.playing" class="row-eq" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <img v-else decoding="async"
        :src="track.cover"
        alt=""
        loading="lazy"
      />
      <span class="min-w-0">
        <b :title="track.title">{{ track.title }}</b>
        <small v-if="track.subtitle" class="track-subtitle" :title="track.subtitle">{{ track.subtitle }}</small>
        <span>{{ track.artist }}</span>
      </span>
    </span>
    <span class="alb" :title="track.album">{{ track.album }}</span>
    <span class="dur">{{ track.dur ? formatTime(track.dur) : '—' }}</span>
    <TrackPlaybackBars :active="active && !state.playing" />
  </BaseButton>
</template>

<style scoped>
/* 播放行均衡器：五根绿色竖条在封面位跳动，只动 transform；关动效时静止定格。 */
.row-eq {
  display: flex;
  width: 36px;
  height: 36px;
  flex: none;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  padding-bottom: 8px;
}
.row-eq i {
  width: 4px;
  border-radius: 2px;
  background: #3ddc84;
}
.row-eq i:nth-child(1) { height: 45%; }
.row-eq i:nth-child(2) { height: 80%; }
.row-eq i:nth-child(3) { height: 60%; }
.row-eq i:nth-child(4) { height: 95%; }
.row-eq i:nth-child(5) { height: 55%; }
@media (prefers-reduced-motion: no-preference) {
  .row-eq i { animation: row-eq-bounce 0.9s ease-in-out infinite alternate; transform-origin: bottom; }
  .row-eq i:nth-child(2) { animation-delay: 0.15s; }
  .row-eq i:nth-child(3) { animation-delay: 0.3s; }
  .row-eq i:nth-child(4) { animation-delay: 0.45s; }
  .row-eq i:nth-child(5) { animation-delay: 0.6s; }
}
@keyframes row-eq-bounce {
  from { transform: scaleY(0.45); }
  to { transform: scaleY(1); }
}
</style>
