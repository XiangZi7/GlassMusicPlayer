<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, provide, useTemplateRef, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { isTauri } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import BaseButton from '@/components/ui/BaseButton.vue';
import PlayerTitlebar from '@/components/player/PlayerTitlebar.vue';
import PlayerSidebar from '@/components/player/PlayerSidebar.vue';
import PlayerNowPlaying from '@/components/player/PlayerNowPlaying.vue';
import PlayerFullscreen from '@/components/player/PlayerFullscreen.vue';
import PlayerPlayerBar from '@/components/player/PlayerPlayerBar.vue';
import { playerKey, type PlayerController } from '@/composables/usePlayer';
import { usePlayerStore, type PlayerPage } from '@/stores/player';
import { mountSourcePlayer } from '@/services/player/runtime';
import { openDesktop } from '@/services/desktop';
import type { SourceAction, SourceSnapshot } from '@/types/prototype';

const root = useTemplateRef<HTMLElement>('root');
const route = useRoute();
const router = useRouter();
const { state, tracks } = usePlayerStore();
const unlisteners: UnlistenFn[] = [];
let player: PlayerController | undefined;
let disposed = false;

provide(playerKey, { state, tracks, controller: () => player });

// 原稿导航统一落到真实路由，保留前进、后退和歌单索引。
function navigate(page: PlayerPage, index: number): void {
  const path = page === 'home' ? '/' : `/${page}`;
  const query = ['playlist', 'album', 'artist'].includes(page) ? { index: String(index) } : {};
  void router.push({ path, query });
}

// 独立窗口只接收主播放器快照，避免出现第二套播放时钟。
function publishSnapshot(snapshot: SourceSnapshot): void {
  if (isTauri()) void emit('player-snapshot', snapshot);
}

// 保留原稿桌面入口，打开对应的 Tauri 独立窗口。
function openSourceDesktop(mode: 'mini' | 'lyr' | 'media'): void {
  void openDesktop(mode === 'lyr' ? 'lyrics' : mode);
}

// 桌面小窗动作回到同一播放器，聚焦动作交给原生窗口。
async function handleAction(action: SourceAction): Promise<void> {
  if (action.type === 'focus' && isTauri()) {
    await getCurrentWindow().show();
    await getCurrentWindow().setFocus();
  } else player?.dispatch(action);
}

// 路由视图更新后再测量胶囊、歌词和横幅，防止读取已卸载节点。
async function syncRoute(): Promise<void> {
  const page = (route.meta.playerPage || 'home') as PlayerPage;
  const index = Math.max(0, Math.min(tracks.length - 1, Number(route.query.index) || 0));
  player?.navigate(page, index, true);
  await nextTick();
  player?.refresh();
}

watch(() => route.fullPath, syncRoute, { flush: 'post' });

onMounted(async () => {
  if (!root.value) return;
  player = mountSourcePlayer(root.value, { state, tracks, onNavigate: navigate, onStateChange: publishSnapshot, onDesktop: openSourceDesktop });
  await syncRoute();
  if (!isTauri()) return;
  const callbacks = await Promise.all([
    listen<SourceAction>('player-action', event => { void handleAction(event.payload); }),
    listen('player-ready', () => { if (player) publishSnapshot(player.getSnapshot()); }),
  ]);
  if (disposed) callbacks.forEach(stop => stop());
  else unlisteners.push(...callbacks);
});

onUnmounted(() => {
  disposed = true;
  unlisteners.forEach(stop => stop());
  player?.destroy();
});
</script>

<template>
  <!-- 公共播放器布局：切换页面时保持播放、全屏和桌面窗口连接。 -->
  <div ref="root" class="native-player h-full w-full">
    <section id="colA" class="col h-full w-full">
      <div class="glass-win h-full w-full">
        <div class="win" data-player>
          <div class="win-bg" data-bg />
          <div class="win-veil" />
          <PlayerTitlebar />
          <div class="win-body">
            <PlayerSidebar />
            <main class="main" :class="{ 'show-page': state.page !== 'home' }">
              <RouterView />
            </main>
            <BaseButton class="np-toggle" data-np-toggle aria-expanded="true" aria-label="收起正在播放面板" title="收起正在播放面板">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5L16 12l-6.5 6.5" /></svg>
            </BaseButton>
            <PlayerNowPlaying />
          </div>
          <PlayerFullscreen />
          <PlayerPlayerBar />
        </div>
      </div>
    </section>
  </div>
</template>
