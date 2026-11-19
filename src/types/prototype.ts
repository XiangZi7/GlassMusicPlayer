import type { MusicPlatform } from '@/api'

export interface CatalogSource {
  platform: MusicPlatform
  id: string
  sourceUrl: string
}

export interface SourceTrack {
  title: string
  artist: string
  album: string
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
  time: number
  volume: number
  liked: boolean
  lyrics: string[]
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
}

export interface SourcePlayer {
  getSnapshot(): SourceSnapshot
  dispatch(action: SourceAction): void
  destroy(): void
}

export interface SourcePlayerOptions {
  onStateChange?: (snapshot: SourceSnapshot) => void
  onDesktop?: (mode: 'mini' | 'lyr' | 'media') => void
  onSettings?: () => void
}
