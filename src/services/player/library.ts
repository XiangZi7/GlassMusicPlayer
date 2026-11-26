import type { SourceTrack } from '@/types/prototype'
import type { SortMode } from '@/stores/player'
import type { CatalogCollectionKind, CatalogRef } from '@/api'
import type { RouteLocationRaw } from 'vue-router'

// 优先使用平台原始署名；旧曲库的显示文本只按约定分隔符拆分，保留 AC/DC 等艺名。
export function trackArtistNames(track?: SourceTrack): string[] {
  const credits = track?.artists ?? (track?.artist ?? '').split(' / ')
  const names = credits.filter(name => typeof name === 'string').map(name => name.trim())
  return [...new Set(names.filter(name => name && name !== '未知歌手' && name !== '—'))]
}

// 平台搜索与单曲详情可能对同一名称使用不同的全角字符或排版引号。
function catalogTypography(name: string): string {
  return name.normalize('NFKC').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim()
}

// 优先匹配原始署名，只有同平台原曲上的编号唯一才接受排版差异。
export function creditedCollectionId(refs: readonly CatalogRef[] | undefined, name: string): string | undefined {
  const valid = refs?.filter(ref => typeof ref?.name === 'string' && /^[1-9]\d{0,19}$/.test(ref.id)) ?? []
  const exact = valid.filter(ref => ref.name.trim() === name.trim())
  const matching = exact.length ? exact : valid.filter(ref => catalogTypography(ref.name) === catalogTypography(name))
  const matches = new Set(matching.map(ref => ref.id))
  return matches.size === 1 ? matches.values().next().value : undefined
}

// 从所选歌曲本身取歌手或专辑的目录编号。
function trackCollectionId(track: SourceTrack, kind: CatalogCollectionKind, name: string): string | undefined {
  const source = track.catalog
  return creditedCollectionId(kind === 'artist' ? source?.artistRefs : source?.albumRef ? [source.albumRef] : [], name)
}

// 网络详情链接携带平台及稳定编号；旧曲目使用同平台原曲回查，刷新后仍能定位。
export function collectionRoute(kind: CatalogCollectionKind, track: SourceTrack, index: number, name: string): RouteLocationRaw {
  const source = track.catalog
  const query = source
    ? { platform: source.platform, id: trackCollectionId(track, kind, name), track: source.id, name,
        kugouAlbumAudioId: source.platform === 'kugou' ? source.kugouAlbumAudioId ?? undefined : undefined }
    : { index, artist: kind === 'artist' ? name : undefined }
  return { path: '/' + kind, query }
}

// 曲库入口按平台和目录编号分组，合唱歌曲的每个署名都有独立入口。
export function libraryCollections(tracks: readonly SourceTrack[], kind: CatalogCollectionKind) {
  const entries = new Map<string, { key: string; name: string; index: number; track: SourceTrack }>()
  tracks.forEach((track, index) => {
    const names = kind === 'artist' ? trackArtistNames(track) : [track.album.trim()]
    for (const name of names) {
      if (!name || name === '—' || (kind === 'album' && name === '未知专辑')) continue
      const id = trackCollectionId(track, kind, name)
      // 缺编号的旧网曲先保留各自原曲入口，避免同平台同名艺人或重发专辑被合并。
      const identity = id ? ['id', id] : ['name', name, track.catalog?.id ?? (kind === 'album' ? track.artist : '')]
      const key = JSON.stringify([track.catalog?.platform ?? 'local', ...identity])
      if (!entries.has(key)) entries.set(key, { key, name, index, track })
    }
  })
  return [...entries.values()]
}

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
