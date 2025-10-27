import { defineStore } from 'pinia'
import { GlobalState, AudioState, Song, PlayMode } from '../interface'
import piniaPersistConfig from '../persist'

// 创建音频播放器实例
const createAudioInstance = (): HTMLAudioElement => {
  const audio = new Audio()
  audio.preload = 'metadata'
  audio.crossOrigin = 'anonymous'
  return audio
}

// 洗牌算法 - 随机打乱数组
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export const useAudioStore = defineStore('audio', {
  state: (): GlobalState => ({
    // 全局计数器（保留原有字段）
    count: 0,
    // 音频播放器状态
    audio: {
      // HTML音频元素实例
      audio: null,
      // 是否正在播放
      isPlaying: false,
      // 是否已暂停
      isPaused: false,
      // 是否正在加载
      isLoading: false,
      // 当前播放的歌曲
      currentSong: null,
      // 当前歌曲在播放列表中的索引
      currentIndex: -1,
      // 当前播放列表
      playlist: [],
      // 原始播放列表（用于随机模式恢复）
      originalPlaylist: [],
      // 播放模式（列表循环/单曲循环/随机播放）
      playMode: PlayMode.LIST,
      // 音量大小（0-1）
      volume: 0.8,
      // 是否静音
      isMuted: false,
      // 当前播放时间（秒）
      currentTime: 0,
      // 歌曲总时长（秒）
      duration: 0,
      // 播放历史记录
      playHistory: [],
      // 错误信息
      error: null
    }
  }),

  getters: {
    // 获取当前播放的歌曲
    getCurrentSong: (state): Song | null => state.audio.currentSong,
    // 获取播放状态
    getIsPlaying: (state): boolean => state.audio.isPlaying,
    // 获取播放列表
    getPlaylist: (state): Song[] => state.audio.playlist,
    // 获取播放模式
    getPlayMode: (state): PlayMode => state.audio.playMode,
    // 获取音量
    getVolume: (state): number => state.audio.volume,
    // 获取当前播放时间
    getCurrentTime: (state): number => state.audio.currentTime,
    // 获取歌曲总时长
    getDuration: (state): number => state.audio.duration,
    // 获取播放进度百分比
    getProgress: (state): number => {
      return state.audio.duration > 0 ? (state.audio.currentTime / state.audio.duration) * 100 : 0
    },

    // 检查是否有下一首/上一首
    hasNext: (state): boolean => {
      if (state.audio.playMode === PlayMode.SINGLE) return true
      return state.audio.currentIndex < state.audio.playlist.length - 1
    },
    hasPrevious: (state): boolean => {
      if (state.audio.playMode === PlayMode.SINGLE) return true
      return state.audio.currentIndex > 0
    },
  },

  actions: {
    // 初始化音频播放器
    initAudio() {
      if (!this.audio.audio) {
        // 单列模式下，不创建新实例
        this.audio.audio = createAudioInstance()
        this.setupAudioEvents()
      }
    },

    // 设置音频事件监听
    setupAudioEvents() {
      if (!this.audio.audio) return

      const audio = this.audio.audio

      // 播放开始
      audio.addEventListener('play', () => {
        this.audio.isPlaying = true
        this.audio.isPaused = false
        this.audio.error = null
      })

      // 播放暂停
      audio.addEventListener('pause', () => {
        this.audio.isPlaying = false
        this.audio.isPaused = true
      })

      // 播放结束
      audio.addEventListener('ended', () => {
        this.audio.isPlaying = false
        this.handleSongEnd()
      })

      // 加载开始
      audio.addEventListener('loadstart', () => {
        this.audio.isLoading = true
      })

      // 可以播放
      audio.addEventListener('canplay', () => {
        this.audio.isLoading = false
        this.audio.duration = audio.duration || 0
      })

      // 时间更新
      audio.addEventListener('timeupdate', () => {
        this.audio.currentTime = audio.currentTime || 0
      })

      // 音量变化
      audio.addEventListener('volumechange', () => {
        this.audio.volume = audio.volume
        this.audio.isMuted = audio.muted
      })

      // 错误处理
      audio.addEventListener('error', e => {
        this.audio.error = '播放出错，请重试'
        this.audio.isLoading = false
        this.audio.isPlaying = false
        console.error('Audio error:', e)
      })
    },

    // 播放歌曲
    async playSong(song?: Song, index?: number) {
      this.initAudio()

      if (song && index !== undefined) {
        this.audio.currentSong = song
        this.audio.currentIndex = index
      }

      if (!this.audio.currentSong || !this.audio.audio) return

      try {
        this.audio.error = null

        // 如果URL变化，重新加载
        if (this.audio.audio.src !== this.audio.currentSong.url) {
          this.audio.audio.src = this.audio.currentSong.url || ''
        }

        await this.audio.audio.play()

        // 添加到播放历史
        this.addToHistory(this.audio.currentSong)
      } catch (error) {
        this.audio.error = '播放失败，请检查网络连接'
        console.error('Play error:', error)
      }
    },

    // 暂停播放
    pause() {
      if (this.audio.audio && this.audio.isPlaying) {
        this.audio.audio.pause()
      }
    },

    // 继续播放
    resume() {
      if (this.audio.audio && this.audio.isPaused) {
        this.audio.audio.play()
      }
    },

    // 播放/暂停切换
    togglePlay() {
      if (this.audio.isPlaying) {
        this.pause()
      } else {
        this.resume()
      }
    },

    // 下一首
    nextSong() {
      if (this.audio.playlist.length === 0) return

      let nextIndex = this.audio.currentIndex

      switch (this.audio.playMode) {
        case PlayMode.SINGLE:
          // 单曲循环，重新播放当前歌曲
          this.playSong(this.audio.currentSong!, this.audio.currentIndex)
          return

        case PlayMode.RANDOM:
          // 随机播放
          const availableIndexes = this.audio.playlist
            .map((_, index) => index)
            .filter(index => index !== this.audio.currentIndex)

          if (availableIndexes.length > 0) {
            nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)]
          }
          break

        case PlayMode.LIST:
        default:
          // 列表循环
          nextIndex = (this.audio.currentIndex + 1) % this.audio.playlist.length
          break
      }

      const nextSong = this.audio.playlist[nextIndex]
      if (nextSong) {
        this.playSong(nextSong, nextIndex)
      }
    },

    // 上一首
    previousSong() {
      if (this.audio.playlist.length === 0) return

      let prevIndex = this.audio.currentIndex

      switch (this.audio.playMode) {
        case PlayMode.SINGLE:
          // 单曲循环，重新播放当前歌曲
          this.playSong(this.audio.currentSong!, this.audio.currentIndex)
          return

        case PlayMode.RANDOM:
          // 随机播放 - 从历史记录中获取上一首
          if (this.audio.playHistory.length > 1) {
            const prevSong = this.audio.playHistory[this.audio.playHistory.length - 2]
            prevIndex = this.audio.playlist.findIndex(song => song.id === prevSong.id)
          } else {
            // 如果没有历史记录，随机选择
            prevIndex = Math.floor(Math.random() * this.audio.playlist.length)
          }
          break

        case PlayMode.LIST:
        default:
          // 列表循环
          prevIndex =
            this.audio.currentIndex <= 0
              ? this.audio.playlist.length - 1
              : this.audio.currentIndex - 1
          break
      }

      const prevSong = this.audio.playlist[prevIndex]
      if (prevSong) {
        this.playSong(prevSong, prevIndex)
      }
    },

    // 处理歌曲播放结束
    handleSongEnd() {
      switch (this.audio.playMode) {
        case PlayMode.SINGLE:
          // 单曲循环
          this.playSong(this.audio.currentSong!, this.audio.currentIndex)
          break

        case PlayMode.LIST:
        case PlayMode.RANDOM:
        default:
          // 列表循环或随机播放
          this.nextSong()
          break
      }
    },

    // 切换播放模式
    togglePlayMode() {
      const modes = [PlayMode.LIST, PlayMode.SINGLE, PlayMode.RANDOM]
      const currentIndex = modes.indexOf(this.audio.playMode)
      const nextIndex = (currentIndex + 1) % modes.length

      this.audio.playMode = modes[nextIndex]

      // 如果切换到随机模式，打乱播放列表
      if (this.audio.playMode === PlayMode.RANDOM) {
        this.shufflePlaylist()
      } else if (this.audio.originalPlaylist.length > 0) {
        // 恢复原始播放列表
        this.audio.playlist = [...this.audio.originalPlaylist]
        // 更新当前歌曲索引
        if (this.audio.currentSong) {
          this.audio.currentIndex = this.audio.playlist.findIndex(
            song => song.id === this.audio.currentSong!.id
          )
        }
      }
    },

    // 设置播放模式
    setPlayMode(mode: PlayMode) {
      this.audio.playMode = mode

      if (mode === PlayMode.RANDOM) {
        this.shufflePlaylist()
      } else if (this.audio.originalPlaylist.length > 0) {
        this.audio.playlist = [...this.audio.originalPlaylist]
        if (this.audio.currentSong) {
          this.audio.currentIndex = this.audio.playlist.findIndex(
            song => song.id === this.audio.currentSong!.id
          )
        }
      }
    },

    // 打乱播放列表
    shufflePlaylist() {
      if (this.audio.playlist.length === 0) return

      // 保存原始播放列表
      if (this.audio.originalPlaylist.length === 0) {
        this.audio.originalPlaylist = [...this.audio.playlist]
      }

      // 打乱播放列表
      this.audio.playlist = shuffleArray(this.audio.playlist)

      // 更新当前歌曲索引
      if (this.audio.currentSong) {
        this.audio.currentIndex = this.audio.playlist.findIndex(
          song => song.id === this.audio.currentSong!.id
        )
      }
    },

    // 设置音量
    setVolume(volume: number) {
      if (this.audio.audio) {
        this.audio.audio.volume = Math.max(0, Math.min(1, volume))
        this.audio.volume = this.audio.audio.volume
      }
    },

    // 静音切换
    toggleMute() {
      if (this.audio.audio) {
        this.audio.audio.muted = !this.audio.audio.muted
        this.audio.isMuted = this.audio.audio.muted
      }
    },

    // 设置播放进度
    setCurrentTime(time: number) {
      if (this.audio.audio && this.audio.duration > 0) {
        this.audio.audio.currentTime = Math.max(0, Math.min(this.audio.duration, time))
      }
    },

    // 设置播放进度（百分比）
    setProgress(progress: number) {
      if (this.audio.duration > 0) {
        const time = (progress / 100) * this.audio.duration
        this.setCurrentTime(time)
      }
    },

    // 添加歌曲到播放列表
    addSong(song: Song) {
      const exists = this.audio.playlist.find(s => s.id === song.id)
      if (!exists) {
        this.audio.playlist.push(song)
        if (this.audio.originalPlaylist.length > 0) {
          this.audio.originalPlaylist.push(song)
        }
      }
    },

    // 添加多首歌曲
    addSongs(songs: Song[]) {
      songs.forEach(song => this.addSong(song))
    },

    // 从播放列表删除歌曲
    removeSong(songId: string | number) {
      const index = this.audio.playlist.findIndex(song => song.id === songId)
      if (index !== -1) {
        this.audio.playlist.splice(index, 1)

        // 同时从原始播放列表删除
        const originalIndex = this.audio.originalPlaylist.findIndex(song => song.id === songId)
        if (originalIndex !== -1) {
          this.audio.originalPlaylist.splice(originalIndex, 1)
        }

        // 如果删除的是当前播放的歌曲
        if (index === this.audio.currentIndex) {
          if (this.audio.playlist.length > 0) {
            // 播放下一首
            const nextIndex = Math.min(index, this.audio.playlist.length - 1)
            this.playSong(this.audio.playlist[nextIndex], nextIndex)
          } else {
            // 没有歌曲了，停止播放
            this.stop()
          }
        } else if (index < this.audio.currentIndex) {
          // 如果删除的歌曲在当前歌曲之前，更新索引
          this.audio.currentIndex--
        }
      }
    },

    // 清空播放列表
    clearPlaylist() {
      this.stop()
      this.audio.playlist = []
      this.audio.originalPlaylist = []
      this.audio.currentSong = null
      this.audio.currentIndex = -1
    },

    // 设置播放列表
    setPlaylist(songs: Song[], startIndex: number = 0) {
      this.audio.playlist = [...songs]
      this.audio.originalPlaylist = [...songs]

      // 只设置当前歌曲和索引，不自动播放
      if (songs.length > 0 && startIndex >= 0 && startIndex < songs.length) {
        this.audio.currentSong = songs[startIndex]
        this.audio.currentIndex = startIndex
      }
    },

    // 播放指定索引的歌曲
    playByIndex(index: number) {
      if (index >= 0 && index < this.audio.playlist.length) {
        this.playSong(this.audio.playlist[index], index)
      }
    },

    // 停止播放
    stop() {
      if (this.audio.audio) {
        this.audio.audio.pause()
        this.audio.audio.currentTime = 0
      }
      this.audio.isPlaying = false
      this.audio.isPaused = false
      this.audio.currentTime = 0
    },

    // 添加到播放历史
    addToHistory(song: Song) {
      // 避免重复添加相同歌曲
      const lastSong = this.audio.playHistory[this.audio.playHistory.length - 1]
      if (!lastSong || lastSong.id !== song.id) {
        this.audio.playHistory.push(song)

        // 限制历史记录数量
        if (this.audio.playHistory.length > 50) {
          this.audio.playHistory.shift()
        }
      }
    },

    // 清空播放历史
    clearHistory() {
      this.audio.playHistory = []
    },

    // 清除错误信息
    clearError() {
      this.audio.error = null
    },

    // 销毁音频播放器
    destroy() {
      if (this.audio.audio) {
        this.audio.audio.pause()
        this.audio.audio.src = ''
        this.audio.audio = null
      }

      this.audio.isPlaying = false
      this.audio.isPaused = false
      this.audio.isLoading = false
      this.audio.currentSong = null
      this.audio.currentIndex = -1
      this.audio.currentTime = 0
      this.audio.duration = 0
      this.audio.error = null
    },
  },

  persist: piniaPersistConfig('audio'),
})
