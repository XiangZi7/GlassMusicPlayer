<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { useSettingsStore } from '@/stores/modules/settings'
import { storeToRefs } from 'pinia'
import MusicProgress from '@/components/Ui/MusicProgress.vue'
import Button from '@/components/Ui/Button.vue'

const settingsStore = useSettingsStore()

const { footerLyrics } = storeToRefs(settingsStore)
const {
  currentSong,
  isPlaying,
  isLoading,
  togglePlay,
  next,
  formattedCurrentTime,
  formattedDuration,
  currentTime,
} = useAudio()

const { mergedLines, activeTimeline, fetchLyrics } = useLyrics()

const lyric = reactive({ idx: 0 })
const updateLyricIdx = () => {
  const times = activeTimeline.value
  if (!times.length) {
    lyric.idx = 0
    return
  }
  const t = currentTime.value
  let i = times.findIndex((time, k) => {
    const next = times[k + 1]
    return t >= time && (next === undefined || t < next)
  })
  if (i === -1) {
    if (t < times[0]) i = 0
    else if (t >= times[times.length - 1]) i = times.length - 1
    else i = times.findIndex(time => time > t)
  }
  if (i !== -1) lyric.idx = i
}

watch(
  () => currentSong.value?.id,
  id => fetchLyrics(id as any, true)
)
watch(() => currentTime.value, updateLyricIdx)

const rootRef = useTemplateRef('rootRef')
let ro: ResizeObserver | null = null
const updateMiniplayerHeight = () => {
  const h = rootRef.value?.offsetHeight ?? 0
  document.documentElement.style.setProperty('--mobile-miniplayer-h', `${h}px`)
}
onMounted(() => {
  updateMiniplayerHeight()
  if (rootRef.value) {
    ro = new ResizeObserver(updateMiniplayerHeight)
    ro.observe(rootRef.value)
  }
})
onUnmounted(() => {
  ro?.disconnect()
  ro = null
  document.documentElement.style.setProperty('--mobile-miniplayer-h', '0px')
})
</script>

<template>
  <div
    v-if="currentSong"
    ref="rootRef"
    class="mask-glass fixed right-0 bottom-15 left-0 z-50 backdrop-blur-md"
  >
    <div class="glass-card flex items-center gap-3 rounded-t-2xl rounded-tl-2xl rounded-b-none p-3">
      <div class="w-12 overflow-hidden rounded-lg" @click="$emit('open')">
        <img
          v-if="currentSong.cover"
          :src="currentSong.cover + '?param=200y200'"
          alt="cover"
          class="h-full w-full object-cover"
        />
        <div v-else class="glass-button flex h-full w-full items-center justify-center rounded-lg">
          🎵
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-3">
          <div class="min-w-0">
            <p class="text-primary truncate text-sm font-medium">{{ currentSong.name }}</p>
            <p class="text-primary/70 truncate text-xs">{{ currentSong.artist || '' }}</p>
          </div>
          <div v-if="footerLyrics.enabled" class="min-w-0 flex-1 text-right">
            <p
              v-if="footerLyrics.modes.includes('original')"
              class="text-primary truncate text-sm font-medium"
            >
              {{ mergedLines[lyric.idx]?.ori || '' }}
            </p>
            <p v-if="footerLyrics.modes.includes('trans')" class="text-primary/70 truncate text-xs">
              {{ mergedLines[lyric.idx]?.tran || '' }}
            </p>
            <p v-if="footerLyrics.modes.includes('roma')" class="text-primary/70 truncate text-xs">
              {{ mergedLines[lyric.idx]?.roma || '' }}
            </p>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <span class="text-primary/60 text-[11px]">{{ formattedCurrentTime }}</span>
          <MusicProgress class="flex-1" />
          <span class="text-primary/60 text-[11px]">{{ formattedDuration }}</span>
        </div>
      </div>
      <Button
        size="icon-lg"
        rounded="full"
        :icon="isPlaying ? 'mdi--pause' : 'mdi--play'"
        :loading="isLoading"
        icon-class="h-5 w-5"
        :title="isPlaying ? $t('player.pause') : $t('player.play')"
        @click="togglePlay"
      />
      <Button
        size="icon-lg"
        rounded="full"
        icon="mdi--skip-next"
        icon-class="h-5 w-5"
        class="ml-1"
        :title="$t('playlistBubble.actions.queueNext')"
        @click="next"
      />
    </div>
  </div>
</template>
