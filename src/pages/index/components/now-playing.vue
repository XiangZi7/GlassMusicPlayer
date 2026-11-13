<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed, ref } from "vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import PlayQueue from "@/pages/index/components/play-queue.vue";
import { usePlayerStore } from "@/stores/player";
const player = usePlayerStore();
const showLyrics = ref(false);
const lyrics = computed(() =>
  player.currentTrack.lyrics
    .map((line, index) => ({ ...line, index }))
    .slice(
      Math.max(0, player.lyricIndex - 1),
      Math.max(0, player.lyricIndex - 1) + 4,
    ),
);
</script>

<template>
  <!-- 右侧正在播放面板：封面、歌词预览与可排序播放队列。 -->
  <aside class="glass min-h-0 overflow-y-auto border-l border-white/10 p-4">
    <div class="mb-4 flex items-center justify-between">
      <span class="text-[11px] font-extrabold">正在播放</span
      ><span class="font-mono text-[8px] text-white/40"
        >TRACK
        {{
          String(
            player.tracks.findIndex((track) => track.id === player.currentId) +
              1,
          ).padStart(2, "0")
        }}
        / {{ player.tracks.length }}</span
      >
    </div>
    <BaseButton
      class="relative block aspect-square w-full overflow-hidden rounded-xl shadow-2xl"
      aria-label="展开全屏播放"
      @click="player.fullscreen = true"
    >
      <Transition name="cover"
        ><img
          :key="player.currentTrack.id"
          :src="player.currentTrack.cover"
          :alt="`${player.currentTrack.album} 专辑封面`"
          class="absolute inset-0 size-full object-cover"
      /></Transition>
    </BaseButton>
    <div class="mb-4 mt-4 flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-lg font-extrabold tracking-tight">
          {{ player.currentTrack.title }}
        </h2>
        <p class="mt-1.5 truncate text-[11px] text-muted">
          {{ player.currentTrack.artist }} · {{ player.currentTrack.album }}
        </p>
      </div>
      <BaseButton
        variant="icon"
        :class="{ 'text-rose-300': player.liked }"
        :aria-pressed="player.liked"
        aria-label="收藏正在播放的歌曲"
        @click="player.toggleLike()"
      >
        <AppIcon name="heart" :size="18" />
      </BaseButton>
    </div>
    <div class="mb-6 flex gap-2">
      <BaseButton
        variant="secondary"
        class="flex-1"
        :aria-pressed="showLyrics"
        @click="showLyrics = !showLyrics"
      >
        {{ showLyrics ? "收起歌词" : "歌词" }}</BaseButton><BaseButton
        variant="secondary"
        class="flex-1"
        @click="player.fullscreen = true"
      >
        全屏聆听
      </BaseButton>
    </div>
    <div
      v-if="showLyrics"
      class="mb-6 space-y-4 rounded-2xl bg-black/10 px-3 py-4"
    >
      <p v-if="!lyrics.length" class="text-xs text-muted">此本地音频暂无歌词</p>
      <BaseButton
        v-for="line in lyrics"
        :key="line.index"
        class="block w-full text-left text-xs leading-6 transition-all duration-500"
        :class="
          line.index === player.lyricIndex
            ? 'font-bold text-white'
            : 'text-white/30'
        "
        @click="
          player.seek(
            (line.index / player.currentTrack.lyrics.length) * player.duration,
          )
        "
      >
        {{ line.text }}
      </BaseButton>
    </div>
    <!-- 右栏队列组件：与全屏播放页共用队列数据和拖动行为。 -->
    <PlayQueue />
  </aside>
</template>
