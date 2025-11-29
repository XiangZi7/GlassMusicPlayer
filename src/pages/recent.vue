<script setup lang="ts">
import { useAudioStore } from '@/stores/modules/audio'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import SongList from '@/components/SongList.vue'

const audioStore = useAudioStore()
const { audio } = storeToRefs(audioStore)

const { setPlaylist, play } = useAudio()

const recentList = computed(() => audio.value?.playHistory || [])

const playAll = () => {
  if (!recentList.value.length) return
  const list: StoreSong[] = recentList.value
  setPlaylist(list, 0)
  play(list[0], 0)
}
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <section class="relative mb-6 shrink-0 overflow-hidden rounded-2xl">
      <div class="absolute inset-0">
        <div
          class="h-full w-full scale-110 bg-linear-to-br from-purple-500/30 to-pink-500/30 blur-3xl"
        ></div>
      </div>
      <div class="absolute inset-0 overflow-hidden">
        <div class="floating-notes">
          <div v-for="i in 6" :key="i" class="note" :style="{ animationDelay: i * 1.2 + 's' }">
            {{ ['🎵', '🎶', '♪', '♫', '🎼', '🎧'][i - 1] }}
          </div>
        </div>
      </div>
      <div class="relative z-10 p-6 md:p-8">
        <div class="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="mb-2 text-3xl font-bold text-primary md:text-4xl">
              {{ $t('recent.title') }}
            </h1>
            <p class="text-sm text-primary/70 md:text-base">{{ $t('recent.subtitle') }}</p>
            <div class="mt-3 flex items-center gap-4 text-primary/60">
              <div class="flex items-center gap-1">
                <span class="icon-[mdi--music-note] h-4 w-4"></span>
                <span class="text-sm">{{
                  $t('commonUnits.songsShort', { count: recentList.length })
                }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="glass-button flex items-center gap-2 bg-linear-to-r from-pink-500 to-purple-600 px-6 py-3 font-medium text-primary transition-transform hover:scale-105"
              :disabled="!recentList.length"
              @click="playAll"
            >
              <span class="icon-[mdi--play] h-5 w-5"></span>
              {{ $t('actions.playAll') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="flex-1 overflow-hidden px-2">
      <SongList
        :songs="recentList"
        :show-header="true"
        :show-controls="true"
        :empty-message="$t('recent.empty')"
      />
    </div>
  </div>
</template>

<style scoped>
.floating-notes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.note {
  position: absolute;
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.15);
  animation: noteFloat 15s linear infinite;
}

.note:nth-child(1) {
  left: 5%;
  animation-duration: 14s;
}
.note:nth-child(2) {
  left: 20%;
  animation-duration: 16s;
}
.note:nth-child(3) {
  left: 40%;
  animation-duration: 12s;
}
.note:nth-child(4) {
  left: 60%;
  animation-duration: 18s;
}
.note:nth-child(5) {
  left: 75%;
  animation-duration: 13s;
}
.note:nth-child(6) {
  left: 90%;
  animation-duration: 17s;
}

@keyframes noteFloat {
  0% {
    transform: translateY(100%) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) rotate(360deg);
    opacity: 0;
  }
}
</style>
