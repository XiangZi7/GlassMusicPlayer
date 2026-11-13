<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import { usePlayer } from '@/composables/usePlayer';
import { formatTime } from '@/utils/format';

const props = defineProps<{ indices: number[]; listKey: string; empty?: string }>();
const { state, tracks, controller } = usePlayer();
const sorted = computed(() => {
  const mode = state.sorts[props.listKey] || 'def';
  if (mode === 'def') return props.indices;
  return [...props.indices].sort((a,b) => {
    const first = tracks[a]!, second = tracks[b]!;
    if (mode === 'dur') return first.dur - second.dur || a - b;
    const left = first[mode], right = second[mode];
    return (left < right ? -1 : left > right ? 1 : 0) || a - b;
  });
});
const current = computed({
  get: () => Math.min(state.pg[props.listKey] || 1, Math.max(1, Math.ceil(sorted.value.length / 10))),
  set: page => { state.pg[props.listKey] = page; },
});
const visible = computed(() => sorted.value.slice((current.value-1)*10, current.value*10));

// 选择曲目回到同一播放器，保留原稿自动播放与切歌动画的顺序。
function play(index: number): void { controller()?.selectTrack(index, true); }
</script>

<template>
  <div data-vue-tracklist>
    <BaseButton v-for="index in visible" :key="index" class="trow" :class="{on: index === state.idx}" @click="play(index)">
      <span class="num">{{ String(index+1).padStart(2,'0') }}</span>
      <span class="tt"><img :src="tracks[index]!.cover" alt=""><span class="min-w-0"><b>{{ tracks[index]!.title }}</b><span>{{ tracks[index]!.artist }}</span></span></span>
      <span class="alb">{{ tracks[index]!.album }}</span><span class="dur">{{ formatTime(tracks[index]!.dur) }}</span>
      <span class="bars"><i/><i/><i/></span>
    </BaseButton>
    <div v-if="!indices.length && empty" class="empty-note">{{ empty }}</div>
  </div>
  <PaginationBar v-model:current="current" :page-key="listKey" :total="indices.length" />
</template>
