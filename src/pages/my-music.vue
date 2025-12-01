<script setup lang="ts">
import { useAudioStore } from '@/stores/modules/audio'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import SongList from '@/components/SongList.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { setPlaylist, play, playlist, clearPlaylist } = useAudio()

const state = reactive({
  activeTab: 0,
})

const { activeTab } = toRefs(state)

const audioStore = useAudioStore()
const { audio } = storeToRefs(audioStore)
const recentSongs = computed<StoreSong[]>(() => audio.value?.playHistory || [])

const playAllRecent = () => {
  if (!recentSongs.value.length) return
  const list = recentSongs.value
  setPlaylist(list, 0)
  play(list[0], 0)
}

const playAllQueue = () => {
  if (!playlist.value.length) return
  play(playlist.value[0], 0)
}

const handleClearQueue = () => {
  clearPlaylist()
}

const tabs = computed(() => [
  {
    icon: 'icon-[mdi--playlist-play]',
    label: t('mobile.recent.playlist'),
    count: playlist.value.length,
  },
  {
    icon: 'icon-[mdi--history]',
    label: t('mobile.recent.history'),
    count: recentSongs.value.length,
  },
])
</script>

<template>
  <div class="flex h-full flex-1 flex-col overflow-hidden p-4">
    <div class="mb-5 flex shrink-0 flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1 rounded-xl bg-white/5 p-1 backdrop-blur-sm">
          <button
            v-for="(tab, i) in tabs"
            :key="i"
            class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200"
            :class="
              activeTab === i
                ? 'bg-linear-to-r from-pink-500/80 to-purple-500/80 text-white shadow-sm'
                : 'text-primary/60 hover:text-primary hover:bg-white/10'
            "
            @click="activeTab = i"
          >
            <span :class="tab.icon" class="h-4 w-4" />
            <span>{{ tab.label }}</span>
            <span
              v-if="tab.count > 0"
              class="rounded-full px-1.5 py-0.5 text-xs"
              :class="activeTab === i ? 'bg-white/20' : 'bg-white/10 text-primary/50'"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          v-if="activeTab === 0 && playlist.length > 0"
          @click="handleClearQueue"
          class="text-primary/60 hover:text-primary flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm transition-all hover:bg-white/10"
        >
          <span class="icon-[mdi--delete-outline] h-4 w-4" />
          {{ t('mobile.myMusic.clear') }}
        </button>
        <button
          v-if="activeTab === 0 && playlist.length > 0"
          @click="playAllQueue"
          class="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-pink-500 to-purple-500 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-pink-500/20 transition-all hover:shadow-lg hover:shadow-pink-500/30"
        >
          <span class="icon-[mdi--play] h-4 w-4" />
          {{ t('actions.playAll') }}
        </button>
        <button
          v-if="activeTab === 1 && recentSongs.length > 0"
          @click="playAllRecent"
          class="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-pink-500 to-purple-500 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-pink-500/20 transition-all hover:shadow-lg hover:shadow-pink-500/30"
        >
          <span class="icon-[mdi--play] h-4 w-4" />
          {{ t('actions.playAll') }}
        </button>
      </div>
    </div>

    <div class="relative min-h-0 flex-1 overflow-hidden">
      <Transition name="slide-fade" mode="out-in">
        <div v-if="activeTab === 0" key="playlist" class="h-full overflow-hidden">
          <div v-if="playlist.length === 0" class="flex h-full flex-col items-center justify-center">
            <div class="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-pink-500/15 to-purple-500/15">
              <span class="icon-[mdi--playlist-music] text-primary/30 h-12 w-12" />
            </div>
            <p class="text-primary/60 mb-2 text-sm font-medium">{{ t('mobile.myMusic.emptyTitle') }}</p>
            <p class="text-primary/40 text-xs">{{ t('mobile.myMusic.emptyHint') }}</p>
          </div>
          <SongList
            v-else
            :songs="playlist"
            :show-header="true"
            :show-controls="true"
            context="queue"
          />
        </div>

        <div v-else key="recent" class="h-full overflow-hidden">
          <div v-if="recentSongs.length === 0" class="flex h-full flex-col items-center justify-center">
            <div class="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-pink-500/15 to-purple-500/15">
              <span class="icon-[mdi--history] text-primary/30 h-12 w-12" />
            </div>
            <p class="text-primary/60 mb-2 text-sm font-medium">{{ t('recent.empty') }}</p>
          </div>
          <SongList
            v-else
            :songs="recentSongs"
            :show-header="true"
            :show-controls="true"
            context="queue"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
