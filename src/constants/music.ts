import type { SourceTrack } from '@/types/prototype'

export const defaultCover = '/images/music-placeholder.svg'

export const playbackQualities = [
  {
    label: '自动',
    value: 'auto',
    icon: 'M4 10a8 8 0 0 1 13-4l3 3m0-5v5h-5M20 14a8 8 0 0 1-13 4l-3-3m0 5v-5h5',
  },
  {
    label: '标准',
    value: 'standard',
    icon: 'M9 17V6l11-2v11M9 17a3 2.5 0 1 1-3-2.5c1.7 0 3 1.1 3 2.5Zm11-2a3 2.5 0 1 1-3-2.5c1.7 0 3 1.1 3 2.5Z',
  },
  {
    label: '极高',
    value: 'exhigh',
    icon: 'M4 15v4m5-8v8m5-12v12m5-16v16',
  },
  {
    label: '无损',
    value: 'lossless',
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Zm0 7a2 2 0 1 0 0 4 2 2 0 1 0 0-4Zm-6 2a6 6 0 0 1 6-6',
  },
  {
    label: 'Hi-Res',
    value: 'hires',
    icon: 'M3 10v4m4-8v12m5-15v18m5-15v12m4-8v4',
  },
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
