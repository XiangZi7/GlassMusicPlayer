<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import { usePlayerStore } from "@/stores/player";
withDefaults(defineProps<{ large?: boolean }>(), { large: false });
const player = usePlayerStore();
</script>

<template>
  <!-- 播放控制组件：主播放栏和全屏 Dock 共用随机、切歌及循环状态。 -->
  <div class="flex shrink-0 items-center justify-center gap-2 xl:gap-4">
    <BaseButton
      variant="icon"
      :class="{ 'text-accent': player.shuffle }"
      aria-label="随机播放"
      :aria-pressed="player.shuffle"
      @click="player.shuffle = !player.shuffle"
    >
      <AppIcon name="shuffle" :size="16" />
    </BaseButton>
    <BaseButton variant="icon" aria-label="上一首" @click="player.previous">
      <AppIcon name="previous" :size="19" />
    </BaseButton>
    <BaseButton
      class="grid shrink-0 place-items-center rounded-full bg-white text-zinc-900 shadow-lg transition-transform hover:scale-105 active:scale-95"
      :class="large ? 'size-13' : 'size-10'"
      :style="
        large
          ? { boxShadow: `0 0 30px ${player.currentTrack.color}55` }
          : undefined
      "
      :aria-label="player.playing ? '暂停' : '播放'"
      :loading="player.loading"
      @click="player.togglePlayback"
    >
      <AppIcon
        v-if="!player.loading"
        :name="player.playing ? 'pause' : 'play'"
        :size="large ? 25 : 21"
      />
    </BaseButton>
    <BaseButton variant="icon" aria-label="下一首" @click="player.next()">
      <AppIcon name="next" :size="19" />
    </BaseButton>
    <BaseButton
      variant="icon"
      class="relative"
      :class="{ 'text-accent': player.repeat > 0 }"
      :aria-label="['循环已关闭', '列表循环', '单曲循环'][player.repeat]"
      @click="player.repeat = (player.repeat + 1) % 3"
    >
      <AppIcon name="repeat" :size="16" /><span
        v-if="player.repeat === 2"
        class="absolute right-0 top-0 rounded-full bg-surface px-0.5 text-[8px]"
        >1</span
      >
    </BaseButton>
  </div>
</template>
