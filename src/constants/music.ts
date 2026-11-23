import type { SourceTrack } from '@/types/prototype'

export const defaultCover = '/images/music-placeholder.svg'

export const playbackQualities = [
  { label: '自动', value: 'auto' }, { label: '标准', value: 'standard' },
  { label: '极高', value: 'exhigh' }, { label: '无损', value: 'lossless' },
  { label: 'Hi-Res', value: 'hires' },
]

// 恢复旧版展示用音质名称，平台没有对应档位时使用自动协商。
export function normalizePlaybackQuality(value: string): string {
  const legacy: Record<string, string> = { '标准': 'standard', 'FLAC · 16-BIT': 'lossless', 'FLAC · 24-BIT': 'hires' }
  return playbackQualities.find(option => option.value === value)?.value ?? legacy[value] ?? 'auto'
}

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
