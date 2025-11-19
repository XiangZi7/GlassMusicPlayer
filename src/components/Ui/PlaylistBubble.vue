<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { formatDuration } from '@/utils/time'

const { playlist, playByIndex } = useAudio()
</script>
<template>
  <div
    class="absolute right-0 bottom-10 z-20 w-72 rounded-2xl bg-black/60 p-3 shadow-xl backdrop-blur"
  >
    <div class="relative">
      <div class="absolute right-5 -bottom-2 h-3 w-3 rotate-45 rounded-sm bg-black/70"></div>
    </div>
    <h4 class="mb-2 text-sm font-medium text-white/80">播放列表</h4>
    <div class="max-h-64 space-y-2 overflow-auto">
      <div
        v-for="(s, i) in playlist"
        :key="s.id || i"
        class="flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/10"
        @click="playByIndex(i)"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div class="h-10 w-10 shrink-0 overflow-hidden rounded-md">
            <img
              v-if="s.cover"
              :src="s.cover + '?param=100y100'"
              alt="cover"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center rounded-md bg-linear-to-br from-pink-400 to-purple-500"
            >
              <span class="icon-[mdi--music] h-5 w-5 text-white"></span>
            </div>
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm text-white">{{ s.name }}</p>
            <p class="truncate text-xs text-purple-300">{{ s.artist }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-white/60">{{ formatDuration(s.duration) }}</span>
          <span class="icon-[mdi--play] h-4 w-4 text-white/70"></span>
        </div>
      </div>
    </div>
  </div>
</template>
