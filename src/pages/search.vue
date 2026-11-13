<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "@/components/ui/AppIcon.vue";
import TrackList from "@/components/music/TrackList.vue";
import MusicCards from "@/components/music/MusicCards.vue";
import { usePlayerStore } from "@/stores/player";
const player = usePlayerStore();
const route = useRoute();
const router = useRouter();
const query = computed({
  get: () => (typeof route.query.q === "string" ? route.query.q : ""),
  set: (value: string) => {
    void router.replace({ name: "search", query: value ? { q: value } : {} });
  },
});
const results = computed(() =>
  player.tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.album}`
      .toLocaleLowerCase()
      .includes(query.value.trim().toLocaleLowerCase()),
  ),
);
</script>

<template>
  <div>
    <!-- 搜索输入区：路由查询参数让主输入框与顶栏搜索同步。 -->
    <h1 class="page-heading">搜索</h1>
    <p class="page-description">下一首心动的歌，也许就在这里。</p>
    <label
      class="glass mt-6 flex items-center gap-3 rounded-2xl border border-white/15 px-4 py-3"
      ><AppIcon name="search" :size="20" /><input
        v-model="query"
        type="search"
        class="min-w-0 flex-1 bg-transparent text-sm"
        placeholder="搜索歌曲、专辑、歌手…"
        aria-label="搜索音乐库"
    /></label>
    <div class="mt-4 flex flex-wrap items-center gap-2">
      <span class="mr-1 text-[10px] text-muted">热门</span
      ><BaseButton
        variant="secondary"
        v-for="tag in ['Night Drive', 'June Harbor', 'Chrome', 'Bauhaus']"
        :key="tag"
        class="min-h-7 px-3 text-[10px]"
        @click="query = tag"
      >
        {{ tag }}
      </BaseButton>
    </div>
    <h2 class="section-heading">
      {{
        query
          ? `搜索结果 · ${results.length} 首`
          : `全部歌曲 · ${results.length} 首`
      }}
    </h2>
    <!-- 搜索结果区：统一歌曲列表提供分页和空状态。 -->
    <TrackList
      :tracks="results"
      empty-text="没有找到匹配的歌曲，换个关键词试试。"
    />
    <h2 class="section-heading">歌手 · 为你发现</h2>
    <!-- 歌手推荐区：点击卡片后按歌手名称筛选。 -->
    <MusicCards
      :tracks="player.artists"
      artists
      @select="(track) => (query = track.artist)"
    />
  </div>
</template>
