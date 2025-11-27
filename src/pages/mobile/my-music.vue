<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'

const { playlist, clearPlaylist } = useAudio()

const handleClearQueue = () => {
  clearPlaylist()
}
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <section class="mb-6">
      <div class="p-3">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-primary text-sm font-semibold">{{ $t('mobile.myMusic.playingList') }}</h2>
          <div class="flex items-center gap-2">
            <span class="text-primary/60 text-xs">{{ $t('mobile.myMusic.totalShort', { count: playlist.length }) }}</span>
            <button
              class="glass-button text-primary rounded-md px-3 py-1 text-xs"
              :title="$t('mobile.myMusic.clearOneClick')"
              @click="handleClearQueue"
            >
              {{ $t('mobile.myMusic.clear') }}
            </button>
          </div>
        </div>

        <div v-if="playlist.length === 0" class="py-8 text-center">
          <div class="text-primary/70 mb-2 text-sm">{{ $t('mobile.myMusic.emptyTitle') }}</div>
          <div class="text-primary/60 text-xs">{{ $t('mobile.myMusic.emptyHint') }}</div>
        </div>
        <div v-else>
          <HotSongsMobile :songs="playlist" context="queue" />
        </div>
      </div>
    </section>
  </div>
</template>
