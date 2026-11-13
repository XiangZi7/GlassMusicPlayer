<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import type { Track } from "@/types/music";
withDefaults(defineProps<{ tracks: Track[]; artists?: boolean }>(), {
  artists: false,
});
defineEmits<{ select: [track: Track] }>();
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <BaseButton
      v-for="track in tracks"
      :key="track.id"
      class="group min-w-0 rounded-2xl border border-white/8 bg-white/4 p-2.5 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/8"
      :aria-label="`${artists ? '歌手' : '专辑'} ${artists ? track.artist : track.album}`"
      @click="$emit('select', track)"
    >
      <div
        class="relative aspect-square overflow-hidden shadow-lg"
        :class="artists ? 'rounded-full' : 'rounded-xl'"
      >
        <img
          :src="track.cover"
          :alt="artists ? track.artist : track.album"
          class="size-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        /><span
          class="absolute bottom-2 right-2 grid size-8 translate-y-1 place-items-center rounded-full bg-white text-zinc-950 opacity-0 shadow-lg transition group-focus-visible:translate-y-0 group-focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
          ><AppIcon name="play" :size="15"
        /></span>
      </div>
      <b class="mb-1 mt-3 block truncate text-[11px] font-extrabold">{{
        artists ? track.artist : track.album
      }}</b><span class="block truncate text-[10px] text-muted">{{
        artists ? "音乐人 · ARTIST" : track.artist
      }}</span>
    </BaseButton>
  </div>
</template>
