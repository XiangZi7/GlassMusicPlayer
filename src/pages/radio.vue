<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import TrackList from "@/components/music/TrackList.vue";
import { usePlayerStore } from "@/stores/player";
const player = usePlayerStore();
</script>

<template>
  <div>
    <!-- 歌曲电台种子区：围绕当前曲目优先播放同专辑作品。 -->
    <h1 class="page-heading">歌曲电台</h1>
    <p class="page-description">从此刻喜欢的这首歌，听见更多可能。</p>
    <section
      class="glass my-6 flex items-center gap-5 rounded-3xl border border-white/10 p-6"
    >
      <img
        :src="player.currentTrack.cover"
        alt="电台种子歌曲封面"
        class="size-24 rounded-2xl object-cover shadow-xl"
      />
      <div class="min-w-0">
        <p class="section-label mb-2">为你延续 · RADIO</p>
        <h2 class="truncate text-2xl font-extrabold">
          {{ player.currentTrack.title }}
        </h2>
        <p class="my-2 text-xs text-muted">
          {{ player.currentTrack.artist }} · 同专辑优先续播
        </p>
        <BaseButton
          variant="primary"
          class="mt-2"
          @click="player.radio ? (player.radio = false) : player.startRadio()"
        >
          <AppIcon :name="player.radio ? 'pause' : 'radio'" :size="14" />{{
            player.radio ? "停止电台续播" : "开始歌曲电台"
          }}
        </BaseButton>
      </div>
    </section>
    <h2 class="section-heading">
      接下来 · {{ player.radio ? "电台续播中" : "当前队列" }}
    </h2>
    <!-- 电台歌曲列表组件：与当前播放队列保持一致。 -->
    <TrackList :tracks="player.queueTracks" />
  </div>
</template>
