<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed, reactive, toRefs } from "vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import PlaybackControls from "@/pages/index/components/playback-controls.vue";
import { usePlayerStore } from "@/stores/player";
import { formatTime } from "@/utils/format";
const player = usePlayerStore();
// 响应式状态：进度线悬停时间气泡的本地位置。
const state = reactive({
  // 光标对应的预览秒数。
  hoverTime: 0,
  // 光标相对进度条的横向百分比。
  hoverPercent: 0,
});
const { hoverTime, hoverPercent } = toRefs(state);
const progress = computed(
  () => (player.time / Math.max(1, player.duration)) * 100,
);
const peaks = Array.from(
  { length: 160 },
  (_, index) =>
    7 +
    Math.sin(index * 1.7) * 4 +
    Math.sin(index * 0.23) * 5 +
    (index % 7) * 1.5,
);

// 移动光标时只更新进度提示，实际跳播由可键盘操作的 range 触发。
function previewProgress(event: MouseEvent): void {
  const bounds =
    event.currentTarget instanceof HTMLElement
      ? event.currentTarget.getBoundingClientRect()
      : null;
  if (!bounds) return;
  state.hoverPercent = Math.max(
    0,
    Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
  );
  state.hoverTime = (player.duration * state.hoverPercent) / 100;
}

// 拖动或键盘调整进度条时将音频定位到所选时间。
function updateProgress(event: Event): void {
  player.seek(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <!-- 主播放栏：72px 单行、直角贴边，频峰只作底层装饰。 -->
  <footer
    class="glass relative z-20 grid h-[72px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-5 transition-transform duration-400"
    :class="{ 'translate-y-full': player.fullscreen }"
  >
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-end justify-between overflow-hidden px-1 opacity-[.08]"
      aria-hidden="true"
    >
      <i
        v-for="(height, index) in peaks"
        :key="index"
        class="w-0.5 shrink-0 rounded-t bg-white transition-[height] duration-700"
        :style="{ height: `${player.playing ? height : height * 0.3}px` }"
      />
    </div>
    <div
      class="group absolute inset-x-0 -top-2 z-30 h-4"
      @mousemove="previewProgress"
    >
      <div
        class="pointer-events-none absolute top-2 h-0.5 w-full bg-white/15 transition-all group-hover:top-1.5 group-hover:h-1.5 group-focus-within:top-1.5 group-focus-within:h-1.5"
      >
        <div
          class="relative h-full bg-white/80"
          :style="{ width: `${progress}%` }"
        >
          <i
            class="absolute right-0 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          />
        </div>
      </div>
      <input
        type="range"
        class="absolute inset-0 z-10 h-full w-full opacity-0"
        min="0"
        :max="player.duration || 1"
        step="0.1"
        :value="player.time"
        aria-label="播放进度"
        :aria-valuetext="`${formatTime(player.time)} / ${formatTime(player.duration)}`"
        @input="updateProgress"
      />
      <span
        class="glass pointer-events-none absolute bottom-5 -translate-x-1/2 rounded-lg border border-white/20 px-2.5 py-1.5 font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
        :style="{ left: `clamp(65px, ${hoverPercent}%, calc(100% - 65px))` }"
        >{{ formatTime(hoverTime) }} / {{ formatTime(player.duration) }}</span
      >
    </div>
    <BaseButton
      v-if="player.currentTrack.lyrics.length"
      class="glass absolute -top-10 left-1/2 flex max-w-[48%] -translate-x-1/2 items-center gap-4 rounded-full border border-white/15 px-5 py-2 text-[11px] shadow-lg hover:bg-white/15"
      aria-label="打开全屏歌词"
      @click="player.fullscreen = true"
    >
      <span :key="player.currentLyric" class="truncate">{{
        player.currentLyric
      }}</span><span class="text-white/50">›</span>
    </BaseButton>
    <div class="relative flex min-w-0 items-center gap-3">
      <BaseButton
        class="shrink-0 overflow-hidden rounded-lg shadow-lg"
        aria-label="打开全屏播放"
        @click="player.fullscreen = true"
      >
        <img
          :src="player.currentTrack.cover"
          alt="当前歌曲封面"
          class="size-12 object-cover"
        />
      </BaseButton>
      <div class="min-w-0">
        <p class="truncate text-xs font-extrabold">
          {{ player.currentTrack.title }}
        </p>
        <p class="mt-1 truncate text-[10px] text-muted">
          {{ player.currentTrack.artist }}
          <span
            v-if="player.currentTrack.source === 'demo'"
            class="text-white/35"
            >· 演示预览</span
          >
        </p>
      </div>
      <BaseButton
        variant="icon"
        :class="{ 'text-rose-300': player.liked }"
        :aria-label="player.liked ? '取消收藏当前歌曲' : '收藏当前歌曲'"
        :aria-pressed="player.liked"
        @click="player.toggleLike()"
      >
        <AppIcon name="heart" :size="17" />
      </BaseButton>
    </div>
    <!-- 底栏中区：可复用的完整播放控制组。 -->
    <PlaybackControls />
    <!-- 底栏右区：队列开关、静音与真实音频音量。 -->
    <div class="relative flex items-center justify-end gap-2">
      <BaseButton
        variant="icon"
        :aria-pressed="player.settings.panelOpen"
        aria-label="播放队列"
        @click="player.settings.panelOpen = !player.settings.panelOpen"
      >
        <AppIcon name="queue" :size="17" /></BaseButton
      ><BaseButton
        variant="icon"
        :aria-label="player.volume ? '静音' : '恢复声音'"
        @click="player.toggleMute"
      >
        <AppIcon
          :name="player.volume ? 'volume' : 'mute'"
          :size="17" /></BaseButton
      ><input
        v-model.number="player.volume"
        type="range"
        min="0"
        max="100"
        class="h-1 w-20 xl:w-25"
        aria-label="音量"
      />
    </div>
  </footer>
</template>
