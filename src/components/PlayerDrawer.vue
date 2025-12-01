<script setup lang="ts">
import { gsap } from 'gsap'
import { useAudio } from '@/composables/useAudio'
import { useLyrics } from '@/composables/useLyrics'
import { commentMusic } from '@/api'
import SongCommentsDialog from '@/components/Comments/SongCommentsDialog.vue'
import { useNow, useOnline, useBattery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useGlobalStore } from '@/stores/modules/global'

const { t } = useI18n()
const globalStore = useGlobalStore()

const themeIcon = computed(() => {
  switch (globalStore.theme) {
    case 'light':
      return 'icon-[mdi--white-balance-sunny]'
    case 'dark':
      return 'icon-[mdi--moon-waning-crescent]'
    default:
      return 'icon-[mdi--theme-light-dark]'
  }
})

const cycleTheme = () => {
  const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const idx = order.indexOf(globalStore.theme)
  globalStore.setTheme(order[(idx + 1) % 3])
}
const isOpen = defineModel<boolean>()

const state = reactive({
  isRendered: false,
  currentLyricIndex: 0,
  lyricsOffset: 0,
  isRecentOpen: false,
  isCommentsOpen: false,
  commentCount: 0,
  useCoverBg: true,
  bgActive: 'A' as 'A' | 'B',
  bgAUrl: '' as string,
  bgBUrl: '' as string,
  lyricsPositioned: false,
  autoScroll: true,
  lyricsScale: 1,
  isDragging: false,
  dragProgress: null as number | null,
})

const {
  isRendered,
  useCoverBg,
  bgAUrl,
  bgBUrl,
  currentLyricIndex,
  isRecentOpen,
  isCommentsOpen,
  commentCount,
} = toRefs(state)

const {
  currentSong,
  isPlaying,
  isLoading,
  volume,
  currentTime,
  progress,
  playMode,
  togglePlay,
  next,
  previous,
  setVolume,
  toggleMute,
  setProgress,
  setCurrentTime,
  formattedCurrentTime,
  formattedDuration,
  togglePlayMode,
} = useAudio()

const playModeIconClass = computed(() => {
  switch (playMode.value) {
    case 'single':
      return 'icon-[mdi--repeat-once]'
    case 'random':
      return 'icon-[mdi--shuffle]'
    case 'list':
    default:
      return 'icon-[mdi--repeat]'
  }
})

const drawerRef = useTemplateRef('drawerRef')
const albumCoverRef = useTemplateRef('albumCoverRef')
const lyricsRef = useTemplateRef('lyricsRef')
const bgARef = useTemplateRef('bgARef')
const bgBRef = useTemplateRef('bgBRef')
const progressBarRef = useTemplateRef('progressBarRef')

const now = useNow()
const online = useOnline()
const timeText = computed(() =>
  new Date(now.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
)
const battery = useBattery()
const batteryPct = computed(() =>
  typeof battery.level?.value === 'number' ? Math.round(battery.level.value * 100) : null
)
const batteryIcon = computed(() =>
  battery.charging?.value ? 'icon-[mdi--battery-charging]' : 'icon-[mdi--battery]'
)

const {
  lyricsTrans,
  lyricsRoma,
  showTrans,
  showRoma,
  activeSingleLyrics,
  activeTimeline,
  timeForIndex,
  fetchLyrics,
} = useLyrics()

const toggleTransBtn = async () => {
  showTrans.value = !showTrans.value
  await nextTick()
  state.lyricsPositioned = false
  updateCurrentLyric(true)
}

const toggleRomaBtn = async () => {
  showRoma.value = !showRoma.value
  await nextTick()
  state.lyricsPositioned = false
  updateCurrentLyric(true)
}

const toggleAutoScroll = () => {
  state.autoScroll = !state.autoScroll
  if (state.autoScroll) updateCurrentLyric(true)
}

const handleTogglePlay = () => {
  togglePlay()
}

const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newVolume = parseInt(target.value) / 100
  setVolume(newVolume)
}

const handleProgressClick = (event: MouseEvent) => {
  if (!progressBarRef.value) return
  const rect = progressBarRef.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newProgress = (clickX / rect.width) * 100
  setProgress(Math.max(0, Math.min(100, newProgress)))
  updateCurrentLyric()
}

const handleProgressDrag = (event: MouseEvent) => {
  if (!state.isDragging || !progressBarRef.value) return
  event.preventDefault()
  const rect = progressBarRef.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newProgress = (clickX / rect.width) * 100
  state.dragProgress = Math.max(0, Math.min(100, newProgress))
}

const startDrag = (event: MouseEvent) => {
  event.preventDefault()
  state.isDragging = true
  state.dragProgress = progress.value
  document.addEventListener('mousemove', handleProgressDrag)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.userSelect = 'none'
}

const stopDrag = () => {
  if (state.isDragging && state.dragProgress !== null) {
    setProgress(state.dragProgress)
    updateCurrentLyric()
  }
  state.isDragging = false
  state.dragProgress = null
  document.removeEventListener('mousemove', handleProgressDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.userSelect = ''
}

const displayProgress = computed(() => {
  return state.isDragging && state.dragProgress !== null ? state.dragProgress : progress.value
})

const seekToLyric = (index: number) => {
  const targetTime = timeForIndex(index) ?? 0
  setCurrentTime(targetTime)
  state.currentLyricIndex = index
  scrollToCurrentLyric()
}

let albumRotationTween: gsap.core.Tween | null = null

const startAlbumRotation = () => {
  if (albumCoverRef.value) {
    albumRotationTween = gsap.to(albumCoverRef.value, {
      rotation: 360,
      duration: 10,
      repeat: -1,
      ease: 'none',
    })
  }
}

const stopAlbumRotation = () => {
  if (albumRotationTween) {
    albumRotationTween.kill()
    albumRotationTween = null
  }
}

const loadCommentCount = async (songId?: number | string) => {
  if (!songId) {
    state.commentCount = 0
    return
  }
  try {
    const res: any = await commentMusic({ id: Number(songId), limit: 1, offset: 0 })
    state.commentCount = Number(res?.data?.total ?? res?.total ?? res?.totalCount ?? 0)
  } catch {
    state.commentCount = 0
  }
}

watch(
  () => currentSong.value?.id,
  id => {
    loadCommentCount(id as any)
  },
  { immediate: true }
)

const updateCurrentLyric = (instant = false) => {
  const adjustedTime = currentTime.value + state.lyricsOffset
  const times = activeTimeline.value
  if (!times.length) return
  let idx = times.findIndex((t, i) => {
    const nextT = times[i + 1]
    return adjustedTime >= t && (nextT === undefined || adjustedTime < nextT)
  })
  if (idx === -1) {
    if (adjustedTime < times[0]) idx = 0
    else if (adjustedTime >= times[times.length - 1]) idx = times.length - 1
    else idx = times.findIndex(t => t > adjustedTime)
  }
  if (idx !== -1 && idx !== state.currentLyricIndex) {
    state.currentLyricIndex = idx
    if (state.autoScroll) scrollToCurrentLyric(instant)
  } else if (!state.lyricsPositioned) {
    if (state.autoScroll) scrollToCurrentLyric(instant)
  }
}

const scrollToCurrentLyric = (instant = false) => {
  if (lyricsRef.value && state.currentLyricIndex >= 0) {
    const lyricsContainer = lyricsRef.value
    const currentLyricElement = lyricsContainer.children[state.currentLyricIndex] as HTMLElement

    if (currentLyricElement) {
      const containerHeight = lyricsContainer.parentElement?.clientHeight || 0
      const targetScrollTop =
        currentLyricElement.offsetTop - containerHeight / 2 + currentLyricElement.clientHeight / 2
      if (instant || !state.lyricsPositioned) {
        gsap.set(lyricsContainer, { y: -targetScrollTop })
        state.lyricsPositioned = true
      } else {
        gsap.to(lyricsContainer, {
          y: -targetScrollTop,
          duration: 0.8,
          ease: 'power2.out',
        })
      }
    }
  }
}

const setBackground = (url?: string) => {
  if (!state.useCoverBg || !url) return
  if (state.bgAUrl === '' && state.bgBUrl === '') {
    state.bgAUrl = url
    if (bgARef.value) {
      gsap.set(bgARef.value, { opacity: 0, scale: 1.6 })
      gsap.to(bgARef.value, {
        opacity: 0.55,
        scale: 1.5,
        duration: 1.2,
        ease: 'power2.out',
      })
    }
    state.bgActive = 'A'
    return
  }

  const incomingRef = state.bgActive === 'A' ? bgBRef : bgARef
  const outgoingRef = state.bgActive === 'A' ? bgARef : bgBRef

  if (state.bgActive === 'A') {
    state.bgBUrl = url
  } else {
    state.bgAUrl = url
  }

  if (incomingRef.value) {
    gsap.set(incomingRef.value, { opacity: 0, scale: 1.6 })
    gsap.to(incomingRef.value, {
      opacity: 0.55,
      scale: 1.5,
      duration: 1.4,
      ease: 'power2.inOut',
    })
  }
  if (outgoingRef.value) {
    gsap.to(outgoingRef.value, {
      opacity: 0,
      scale: 1.45,
      duration: 1.4,
      ease: 'power2.inOut',
    })
  }

  state.bgActive = state.bgActive === 'A' ? 'B' : 'A'
}

const openDrawer = () => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value, { display: 'flex' })

    const tl = gsap.timeline()
    tl.fromTo(
      drawerRef.value,
      { y: '-100%', opacity: 0 },
      { y: '0%', opacity: 1, duration: 0.6, ease: 'power3.out' }
    )
      .fromTo(
        '.album-cover',
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
        '-=0.3'
      )
      .fromTo(
        '.song-info',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
        '-=0.2'
      )
      .fromTo(
        '.lyric-line',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power2.out' },
        '-=0.2'
      )
  }
}

const closeDrawer = () => {
  if (drawerRef.value) {
    const tl = gsap.timeline({
      onComplete: () => {
        state.isRendered = false
      },
    })

    tl.to(drawerRef.value, {
      y: '-100%',
      opacity: 0,
      duration: 0.4,
      ease: 'power3.in',
    })

    stopAlbumRotation()
  }
}

watch(
  () => isOpen.value,
  async newVal => {
    if (newVal) {
      state.isRendered = true
      await nextTick()
      openDrawer()
      state.lyricsPositioned = false
      updateCurrentLyric(true)
      setBackground(currentSong.value?.cover)
      isPlaying.value ? startAlbumRotation() : stopAlbumRotation()
    } else {
      closeDrawer()
      isPlaying.value ? startAlbumRotation() : stopAlbumRotation()
    }
  }
)

watch(
  isPlaying,
  playing => {
    playing ? startAlbumRotation() : stopAlbumRotation()
  },
  { immediate: true }
)

watch(currentTime, () => {
  updateCurrentLyric()
})

watch(
  currentSong,
  async s => {
    await fetchLyrics(s?.id)
    state.currentLyricIndex = 0
    state.lyricsPositioned = false
    await nextTick()
    updateCurrentLyric(true)
    setBackground(s?.cover)
  },
  { immediate: true }
)

onMounted(() => {
  if (drawerRef.value) {
    gsap.set(drawerRef.value as any, { display: 'none' })
  }
})

onUnmounted(() => {
  stopAlbumRotation()
})
</script>

<template>
  <div
    v-if="isRendered"
    ref="drawerRef"
    class="bg-overlay/95 absolute inset-0 z-50 flex backdrop-blur-md backdrop-filter"
  >
    <div v-show="useCoverBg" class="absolute inset-0 -z-10 overflow-hidden">
      <div
        ref="bgARef"
        class="bg-layer absolute inset-0 bg-cover bg-center opacity-0"
        :style="bgAUrl ? { backgroundImage: `url(${bgAUrl})` } : {}"
      ></div>
      <div
        ref="bgBRef"
        class="bg-layer absolute inset-0 bg-cover bg-center opacity-0"
        :style="bgBUrl ? { backgroundImage: `url(${bgBUrl})` } : {}"
      ></div>
      <div class="bg-overlay/30 absolute inset-0"></div>
    </div>

    <div class="absolute top-0 right-0 left-0 z-10 flex items-center justify-between p-4 lg:p-6">
      <div class="flex items-center gap-3">
        <div class="glass-toolbar flex items-center gap-1 rounded-2xl p-1.5">
          <button
            class="toolbar-btn"
            :title="t('player.fontDec')"
            @click="state.lyricsScale = Math.max(0.8, state.lyricsScale - 0.05)"
          >
            <span class="icon-[mdi--format-font-size-decrease] h-4 w-4"></span>
          </button>
          <button
            class="toolbar-btn"
            :title="t('player.fontInc')"
            @click="state.lyricsScale = Math.min(1.4, state.lyricsScale + 0.05)"
          >
            <span class="icon-[mdi--format-font-size-increase] h-4 w-4"></span>
          </button>
          <div class="mx-1 h-4 w-px bg-white/10"></div>
          <button
            class="toolbar-btn"
            :class="state.autoScroll ? 'active' : ''"
            :title="t('player.autoCenter')"
            @click="toggleAutoScroll"
          >
            <span
              :class="state.autoScroll ? 'icon-[mdi--autorenew]' : 'icon-[mdi--pause]'"
              class="h-4 w-4"
            ></span>
          </button>
        </div>

        <div class="glass-toolbar hidden items-center gap-3 rounded-2xl px-4 py-2 sm:flex">
          <span class="text-primary/80 text-sm font-medium">{{ timeText }}</span>
          <div class="h-3 w-px bg-white/10"></div>
          <span class="flex items-center gap-1.5 text-sm">
            <span
              :class="
                online ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-red-400 shadow-red-400/50'
              "
              class="inline-block h-2 w-2 rounded-full shadow-lg"
            ></span>
            <span class="text-primary/70">{{
              online ? t('player.online') : t('player.offline')
            }}</span>
          </span>
          <template v-if="battery.isSupported">
            <div class="h-3 w-px bg-white/10"></div>
            <span class="text-primary/70 flex items-center gap-1.5 text-sm">
              <span :class="batteryIcon" class="h-4 w-4"></span>
              {{ batteryPct !== null ? batteryPct + '%' : 'N/A' }}
            </span>
          </template>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div
          v-if="lyricsTrans.length || lyricsRoma.length"
          class="glass-toolbar hidden items-center gap-2 rounded-2xl p-1.5 lg:flex"
        >
          <button
            v-if="lyricsTrans.length"
            class="toolbar-btn-text"
            :class="showTrans ? 'active' : ''"
            @click="toggleTransBtn"
          >
            <span class="icon-[mdi--translate] h-4 w-4"></span>
            <span>{{ t('player.translate') }}</span>
          </button>
          <button
            v-if="lyricsRoma.length"
            class="toolbar-btn-text"
            :class="showRoma ? 'active' : ''"
            @click="toggleRomaBtn"
          >
            <span class="icon-[mdi--alphabetical-variant] h-4 w-4"></span>
            <span>{{ t('player.roma') }}</span>
          </button>
        </div>

        <button
          class="action-btn"
          :class="!state.useCoverBg ? 'active' : ''"
          @click="state.useCoverBg = !state.useCoverBg"
          :title="t('player.toggleBg')"
        >
          <span
            :class="[
              state.useCoverBg
                ? 'icon-[mdi--image-multiple-outline]'
                : 'icon-[mdi--palette-swatch]',
              'h-5 w-5',
            ]"
          ></span>
        </button>

        <button class="action-btn" @click="cycleTheme" :title="t('components.settings.themeMode')">
          <span :class="[themeIcon, 'h-5 w-5']"></span>
        </button>

        <button @click="isOpen = false" class="action-btn close-btn">
          <span class="icon-[mdi--chevron-down] h-6 w-6"></span>
        </button>
      </div>
    </div>

    <div
      class="player-left-panel flex w-full flex-col items-center justify-center px-4 pt-20 pb-8 lg:w-1/2 lg:px-8 lg:pt-24 lg:pb-12"
    >
      <div class="mb-4 flex flex-col items-center lg:mb-6">
        <div
          class="album-wrapper relative mb-4 h-56 w-56 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:mb-6 lg:h-80 lg:w-80"
        >
          <div
            ref="albumCoverRef"
            class="album-cover vinyl-disc relative h-full w-full overflow-hidden rounded-full shadow-2xl"
          >
            <div
              class="vinyl-label absolute top-1/2 left-1/2 flex h-1/2 w-1/2 -translate-1/2 items-center justify-center rounded-full bg-cover text-center"
              :style="{
                backgroundImage: currentSong?.cover
                  ? `url(${currentSong.cover})`
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }"
            ></div>
            <div
              class="spindle absolute top-1/2 left-1/2 h-4 w-4 -translate-1/2 rounded-full"
            ></div>
          </div>

          <div
            class="tonearm absolute -top-12 -right-16 z-10 origin-top-left transition-transform duration-500 ease-out lg:-top-14 lg:-right-18"
            :class="isPlaying ? 'rotate-16' : 'rotate-[-28deg]'"
          >
            <div class="arm-pivot relative h-10 w-10 rounded-full shadow-xl lg:h-12 lg:w-12"></div>
            <div class="arm-shaft mt-[-2px] h-36 w-2.5 rounded-full lg:h-40 lg:w-3"></div>
            <div
              class="counterweight -mt-3 ml-1.5 h-6 w-6 rounded-full shadow-md lg:h-7 lg:w-7"
            ></div>
            <div class="headshell relative mt-1 h-8 w-14 rounded-md shadow-md lg:h-10 lg:w-16">
              <div
                class="cartridge absolute top-1/2 left-1/2 h-4 w-8 -translate-x-1/2 -translate-y-1/2 rounded-sm lg:h-5 lg:w-10"
              ></div>
              <div
                class="stylus absolute top-full left-1/2 h-4 w-[2px] -translate-x-1/2 lg:h-5"
              ></div>
            </div>
          </div>
        </div>

        <div class="song-info text-center">
          <h2 class="text-primary mb-1 line-clamp-1 text-xl font-bold sm:text-2xl lg:text-3xl">
            {{ currentSong?.name || t('player.unknownSong') }}
          </h2>
          <p class="text-primary/70 text-sm sm:text-base lg:text-lg">
            {{ currentSong?.artist || t('player.unknownArtist') }}
          </p>
          <p class="text-primary/50 mt-0.5 text-xs sm:text-sm">
            {{ currentSong?.album || t('player.unknownAlbum') }}
          </p>
        </div>
      </div>

      <div v-if="currentSong" class="mb-4 w-full max-w-md px-4">
        <div
          ref="progressBarRef"
          @click="handleProgressClick"
          class="progress-wrapper group relative h-6 cursor-pointer"
          @mousedown="startDrag"
        >
          <div
            class="progress-track absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full transition-all group-hover:h-1.5"
            :class="state.isDragging ? 'h-1.5' : ''"
          >
            <div
              class="progress-fill absolute inset-y-0 left-0 rounded-full"
              :style="{ width: `${displayProgress}%` }"
            ></div>
          </div>
          <div
            class="progress-thumb absolute top-1/2"
            :class="state.isDragging ? 'active' : ''"
            :style="{ left: `${displayProgress}%` }"
          ></div>
        </div>
        <div class="mt-1 flex justify-between">
          <span class="text-primary/50 text-xs">{{
            isLoading ? t('player.loading') : formattedCurrentTime
          }}</span>
          <span class="text-primary/50 text-xs">{{ formattedDuration }}</span>
        </div>
      </div>

      <div class="mb-4 flex items-center gap-3 sm:gap-4 lg:mb-6">
        <button
          @click="togglePlayMode"
          class="control-btn small"
          :class="{ active: playMode !== 'list' }"
        >
          <component :is="'span'" :class="playModeIconClass" class="h-5 w-5" />
        </button>

        <button @click="previous" class="control-btn">
          <span class="icon-[mdi--skip-previous] h-6 w-6"></span>
        </button>

        <button
          @click="handleTogglePlay"
          :disabled="isLoading"
          class="play-btn"
          :class="isLoading ? 'loading' : ''"
        >
          <span v-if="isLoading" class="icon-[mdi--loading] h-8 w-8 animate-spin"></span>
          <span v-else-if="!isPlaying" class="icon-[mdi--play] ml-1 h-8 w-8"></span>
          <span v-else class="icon-[mdi--pause] h-8 w-8"></span>
        </button>

        <button @click="next" class="control-btn">
          <span class="icon-[mdi--skip-next] h-6 w-6"></span>
        </button>

        <PlaylistBubble
          v-model:show="isRecentOpen"
          placement="top-left"
          :offset-x="8"
          :offset-y="10"
        >
          <template #trigger>
            <button class="control-btn small">
              <span class="icon-[mdi--playlist-music] h-5 w-5"></span>
            </button>
          </template>
        </PlaylistBubble>
      </div>

      <div class="flex w-full max-w-sm items-center justify-between px-4">
        <button class="comment-btn" @click="isCommentsOpen = true">
          <span class="icon-[mdi--comment-outline] h-5 w-5"></span>
          <span>{{ commentCount }}</span>
        </button>

        <div class="volume-control flex items-center gap-2">
          <button @click="toggleMute" class="volume-btn">
            <span v-if="volume === 0" class="icon-[mdi--volume-off] h-5 w-5"></span>
            <span v-else-if="volume < 0.5" class="icon-[mdi--volume-medium] h-5 w-5"></span>
            <span v-else class="icon-[mdi--volume-high] h-5 w-5"></span>
          </button>
          <div class="volume-slider-wrapper">
            <input
              type="range"
              min="0"
              max="100"
              :value="volume * 100"
              @input="handleVolumeChange"
              class="volume-slider"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      class="player-right-panel hidden w-1/2 flex-col px-6 pt-20 pb-8 lg:flex lg:px-8 lg:pt-24 lg:pb-12"
    >
      <div class="lyrics-container relative h-full flex-1 overflow-hidden">
        <div
          ref="lyricsRef"
          class="lyrics-scroll relative z-20 h-full"
          :style="{ fontSize: state.lyricsScale + 'rem' }"
        >
          <div
            v-for="(line, index) in activeSingleLyrics"
            :key="index"
            class="lyric-line cursor-pointer text-center transition-all duration-500"
            :class="{
              current: index === currentLyricIndex,
              'text-primary/40 hover:text-primary/60': index !== currentLyricIndex,
            }"
            @click="seekToLyric(index)"
          >
            <p class="lyric-text">{{ line.ori }}</p>
            <p v-if="showTrans && line.tran" class="lyric-sub">{{ line.tran }}</p>
            <p v-if="showRoma && line.roma" class="lyric-sub">{{ line.roma }}</p>
          </div>
          <div class="h-64"></div>
        </div>

        <div
          class="pointer-events-none absolute top-1/2 right-0 left-0 -z-10 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        ></div>
      </div>
    </div>
  </div>
  <SongCommentsDialog v-model:show="isCommentsOpen" :song-id="currentSong?.id ?? null" />
</template>

<style scoped>
@reference "../style/tailwind.css";
.bg-layer {
  transform: scale(1.5);
  filter: blur(48px) saturate(1.3);
  transition: filter 0.3s ease;
  will-change: transform, opacity;
}

.glass-toolbar {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toolbar-btn {
  @apply text-primary/70 flex h-8 w-8 items-center justify-center rounded-xl transition-all;
}
.toolbar-btn:hover {
  @apply text-primary bg-white/10;
}
.toolbar-btn.active {
  @apply text-primary bg-white/15 ring-1 ring-white/20;
}

.toolbar-btn-text {
  @apply text-primary/70 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-all;
}
.toolbar-btn-text:hover {
  @apply text-primary bg-white/10;
}
.toolbar-btn-text.active {
  @apply text-primary bg-white/15 ring-1 ring-white/20;
}

.action-btn {
  @apply text-primary/80 flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.action-btn:hover {
  @apply text-primary scale-105 bg-white/15;
}
.action-btn.active {
  @apply bg-white/20 text-yellow-300;
}
.action-btn.close-btn:hover {
  @apply bg-white/20;
}

.control-btn {
  @apply text-primary/80 flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}
.control-btn:hover {
  @apply text-primary scale-110 bg-white/20;
}
.control-btn.small {
  @apply h-11 w-11;
}
.control-btn.active {
  background: rgba(236, 72, 153, 0.3);
}

.play-btn {
  @apply text-primary flex h-18 w-18 items-center justify-center rounded-full shadow-2xl transition-all duration-300;
  background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  box-shadow: 0 8px 32px rgba(236, 72, 153, 0.4);
}
.play-btn:hover {
  @apply scale-110;
  box-shadow: 0 12px 40px rgba(236, 72, 153, 0.5);
}
.play-btn.loading {
  @apply cursor-wait opacity-70;
}

.comment-btn {
  @apply text-primary/70 flex items-center gap-2 rounded-2xl px-4 py-2 text-sm transition-all;
  background: rgba(255, 255, 255, 0.08);
}
.comment-btn:hover {
  @apply text-primary bg-white/15;
}

.volume-btn {
  @apply text-primary/70 transition-colors;
}
.volume-btn:hover {
  @apply text-primary;
}

.volume-slider-wrapper {
  @apply relative h-2 w-24 overflow-hidden rounded-full;
  background: rgba(255, 255, 255, 0.15);
}

.volume-slider {
  @apply absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent;
}
.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
}
.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}
.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.progress-wrapper {
  touch-action: none;
}

.progress-track {
  background: rgba(255, 255, 255, 0.15);
}

.progress-fill {
  background: linear-gradient(90deg, #ec4899, #8b5cf6);
  box-shadow: 0 0 8px rgba(236, 72, 153, 0.4);
  transition: width 0.05s linear;
}

.progress-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%);
  opacity: 0;
  transition:
    opacity 0.2s,
    transform 0.2s,
    box-shadow 0.2s;
}

.progress-wrapper:hover .progress-thumb,
.progress-thumb.active {
  opacity: 1;
}

.progress-thumb.active {
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(236, 72, 153, 0.6);
}

.vinyl-disc {
  background: radial-gradient(circle at 50% 50%, #161616 0%, #0b0b0b 60%, #000 100%);
}
.vinyl-disc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: repeating-radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.06) 0px,
    rgba(255, 255, 255, 0.06) 1px,
    transparent 3px
  );
  opacity: 0.25;
  pointer-events: none;
}
.vinyl-disc::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: radial-gradient(
    ellipse at 30% 15%,
    rgba(255, 255, 255, 0.18),
    rgba(255, 255, 255, 0.02) 40%,
    transparent 60%
  );
  mix-blend-mode: screen;
  pointer-events: none;
}

.vinyl-label {
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 2px 16px rgba(0, 0, 0, 0.25);
  position: relative;
  overflow: hidden;
}
.vinyl-label::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: repeating-radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.12) 0px,
    rgba(255, 255, 255, 0.12) 1px,
    transparent 2px
  );
  opacity: 0.25;
  pointer-events: none;
}
.vinyl-label::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 70%;
  height: 70%;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  opacity: 0.6;
}

.spindle {
  background: radial-gradient(circle at 30% 30%, #c9c9c9, #9a9a9a 60%, #6f6f6f);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.45),
    inset 0 1px 2px rgba(255, 255, 255, 0.35);
}

.tonearm {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
}
.arm-pivot {
  background: conic-gradient(from 180deg at 50% 50%, #d7d7d7, #bdbdbd, #9f9f9f, #d7d7d7);
}
.arm-shaft {
  background: linear-gradient(180deg, #d6d6d6 0%, #bfbfbf 40%, #9c9c9c 100%);
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.2);
}
.counterweight {
  background: radial-gradient(circle at 30% 30%, #bfbfbf, #8f8f8f 60%, #6f6f6f);
}
.headshell {
  background: linear-gradient(135deg, #6b7280, #374151);
}
.cartridge {
  background: linear-gradient(180deg, #8b8b8b, #5f5f5f);
}
.stylus {
  background: linear-gradient(180deg, #e5e7eb, #9ca3af);
}

.lyrics-container {
  mask-image: linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 12%,
    black 88%,
    transparent 100%
  );
}

.lyrics-scroll {
  transform: translateY(0);
  transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.lyric-line {
  line-height: 1.8;
  padding: 0.75rem 1.5rem;
  margin-bottom: 0.5rem;
  border-radius: 0.75rem;
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  white-space: pre-line;
}
.lyric-line:hover {
  background: rgba(255, 255, 255, 0.05);
}

.lyric-line.current {
  @apply text-primary;
  transform: scale(1.08);
  text-shadow: 0 0 24px rgba(255, 255, 255, 0.4);
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(139, 92, 246, 0.12));
}
.lyric-line.current .lyric-text {
  @apply text-xl font-semibold lg:text-2xl;
}
.lyric-line.current .lyric-sub {
  @apply text-primary/70 mt-1 text-sm lg:text-base;
}

.lyric-sub {
  @apply text-primary/40 mt-0.5 text-sm;
}

.album-wrapper {
  transition: transform 0.3s ease;
}
.album-wrapper:hover {
  transform: scale(1.03);
}

@media (max-width: 1024px) {
  .player-left-panel {
    width: 100%;
  }
}
</style>
