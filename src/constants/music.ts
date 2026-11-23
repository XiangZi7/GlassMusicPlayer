import type { SourceTrack } from '@/types/prototype'

export const defaultCover = '/images/music-placeholder.svg'

// 空播放状态的界面占位，不属于曲库、播放队列或收藏。
export const emptyTrack: Readonly<SourceTrack> = {
  title: '未选择歌曲',
  artist: '',
  album: '',
  dur: 0,
  cover: defaultCover,
  q: '',
  glow: 'rgba(110,140,255,.55)',
}
