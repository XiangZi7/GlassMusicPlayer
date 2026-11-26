import type { CatalogPlaylist, CatalogTrack, MusicPlatform } from '@/api'
import { getCatalogPlaylist, resolveCatalogPlaylist } from '@/api'
import { defaultCover } from '@/constants/music'
import type { SourceTrack } from '@/types/prototype'

export const platformNames: Record<MusicPlatform, string> = {
  netease: '网易云音乐',
  kugou: '酷狗音乐',
  kuwo: '酷我音乐',
}

export { defaultCover }

// 平台与曲目 ID 共同定位歌曲或歌单，允许不同平台有相同 ID。
export function catalogKey(item: {
  platform: MusicPlatform
  id: string
}): string {
  return `${item.platform}:${item.id}`
}

// 将 API 曲目转换为公用列表与播放队列的曲目类型。
export function toSourceTrack(track: CatalogTrack): SourceTrack {
  return {
    title: track.title,
    artist: track.artists.join(' / ') || '未知歌手',
    artists: track.artists,
    album: track.album || '—',
    subtitle: track.subtitle,
    dur: Math.max(0, (track.durationMs || 0) / 1000),
    cover: track.coverUrl || defaultCover,
    q: platformNames[track.platform],
    glow: 'rgba(110,140,255,.55)',
    catalog: {
      platform: track.platform,
      id: track.id,
      sourceUrl: track.sourceUrl,
      artistRefs: track.artistRefs,
      albumRef: track.albumRef,
      kugouAlbumAudioId: track.platform === 'kugou' ? track.kugouAlbumAudioId ?? undefined : undefined,
    },
  }
}

// 完整拉取公开歌单后再交给曲库保存，任意一页失败时保留已保存的版本。
export async function fetchPublicPlaylist(
  text: string,
  signal: AbortSignal,
  onProgress: (count: number) => void
): Promise<CatalogPlaylist> {
  const input = text.trim()
  const url = /https?:\/\//i.test(input) ? input : `https://${input}`
  const first = await resolveCatalogPlaylist(url, 100, signal)
  return fetchFollowingPages(first, signal, onProgress)
}

// 用用户公开歌单列表中的平台和 ID 读取完整曲目。
export async function fetchLinkedPlaylist(
  platform: MusicPlatform,
  id: string,
  signal: AbortSignal,
  onProgress?: (count: number) => void
): Promise<CatalogPlaylist> {
  const first = await getCatalogPlaylist(platform, id, 1, 100, signal)
  if (first.platform !== platform || first.id !== id || first.pageNum !== 1 || !(first.pageSize > 0))
    throw new Error('音乐平台返回的歌单信息不一致，请重试。')
  return fetchFollowingPages(first, signal, onProgress)
}

// 两种导入入口共用分页与上游歌单一致性校验。
async function fetchFollowingPages(
  first: CatalogPlaylist,
  signal: AbortSignal,
  onProgress?: (count: number) => void
): Promise<CatalogPlaylist> {
  const pageSize = first.pageSize
  if (first.tracks.some(track => track.platform !== first.platform) || (!first.tracks.length && (first.total ?? 0) > 0))
    throw new Error('音乐平台未返回这份歌单的完整曲目，请重试。')
  const tracks = [...first.tracks]
  onProgress?.(tracks.length)
  let previous = first
  for (
    let pageNum = 2;
    first.total === null
      ? previous.tracks.length === pageSize
      : (pageNum - 1) * pageSize < first.total;
    pageNum++
  ) {
    if (pageNum > 1000) throw new Error('歌单超出音乐服务支持的分页范围。')
    const page = await getCatalogPlaylist(
      first.platform,
      first.id,
      pageNum,
      pageSize,
      signal
    )
    if (
      page.id !== first.id ||
      page.platform !== first.platform ||
      page.pageNum !== pageNum || page.pageSize !== pageSize ||
      page.tracks.some(track => track.platform !== first.platform)
    ) {
      throw new Error('音乐平台返回了其他歌单的曲目，请重试。')
    }
    if (page.total !== first.total || (!page.tracks.length && (first.total ?? 0) > (pageNum - 1) * pageSize))
      throw new Error('歌单在读取期间发生变化或分页不完整，请重试。')
    tracks.push(...page.tracks)
    onProgress?.(tracks.length)
    previous = page
  }
  return { ...first, tracks }
}
