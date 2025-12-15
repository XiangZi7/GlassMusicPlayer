// 音频播放器组合式API
import { Song, PlayMode } from '@/stores/interface'
import { formatTime } from '@/utils/audioUtils'

export const useAudio = () => {
  const audioStore = useAudioStore()

  // 初始化音频播放器（只在首次调用时初始化）
  // if (!audioStore.audio.audio) {
  audioStore.initAudio()
  // }

  // 响应式状态
  const currentSong = computed(() => audioStore.getCurrentSong)
  const isPlaying = computed(() => audioStore.getIsPlaying)
  const isLoading = computed(() => audioStore.audio.isLoading)
  const playlist = computed(() => audioStore.getPlaylist)
  const playHistory = computed(() => audioStore.audio.playHistory)
  const playMode = computed(() => audioStore.getPlayMode)
  const volume = computed(() => audioStore.getVolume)
  const isMuted = computed(() => audioStore.getIsMuted)
  const currentTime = computed(() => audioStore.getCurrentTime)
  const duration = computed(() => audioStore.getDuration)
  const progress = computed(() => audioStore.getProgress)
  const hasNext = computed(() => audioStore.hasNext)
  const hasPrevious = computed(() => audioStore.hasPrevious)

  // 格式化时间
  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

  // 播放模式文本
  const playModeText = computed(() => {
    switch (playMode.value) {
      case PlayMode.LIST:
        return '列表循环'
      case PlayMode.SINGLE:
        return '单曲循环'
      case PlayMode.RANDOM:
        return '随机播放'
      default:
        return '列表循环'
    }
  })

  // 播放模式图标
  const playModeIcon = computed(() => {
    switch (playMode.value) {
      case PlayMode.LIST:
        return 'icon-[mdi--repeat]'
      case PlayMode.SINGLE:
        return 'icon-[mdi--repeat-once]'
      case PlayMode.RANDOM:
        return 'icon-[mdi--shuffle]'
      default:
        return 'icon-[mdi--repeat]'
    }
  })

  // 播放控制方法
  const play = (song?: Song, index?: number) => {
    audioStore.playSong(song, index)
  }

  const pause = () => {
    audioStore.pause()
  }

  const resume = () => {
    audioStore.resume()
  }

  const togglePlay = () => {
    if (!audioStore.audio.audio) audioStore.initAudio()
    audioStore.togglePlay()
  }

  const next = () => {
    if (!audioStore.audio.audio) audioStore.initAudio()
    audioStore.nextSong()
  }

  const previous = () => {
    if (!audioStore.audio.audio) audioStore.initAudio()
    audioStore.previousSong()
  }

  const stop = () => {
    audioStore.stop()
  }

  // 播放模式控制
  const togglePlayMode = () => {
    audioStore.togglePlayMode()
  }

  const setPlayMode = (mode: PlayMode) => {
    audioStore.setPlayMode(mode)
  }

  // 音量控制
  const setVolume = (vol: number) => {
    audioStore.setVolume(vol)
  }

  const toggleMute = () => {
    audioStore.toggleMute()
  }

  // 进度控制
  const setProgress = (prog: number) => {
    audioStore.setProgress(prog)
  }

  const setCurrentTime = (time: number) => {
    audioStore.setCurrentTime(time)
  }

  // 播放列表管理
  const addSong = (song: Song) => {
    audioStore.addSong(song)
  }

  const addSongs = (songs: Song[]) => {
    audioStore.addSongs(songs)
  }

  const removeSong = (songId: string | number) => {
    audioStore.removeSong(songId)
  }

  const clearPlaylist = () => {
    audioStore.clearPlaylist()
  }

  const moveSong = (fromIndex: number, toIndex: number) => {
    audioStore.moveSong(fromIndex, toIndex)
  }

  const queueNext = (songId: string | number) => {
    audioStore.queueNext(songId)
  }

  const removeSongs = (ids: Array<string | number>) => {
    audioStore.removeSongs(ids)
  }

  const setPlaylist = (songs: Song[], startIndex?: number) => {
    audioStore.setPlaylist(songs, startIndex)
  }

  const playByIndex = (index: number) => {
    audioStore.playByIndex(index)
  }

  // 历史记录
  const clearHistory = () => {
    audioStore.clearHistory()
  }

  // 错误处理
  const clearError = () => {
    audioStore.clearError()
  }

  // 键盘快捷键支持
  const handleKeyboard = (event: KeyboardEvent) => {
    // 防止在输入框中触发
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    switch (event.code) {
      case 'Space':
        event.preventDefault()
        togglePlay()
        break
      case 'ArrowLeft':
        event.preventDefault()
        if (event.ctrlKey) {
          previous()
        } else {
          setCurrentTime(Math.max(0, currentTime.value - 10))
        }
        break
      case 'ArrowRight':
        event.preventDefault()
        if (event.ctrlKey) {
          next()
        } else {
          setCurrentTime(Math.min(duration.value, currentTime.value + 10))
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        setVolume(Math.min(1, volume.value + 0.1))
        break
      case 'ArrowDown':
        event.preventDefault()
        setVolume(Math.max(0, volume.value - 0.1))
        break
      case 'KeyM':
        event.preventDefault()
        toggleMute()
        break
      case 'KeyR':
        event.preventDefault()
        togglePlayMode()
        break
    }
  }

  // 媒体会话API支持（用于系统媒体控制）
  const setupMediaSession = () => {
    if ('mediaSession' in navigator && currentSong.value) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.value.name,
        artist: currentSong.value.artist,
        album: currentSong.value.album || '',
        artwork: currentSong.value.cover
          ? [{ src: currentSong.value.cover, sizes: '512x512', type: 'image/png' }]
          : [],
      })

      navigator.mediaSession.setActionHandler('play', () => resume())
      navigator.mediaSession.setActionHandler('pause', () => pause())
      navigator.mediaSession.setActionHandler('previoustrack', () => previous())
      navigator.mediaSession.setActionHandler('nexttrack', () => next())
      navigator.mediaSession.setActionHandler('seekto', details => {
        if (details.seekTime) {
          setCurrentTime(details.seekTime)
        }
      })
    }
  }

  // 监听当前歌曲变化，更新媒体会话
  watch(
    currentSong,
    () => {
      setupMediaSession()
    },
    { immediate: true }
  )

  // 组件卸载时清理
  onUnmounted(() => {
    // 移除键盘事件监听器（如果有的话）
    document.removeEventListener('keydown', handleKeyboard)
  })

  return {
    // 状态
    currentSong,
    isPlaying,
    isLoading,
    playlist,
    playHistory,
    playMode,
    volume,
    isMuted,
    currentTime,
    duration,
    progress,
    hasNext,
    hasPrevious,
    formattedCurrentTime,
    formattedDuration,
    playModeText,
    playModeIcon,

    // 播放控制
    play,
    pause,
    resume,
    togglePlay,
    next,
    previous,
    stop,

    // 播放模式
    togglePlayMode,
    setPlayMode,

    // 音量控制
    setVolume,
    toggleMute,

    // 进度控制
    setProgress,
    setCurrentTime,

    // 播放列表管理
    addSong,
    addSongs,
    removeSong,
    clearPlaylist,
    moveSong,
    queueNext,
    removeSongs,
    setPlaylist,
    playByIndex,

    // 其他功能
    clearHistory,
    clearError,
    handleKeyboard,
    setupMediaSession,
  }
}

// 全局键盘快捷键支持
export const useGlobalKeyboard = () => {
  const { handleKeyboard } = useAudio()

  const enableGlobalKeyboard = () => {
    document.addEventListener('keydown', handleKeyboard)
  }

  const disableGlobalKeyboard = () => {
    document.removeEventListener('keydown', handleKeyboard)
  }

  return {
    enableGlobalKeyboard,
    disableGlobalKeyboard,
  }
}
