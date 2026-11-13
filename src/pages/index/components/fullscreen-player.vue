<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from "vue";
import { useMouseInElement } from "@vueuse/core";
import AppIcon from "@/components/ui/AppIcon.vue";
import PlaybackControls from "@/pages/index/components/playback-controls.vue";
import PlayQueue from "@/pages/index/components/play-queue.vue";
import WeatherPill from "@/pages/index/components/weather-pill.vue";
import { usePlayerStore } from "@/stores/player";
import { formatTime } from "@/utils/format";
const player = usePlayerStore();
const dialog = useTemplateRef<HTMLDialogElement>("stage");
const lyricViewport = useTemplateRef<HTMLElement>("lyricViewport");
const queueOpen = ref(false);
const { elementX, elementY, elementWidth, elementHeight, isOutside } =
  useMouseInElement(dialog);
const parallax = computed(() => {
  const enabled = player.settings.motion && !isOutside.value;
  return {
    "--px": `${enabled ? (elementX.value / Math.max(1, elementWidth.value) - 0.5) * 12 : 0}px`,
    "--py": `${enabled ? (elementY.value / Math.max(1, elementHeight.value) - 0.5) * 8 : 0}px`,
    "--album-color": player.currentTrack.color,
  };
});
const progress = computed(
  () => `${(player.time / Math.max(player.duration, 1)) * 100}%`,
);

// 歌词切句时在独立歌词容器内居中滚动，避免带动主页面。
async function centerLyric(): Promise<void> {
  await nextTick();
  const viewport = lyricViewport.value;
  const line = viewport?.querySelector<HTMLElement>('[data-current="true"]');
  if (viewport && line)
    viewport.scrollTo({
      top:
        line.offsetTop -
        viewport.offsetTop -
        viewport.clientHeight / 2 +
        line.offsetHeight / 2,
      behavior: player.settings.motion ? "smooth" : "instant",
    });
}
watch(() => [player.lyricIndex, player.currentId], centerLyric);
onMounted(() => {
  dialog.value?.showModal();
  void centerLyric();
});

// 全屏 Dock 的进度条同步定位真实音频或演示播放时间。
function seekFromInput(event: Event): void {
  player.seek(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <!-- 全屏播放舞台：原生模态窗口提供焦点管理与 Escape 关闭。 -->
  <dialog
    ref="stage"
    class="stage m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-[#0b0c14] p-0 text-white"
    :class="{ 'is-playing': player.playing, calm: !player.settings.motion }"
    :style="parallax"
    aria-label="全屏播放"
    @cancel.prevent="player.fullscreen = false"
  >
    <div
      class="absolute inset-[-80px] bg-cover bg-center opacity-25 blur-[70px]"
      :style="{ backgroundImage: `url('${player.currentTrack.cover}')` }"
    />
    <div
      class="ambient absolute -left-1/4 -top-1/4 size-[110%] rounded-full opacity-20 blur-[90px]"
      :style="{
        background: `radial-gradient(ellipse, ${player.currentTrack.color}, transparent 65%)`,
      }"
    />
    <div
      class="pointer-events-none absolute inset-0 bg-linear-to-b from-black/20 via-black/15 to-black/50"
    />
    <span
      class="stage-type pointer-events-none absolute left-[8%] top-[13%] whitespace-nowrap text-[clamp(80px,16vw,240px)] font-extrabold uppercase leading-none tracking-tighter opacity-10"
      >{{ player.currentTrack.artist }}</span
    >
    <span
      class="absolute bottom-14 left-6 text-[9px] font-bold tracking-[.4em] text-white/25 [writing-mode:vertical-rl]"
      >NOW PLAYING — MIRAI MUSIC</span
    >
    <span
      class="stage-type pointer-events-none absolute bottom-6 right-8 font-mono text-7xl font-bold opacity-15"
      >{{
        String(
          player.tracks.findIndex((track) => track.id === player.currentId) + 1,
        ).padStart(2, "0")
      }}</span
    >
    <header class="relative z-10 flex h-20 items-center gap-4 px-8">
      <BaseButton
        variant="icon"
        class="glass size-10 border border-white/10"
        aria-label="关闭全屏播放"
        @click="player.fullscreen = false"
      >
        <AppIcon name="chevronDown" :size="20" />
      </BaseButton>
      <div>
        <p class="text-[9px] font-bold tracking-[.22em] text-white/40">
          NOW PLAYING
        </p>
        <p class="mt-1.5 font-mono text-[10px] text-white/65">
          {{ player.currentTrack.album }} / {{ player.currentTrack.quality }}
        </p>
      </div>
      <div class="ml-auto flex gap-3">
        <WeatherPill v-if="player.settings.weather" /><BaseButton
          variant="secondary"
          class="glass"
          :aria-expanded="queueOpen"
          @click="queueOpen = !queueOpen"
        >
          <AppIcon name="queue" :size="15" />队列
        </BaseButton>
      </div>
    </header>
    <!-- 全屏主舞台：封面呼吸与切歌入场分层，歌词列可点击定位。 -->
    <div
      class="relative mx-auto grid h-[calc(100%-250px)] max-w-[1250px] grid-cols-[1.15fr_1fr] items-center gap-12 px-20 pb-8 pt-2 xl:gap-20"
    >
      <div class="relative min-w-0">
        <div
          class="cover-parallax relative mx-auto aspect-square w-[min(32vw,400px)]"
        >
          <div
            class="absolute inset-8 rounded-full opacity-35 blur-[55px]"
            :style="{ backgroundColor: player.currentTrack.color }"
          />
          <div class="cover-breathe relative size-full">
            <Transition name="cover"
              ><img
                :key="player.currentId"
                :src="player.currentTrack.cover"
                :alt="`${player.currentTrack.album} 专辑封面`"
                class="absolute inset-0 size-full rounded-2xl object-cover shadow-[0_30px_90px_#0009]"
            /></Transition>
          </div>
        </div>
        <div
          :key="player.currentId"
          class="relative z-10 -mt-9 ml-[18%] w-[105%]"
        >
          <p class="mb-2 text-[9px] font-bold tracking-[.2em] text-white/50">
            {{
              player.currentTrack.source === "demo"
                ? "DEMO PREVIEW · 演示曲目"
                : "LOCAL MUSIC · 本地音乐"
            }}
          </p>
          <h1
            class="text-[clamp(30px,4.8vw,64px)] font-extrabold leading-[1.04] tracking-[-.045em] [text-shadow:0_4px_30px_#0008]"
          >
            {{ player.currentTrack.title }}
          </h1>
          <p class="mt-4 text-sm font-semibold text-white/55">
            {{ player.currentTrack.artist }}
          </p>
        </div>
      </div>
      <div class="relative h-full min-h-0 overflow-hidden pt-3">
        <h2 class="section-label mb-5">歌词 · LYRICS</h2>
        <div
          ref="lyricViewport"
          class="relative h-[calc(100%-35px)] overflow-y-auto overscroll-contain [mask-image:linear-gradient(transparent,black_18%,black_82%,transparent)] [scrollbar-width:none]"
        >
          <div class="py-[150px]">
            <BaseButton
              v-for="(line, index) in player.currentTrack.lyrics"
              :key="`${player.currentId}:${index}`"
              class="lyric-line my-7 block w-full select-none text-left transition-all duration-700"
              :data-current="index === player.lyricIndex"
              :class="
                index === player.lyricIndex
                  ? 'scale-100 text-white blur-none'
                  : 'scale-95 text-white/25 blur-[.7px]'
              "
              :aria-label="`跳转歌词：${line.text}`"
              @click="
                player.seek(
                  (index / player.currentTrack.lyrics.length) * player.duration,
                )
              "
            >
              <span
                class="block text-[clamp(17px,1.9vw,26px)] font-extrabold leading-relaxed tracking-tight"
                >{{ line.text }}</span><span
                class="mt-2 block text-[11px] font-medium leading-5 opacity-55"
                >{{ line.translation }}</span
              >
            </BaseButton>
            <div
              v-if="!player.currentTrack.lyrics.length"
              class="py-16 text-center"
            >
              <AppIcon
                class="mx-auto mb-5 text-white/30"
                name="music"
                :size="40"
              />
              <p class="text-lg font-bold text-white/70">让音乐自由流淌</p>
              <p class="mt-3 text-xs text-muted">此本地音频暂无歌词</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 浮动双层 Dock：上层时间进度，下层曲目、播放控制及音量。 -->
    <div
      class="glass absolute bottom-6 left-1/2 z-20 w-[min(920px,calc(100%-110px))] -translate-x-1/2 rounded-[26px] border border-white/15 px-5 pb-4 pt-3 shadow-[0_20px_70px_#0006]"
    >
      <div class="mb-3 flex items-center gap-4">
        <span class="font-mono text-[9px] text-white/55">{{
          formatTime(player.time)
        }}</span>
        <div class="relative h-4 flex-1">
          <div class="absolute top-1.5 h-1 w-full rounded-full bg-white/15">
            <div
              class="h-full rounded-full bg-white/85"
              :style="{ width: progress }"
            />
          </div>
          <input
            type="range"
            min="0"
            :max="player.duration || 1"
            step="0.1"
            :value="player.time"
            class="absolute inset-0 h-full w-full opacity-0 focus-visible:opacity-100"
            aria-label="全屏播放进度"
            @input="seekFromInput"
          />
        </div>
        <span class="font-mono text-[9px] text-white/55"
          >−{{ formatTime(player.duration - player.time) }}</span
        >
      </div>
      <div
        class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4"
      >
        <div class="flex min-w-0 items-center gap-3">
          <img
            :src="player.currentTrack.cover"
            alt=""
            class="size-11 rounded-lg object-cover"
          />
          <div class="min-w-0">
            <b class="block truncate text-[11px]">{{
              player.currentTrack.title
            }}</b>
            <p class="mt-1 truncate text-[9px] text-muted">
              {{ player.currentTrack.artist }}
            </p>
          </div>
          <BaseButton
            variant="icon"
            aria-label="全屏收藏歌曲"
            :class="{ 'text-rose-300': player.liked }"
            @click="player.toggleLike()"
          >
            <AppIcon name="heart" :size="15" />
          </BaseButton>
        </div>
        <PlaybackControls large />
        <div class="flex min-w-0 items-center justify-end gap-2">
          <div class="hidden min-w-0 xl:block">
            <p class="truncate text-[8px] text-muted">
              下一首 · {{ player.nextTrack?.title || "—" }}
            </p>
            <p class="mt-1 font-mono text-[8px] text-white/70">
              {{ player.currentTrack.quality }}
            </p>
          </div>
          <BaseButton
            variant="icon"
            aria-label="全屏播放队列"
            @click="queueOpen = !queueOpen"
          >
            <AppIcon name="queue" :size="15" /></BaseButton
          ><BaseButton
            variant="icon"
            aria-label="全屏静音开关"
            @click="player.toggleMute"
          >
            <AppIcon
              :name="player.volume ? 'volume' : 'mute'"
              :size="15" /></BaseButton
          ><input
            v-model.number="player.volume"
            class="w-16"
            type="range"
            min="0"
            max="100"
            aria-label="全屏音量"
          />
        </div>
      </div>
    </div>
    <!-- 全屏队列抽屉：复用队列组件，点击遮罩或关闭按钮收起。 -->
    <template v-if="queueOpen"
      ><BaseButton
        class="absolute inset-0 z-30 bg-black/30"
        aria-label="关闭队列遮罩"
        @click="queueOpen = false" />
      <aside
        class="glass absolute inset-y-0 right-0 z-40 w-80 overflow-y-auto border-l border-white/15 p-5"
      >
        <div class="mb-6 flex items-center justify-between">
          <h2 class="font-bold">播放队列</h2>
          <BaseButton
            variant="icon"
            aria-label="收起全屏队列"
            @click="queueOpen = false"
          >
            <AppIcon name="close" :size="16" />
          </BaseButton>
        </div>
        <PlayQueue /></aside
    ></template>
  </dialog>
</template>

<style scoped>
.stage-type {
  color: transparent;
  -webkit-text-stroke: 1px white;
  transform: translate(calc(var(--px) * -0.6), calc(var(--py) * -0.6));
  transition: transform 0.7s ease-out;
}
.cover-parallax {
  transform: translate(var(--px), var(--py));
  transition: transform 0.5s ease-out;
}
.ambient {
  animation: ambient-drift 32s ease-in-out infinite alternate;
  animation-play-state: paused;
}
.cover-breathe {
  animation: cover-breathe 7s ease-in-out infinite alternate;
  animation-play-state: paused;
}
.is-playing .ambient,
.is-playing .cover-breathe {
  animation-play-state: running;
}
</style>
