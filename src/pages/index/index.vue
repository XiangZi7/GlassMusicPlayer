<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import BaseButton from "@/components/ui/BaseButton.vue";
import SourceTitlebar from "@/pages/index/components/source-titlebar.vue";
import SourceSidebar from "@/pages/index/components/source-sidebar.vue";
import SourceContent from "@/pages/index/components/source-content.vue";
import SourceNowPlaying from "@/pages/index/components/source-now-playing.vue";
import SourceFullscreen from "@/pages/index/components/source-fullscreen.vue";
import SourcePlayerBar from "@/pages/index/components/source-player-bar.vue";
import SourceDesktopSurfaces from "@/pages/index/components/source-desktop-surfaces.vue";
import { mountSourcePlayer } from "@/pages/index/source-player";
import { openDesktop } from "@/services/desktop";
import type {
  SourceAction,
  SourcePlayer,
  SourceSnapshot,
} from "@/types/prototype";

const root = useTemplateRef<HTMLElement>("root");
const unlisteners: UnlistenFn[] = [];
let player: SourcePlayer | undefined;
let disposed = false;

// 原稿状态只向独立小窗发布快照，主界面继续由原稿逻辑更新。
function publishSnapshot(snapshot: SourceSnapshot): void {
  if (isTauri()) void emit("player-snapshot", snapshot);
}

// 保留原稿的三个桌面入口，将对应表面放入 Tauri 独立窗口。
function openSourceDesktop(mode: "mini" | "lyr" | "media"): void {
  void openDesktop(mode === "lyr" ? "lyrics" : mode);
}

// 桌面窗口的动作交回原稿控制器执行，避免产生不同步的第二套状态。
async function handleAction(action: SourceAction): Promise<void> {
  if (action.type === "focus" && isTauri()) {
    await getCurrentWindow().show();
    await getCurrentWindow().setFocus();
    return;
  }
  player?.dispatch(action);
}

onMounted(async () => {
  if (!root.value) return;
  player = mountSourcePlayer(root.value, {
    onStateChange: publishSnapshot,
    onDesktop: openSourceDesktop,
  });
  if (!isTauri()) return;
  const callbacks = await Promise.all([
    listen<SourceAction>("player-action", (event) => {
      void handleAction(event.payload);
    }),
    listen("player-ready", () => {
      if (player) publishSnapshot(player.getSnapshot());
    }),
  ]);
  if (disposed) callbacks.forEach((stop) => stop());
  else unlisteners.push(...callbacks);
});
onUnmounted(() => {
  disposed = true;
  unlisteners.forEach((stop) => stop());
  player?.destroy();
});
</script>

<template>
  <!-- 原稿单窗口宿主：仅去除设计稿说明区与第二个对比窗口。 -->
  <div ref="root" class="native-player">
    <section id="colA" class="col">
      <div class="glass-win">
        <div class="win" data-player>
          <div class="win-bg" data-bg></div>
          <div class="win-veil"></div>
          <!-- 原稿标题栏组件：保留原尺寸与布局，仅接入真实窗口按钮。 -->
          <SourceTitlebar />
          <div class="win-body">
            <!-- 原稿侧栏组件：导航、歌单与桌面入口。 -->
            <SourceSidebar />
            <!-- 原稿内容组件：原样保留首页与全部内页。 -->
            <SourceContent />
            <BaseButton
              class="np-toggle"
              data-np-toggle
              aria-expanded="true"
              aria-label="收起正在播放面板"
              title="收起正在播放面板"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9.5 5.5L16 12l-6.5 6.5" /></svg
            ></BaseButton>
            <!-- 原稿右栏组件：正在播放、歌词与队列。 -->
            <SourceNowPlaying />
          </div>
          <!-- 原稿全屏组件：完整保留歌词、封面与原有动效。 -->
          <SourceFullscreen />
          <!-- 原稿底栏组件：原进度线、频峰背景与歌词胶囊。 -->
          <SourcePlayerBar />
        </div>
      </div>
    </section>
    <!-- 原稿演示辅助表面：保留同步钩子，不占用桌面应用可见布局。 -->
    <div hidden aria-hidden="true">
      <div id="trackPills"></div>
      <BaseButton id="syncPlay" />
      <SourceDesktopSurfaces />
    </div>
  </div>
</template>
