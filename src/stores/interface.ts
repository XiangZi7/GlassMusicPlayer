/**
 * Store 层类型定义
 * 集中管理所有 Pinia Store 相关的接口和枚举
 */

/** 歌手信息 */
export interface Artist {
  /** 歌手 ID */
  id: string | number
  /** 歌手名称 */
  name: string
}

/** 歌曲信息（Store 层通用类型，贯穿播放器全流程） */
export interface Song {
  /** 歌曲 ID */
  id: string | number
  /** MV ID */
  mvId?: string | number
  /** 歌曲名称 */
  name: string
  /** 歌手名称（已拼接的展示文本，如 "周杰伦 / 费玉清"） */
  artist: string
  /** 主歌手 ID */
  artistId?: string | number
  /** 歌手列表（包含 id 和 name） */
  artists?: Artist[]
  /** 专辑名称 */
  album?: string
  /** 专辑 ID */
  albumId?: string | number
  /** 歌曲时长（毫秒） */
  duration: number
  /** 表情图标（用于 UI 展示） */
  emoji?: string
  /** Tailwind 渐变类名（用于 UI 展示） */
  gradient?: string
  /** 是否已喜欢 */
  liked?: boolean
  /** 封面图片 URL */
  cover?: string
  /** 音频播放地址（懒加载，播放时才获取） */
  url?: string
  /** 是否为本地音乐 */
  isLocal?: boolean
}

/** 音频播放器 Store 状态 */
export interface AudioStoreState {
  /** 全局计数器 */
  count: number
  /** 音频播放器核心状态 */
  audio: {
    /** HTML Audio 元素实例 */
    audio: HTMLAudioElement | null
    /** 是否正在播放 */
    isPlaying: boolean
    /** 是否已暂停 */
    isPaused: boolean
    /** 是否正在加载 */
    isLoading: boolean
    /** 当前播放的歌曲 */
    currentSong: Song | null
    /** 当前歌曲在播放列表中的索引 */
    currentIndex: number
    /** 当前播放列表 */
    playlist: Song[]
    /** 原始播放列表（用于随机模式恢复原始顺序） */
    originalPlaylist: Song[]
    /** 播放模式 */
    playMode: PlayMode
    /** 音量（0-1） */
    volume: number
    /** 是否静音 */
    isMuted: boolean
    /** 当前播放时间（秒） */
    currentTime: number
    /** 歌曲总时长（秒） */
    duration: number
    /** 播放历史记录 */
    playHistory: Song[]
    /** 错误信息 */
    error: string | null
    /** 静音前的音量（用于取消静音时恢复） */
    previousVolume?: number
  }
}

/** 播放模式枚举 */
export enum PlayMode {
  /** 列表循环 */
  LIST = 'list',
  /** 单曲循环 */
  SINGLE = 'single',
  /** 随机播放 */
  RANDOM = 'random',
}

/** 全局应用状态 */
export interface GlobalState {
  /** 全局计数器 */
  count: number
  /** 主题模式 */
  theme?: 'light' | 'dark' | 'system'
  /** 搜索历史记录（最近 10 条） */
  searchHistory: string[]
  /** 界面语言 */
  lang?: 'zh' | 'en' | 'ja'
}
