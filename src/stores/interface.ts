// 歌手信息接口
export interface Artist {
  id: string | number
  name: string
}

// 歌曲信息接口
export interface Song {
  id: string | number
  mvId?: string | number
  name: string
  artist: string
  artistId?: string | number
  artists?: Artist[]
  album?: string
  albumId?: string | number
  duration: number
  emoji?: string
  gradient?: string
  liked?: boolean
  cover?: string
  url?: string
  isLocal?: boolean
}

export interface AudioStoreState {
  count: number
  audio: {
    audio: HTMLAudioElement | null
    isPlaying: boolean
    isPaused: boolean
    isLoading: boolean
    currentSong: Song | null
    currentIndex: number
    playlist: Song[]
    originalPlaylist: Song[]
    playMode: PlayMode
    volume: number
    isMuted: boolean
    currentTime: number
    duration: number
    playHistory: Song[]
    error: string | null
    previousVolume?: number
  }
}

// 播放模式枚举
export enum PlayMode {
  LIST = 'list', // 列表循环
  SINGLE = 'single', // 单曲循环
  RANDOM = 'random', // 随机播放
}

// 音乐播放器状态接口
export interface AudioState {
  // 播放器实例
  audio: HTMLAudioElement | null

  // 播放状态
  isPlaying: boolean
  isPaused: boolean
  isLoading: boolean

  // 当前歌曲信息
  currentSong: Song | null
  currentIndex: number

  // 播放列表
  playlist: Song[]
  originalPlaylist: Song[] // 原始播放列表（用于随机模式）

  // 播放模式
  playMode: PlayMode

  // 音量控制
  volume: number
  isMuted: boolean

  // 播放进度
  currentTime: number
  duration: number

  // 历史记录
  playHistory: Song[]

  // 错误信息
  error: string | null
}

export interface GlobalState {
  count: number
  theme?: 'light' | 'dark' | 'system'
  searchHistory: string[]
  lang?: 'zh' | 'en' | 'ja'
}
