<script setup lang="ts">
import { useAudioStore } from '@/stores/modules/audio'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import SongList from '@/components/SongList.vue'
import TabGroup from '@/components/Ui/TabGroup.vue'
import Button from '@/components/Ui/Button.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { setPlaylist, play, playlist, clearPlaylist } = useAudio()

const state = reactive({
  activeTab: 'playlist' as 'playlist' | 'history',
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
    key: 'playlist',
    icon: 'icon-[mdi--playlist-play]',
    labelKey: 'mobile.recent.playlist',
    count: playlist.value.length,
  },
  {
    key: 'history',
    icon: 'icon-[mdi--history]',
    labelKey: 'mobile.recent.history',
    count: recentSongs.value.length,
  },
])
</script>

<template>
  <div class="flex h-full flex-1 flex-col overflow-hidden p-4">
    <!-- 顶部操作栏 -->
    <div class="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-4">
      <!-- Tab 导航 -->
      <TabGroup v-model="state.activeTab" :tabs="tabs" variant="gradient" size="sm" />

      <!-- 操作按钮 -->
      <div class="flex items-center gap-3">
        <Button
          v-if="activeTab === 'playlist' && playlist.length > 0"
          variant="ghost"
          size="sm"
          rounded="lg"
          class="gap-2"
          @click="handleClearQueue"
        >
          <span class="icon-[mdi--delete-outline] h-4 w-4" />
          {{ t('mobile.myMusic.clear') }}
        </Button>
        <Button
          v-if="activeTab === 'playlist' && playlist.length > 0"
          variant="solid"
          size="sm"
          rounded="lg"
          class="gap-2 shadow-md shadow-pink-500/20 hover:shadow-lg hover:shadow-pink-500/30"
          @click="playAllQueue"
        >
          <span class="icon-[mdi--play] h-4 w-4" />
          {{ t('actions.playAll') }}
        </Button>
        <Button
          v-if="activeTab === 'history' && recentSongs.length > 0"
          variant="solid"
          size="sm"
          rounded="lg"
          class="gap-2 shadow-md shadow-pink-500/20 hover:shadow-lg hover:shadow-pink-500/30"
          @click="playAllRecent"
        >
          <span class="icon-[mdi--play] h-4 w-4" />
          {{ t('actions.playAll') }}
        </Button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="relative min-h-0 flex-1 overflow-hidden">
      <Transition name="slide-fade" mode="out-in">
        <!-- 播放列表 -->
        <div v-if="activeTab === 'playlist'" key="playlist" class="h-full overflow-hidden">
          <div v-if="playlist.length === 0" class="flex h-full flex-col items-center justify-center">
            <div class="mb-6 rounded-full glass-card p-8">
              <span class="icon-[mdi--playlist-music] text-primary/20 h-16 w-16" />
            </div>
            <p class="text-primary/60 mb-2 text-base font-semibold">{{ t('mobile.myMusic.emptyTitle') }}</p>
            <p class="text-primary/40 text-sm">{{ t('mobile.myMusic.emptyHint') }}</p>
          </div>
          <SongList
            v-else
            :songs="playlist"
            :show-header="true"
            :show-controls="true"
            context="queue"
          />
        </div>

        <!-- 历史记录 -->
        <div v-else key="history" class="h-full overflow-hidden">
          <div v-if="recentSongs.length === 0" class="flex h-full flex-col items-center justify-center">
            <div class="mb-6 rounded-full glass-card p-8">
              <span class="icon-[mdi--history] text-primary/20 h-16 w-16" />
            </div>
            <p class="text-primary/60 mb-2 text-base font-semibold">{{ t('recent.empty') }}</p>
            <p class="text-primary/40 text-sm">{{ t('mobile.myMusic.emptyHint') }}</p>
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
