<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed, onMounted, onUnmounted, reactive, toRefs } from "vue";
import { useRoute } from "vue-router";
import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import AppIcon from "@/components/ui/AppIcon.vue";
import { demoTracks } from "@/constants/music";
import { controlWindow } from "@/services/desktop";
import { notify } from "@/services/notification";
import { formatTime } from "@/utils/format";
import type { PlayerAction, PlayerSnapshot } from "@/types/music";

const route = useRoute();
const isLyrics = computed(() => route.params.mode === "lyrics");
// 响应式状态：桌面小窗仅消费主窗口快照，不创建第二个音频引擎。
const state = reactive({
  // 主窗口共享的只读播放状态。
  snapshot: {
    track: demoTracks[0]!,
    playing: false,
    time: 0,
    duration: 214,
    volume: 70,
    liked: false,
    lyricIndex: 0,
  } as PlayerSnapshot,
  // 桌面歌词显示字号。
  fontSize: 24,
  // 桌面窗口的视觉透明度。
  opacity: 96,
  // 点击穿透锁定状态。
  locked: false,
});
const { snapshot, fontSize, opacity, locked } = toRefs(state);
const lyric = computed(
  () =>
    state.snapshot.track.lyrics[state.snapshot.lyricIndex]?.text ||
    "纯音乐 · 静静聆听",
);
const nextLyric = computed(
  () =>
    state.snapshot.track.lyrics[state.snapshot.lyricIndex + 1]?.text ||
    state.snapshot.track.artist,
);
const unlisteners: UnlistenFn[] = [];
let disposed = false;

// 小窗操作通过定向事件交给主播放器，确保音频与所有窗口同步。
function sendAction(action: PlayerAction): void {
  if (isTauri()) void emitTo("main", "player-action", action);
}

// 锁定歌词后启用真实窗口点击穿透；可从主窗口歌词入口解除锁定。
async function lockWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    state.locked = true;
    await getCurrentWindow().setIgnoreCursorEvents(true);
    notify("歌词已锁定，点击主窗口的「悬浮歌词窗」可解锁");
  } catch {
    state.locked = false;
    notify("无法锁定歌词窗口", "error");
  }
}
onMounted(async () => {
  if (!isTauri()) return;
  const callbacks = await Promise.all([
    listen<PlayerSnapshot>("player-snapshot", (event) => {
      state.snapshot = event.payload;
    }),
    listen("desktop-unlocked", () => {
      state.locked = false;
    }),
  ]);
  if (disposed) {
    callbacks.forEach((stop) => stop());
    return;
  }
  unlisteners.push(...callbacks);
  await emitTo("main", "player-ready");
});
onUnmounted(() => {
  disposed = true;
  unlisteners.forEach((stop) => stop());
});
</script>

<template>
  <!-- 桌面独立小窗：由 Tauri 置顶显示，播放动作全部发往主窗口。 -->
  <div
    class="desktop-window relative flex h-dvh flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#161923] text-white"
    :style="{ opacity: opacity / 100 }"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-cover bg-center opacity-15 blur-2xl"
      :style="{ backgroundImage: `url('${snapshot.track.cover}')` }"
    />
    <header
      data-tauri-drag-region
      class="relative flex h-10 shrink-0 items-center gap-2 border-b border-white/10 px-3"
    >
      <span
        data-tauri-drag-region
        class="text-[9px] font-bold tracking-[.13em] text-white/50"
        >{{ isLyrics ? "桌面歌词" : "MINI PLAYER" }} · MIRAI</span
      ><span class="ml-auto flex items-center"
        ><template v-if="isLyrics"
          ><BaseButton
            variant="icon"
            class="size-6 text-xs"
            aria-label="缩小歌词"
            @click="fontSize = Math.max(16, fontSize - 2)"
          >
            A−</BaseButton
          ><BaseButton
            variant="icon"
            class="size-6 text-xs"
            aria-label="放大歌词"
            @click="fontSize = Math.min(40, fontSize + 2)"
          >
            A+</BaseButton
          ><input
            v-model.number="opacity"
            aria-label="歌词窗口透明度"
            type="range"
            min="40"
            max="100"
            class="mx-2 w-12" /><BaseButton
            variant="icon"
            class="size-6"
            :disabled="locked"
            aria-label="锁定歌词并点击穿透"
            @click="lockWindow"
          >
            <AppIcon name="lock" :size="12" /></BaseButton></template
        ><BaseButton
          variant="icon"
          class="size-6"
          aria-label="关闭小窗"
          @click="controlWindow('close')"
        >
          <AppIcon name="close" :size="13" /></BaseButton
      ></span>
    </header>
    <!-- 桌面歌词区：当前句和下一句与主窗口逐句同步。 -->
    <div
      v-if="isLyrics"
      class="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6"
    >
      <p
        :key="`${snapshot.track.id}:${snapshot.lyricIndex}`"
        class="text-center font-extrabold leading-relaxed tracking-tight text-white [text-shadow:0_2px_14px_#0008]"
        :style="{ fontSize: `${fontSize}px` }"
      >
        {{ lyric }}
      </p>
      <p class="text-center text-xs text-white/35">{{ nextLyric }}</p>
    </div>
    <!-- 迷你播放器曲目区：切歌时封面与文字采用同步淡入过渡。 -->
    <div
      v-else
      :key="snapshot.track.id"
      class="relative flex flex-1 items-center gap-4 p-5"
    >
      <img
        :src="snapshot.track.cover"
        alt="正在播放的专辑封面"
        class="size-24 rounded-xl object-cover shadow-xl"
      />
      <div class="min-w-0">
        <h1 class="truncate text-lg font-extrabold">
          {{ snapshot.track.title }}
        </h1>
        <p class="mt-2 text-xs text-white/50">{{ snapshot.track.artist }}</p>
        <p class="mt-3 font-mono text-[9px] text-white/35">
          {{ snapshot.track.quality }}
        </p>
      </div>
    </div>
    <!-- 小窗控制区：上一首、播放暂停、下一首与收藏全部定向到主播放器。 -->
    <footer
      class="relative flex h-14 shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5"
    >
      <p class="min-w-0 truncate font-mono text-[9px] text-white/40">
        {{ formatTime(snapshot.time) }} / {{ formatTime(snapshot.duration) }}
      </p>
      <div class="flex items-center gap-3">
        <BaseButton
          variant="icon"
          aria-label="小窗上一首"
          @click="sendAction('previous')"
        >
          <AppIcon name="previous" :size="16" /></BaseButton
        ><BaseButton
          class="grid size-8 place-items-center rounded-full bg-white text-zinc-900"
          :aria-label="snapshot.playing ? '小窗暂停' : '小窗播放'"
          @click="sendAction('toggle')"
        >
          <AppIcon
            :name="snapshot.playing ? 'pause' : 'play'"
            :size="16" /></BaseButton
        ><BaseButton
          variant="icon"
          aria-label="小窗下一首"
          @click="sendAction('next')"
        >
          <AppIcon name="next" :size="16" /></BaseButton
        ><BaseButton
          variant="icon"
          :class="{ 'text-rose-300': snapshot.liked }"
          aria-label="小窗收藏"
          @click="sendAction('like')"
        >
          <AppIcon name="heart" :size="15" />
        </BaseButton>
      </div>
    </footer>
  </div>
</template>
