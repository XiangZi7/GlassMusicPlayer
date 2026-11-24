import type { SourceTrack } from '@/types/prototype'
import type { SortMode } from '@/stores/player'

// 按曲库排序规则排列索引，相同值保留原始索引顺序。
export function sortTrackIndices(tracks: readonly SourceTrack[], indices: number[], mode: SortMode = 'def'): number[] {
  if (mode === 'def') return indices
  return [...indices].sort((a, b) => {
    const first = tracks[a]!, second = tracks[b]!
    if (mode === 'dur') return first.dur - second.dur || a - b
    const left = first[mode], right = second[mode]
    return (left < right ? -1 : left > right ? 1 : 0) || a - b
  })
}

// 每个专辑或歌手保留首次出现的曲库索引，侧栏和本地搜索只统计登记资料。
export function firstTrackIndices(
  tracks: SourceTrack[],
  field: 'album' | 'artist',
  localOnly = false
): number[] {
  const seen = new Set<string>()
  const indices: number[] = []
  tracks.forEach((track, index) => {
    if (localOnly && track.catalog) return
    const name = track[field]
    if (seen.has(name)) return
    seen.add(name)
    indices.push(index)
  })
  return indices
}
