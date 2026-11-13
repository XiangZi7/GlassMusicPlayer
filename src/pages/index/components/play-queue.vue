<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import { usePlayerStore } from "@/stores/player";
import { formatTime } from "@/utils/format";
const player = usePlayerStore();

// 开始拖动歌曲时只记录歌曲编号，队列顺序在放下时更新。
function startDrag(event: DragEvent, id: string): void {
  event.dataTransfer?.setData("text/mirai-track", id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

// 将拖入的歌曲移动到目标行之前，非队列文件拖放不触发操作。
function dropTrack(event: DragEvent, id: string): void {
  event.preventDefault();
  const from = event.dataTransfer?.getData("text/mirai-track");
  if (from) player.reorderQueue(from, id);
}
</script>

<template>
  <!-- 播放队列：双击非必要，行内播放、下一首与键盘上移均可直接操作。 -->
  <div>
    <div class="mb-3 flex items-center justify-between">
      <h3 class="section-label">
        {{ player.radio ? "电台续播中" : "接下来播放" }} · QUEUE
      </h3>
      <BaseButton
        class="rounded-full border border-white/10 px-2 py-1 text-[9px] text-muted hover:text-white"
        @click="player.radio ? (player.radio = false) : player.startRadio()"
      >
        {{ player.radio ? "关闭电台" : "开启电台" }}
      </BaseButton>
    </div>
    <div class="flex flex-col gap-1">
      <div
        v-for="(track, index) in player.queueTracks"
        :key="track.id"
        class="group flex min-h-13 items-center gap-2 rounded-xl p-2 hover:bg-white/7"
        :class="{ 'bg-white/7': player.currentId === track.id }"
        draggable="true"
        @dragstart="startDrag($event, track.id)"
        @dragover.prevent
        @drop="dropTrack($event, track.id)"
      >
        <BaseButton
          class="flex min-w-0 flex-1 items-center gap-2 text-left"
          :aria-label="`队列播放 ${track.title}`"
          @click="player.playTrack(track.id)"
        >
          <img
            :src="track.cover"
            alt=""
            class="size-8 rounded-md object-cover"
            loading="lazy"
          /><span class="min-w-0"
            ><b class="block truncate text-[11px] font-bold">{{
              track.title
            }}</b
            ><span class="mt-1 block truncate text-[9px] text-muted">{{
              track.artist
            }}</span></span
          >
        </BaseButton>
        <span
          class="font-mono text-[9px] text-muted group-hover:hidden group-focus-within:hidden"
          >{{ formatTime(track.duration) }}</span
        >
        <BaseButton
          v-if="index"
          class="hidden size-6 shrink-0 rounded-full text-xs text-muted hover:bg-white/10 group-focus-within:block group-hover:block"
          :aria-label="`上移 ${track.title}`"
          @click="
            player.reorderQueue(track.id, player.queueTracks[index - 1]!.id)
          "
        >
          ↑
        </BaseButton>
        <BaseButton
          variant="icon"
          class="size-6"
          :aria-label="`下一首播放 ${track.title}`"
          @click="player.playNext(track.id)"
        >
          <AppIcon name="next" :size="12" />
        </BaseButton>
      </div>
    </div>
  </div>
</template>
