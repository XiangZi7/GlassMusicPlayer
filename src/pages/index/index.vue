<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed } from "vue";
import { useRouter } from "vue-router";
import FeaturedBanner from "@/pages/index/components/featured-banner.vue";
import MusicCards from "@/components/music/MusicCards.vue";
import TrackList from "@/components/music/TrackList.vue";
import { usePlayerStore } from "@/stores/player";
const player = usePlayerStore();
const router = useRouter();
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour < 6
    ? "夜深了"
    : hour < 12
      ? "早上好"
      : hour < 18
        ? "下午好"
        : "晚上好";
});
</script>

<template>
  <div>
    <!-- 首页问候区：继续播放信息与专辑、歌手快捷入口。 -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-heading">{{ greeting }}</h1>
        <p class="mt-2 text-[11px] text-muted">
          继续听 {{ player.currentTrack.album }} · 让喜欢的旋律陪着你
        </p>
      </div>
      <div class="flex gap-2">
        <BaseButton variant="primary" class="min-h-8 px-3 text-[10px]"
          >全部</BaseButton
        ><BaseButton
          variant="secondary"
          class="min-h-8 px-3 text-[10px]"
          @click="router.push('/library/albums')"
        >
          专辑</BaseButton
        ><BaseButton
          variant="secondary"
          class="min-h-8 px-3 text-[10px]"
          @click="router.push('/library/artists')"
        >
          歌手
        </BaseButton>
      </div>
    </header>
    <!-- 首页主打区：分层立绘横幅组件，复用原稿本地素材。 -->
    <FeaturedBanner />
    <div class="section-heading">
      <h2>为你推荐</h2>
      <span class="text-[10px] font-medium text-muted">专辑 · 点击即播</span>
    </div>
    <!-- 首页推荐区：专辑卡片组件，点击后播放该专辑。 -->
    <MusicCards
      :tracks="player.albums.filter((track) => track.source === 'demo')"
      @select="
        (album) =>
          player.playAll(
            player.tracks.filter((track) => track.album === album.album),
          )
      "
    />
    <div class="section-heading">
      <h2>值得再听一遍</h2>
      <RouterLink
        to="/library"
        class="text-[10px] font-medium text-muted hover:text-white"
        >全部歌曲 →</RouterLink
      >
    </div>
    <!-- 首页歌曲区：统一歌曲列表，提供分页、收藏及歌单操作。 -->
    <TrackList :tracks="player.tracks" />
  </div>
</template>
