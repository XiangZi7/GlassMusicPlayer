<script setup lang="ts">
import { toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackPlaybackBars from '@/components/player/TrackPlaybackBars.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'
defineProps<{ index: number; meta: string; showAlbum?: boolean }>()
const { state, tracks, controller } = usePlayer()
const { idx } = toRefs(state)
</script>
<template>
  <div
    class="srow flex min-h-[48px] w-full cursor-pointer items-center gap-[10px] rounded-[13px] border border-transparent p-[7px]"
    :class="{ on: index === idx }"
    :aria-current="index === idx ? 'true' : undefined"
    role="button"
    tabindex="0"
    @click="controller()?.selectTrack(index, true)"
    @keydown.enter="controller()?.selectTrack(index, true)"
  >
    <img decoding="async" loading="lazy"
      :src="tracks[index]!.cover"
      alt=""
    /><span class="qt"
      ><b>{{ tracks[index]!.title }}</b
      ><span
        >{{ tracks[index]!.artist
        }}{{ showAlbum ? ' · ' + tracks[index]!.album : '' }}</span
      ></span
    ><span
      class="stag flex-none rounded-full p-[4px_8px] text-[10px] font-extrabold tracking-[.03em] whitespace-nowrap opacity-[.85]"
      >{{ meta }}</span
    >
    <BaseButton
      class="qnext"
      title="下一首播放"
      :aria-label="`下一首播放《${tracks[index]!.title}》`"
      @click.stop="controller()?.playNext(index)"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M5 5v14l7-7z"
          fill="currentColor"
          stroke="none"
        />
        <path
          d="M13 5v14l7-7z"
          fill="currentColor"
          stroke="none"
          opacity=".55"
        />
        <path d="M21 5v14" /></svg></BaseButton
    ><span class="qd">{{ formatTime(tracks[index]!.dur) }}</span>
    <TrackPlaybackBars :active="index === idx" />
  </div>
</template>
