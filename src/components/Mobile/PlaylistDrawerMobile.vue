<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectCreative } from 'swiper/modules'
import MobileDrawer from './MobileDrawer.vue'
import Button from '@/components/Ui/Button.vue'
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
const {
  playlist,
  playHistory,
  currentSong,
  playMode,
  togglePlayMode,
  play,
  removeSong,
  clearPlaylist,
  clearHistory,
  addSong,
} = useAudio()

// 当前激活的标签页：'playlist' (播放列表) 或 'history' (历史记录)
const activeTab = ref<'playlist' | 'history'>('playlist')
const swiperInstance = ref<any>(null)

const isDrawerOpen = ref(false)

// 保存 Swiper 实例
const onSwiper = (swiper: any) => {
  swiperInstance.value = swiper
}

// 滑动切换时同步 activeTab
const onSlideChange = (swiper: any) => {
  activeTab.value = swiper.activeIndex === 0 ? 'playlist' : 'history'
}

// activeTab 变化时同步 Swiper 滑动
watch(activeTab, val => {
  if (!swiperInstance.value) return
  if (val === 'playlist') {
    swiperInstance.value.slideTo(0)
  } else {
    swiperInstance.value.slideTo(1)
  }
})

// 计算播放模式图标
const playModeIcon = computed(() => {
  switch (playMode.value) {
    case 'single':
      return 'icon-[mdi--repeat-once]'
    case 'random':
      return 'icon-[mdi--shuffle]'
    default:
      return 'icon-[mdi--repeat]'
  }
})

// 从播放列表播放歌曲
const handlePlay = (song: any, index: number) => {
  play(song, index)
}

// 从历史记录播放歌曲
const handleHistoryPlay = (song: any) => {
  // 确保歌曲在播放列表中
  addSong(song)
  // 查找歌曲在播放列表中的索引
  const index = playlist.value.findIndex(s => s.id === song.id)
  if (index !== -1) {
    play(song, index)
  }
}

// 清空当前列表（播放列表或历史记录）
const handleClear = () => {
  if (activeTab.value === 'playlist') {
    clearPlaylist()
  } else {
    clearHistory()
  }
}
</script>

<template>
  <div class="relative flex items-center justify-center">
    <!-- 切换按钮 -->
    <Button
      variant="ghost"
      size="none"
      class="group p-2"
      icon="icon-[mdi--playlist-music-outline]"
      icon-class="text-primary/70 group-hover:text-primary h-7 w-7 transition-colors"
      @click.stop="isDrawerOpen = true"
    />

    <!-- 播放列表抽屉 -->
    <MobileDrawer v-model:show="isDrawerOpen">
      <template #header>
        <div class="flex items-center justify-between border-b border-white/5 px-4 pb-3">
          <!-- 标签页 -->
          <div class="flex items-center gap-4">
            <button
              class="text-base font-bold transition-colors"
              :class="activeTab === 'playlist' ? 'text-primary' : 'text-primary/40'"
              @click="activeTab = 'playlist'"
            >
              {{ t('player.playlist') }}
            </button>
            <button
              class="text-base font-bold transition-colors"
              :class="activeTab === 'history' ? 'text-primary' : 'text-primary/40'"
              @click="activeTab = 'history'"
            >
              {{ t('player.history') }}
            </button>
          </div>

          <div class="flex items-center gap-3">
            <!-- 仅在播放列表标签页显示播放模式切换 -->
            <div
              v-if="activeTab === 'playlist'"
              class="flex items-center gap-2"
              @click="togglePlayMode"
            >
              <span :class="playModeIcon" class="text-primary/60 h-5 w-5"></span>
            </div>
            <Button
              variant="ghost"
              size="none"
              class="text-primary/60 hover:text-primary flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-white/5"
              icon="mdi--trash-can-outline"
              icon-class="h-4 w-4"
              @click="handleClear"
            />
          </div>
        </div>
      </template>

      <!-- 歌曲列表和历史记录（使用 Swiper） -->
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
          <!-- 播放列表幻灯片 -->
          <swiper-slide>
            <div v-if="playlist.length > 0" class="h-full w-full overflow-y-auto px-2 py-2">
              <div
                v-for="(song, index) in playlist"
                :key="song.id"
                class="group mb-1 flex items-center justify-between rounded-xl px-3 py-2 transition-all active:scale-[0.99] active:bg-white/5"
                :class="{ 'bg-white/10': currentSong?.id === song.id }"
                @click="handlePlay(song, index)"
              >
                <div class="flex flex-1 items-center gap-3 overflow-hidden">
                  <span
                    v-if="currentSong?.id === song.id"
                    class="icon-[mdi--poll] h-4 w-4 text-pink-500"
                  ></span>
                  <span v-else class="text-primary/40 w-4 text-center text-xs">{{
                    index + 1
                  }}</span>

                  <div class="flex flex-col overflow-hidden">
                    <span
                      class="truncate text-sm font-medium"
                      :class="currentSong?.id === song.id ? 'text-pink-500' : 'text-primary'"
                    >
                      {{ song.name }}
                    </span>
                    <span
                      class="truncate text-xs"
                      :class="
                        currentSong?.id === song.id ? 'text-pink-400/70' : 'text-primary/50'
                      "
                    >
                      {{ song.artist }}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="none"
                  class="ml-2 p-2 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 active:opacity-100"
                  icon="mdi--close"
                  icon-class="text-primary/40 hover:text-primary h-4 w-4"
                  @click.stop="removeSong(song.id)"
                />
              </div>
            </div>
            <div
              v-else
              class="text-primary/40 flex h-full w-full flex-col items-center justify-center"
            >
              <span class="icon-[mdi--music-note-off] mb-2 h-10 w-10"></span>
              <p class="text-sm">{{ t('common.noData') }}</p>
            </div>
          </swiper-slide>

          <!-- 历史记录幻灯片 -->
          <swiper-slide>
            <div v-if="playHistory.length > 0" class="h-full w-full overflow-y-auto px-2 py-2">
              <div
                v-for="song in playHistory"
                :key="song.id"
                class="group mb-1 flex items-center justify-between rounded-xl px-3 py-2 transition-all active:scale-[0.99] active:bg-white/5"
                :class="{ 'bg-white/10': currentSong?.id === song.id }"
                @click="handleHistoryPlay(song)"
              >
                <div class="flex flex-1 items-center gap-3 overflow-hidden">
                  <!-- 历史记录不显示索引，显示图标 -->
                  <span class="icon-[mdi--history] text-primary/40 h-4 w-4"></span>

                  <div class="flex flex-col overflow-hidden">
                    <span
                      class="truncate text-sm font-medium"
                      :class="currentSong?.id === song.id ? 'text-pink-500' : 'text-primary'"
                    >
                      {{ song.name }}
                    </span>
                    <span
                      class="truncate text-xs"
                      :class="
                        currentSong?.id === song.id ? 'text-pink-400/70' : 'text-primary/50'
                      "
                    >
                      {{ song.artist }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-else
              class="text-primary/40 flex h-full w-full flex-col items-center justify-center"
            >
              <span class="icon-[mdi--history] mb-2 h-10 w-10"></span>
              <p class="text-sm">{{ t('common.noData') }}</p>
            </div>
          </swiper-slide>
        </swiper>
      </div>
    </MobileDrawer>
  </div>
</template>

<style scoped>
/* Custom Scrollbar for the list */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
