<script setup lang="ts">
import { useAudioStore } from '@/stores/modules/audio'
import { storeToRefs } from 'pinia'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import MobileSongList from '@/components/Mobile/MobileSongList.vue'
import { useI18n } from 'vue-i18n'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectCreative } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-creative'

const creativeEffect = {
  prev: {
    shadow: false,
    translate: ['-20px', 0, 0],
    opacity: 0,
  },
  next: {
    translate: ['20px', 0, 0],
    opacity: 0,
  },
}

const { t } = useI18n()
const { setPlaylist, play, playlist, clearPlaylist } = useAudio()

const state = reactive({
  activeTab: 0,
})

const { activeTab } = toRefs(state)
const swiperInstance = ref<any>(null)

const onSwiper = (swiper: any) => {
  swiperInstance.value = swiper
}

const onSlideChange = (swiper: any) => {
  activeTab.value = swiper.activeIndex
}

watch(activeTab, val => {
  if (swiperInstance.value) {
    swiperInstance.value.slideTo(val)
  }
})

const audioStore = useAudioStore()
const { audio } = storeToRefs(audioStore)
const recentSongs = computed<StoreSong[]>(() => audio.value?.playHistory || [])

const playAllRecent = () => {
  if (!recentSongs.value.length) return
  const list = recentSongs.value
  setPlaylist(list, 0)
  play(list[0], 0)
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
  <div class="flex flex-1 flex-col overflow-hidden">
    <div class="shrink-0 px-4 pb-3">
      <div class="glass-card inline-flex w-full gap-1.5 p-1.5">
        <button
          v-for="(tab, i) in tabs"
          :key="i"
          class="tab-button flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all duration-300"
          :class="activeTab === i ? 'tab-button-active' : ''"
          @click="activeTab = i"
        >
          <span :class="tab.icon" class="h-5 w-5" />
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.count > 0"
            class="tab-count rounded-full px-2 py-0.5 text-xs"
            :class="activeTab === i ? 'tab-count-active' : ''"
          >
            {{ tab.count }}
          </span>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <swiper
        class="h-full w-full"
        :initial-slide="0"
        :modules="[EffectCreative]"
        effect="creative"
        :creative-effect="creativeEffect"
        :speed="300"
        @swiper="onSwiper"
        @slideChange="onSlideChange"
      >
        <!-- Playlist Slide -->
        <swiper-slide>
          <div class="flex h-full w-full flex-col overflow-hidden">
            <div
              v-if="playlist.length > 0"
              class="flex shrink-0 items-center justify-between px-4 py-3"
            >
              <p class="info-text text-xs">
                {{ t('mobile.recent.nowPlaying') }}
              </p>
              <button
                class="clear-button flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all duration-200"
                @click="handleClearQueue"
              >
                <span class="icon-[mdi--delete-outline] h-4 w-4" />
                {{ t('mobile.myMusic.clear') }}
              </button>
            </div>

            <div class="flex-1 overflow-auto px-4 pb-6">
              <div
                v-if="playlist.length === 0"
                class="flex h-full flex-col items-center justify-center py-16 text-center"
              >
                <div class="empty-icon mb-4 flex h-24 w-24 items-center justify-center rounded-full">
                  <span class="icon-[mdi--playlist-music] empty-icon-inner h-12 w-12" />
                </div>
                <p class="empty-title mb-2 text-sm font-medium">
                  {{ t('mobile.myMusic.emptyTitle') }}
                </p>
                <p class="empty-hint text-xs">{{ t('mobile.myMusic.emptyHint') }}</p>
              </div>
              <MobileSongList
                v-else
                :songs="playlist"
                variant="card"
                :show-index="false"
                context="queue"
              />
            </div>
          </div>
        </swiper-slide>

        <!-- History Slide -->
        <swiper-slide>
          <div class="flex h-full w-full flex-col overflow-hidden">
            <div
              v-if="recentSongs.length > 0"
              class="flex shrink-0 items-center justify-between px-4 py-3"
            >
              <p class="info-text text-xs">
                {{ t('mobile.recent.recentlyPlayed') }}
              </p>
              <button
                class="play-all-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-primary shadow-lg transition-all duration-200 active:scale-95"
                @click="playAllRecent"
              >
                <span class="icon-[mdi--play] h-4 w-4" />
                {{ t('actions.playAll') }}
              </button>
            </div>

            <div class="flex-1 overflow-auto px-4 pb-6">
              <div
                v-if="!recentSongs.length"
                class="flex h-full flex-col items-center justify-center py-16 text-center"
              >
                <div class="empty-icon mb-4 flex h-24 w-24 items-center justify-center rounded-full">
                  <span class="icon-[mdi--history] empty-icon-inner h-12 w-12" />
                </div>
                <p class="empty-title mb-2 text-sm font-medium">{{ t('recent.empty') }}</p>
              </div>
              <MobileSongList
                v-else
                :songs="recentSongs"
                variant="compact"
                :show-index="true"
                context="queue"
              />
            </div>
          </div>
        </swiper-slide>
      </swiper>
    </div>
  </div>
</template>

<style scoped>
.tab-button {
  color: var(--glass-text);
  opacity: 0.6;
}

.tab-button-active {
  background: linear-gradient(to right, #ec4899, #8b5cf6);
  color: white;
  opacity: 1;
  box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);
}

.tab-count {
  background: var(--glass-hover-item-bg);
  color: var(--glass-text);
  opacity: 0.7;
}

.tab-count-active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  opacity: 1;
}

.info-text {
  color: var(--glass-text);
  opacity: 0.5;
}

.clear-button {
  background: var(--glass-hover-item-bg);
  color: var(--glass-text);
  opacity: 0.7;
}

.clear-button:active {
  background: var(--glass-bg-button);
  opacity: 1;
}

.play-all-button {
  background: linear-gradient(to right, #ec4899, #8b5cf6);
  box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);
}

.play-all-button:active {
  box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3);
}

.empty-icon {
  background: linear-gradient(to bottom right, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15));
}

:root.dark .empty-icon,
html.dark .empty-icon {
  background: linear-gradient(to bottom right, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
}

.empty-icon-inner {
  color: var(--glass-text);
  opacity: 0.4;
}

.empty-title {
  color: var(--glass-text);
  opacity: 0.7;
}

.empty-hint {
  color: var(--glass-text);
  opacity: 0.4;
}
</style>
