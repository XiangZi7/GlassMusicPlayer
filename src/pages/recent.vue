<script setup lang="ts">
import { useAudioStore } from '@/stores/modules/audio'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import SongList from '@/components/SongList.vue'
import Button from '@/components/Ui/Button.vue'

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
  <div class="flex flex-1 flex-col overflow-hidden p-4">
    <!-- 头部卡片 -->
    <section class="relative mb-6 shrink-0 overflow-hidden">
      <!-- 背景装饰 -->
      <div class="absolute inset-0 overflow-hidden rounded-3xl">
        <div class="h-full w-full scale-110 accent-gradient opacity-20 blur-3xl"></div>
      </div>
      <div class="absolute inset-0 overflow-hidden">
        <div class="floating-notes">
          <div v-for="i in 6" :key="i" class="note" :style="{ animationDelay: i * 1.2 + 's' }">
            {{ ['🎵', '🎶', '♪', '♫', '🎼', '🎧'][i - 1] }}
          </div>
        </div>
      </div>

      <!-- 内容 -->
      <div class="relative z-10 overflow-hidden rounded-3xl">
        <div class="glass-container p-6 md:p-8">
          <div class="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 class="mb-2 text-3xl font-bold text-primary md:text-4xl">
                {{ $t('recent.title') }}
              </h1>
              <p class="text-sm text-primary/70 md:text-base">{{ $t('recent.subtitle') }}</p>
              <div class="mt-4 flex items-center gap-4 text-primary/60">
                <div class="flex items-center gap-2">
                  <span class="icon-[mdi--music-note] h-5 w-5"></span>
                  <span class="text-sm font-medium">
                    {{ $t('commonUnits.songsShort', { count: recentList.length }) }}
                  </span>
                </div>
                <div v-if="recentList.length > 0" class="flex items-center gap-2">
                  <span class="icon-[mdi--history] h-5 w-5"></span>
                  <span class="text-sm font-medium">{{ $t('recent.playHistory') }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <Button
                variant="solid"
                size="md"
                rounded="full"
                class="px-6 py-3 shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40"
                :disabled="!recentList.length"
                @click="playAll"
              >
                <span class="icon-[mdi--play] mr-2 h-5 w-5"></span>
                {{ $t('actions.playAll') }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 歌曲列表 -->
    <div class="flex-1 overflow-hidden">
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
