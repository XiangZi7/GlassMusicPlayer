import { apiBaseUrl, httpGet, httpPost } from '@/utils/http'

export type MusicPlatform = 'netease' | 'kugou' | 'kuwo'
export type PublicProfilePlatform = Exclude<MusicPlatform, 'kugou'>

export interface CatalogTrack {
  platform: MusicPlatform
  id: string
  title: string
  artists: string[]
  album: string | null
  durationMs: number | null
  coverUrl: string | null
  sourceUrl: string
}

export interface CatalogPage {
  platform: MusicPlatform
  pageNum: number
  pageSize: number
  total: number | null
  tracks: CatalogTrack[]
}

export interface CatalogPlaylist extends CatalogPage {
  id: string
  title: string | null
  coverUrl: string | null
  sourceUrl: string
}

export interface CatalogLyrics {
  lrc: string
  translatedLrc: string
  yrc?: string
  ytlrc?: string
}

export interface PublicPlaylistSummary {
  id: string
  title: string
  coverUrl: string | null
  trackCount: number | null
}

export interface PublicUserPlaylists {
  platform: PublicProfilePlatform
  userId: string
  displayName: string | null
  avatarUrl?: string | null
  pageNum: number
  pageSize: number
  hasMore: boolean
  playlists: PublicPlaylistSummary[]
}

export type PlaybackStatus = 'full' | 'preview' | 'unknown' | 'unavailable'

export interface CatalogPlayback {
  status: PlaybackStatus
  url: string | null
  bitrateKbps: number | null
  sourceUrl: string
}

// 按服务端的真实分页搜索所选平台，切换查询时可取消上一请求。
export function searchCatalog(
  platform: MusicPlatform,
  q: string,
  pageNum: number,
  pageSize: number,
  signal: AbortSignal
) {
  return httpGet<CatalogPage>(`/${platform}/search`, {
    params: { q, pageNum, pageSize },
    signal,
  })
}

// 首次请求解析链接并读取歌单第一页，平台与 ID 由服务端确认。
export function resolveCatalogPlaylist(
  url: string,
  pageSize: number,
  signal: AbortSignal
) {
  return httpPost<CatalogPlaylist>(
    '/playlists/resolve',
    { url },
    { params: { pageSize }, signal }
  )
}

// 使用同一歌单 ID 继续获取后续曲目，保留原歌单顺序。
export function getCatalogPlaylist(
  platform: MusicPlatform,
  id: string,
  pageNum: number,
  pageSize: number,
  signal: AbortSignal
) {
  return httpGet<CatalogPlaylist>(
    `/${platform}/playlists/${encodeURIComponent(id)}`,
    { params: { pageNum, pageSize }, signal }
  )
}

// 查阅已提供 UID 的公开主页歌单，保留服务端分页字段。
export function getPublicUserPlaylists(
  platform: PublicProfilePlatform,
  userId: string,
  pageNum: number,
  pageSize: number,
  signal: AbortSignal
) {
  return httpGet<PublicUserPlaylists>(
    `/${platform}/users/${encodeURIComponent(userId)}/playlists`,
    { params: { pageNum, pageSize }, signal }
  )
}

// 点歌时获取短期音频地址，地址只用于当前播放。
export function getCatalogPlayback(
  platform: MusicPlatform,
  id: string,
  signal: AbortSignal
) {
  return httpGet<CatalogPlayback>(
    `/${platform}/tracks/${encodeURIComponent(id)}/playback`,
    { signal }
  )
}

// 音频元素直接读取支持 Range 的接口，保持浏览器的流式播放及拖动进度。
export function getCatalogAudioUrl(
  platform: MusicPlatform,
  id: string
): string {
  return `${apiBaseUrl}/${platform}/tracks/${encodeURIComponent(id)}/audio`
}

// 获取原文、译文及平台提供的逐字时间轴，供主窗口和独立歌词窗展示。
export function getCatalogLyrics(
  platform: MusicPlatform,
  id: string,
  signal: AbortSignal
) {
  return httpGet<CatalogLyrics>(
    `/${platform}/tracks/${encodeURIComponent(id)}/lyrics`,
    { signal }
  )
}
