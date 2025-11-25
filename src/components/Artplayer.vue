<script setup lang="ts">
import Artplayer from 'artplayer'
import Hls from 'hls.js'
import type { Option } from 'artplayer/types/option'
import artplayerPluginHlsControl from 'artplayer-plugin-hls-control'
import { useAudio } from '@/composables/useAudio'

interface Props {
  src: string
  poster?: string
  title?: string
  options?: Partial<Option>
  autoplay?: boolean
  muted?: boolean
  width?: string | number
  height?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  poster: '',
  title: '',
  autoplay: false,
  muted: false,
  width: '100%',
  height: '400px',
})

// 组件事件：增加 timeupdate 以便上层记录观看进度
const emit = defineEmits<{
  ready: [player: Artplayer]
  play: []
  pause: []
  ended: []
  error: [error: Error]
  timeupdate: [currentTime: number, duration: number]
}>()

const playerRef = useTemplateRef('playerRef')
let player: Artplayer | null = null
const { pause: pauseAudio } = useAudio()

const initPlayer = () => {
  if (!playerRef.value) return

  const defaultOptions: Option = {
    container: playerRef.value,
    url: props.src ?? '',
    poster: props.poster,
    autoplay: props.autoplay,
    muted: props.muted,
    volume: 1,
    pip: true,
    setting: true,
    screenshot: true,
    hotkey: true,
    fullscreen: true,
    fullscreenWeb: true,
    subtitleOffset: true,
    miniProgressBar: true,
    mutex: true,
    backdrop: true,
    playbackRate: true,
    aspectRatio: true,
    plugins: [
      artplayerPluginHlsControl({
        quality: {
          // Show qualitys in control
          control: true,
          // Show qualitys in setting
          setting: true,
          // I18n
          title: 'Quality',
          auto: 'Auto',
        },
        audio: {
          // Show audios in control
          control: true,
          // Show audios in setting
          setting: true,
          // I18n
          title: 'Audio',
          auto: 'Auto',
        },
      }),
    ],
    customType: {
      m3u8: function playM3u8(video: HTMLVideoElement, url: string, art: any) {
        if (Hls.isSupported()) {
          if (art.hls) art.hls.destroy()
          const hls = new Hls()
          hls.loadSource(url)
          hls.attachMedia(video)
          art.hls = hls
          art.on('destroy', () => hls.destroy())
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url
        } else {
          art.notice.show = 'Unsupported playback format: m3u8'
        }
      },
    },
    ...props.options,
  }

  try {
    player = new Artplayer(defaultOptions)

    player.on('ready', () => {
      emit('ready', player!)
    })

    player.on('play', () => {
      pauseAudio()
      emit('play')
    })

    player.on('pause', () => {
      emit('pause')
    })

    player.on('video:ended', () => {
      emit('ended')
    })

    // 播放进度事件（每次 timeupdate 回调当前播放秒数与总时长）
    player.on('video:timeupdate', () => {
      const ct = player?.video?.currentTime ?? 0
      const du = player?.video?.duration ?? 0
      emit('timeupdate', ct, du)
    })

    player.on('error', (error: Error) => {
      emit('error', error)
    })
  } catch (error) {
    emit('error', error as Error)
  }
}

const destroyPlayer = () => {
  if (player) {
    player.destroy()
    player = null
  }
}

const play = () => {
  if (player) {
    player.play()
  }
}

const pause = () => {
  if (player) {
    player.pause()
  }
}

const seek = (time: number) => {
  if (player) {
    player.seek = time
  }
}

const switchUrl = (url: string) => {
  if (player) {
    player.switchUrl(url)
  }
}

const switchQuality = (url: string) => {
  if (player) {
    player.switchQuality(url)
  }
}

watch(
  () => props.src,
  newSrc => {
    if (newSrc && player) switchUrl(newSrc)
  }
)

onMounted(() => {
  initPlayer()
})

onUnmounted(() => {
  destroyPlayer()
})

defineExpose({
  player: () => player,
  play,
  pause,
  seek,
  switchUrl,
  switchQuality,
  destroy: destroyPlayer,
})
</script>

<template>
  <div
    ref="playerRef"
    class="artplayer-container"
    :style="{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
    }"
  />
</template>

<style scoped>
.artplayer-container {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.artplayer-container :deep(.art-video-player) {
  border-radius: 8px;
}
</style>
