<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  toRefs,
  useTemplateRef,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import BaseButton from "@/components/ui/BaseButton.vue";
import { formatTime } from "@/utils/format";
import {
  animateSourceDesktop,
  animateSourceLyric,
} from "@/pages/index/source-desktop-animation";
import type { SourceAction, SourceSnapshot } from "@/types/prototype";

const route = useRoute();
const root = useTemplateRef<HTMLElement>("root");
const mode = computed(() => String(route.params.mode));
// 响应式状态：小窗只接收原稿快照，不创建另一套播放器或改写原稿卡片。
const state = reactive({
  // 原稿主窗口的曲目、歌词和音量。
  snapshot: {
    track: {
      title: "",
      artist: "",
      album: "",
      cover: "",
      dur: 0,
      q: "",
      glow: "",
    },
    playing: false,
    time: 0,
    volume: 70,
    liked: false,
    lyrics: [],
    lyricIndex: 0,
    motion: true,
    fontSize: 21,
    locked: false,
    index: -1,
    direction: 1,
  } as SourceSnapshot,
});
const { snapshot } = toRefs(state);
const track = computed(() => state.snapshot.track);
const previousLyric = computed(
  () => state.snapshot.lyrics[state.snapshot.lyricIndex - 1] || "",
);
const currentLyric = computed(
  () => state.snapshot.lyrics[state.snapshot.lyricIndex] || "",
);
const nextLyric = computed(
  () => state.snapshot.lyrics[state.snapshot.lyricIndex + 1] || "",
);
const progress = computed(
  () =>
    `${track.value.dur ? Math.min(100, (state.snapshot.time / track.value.dur) * 100) : 0}%`,
);
let unlisten: UnlistenFn | undefined;
let disposed = false;

// 原稿小窗操作定向交回主窗口，继续调用原来的播放、切歌与收藏方法。
function sendAction(type: SourceAction["type"], value?: number): void {
  if (isTauri()) void emitTo("main", "player-action", { type, value });
}
// 原稿进度条点击时换算为歌曲的相对位置。
function seekNative(event: MouseEvent): void {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  sendAction("seek", (event.clientX - bounds.left) / bounds.width);
}
// 原稿音量滑块继续控制主窗口的统一音量。
function setNativeVolume(event: Event): void {
  sendAction("volume", Number((event.target as HTMLInputElement).value));
}
// 原稿迷你卡片的打开主窗口入口恢复主窗口并收起当前迷你窗口。
async function focusMain(): Promise<void> {
  sendAction("focus");
  if (isTauri()) await getCurrentWindow().close();
}
watch(
  () => state.snapshot.locked,
  (locked) => {
    if (isTauri() && mode.value === "lyrics")
      void getCurrentWindow().setIgnoreCursorEvents(locked);
  },
);
watch(
  () => state.snapshot,
  async (current, previous) => {
    await nextTick();
    if (!root.value) return;
    if (previous.index >= 0 && current.index !== previous.index) {
      animateSourceDesktop(
        root.value,
        current.direction,
        previous.track,
        current.motion,
      );
    } else if (current.lyricIndex !== previous.lyricIndex) {
      animateSourceLyric(root.value, current.motion);
    }
  },
);
onMounted(async () => {
  if (!isTauri()) return;
  const stop = await listen<SourceSnapshot>("player-snapshot", (event) => {
    state.snapshot = event.payload;
  });
  if (disposed) {
    stop();
    return;
  }
  unlisten = stop;
  await emitTo("main", "player-ready");
});
onUnmounted(() => {
  disposed = true;
  unlisten?.();
  root.value
    ?.getAnimations({ subtree: true })
    .forEach((animation) => animation.cancel());
});
</script>

<template>
  <!-- 原稿桌面表面：仅适配为独立原生窗口，内部 DOM、SVG 和类名保持一致。 -->
  <div ref="root" id="desk" class="desk native-desktop">
    <div v-if="mode === 'lyrics'" class="desk-lyr" id="deskLyr">
      <div class="desk-lyr-head" id="deskLyrHead" data-tauri-drag-region>
        <span aria-hidden="true">⠿</span><span>桌面歌词 · AURA</span
        ><span class="desk-lyr-state" id="deskLyrState">{{
          snapshot.locked ? "已锁定" : "可拖动"
        }}</span>
      </div>
      <div class="desk-lyr-prev" data-desk-prev>{{ previousLyric }}</div>
      <div
        class="desk-lyr-cur"
        data-desk-cur
        :style="{ fontSize: `${snapshot.fontSize}px` }"
      >
        {{ currentLyric }}
      </div>
      <div class="desk-lyr-next" data-desk-next>{{ nextLyric }}</div>
      <div class="desk-lyr-prog">
        <i data-desk-prog :style="{ width: progress }"></i>
      </div>
      <div class="desk-lyr-meta">
        <span data-desk-title>{{ track.title }}</span><span data-desk-time
          >{{ formatTime(snapshot.time) }} / {{ formatTime(track.dur) }}</span
        >
      </div>
    </div>
    <div v-else-if="mode === 'mini'" class="tray-pop" id="trayPop">
      <div class="tray-pop-head">
        <span>正在播放 · AURA PLAYER</span
        ><BaseButton type="button" data-desk-open @click="focusMain"
          >打开主窗口</BaseButton
        >
      </div>
      <div class="tray-pop-main">
        <img :src="track.cover" data-desk-cover alt="专辑封面" />
        <div class="tray-pop-txt">
          <b data-desk-title>{{ track.title }}</b><span data-desk-artist
            >{{ track.artist }} · {{ track.album }}</span
          >
        </div>
        <BaseButton
          class="heart"
          data-desk-like
          :class="{ liked: snapshot.liked }"
          @click="sendAction('like')"
          aria-label="收藏"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5 5 7.6 5c1.7 0 3.4 1 4.4 2.6C13 6 14.7 5 16.4 5 19 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8z"
            /></svg
        ></BaseButton>
      </div>
      <div class="tray-prog" data-desk-seekbar @click="seekNative">
        <i data-desk-prog :style="{ width: progress }"></i>
      </div>
      <div class="tray-pop-ctl">
        <BaseButton
          type="button"
          data-desk-prev-btn
          @click="sendAction('previous')"
          aria-label="上一首"
          ><svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg
        ></BaseButton>
        <BaseButton
          type="button"
          class="tray-play"
          data-desk-play
          @click="sendAction('toggle')"
          aria-label="播放或暂停"
          ><svg v-if="snapshot.playing" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" /></svg
          ><svg v-else viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" /></svg
        ></BaseButton>
        <BaseButton
          type="button"
          data-desk-next-btn
          @click="sendAction('next')"
          aria-label="下一首"
          ><svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
        ></BaseButton>
        <input
          type="range"
          class="vol tray-vol"
          id="trayVol"
          min="0"
          max="100"
          :value="snapshot.volume"
          @input="setNativeVolume"
          aria-label="音量"
          :style="{ '--p': `${snapshot.volume}%` }"
        />
      </div>
    </div>
    <div v-else class="desk-smtc" id="deskSmtc">
      <span class="smtc-tag">系统媒体控制 · SMTC</span>
      <img :src="track.cover" data-desk-cover alt="专辑封面" />
      <div class="smtc-txt">
        <b data-desk-title>{{ track.title }}</b><span data-desk-artist
          >{{ track.artist }} · {{ track.album }}</span
        >
        <div class="smtc-prog">
          <i data-desk-prog :style="{ width: progress }"></i>
        </div>
      </div>
      <div class="smtc-btns">
        <BaseButton
          type="button"
          data-desk-prev-btn
          @click="sendAction('previous')"
          aria-label="上一首"
          ><svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg></BaseButton
        ><BaseButton
          type="button"
          data-desk-play
          @click="sendAction('toggle')"
          aria-label="播放或暂停"
          ><svg v-if="snapshot.playing" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" /></svg
          ><svg v-else viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" /></svg></BaseButton
        ><BaseButton
          type="button"
          data-desk-next-btn
          @click="sendAction('next')"
          aria-label="下一首"
          ><svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
        ></BaseButton>
      </div>
    </div>
  </div>
</template>
<style scoped>
.native-desktop {
  width: 100%;
  height: 100dvh;
  min-height: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.native-desktop .desk-lyr,
.native-desktop .tray-pop,
.native-desktop .desk-smtc {
  position: relative;
  inset: auto;
  width: 100%;
  height: 100%;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
}
</style>
