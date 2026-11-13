<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/ui/AppIcon.vue";
import TrackList from "@/components/music/TrackList.vue";
import { usePlayerStore } from "@/stores/player";
import { formatTime } from "@/utils/format";
const player = usePlayerStore();
const route = useRoute();
const kind = computed(() => String(route.params.kind));
const playlist = computed(() =>
  player.playlists.find((item) => item.id === route.params.id),
);
const title = computed(() =>
  kind.value === "playlist"
    ? playlist.value?.name || "歌单不存在"
    : String(route.params.id),
);
const tracks = computed(() =>
  player.tracks.filter((track) =>
    kind.value === "playlist"
      ? playlist.value?.trackIds.includes(track.id)
      : kind.value === "album"
        ? track.album === title.value
        : kind.value === "artist" && track.artist === title.value,
  ),
);
const cover = computed(
  () => tracks.value[0]?.cover || "/images/night-drive.webp",
);
const duration = computed(() =>
  formatTime(tracks.value.reduce((sum, track) => sum + track.duration, 0)),
);
</script>

<template>
  <div>
    <!-- 收藏详情头图：专辑、歌手与自建歌单共用完整详情流程。 -->
    <header class="mb-8 flex flex-wrap items-end gap-6">
      <img
        :src="cover"
        :alt="title"
        class="size-36 rounded-2xl object-cover shadow-2xl xl:size-44"
        :class="{ 'rounded-full': kind === 'artist' }"
      />
      <div class="min-w-0 flex-1">
        <p class="section-label mb-3">
          {{
            kind === "album"
              ? "专辑 · ALBUM"
              : kind === "artist"
                ? "歌手 · ARTIST"
                : "歌单 · PLAYLIST"
          }}
        </p>
        <h1
          class="break-words text-[clamp(24px,3vw,38px)] font-extrabold tracking-tight"
        >
          {{ title }}
        </h1>
        <p class="my-3 text-xs text-muted">
          {{ tracks.length }} 首歌曲 · {{ duration
          }}{{ kind === "album" && tracks[0] ? ` · ${tracks[0].artist}` : "" }}
        </p>
        <BaseButton
          variant="primary"
          :disabled="!tracks.length"
          @click="player.playAll(tracks)"
        >
          <AppIcon name="play" :size="14" />播放全部
        </BaseButton>
      </div>
    </header>
    <!-- 收藏详情歌曲区：统一排序、分页与空歌单引导。 -->
    <TrackList
      :tracks="tracks"
      sortable
      empty-text="这里还没有歌曲。从音乐库歌曲的「更多操作」中添加到此歌单。"
    />
  </div>
</template>
