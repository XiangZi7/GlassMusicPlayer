import type { CatalogRef, MusicPlatform } from '@/api'

export interface CatalogSource {
  platform: MusicPlatform
  id: string
  sourceUrl: string
  /** 原曲所在平台的歌手、专辑身份，点击详情时使用。 */
  artistRefs?: CatalogRef[]
  albumRef?: CatalogRef | null
  /** 酷狗账号收藏使用的专辑曲目编号，null 表示同一 hash 曾对应多个编号。 */
  kugouAlbumAudioId?: string | null
}

export interface SourceTrack {
  title: string
  artist: string
  /** 平台的独立歌手署名，旧曲目和本机文件可能只提供展示文本。 */
  artists?: string[]
  album: string
  subtitle?: string | null
  dur: number
  cover: string
  q: string
  glow: string
  mine?: boolean
  catalog?: CatalogSource
}

export interface SourceSnapshot {
  track: SourceTrack
  playing: boolean
  audioLoading?: boolean
  playable?: boolean
  glassStyle?: string
  lyricIslandSnap?: boolean
  time: number
  volume: number
  liked: boolean
  favoriteBusy?: boolean
  favoriteHint?: string
  favoriteTarget?: string
  lyrics: string[]
  /** 小窗歌词片段的绝对起始行；旧格式的完整歌词从零开始。 */
  lyricOffset?: number
  lyricIndex: number
  capsuleLyric?: string
  motion: boolean
  fontSize: number
  locked: boolean
  index: number
  direction: number
}

export interface SourceAction {
  type: 'toggle' | 'next' | 'previous' | 'like' | 'volume' | 'seek' | 'focus'
  value?: number
  favoriteTarget?: string
}

export interface SourcePlayer {
  getSnapshot(): SourceSnapshot
  dispatch(action: SourceAction): void
  destroy(): void
}

export interface SourcePlayerOptions {
  prepareStage?: (signal: AbortSignal) => Promise<void>
  onStateChange?: (snapshot: SourceSnapshot) => void
  onDesktop?: (mode: 'mini' | 'lyr' | 'media') => void
  onSettings?: () => void
}
