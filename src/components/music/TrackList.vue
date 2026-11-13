<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed, reactive, toRefs, watch } from "vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import PaginationBar from "@/components/ui/PaginationBar.vue";
import SlidingTabs from "@/components/ui/SlidingTabs.vue";
import { usePlayerStore } from "@/stores/player";
import { formatTime } from "@/utils/format";
import { notify } from "@/services/notification";
import { readAudio } from "@/services/audio-storage";
import type { Track } from "@/types/music";

const props = withDefaults(
  defineProps<{ tracks: Track[]; sortable?: boolean; emptyText?: string }>(),
  { sortable: false, emptyText: "这里还没有歌曲，去发现一些喜欢的音乐吧。" },
);
const player = usePlayerStore();
// 响应式状态：排序和分页只属于当前列表，不写入全局播放器。
const state = reactive({
  // 当前页码。
  page: 1,
  // 列表排序字段。
  sort: "default",
});
const { page, sort } = toRefs(state);
const options = [
  { value: "default", label: "默认" },
  { value: "title", label: "歌名" },
  { value: "artist", label: "歌手" },
  { value: "duration", label: "时长" },
];
const sorted = computed(() =>
  [...props.tracks].sort((a, b) =>
    state.sort === "duration"
      ? a.duration - b.duration
      : state.sort === "title" || state.sort === "artist"
        ? a[state.sort].localeCompare(b[state.sort], "zh-CN")
        : 0,
  ),
);
const visible = computed(() =>
  sorted.value.slice((state.page - 1) * 10, state.page * 10),
);

watch(
  () => [state.sort, props.tracks.map((track) => track.id).join("|")],
  () => {
    state.page = 1;
  },
);

// 将当前行加入已有歌单，避免重复写入，并统一展示结果。
function addToPlaylist(playlistId: string, trackId: string): void {
  const playlist = player.playlists.find((item) => item.id === playlistId);
  if (!playlist) return;
  if (playlist.trackIds.includes(trackId)) {
    notify("这首歌已经在歌单中");
    return;
  }
  playlist.trackIds.push(trackId);
  notify(`已加入「${playlist.name}」`);
}

// 本地音频可导出原文件；演示歌曲没有可下载的音源。
async function downloadTrack(track: Track): Promise<void> {
  if (track.source === "demo") {
    notify("演示曲目不含音源，请先导入本地音频");
    return;
  }
  try {
    const blob = await readAudio(track.id);
    if (!blob) throw new Error();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${track.title}.${track.quality.toLowerCase()}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    notify("无法导出音频，请重新导入文件", "error");
  }
}
</script>

<template>
  <section aria-label="歌曲列表">
    <!-- 歌曲列表工具栏：统一滑动分段组件控制列表排序。 -->
    <div v-if="sortable" class="mb-4 flex items-center justify-between gap-3">
      <span class="text-xs text-muted">排序</span
      ><SlidingTabs v-model="sort" :options="options" label="列表排序" />
    </div>
    <div
      v-if="!tracks.length"
      class="flex min-h-48 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 text-center text-sm text-muted"
    >
      <AppIcon name="music" :size="32" />
      <p>{{ emptyText }}</p>
    </div>
    <!-- 歌曲表格：播放入口与收藏、下一首、歌单操作独立，支持键盘焦点。 -->
    <template v-else>
      <div
        class="track-grid border-b border-white/8 px-3 pb-3 text-[10px] font-bold tracking-wider text-muted"
      >
        <span>#</span><span>标题</span><span>专辑</span
        ><span class="text-right">时长</span><span class="col-span-2" />
      </div>
      <div
        v-for="(track, index) in visible"
        :key="track.id"
        class="track-grid group min-h-16 rounded-xl px-3 transition-colors hover:bg-white/5"
        :class="{ 'bg-white/7': player.currentId === track.id }"
      >
        <BaseButton
          class="col-span-4 grid h-full grid-cols-subgrid items-center text-left"
          :aria-label="`播放 ${track.title} · ${track.artist}`"
          @click="player.playTrack(track.id)"
        >
          <span
            v-if="player.currentId === track.id && player.playing"
            class="equalizer"
            ><i /><i /><i /></span
          ><span v-else class="font-mono text-[11px] text-muted">{{
            String((page - 1) * 10 + index + 1).padStart(2, "0")
          }}</span>
          <span class="min-w-0 pr-3"
            ><b class="block truncate text-[13px] font-bold">{{
              track.title
            }}</b
            ><span class="mt-1 block truncate text-[11px] text-muted">{{
              track.artist
            }}</span></span
          >
          <span class="truncate pr-2 text-xs text-muted">{{
            track.album
          }}</span><span class="text-right font-mono text-[11px] text-muted">{{
            track.duration ? formatTime(track.duration) : "—"
          }}</span>
        </BaseButton>
        <BaseButton
          variant="icon"
          :class="{ 'text-rose-300': player.likedIds.includes(track.id) }"
          :aria-label="`${player.likedIds.includes(track.id) ? '取消收藏' : '收藏'} ${track.title}`"
          :aria-pressed="player.likedIds.includes(track.id)"
          @click="player.toggleLike(track.id)"
        >
          <AppIcon name="heart" :size="15" />
        </BaseButton>
        <details class="relative">
          <summary
            class="icon-button list-none font-bold"
            :aria-label="`${track.title} 更多操作`"
          >
            ···
          </summary>
          <div
            class="glass absolute right-0 z-30 w-48 rounded-xl border border-white/15 p-1.5 text-xs shadow-xl"
          >
            <BaseButton class="menu-item" @click="player.playNext(track.id)">
              下一首播放
            </BaseButton>
            <BaseButton class="menu-item" @click="downloadTrack(track)">
              导出音频文件
            </BaseButton>
            <p class="px-3 py-2 text-[10px] text-muted">添加到歌单</p>
            <BaseButton
              v-for="playlist in player.playlists"
              :key="playlist.id"
              class="menu-item truncate"
              @click="addToPlaylist(playlist.id, track.id)"
            >
              {{ playlist.name }}
            </BaseButton>
            <p v-if="!player.playlists.length" class="px-3 pb-2 text-muted">
              请先在侧边栏新建歌单
            </p>
          </div>
        </details>
      </div>
    </template>
    <!-- 歌曲列表分页：保留胶囊节点，以位移动画标记当前页。 -->
    <PaginationBar v-model="page" :total="tracks.length" />
  </section>
</template>
