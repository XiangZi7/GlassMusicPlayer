<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "@/components/ui/AppIcon.vue";
import SlidingTabs from "@/components/ui/SlidingTabs.vue";
import MusicCards from "@/components/music/MusicCards.vue";
import TrackList from "@/components/music/TrackList.vue";
import { usePlayerStore } from "@/stores/player";
import { formatTime } from "@/utils/format";
import { notify } from "@/services/notification";
const player = usePlayerStore();
const route = useRoute();
const router = useRouter();
const options = [
  { value: "all", label: "全部歌曲" },
  { value: "albums", label: "专辑" },
  { value: "artists", label: "歌手" },
  { value: "liked", label: "我喜欢的" },
  { value: "recent", label: "最近播放" },
];
const tab = computed({
  get: () =>
    options.some((option) => option.value === route.params.tab)
      ? String(route.params.tab)
      : "all",
  set: (value: string) => {
    void router.push(`/library/${value}`);
  },
});
const list = computed(() =>
  tab.value === "liked"
    ? player.tracks.filter((track) => player.likedIds.includes(track.id))
    : tab.value === "recent"
      ? player.recentIds
          .map((id) => player.tracks.find((track) => track.id === id))
          .filter((track): track is NonNullable<typeof track> => !!track)
      : player.tracks,
);
const totalDuration = computed(() =>
  formatTime(player.tracks.reduce((sum, track) => sum + track.duration, 0)),
);
const smartLists = computed(() => [
  {
    title: "久未听的",
    description: "留一点时间，重逢老朋友。",
    icon: "lyrics",
    tracks: player.tracks
      .filter((track) => !player.recentIds.slice(0, 8).includes(track.id))
      .slice(0, 8),
  },
  {
    title: "循环最多",
    description: "那些怎么听都不腻的歌。",
    icon: "repeat",
    tracks: [...player.tracks]
      .sort(
        (a, b) =>
          (player.playCounts[b.id] || 0) - (player.playCounts[a.id] || 0),
      )
      .slice(0, 8),
  },
  {
    title: "随机重温",
    description: "让熟悉的旋律带来惊喜。",
    icon: "shuffle",
    tracks: [...player.tracks]
      .sort((a, b) => a.title.localeCompare(b.title))
      .filter((_, index) => (index + new Date().getDate()) % 3 === 0)
      .slice(0, 8),
  },
]);

// 清空最近播放记录，保留收藏、歌单及当前播放。
function clearRecent(): void {
  player.recentIds = [];
  notify("最近播放记录已清空");
}
</script>

<template>
  <div>
    <!-- 音乐库分类区：使用滑动标签组件与路由保存分类。 -->
    <h1 class="page-heading">音乐库</h1>
    <p class="page-description">属于你的音乐，随时值得重温。</p>
    <SlidingTabs
      v-model="tab"
      class="mt-5"
      :options="options"
      label="音乐库分类"
    />
    <div
      v-if="tab === 'all'"
      class="my-6 grid grid-cols-4 rounded-2xl border border-white/8 bg-white/3 p-5"
    >
      <div
        v-for="stat in [
          { value: player.tracks.length, label: '歌曲' },
          { value: player.albums.length, label: '专辑' },
          { value: player.artists.length, label: '歌手' },
          { value: totalDuration, label: '总时长' },
        ]"
        :key="stat.label"
      >
        <b class="font-mono text-xl font-bold">{{ stat.value }}</b>
        <p class="mt-2 text-[10px] text-muted">{{ stat.label }}</p>
      </div>
    </div>
    <!-- 专辑与歌手卡片区：点击后进入对应详情路由。 -->
    <MusicCards
      v-if="tab === 'albums' || tab === 'artists'"
      class="mt-6"
      :tracks="tab === 'albums' ? player.albums : player.artists"
      :artists="tab === 'artists'"
      @select="
        (track) =>
          router.push(
            `/collection/${tab === 'albums' ? 'album' : 'artist'}/${encodeURIComponent(tab === 'albums' ? track.album : track.artist)}`,
          )
      "
    />
    <section v-else class="mt-6">
      <div class="section-heading">
        <h2>
          {{ options.find((option) => option.value === tab)?.label }} ·
          {{ list.length }} 首
        </h2>
        <BaseButton
          v-if="tab === 'recent' && list.length"
          class="text-[10px] font-medium text-muted hover:text-white"
          @click="clearRecent"
        >
          清空记录
        </BaseButton>
      </div>
      <TrackList
        :tracks="list"
        sortable
        :empty-text="
          tab === 'liked'
            ? '点一下歌曲旁的爱心，把喜欢的旋律收藏起来。'
            : '还没有播放记录，选一首喜欢的歌曲开始吧。'
        "
      />
    </section>
    <!-- 智能歌单区：基于真实播放记录和播放次数生成。 -->
    <section v-if="tab === 'all'" class="mt-8">
      <h2 class="section-heading">智能歌单</h2>
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <BaseButton
          v-for="item in smartLists"
          :key="item.title"
          class="glass rounded-2xl border border-white/10 p-4 text-left transition hover:bg-white/10"
          @click="player.playAll(item.tracks)"
        >
          <AppIcon :name="item.icon" :size="23" class="mb-5 text-accent" /><b
            class="text-sm"
            >{{ item.title }}</b
          >
          <p class="mt-2 text-[10px] leading-5 text-muted">
            {{ item.description }}
          </p>
        </BaseButton>
      </div>
    </section>
  </div>
</template>
