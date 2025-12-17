import { defineStore } from 'pinia'
import { songUrlV1 } from '@/api'
import { Song, PlayMode, AudioStoreState } from '../interface'
import { useSettingsStore } from './settings'
import piniaPersistConfig from '../persist'
let globalAudio: HTMLAudioElement | null = null
let eventsBound = false
// 链接过期自动重试节流：记录上次重试的歌曲ID与时间戳，避免短时间重复刷新
let lastRetrySongId: string | number | null = null
let lastRetryTime = 0
const getAudioSingleton = (): HTMLAudioElement => {
  if (!globalAudio) {
    globalAudio = new Audio()
    // 允许跨域音频分析
    globalAudio.crossOrigin = 'anonymous'
  }
  return globalAudio
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
  state: (): AudioStoreState => ({
    // 全局计数器
    count: 0,
    // 音频播放器状态
    audio: {
      // 音频实例
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
      playlist: [] as Song[],
      // 原始播放列表（用于随机模式恢复）
      originalPlaylist: [],
      // 播放模式（列表循环/单曲循环/随机播放）
      playMode: PlayMode.LIST,
      // 音量大小（0-1）
      volume: 1,
      // 是否静音
      isMuted: false,
      // 当前播放时间（秒）
      currentTime: 0,
      // 歌曲总时长（秒）
      duration: 0,
      // 播放历史记录
      playHistory: [],
      // 错误信息
      error: null,
      // 记录静音前的音量
      previousVolume: 1,
    },
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
    // 获取是否静音
    getIsMuted: (state): boolean => state.audio.isMuted,
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
        this.audio.audio = getAudioSingleton()
        this.setupAudioEvents()
        // 如果有歌曲的情况下
        if (this.audio.playlist.length > 0) {
          const index =
            typeof this.audio.currentIndex === 'number' &&
            this.audio.currentIndex >= 0 &&
            this.audio.currentIndex < this.audio.playlist.length
              ? this.audio.currentIndex
              : 0
          this.audio.currentIndex = index
          this.audio.currentSong = this.audio.playlist[index]
          this.audio.audio.src = (this.audio.currentSong && this.audio.currentSong.url) || ''
          this.audio.audio.load()
        }
        //
      }
    },

    // 设置音频事件监听
    setupAudioEvents() {
      if (!this.audio.audio) return
      if (eventsBound) return

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
      audio.addEventListener('error', (e: any) => {
        this.audio.error = '播放出错，请重试'
        this.audio.isLoading = false
        this.audio.isPlaying = false
        console.error('Audio error:', e)
        // 触发一次刷新播放地址并重试，10秒内同一歌曲仅重试一次
        const now = Date.now()
        const id = this.audio.currentSong?.id ?? null
        if (id && (!lastRetrySongId || lastRetrySongId !== id || now - lastRetryTime > 10000)) {
          lastRetrySongId = id as any
          lastRetryTime = now
          this.refreshAndReplay()
        }
      })
      eventsBound = true
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

        // 若无URL则拉取（本地音乐除外）
        if (!this.audio.currentSong.url && !this.audio.currentSong.isLocal) {
          this.audio.isLoading = true
          try {
            const settingsStore = useSettingsStore()
            const res: any = await songUrlV1({
              id: String(this.audio.currentSong.id),
              level: settingsStore.audioQuality
            })
            const url: string = res?.data?.[0]?.url || res?.data?.data?.[0]?.url || res?.url || ''
            this.audio.currentSong.url = url
            // 同步到播放列表项
            const idx = this.audio.currentIndex
            if (idx >= 0 && idx < this.audio.playlist.length) {
              this.audio.playlist[idx].url = url
            }
          } catch (e) {
            this.audio.error = '获取音频地址失败'
            this.audio.isLoading = false
            throw e
          }
        }

        // 如果URL变化，重新加载
        if (this.audio.audio.src !== (this.audio.currentSong.url || '')) {
          this.audio.audio.src = this.audio.currentSong.url || ''
          this.audio.audio.load()
        }

        await this.audio.audio.play()

        // 添加到播放历史
        this.addToHistory(this.audio.currentSong)
      } catch (error) {
        this.audio.error = '播放失败，请检查网络连接'
        console.error('Play error:', error)
        // 播放失败时也尝试刷新URL后重试
        const id = this.audio.currentSong?.id ?? null
        if (id) this.refreshAndReplay()
      }
    },

    // 刷新当前歌曲的播放地址并重试播放
    // 步骤：
    // 1) 调用接口获取最新URL；2) 同步到 currentSong 与 playlist；
    // 3) 重设 audio.src 并 load()；4) 调用 play()
    async refreshAndReplay() {
      if (!this.audio.currentSong || !this.audio.audio) return
      // 本地音乐不进行刷新
      if (this.audio.currentSong.isLocal) return
      
      this.audio.isLoading = true
      try {
        const settingsStore = useSettingsStore()
        const res: any = await songUrlV1({
          id: String(this.audio.currentSong.id),
          level: settingsStore.audioQuality
        })
        const url: string = res?.data?.[0]?.url || res?.data?.data?.[0]?.url || res?.url || ''
        this.audio.currentSong.url = url
        const idx = this.audio.currentIndex
        if (idx >= 0 && idx < this.audio.playlist.length) {
          this.audio.playlist[idx].url = url
        }
        if (this.audio.audio.src !== (url || '')) {
          this.audio.audio.src = url || ''
          this.audio.audio.load()
        }
        await this.audio.audio.play()
        this.audio.error = null
      } catch (e) {
        console.error('Refresh url failed:', e)
      } finally {
        this.audio.isLoading = false
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
      if (this.audio.audio) {
        this.audio.audio.play()
      }
    },

    // 播放/暂停切换（启动播放时会自动获取缺失的URL）
    togglePlay() {
      this.initAudio()
      if (!this.audio.audio) return

      if (this.audio.isPlaying) {
        this.pause()
      } else {
        if (!this.audio.currentSong && this.audio.playlist.length > 0) {
          this.audio.currentSong = this.audio.playlist[0]
          this.audio.currentIndex = 0
        }
        if (this.audio.currentSong) {
          // 统一通过 playSong 执行，确保缺失URL的懒加载
          this.playSong(this.audio.currentSong, this.audio.currentIndex)
        }
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
            .map((_: any, index: any) => index)
            .filter((index: any) => index !== this.audio.currentIndex)

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
            prevIndex = this.audio.playlist.findIndex(
              (song: { id: any }) => song.id === prevSong.id
            )
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
            (song: { id: any }) => song.id === this.audio.currentSong!.id
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
            (song: { id: any }) => song.id === this.audio.currentSong!.id
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
          (song: { id: any }) => song.id === this.audio.currentSong!.id
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
        if (this.audio.audio.muted) {
          // 恢复静音前的音量
          this.audio.audio.muted = false
          this.audio.isMuted = false
          this.setVolume(this.audio.previousVolume || 1)
        } else {
          // 开启静音，记录当前音量
          this.audio.previousVolume = this.audio.volume
          this.audio.audio.muted = true
          this.audio.isMuted = true
          this.setVolume(0)
        }
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
      const exists = this.audio.playlist.find((s: { id: string | number }) => s.id === song.id)
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

    // 移动歌曲位置
    moveSong(fromIndex: number, toIndex: number) {
      if (fromIndex === toIndex) return
      if (fromIndex < 0 || fromIndex >= this.audio.playlist.length) return
      if (toIndex < 0 || toIndex >= this.audio.playlist.length) return
      const move = (arr: Song[]) => {
        const item = arr.splice(fromIndex, 1)[0]
        arr.splice(toIndex, 0, item)
      }
      move(this.audio.playlist)
      if (this.audio.originalPlaylist.length === this.audio.playlist.length)
        move(this.audio.originalPlaylist)
      if (this.audio.currentIndex === fromIndex) {
        this.audio.currentIndex = toIndex
      } else if (fromIndex < this.audio.currentIndex && toIndex >= this.audio.currentIndex) {
        this.audio.currentIndex -= 1
      } else if (fromIndex > this.audio.currentIndex && toIndex <= this.audio.currentIndex) {
        this.audio.currentIndex += 1
      }
    },

    // 将指定歌曲排到下一首播放
    queueNext(songId: string | number) {
      if (this.audio.playlist.length === 0) return
      const idx = this.audio.playlist.findIndex((s: { id: string | number }) => s.id === songId)
      if (idx === -1) return
      const target = Math.min(this.audio.currentIndex + 1, this.audio.playlist.length - 1)
      this.moveSong(idx, target)
    },

    // 批量删除歌曲
    removeSongs(ids: Array<string | number>) {
      ids.forEach(id => this.removeSong(id))
    },

    // 从播放列表删除歌曲
    removeSong(songId: string | number) {
      const index = this.audio.playlist.findIndex(
        (song: { id: string | number }) => song.id === songId
      )
      if (index !== -1) {
        this.audio.playlist.splice(index, 1)

        // 同时从原始播放列表删除
        const originalIndex = this.audio.originalPlaylist.findIndex(
          (song: { id: string | number }) => song.id === songId
        )
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
      // 移除已存在的相同歌曲（避免重复）
      const existingIndex = this.audio.playHistory.findIndex(
        (s: { id: string | number }) => s.id === song.id
      )

      if (existingIndex !== -1) {
        this.audio.playHistory.splice(existingIndex, 1)
      }

      // 添加到历史记录末尾
      this.audio.playHistory.push(song)

      // 限制历史记录数量
      if (this.audio.playHistory.length > 100) {
        this.audio.playHistory.shift()
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

  persist: piniaPersistConfig('audio', [
    'count',
    'audio.currentSong',
    'audio.currentIndex',
    'audio.playlist',
    'audio.originalPlaylist',
    'audio.playMode',
    'audio.volume',
    'audio.isMuted',
    'audio.playHistory',
  ]),
})
