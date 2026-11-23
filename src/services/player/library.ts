import type { SourceTrack } from '@/types/prototype'

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
