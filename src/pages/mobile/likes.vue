<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'

const { playlist } = useAudio()

const likedSongs = computed(() => (playlist.value || []).filter(s => s.liked))
const playSong = (s: any) => {
  const { play } = useAudio()
  play(s, 0)
}
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <template v-if="!likedSongs.length">
      <div class="py-10 text-center text-white/70">暂无喜欢的歌曲</div>
    </template>
    <div v-else class="space-y-3">
      <div v-for="s in likedSongs" :key="s.id" class="glass-card flex items-center gap-3 p-3" @click="playSong(s)">
        <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
          <img v-if="s.cover" :src="s.cover+'?param=200y200'" alt="cover" class="h-full w-full object-cover" />
          <div v-else class="flex h-full w-full items-center justify-center rounded-lg bg-white/10">🎵</div>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-white">{{ s.name }}</p>
          <p class="truncate text-xs text-purple-300">{{ s.artist }}</p>
        </div>
        <span class="icon-[mdi--heart] h-5 w-5 text-red-400"></span>
      </div>
    </div>
  </div>
</template>
