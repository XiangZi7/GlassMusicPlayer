<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'

const {
  currentSong,
  isPlaying,
  isLoading,
  togglePlay,
  next,
  progress,
  formattedCurrentTime,
  formattedDuration,
  setProgress,
  currentTime,
} = useAudio()

const onProgressClick = (event: MouseEvent) => {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const percent = ((event.clientX - rect.left) / rect.width) * 100
  setProgress(Math.max(0, Math.min(100, percent)))
}

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
</script>

<template>
  <div v-if="currentSong" class="fixed right-0 bottom-14 left-0 z-50 pr-3">
    <div class="glass-card flex items-center gap-3 rounded-2xl p-3">
      <div class="w-12 overflow-hidden rounded-lg" @click="$emit('open')">
        <img v-if="currentSong.cover" :src="currentSong.cover + '?param=200y200'" alt="cover" class="h-full w-full object-cover" />
        <div v-else class="flex h-full w-full items-center justify-center rounded-lg bg-white/10">🎵</div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-white">{{ currentSong.name }}</p>
            <p class="truncate text-xs text-white/70">{{ currentSong.artist || '' }}</p>
          </div>
          <div class="min-w-0 flex-1 text-right">
            <p class="truncate text-sm font-medium text-white">
              {{ mergedLines[lyric.idx]?.ori || '' }}
            </p>
            <p class="truncate text-xs text-white/70">
              {{ mergedLines[lyric.idx]?.tran || '' }}
            </p>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <span class="text-[11px] text-white/60">{{ formattedCurrentTime }}</span>
          <div
            @click="onProgressClick"
            class="relative h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20"
          >
            <div
              class="h-full rounded-full bg-linear-to-r from-pink-400 to-purple-500"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
          <span class="text-[11px] text-white/60">{{ formattedDuration }}</span>
        </div>
      </div>
      <button
        class="glass-button flex h-10 w-10 items-center justify-center rounded-full"
        :title="isPlaying ? '暂停' : '播放'"
        @click="togglePlay"
      >
        <span v-if="isLoading" class="icon-[mdi--loading] h-5 w-5 animate-spin text-white"></span>
        <span
          v-else
          :class="isPlaying ? 'icon-[mdi--pause]' : 'icon-[mdi--play]'"
          class="h-5 w-5 text-white"
        ></span>
      </button>
      <button
        class="glass-button ml-1 flex h-10 w-10 items-center justify-center rounded-full"
        title="下一首"
        @click="next"
      >
        <span class="icon-[mdi--skip-next] h-5 w-5 text-white"></span>
      </button>
    </div>
  </div>
</template>
