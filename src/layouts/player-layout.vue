<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed, onMounted, onUnmounted, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useEventListener } from "@vueuse/core";
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import AppIcon from "@/components/ui/AppIcon.vue";
import PlayerSidebar from "@/pages/index/components/player-sidebar.vue";
import NowPlaying from "@/pages/index/components/now-playing.vue";
import PlayerBar from "@/pages/index/components/player-bar.vue";
import FullscreenPlayer from "@/pages/index/components/fullscreen-player.vue";
import WeatherPill from "@/pages/index/components/weather-pill.vue";
import { usePlayerStore } from "@/stores/player";
import { controlWindow } from "@/services/desktop";
import type { PlayerAction, PlayerSnapshot } from "@/types/music";

const player = usePlayerStore();
const route = useRoute();
const router = useRouter();
const topSearch = useTemplateRef<HTMLInputElement>("topSearch");
const content = useTemplateRef<HTMLElement>("content");
const unlisteners: UnlistenFn[] = [];
let disposed = false;
const query = computed({
  get: () => (typeof route.query.q === "string" ? route.query.q : ""),
  set: (value: string) => {
    const target = { name: "search", query: value ? { q: value } : {} };
    if (route.name === "search") void router.replace(target);
    else void router.push(target);
  },
});
const canBack = computed(() =>
  Boolean(route.fullPath && window.history.state?.back),
);
const canForward = computed(() =>
  Boolean(route.fullPath && window.history.state?.forward),
);
const panelStyle = computed(() => ({
  gridTemplateColumns: `var(--sidebar-width) minmax(0,1fr) ${player.settings.panelOpen ? "var(--panel-width)" : "0px"}`,
}));

// 在浏览器与桌面端共用搜索入口，聚焦时打开对应路由。
function openSearch(): void {
  if (route.name !== "search") void router.push("/search");
}

// 主窗口发布只读播放快照，桌面小窗只负责显示与发送控制动作。
function publishSnapshot(): void {
  if (!isTauri()) return;
  const snapshot: PlayerSnapshot = {
    track: { ...player.currentTrack },
    playing: player.playing,
    time: player.time,
    duration: player.duration,
    volume: player.volume,
    liked: player.liked,
    lyricIndex: player.lyricIndex,
  };
  void emit("player-snapshot", snapshot);
}

// 桌面小窗和托盘的动作统一回到主窗口执行，避免多个音频引擎同时播放。
function handleDesktopAction(action: PlayerAction): void {
  if (action === "toggle") void player.togglePlayback();
  else if (action === "next") player.next();
  else if (action === "previous") player.previous();
  else if (action === "like") player.toggleLike();
}

// 全局键盘快捷键避开输入框与按钮，防止打字或空格激活控件时误触播放。
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    player.fullscreen = false;
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    topSearch.value?.focus();
    return;
  }
  if (
    event.target instanceof HTMLElement &&
    event.target.closest(
      "input,textarea,select,button,summary,[contenteditable=true],dialog[open]",
    )
  )
    return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === "Space") {
    event.preventDefault();
    void player.togglePlayback();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    player.seek(player.time + 5);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    player.seek(player.time - 5);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    player.volume = Math.min(100, player.volume + 5);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    player.volume = Math.max(0, player.volume - 5);
  } else if (event.key.toLowerCase() === "m") player.toggleMute();
}
useEventListener(window, "keydown", handleKeydown);
watch(
  () => route.fullPath,
  () => {
    if (content.value) content.value.scrollTop = 0;
  },
);
watch(
  () => [
    player.currentId,
    player.playing,
    player.time,
    player.volume,
    player.liked,
  ],
  publishSnapshot,
);
onMounted(async () => {
  player.setupMediaSession();
  if (!isTauri()) return;
  const callbacks = await Promise.all([
    listen<PlayerAction>("player-action", (event) =>
      handleDesktopAction(event.payload),
    ),
    listen("player-ready", publishSnapshot),
  ]);
  if (disposed) callbacks.forEach((stop) => stop());
  else unlisteners.push(...callbacks);
});
onUnmounted(() => {
  disposed = true;
  unlisteners.forEach((stop) => stop());
});
</script>

<template>
  <!-- 桌面应用布局：自定义标题栏、三栏内容与通栏播放器。 -->
  <div
    class="app-shell relative flex h-dvh min-h-0 min-w-[760px] flex-col overflow-hidden"
    :class="[player.settings.glass, { calm: !player.settings.motion }]"
  >
    <div
      class="app-background"
      :style="{ backgroundImage: `url('${player.currentTrack.cover}')` }"
    />
    <header
      data-tauri-drag-region
      class="relative z-10 flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4"
      @dblclick.self="controlWindow('maximize')"
    >
      <div class="mr-3 flex gap-2" aria-hidden="true">
        <i class="size-2.5 rounded-full bg-[#ff5f57]" /><i
          class="size-2.5 rounded-full bg-[#febc2e]"
        /><i class="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div class="flex gap-1">
        <BaseButton
          variant="icon"
          :disabled="!canBack"
          aria-label="后退"
          @click="router.back()"
        >
          <AppIcon name="chevronLeft" :size="15" /></BaseButton
        ><BaseButton
          variant="icon"
          :disabled="!canForward"
          aria-label="前进"
          @click="router.forward()"
        >
          <AppIcon name="chevronRight" :size="15" />
        </BaseButton>
      </div>
      <span
        data-tauri-drag-region
        class="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/75 max-lg:left-[38%]"
        >{{ route.meta.title }}</span
      >
      <label
        class="glass ml-auto flex h-8 w-52 items-center gap-2 rounded-full border border-white/15 px-3 xl:w-60"
        ><AppIcon name="search" :size="13" /><input
          ref="topSearch"
          v-model="query"
          type="search"
          class="min-w-0 flex-1 bg-transparent text-[11px] placeholder:text-white/40"
          placeholder="搜索歌曲、专辑、歌手…"
          aria-label="顶栏搜索"
          @focus="openSearch"
      /></label>
      <!-- 标题栏天气胶囊：保留原型效果，可在设置中关闭。 -->
      <WeatherPill v-if="player.settings.weather" />
      <div class="ml-1 flex items-center">
        <BaseButton
          variant="icon"
          class="rounded-md"
          aria-label="最小化窗口"
          @click="controlWindow('minimize')"
        >
          <AppIcon name="minus" :size="14" /></BaseButton
        ><BaseButton
          variant="icon"
          class="rounded-md"
          aria-label="最大化窗口"
          @click="controlWindow('maximize')"
        >
          <AppIcon name="maximize" :size="12" /></BaseButton
        ><BaseButton
          variant="icon"
          class="rounded-md hover:bg-red-500/80"
          aria-label="关闭窗口"
          @click="controlWindow('close')"
        >
          <AppIcon name="close" :size="14" />
        </BaseButton>
      </div>
    </header>
    <div
      class="app-columns relative z-0 grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-400"
      :style="panelStyle"
    >
      <!-- 左侧导航组件：歌单管理与桌面小窗入口。 -->
      <PlayerSidebar />
      <!-- 主内容路由：切换页面时保持播放引擎和左右栏持续挂载。 -->
      <main
        ref="content"
        class="main-content min-h-0 min-w-0 overflow-y-auto px-6 pb-16 pt-6 xl:px-8"
      >
        <RouterView />
      </main>
      <!-- 右侧播放组件：收起时保留布局动画并移出键盘焦点。 -->
      <NowPlaying
        :inert="!player.settings.panelOpen"
        class="w-[var(--panel-width)] transition-opacity duration-300"
        :class="{ 'pointer-events-none opacity-0': !player.settings.panelOpen }"
      />
      <BaseButton
        class="glass absolute top-4 z-10 grid size-7 place-items-center rounded-full border border-white/20 transition-[right] duration-400 hover:bg-white/15"
        :style="{
          right: player.settings.panelOpen
            ? 'calc(var(--panel-width) - 14px)'
            : '4px',
        }"
        :aria-label="
          player.settings.panelOpen ? '收起正在播放面板' : '展开正在播放面板'
        "
        :aria-expanded="player.settings.panelOpen"
        @click="player.settings.panelOpen = !player.settings.panelOpen"
      >
        <AppIcon
          :name="player.settings.panelOpen ? 'chevronRight' : 'chevronLeft'"
          :size="13"
        />
      </BaseButton>
    </div>
    <!-- 主播放栏组件：保持跨页面连续播放。 -->
    <PlayerBar />
    <!-- 全屏舞台组件：进入退出动画、同步歌词与浮动 Dock。 -->
    <Transition name="stage"
      ><FullscreenPlayer v-if="player.fullscreen"
    /></Transition>
  </div>
</template>

<style scoped>
.app-columns {
  --sidebar-width: 220px;
  --panel-width: 296px;
}
@media (max-width: 1150px) {
  .app-columns {
    --sidebar-width: 194px;
    --panel-width: 260px;
  }
}
</style>
