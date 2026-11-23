<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import type { SourceTrack } from '@/types/prototype'
import { formatTime } from '@/utils/format'

defineProps<{ track: SourceTrack; number: number; active: boolean }>()
const emit = defineEmits<{ play: [] }>()
</script>

<template>
  <!-- 曲目行同时用于在线搜索和曲库，点击交给上层选择播放队列。 -->
  <BaseButton
    class="trow grid min-h-[52px] w-full grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] rounded-[12px] border-none bg-transparent p-[0_10px] pt-[7px] pb-[7px] text-left text-[13px] text-inherit"
    :class="{ on: active }"
    :disabled="!!track.mine && !track.catalog"
    :title="track.mine && !track.catalog ? '已登记曲目信息，暂无音源' : undefined"
    @click="emit('play')"
  >
    <span class="num">{{ String(number).padStart(2, '0') }}</span>
    <span class="tt">
      <img
        :src="track.cover"
        alt=""
        loading="lazy"
      />
      <span class="min-w-0"
        ><b>{{ track.title }}</b
        ><span>{{ track.artist }}</span></span
      >
    </span>
    <span class="alb">{{ track.album }}</span>
    <span class="dur">{{ track.dur ? formatTime(track.dur) : '—' }}</span>
    <span class="bars hidden h-[14px] items-end justify-center gap-[2.5px]"
      ><i /><i /><i
    /></span>
  </BaseButton>
</template>
