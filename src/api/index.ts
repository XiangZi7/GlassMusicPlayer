import { apiBaseUrl, httpGet, httpPost } from '@/utils/http'
import { creditedCollectionId } from '@/services/player/library'
import {
  playbackBearer,
  restorePlaybackGrant,
  clearPlaybackGrant,
} from '@/services/player/playback-session'

export type MusicPlatform = 'netease' | 'kugou' | 'kuwo'
export type PublicProfilePlatform = Exclude<MusicPlatform, 'kugou'>
export type CatalogCollectionKind = 'artist' | 'album'

export interface CatalogRef {
  id: string
  name: string
}

export interface CatalogTrack {
  platform: MusicPlatform
  id: string
  /** 酷狗公开曲目记录里与文件 hash 对应的专辑曲目编号。 */
  kugouAlbumAudioId?: string | null
  title: string
  artists: string[]
  /** 来自这首歌所属平台的歌手与专辑编号，旧版曲目可能缺少。 */
  artistRefs?: CatalogRef[]
  albumRef?: CatalogRef | null
  album: string | null
  subtitle?: string | null
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
  /** 平台确认的系统喜欢歌单所有者，普通歌单省略此字段。 */
  favoriteOwnerId?: string | null
  id: string
  title: string | null
  coverUrl: string | null
  sourceUrl: string
}

export interface CatalogCollectionPage extends CatalogPage {
  kind: CatalogCollectionKind
  id: string
  name: string
  coverUrl: string | null
  description: string | null
  sourceUrl: string
  hasMore: boolean
}

export interface CatalogLyrics {
  lrc: string
  translatedLrc: string
  yrc?: string
  ytlrc?: string
}

export interface PublicPlaylistSummary {
  /** 平台确认的系统喜欢歌单所有者，可用于补齐旧导入记录。 */
  favoriteOwnerId?: string | null
  id: string
  title: string
  coverUrl: string | null
  trackCount: number | null
}

export interface PlaylistSearchPage {
  platform: MusicPlatform
  pageNum: number
  pageSize: number
  total: number | null
  playlists: PublicPlaylistSummary[]
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
  quality?: string
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

// 读取当前服务已接通歌单搜索的平台。
export function getPlaylistSearchPlatforms(signal: AbortSignal) {
  return httpGet<MusicPlatform[]>('/platforms/playlist-search', { signal })
}

// 按关键词搜索所选平台的公开歌单，列表仅获取摘要。
export function searchCatalogPlaylists(
  platform: MusicPlatform, q: string, pageNum: number, pageSize: number, signal: AbortSignal
) {
  return httpGet<PlaylistSearchPage>(`/${platform}/search/playlists`, {
    params: { q, pageNum, pageSize }, signal,
  })
}

// 读取同平台曲目详情，为旧歌单和精简列表补齐作品说明。
export function getCatalogTrack(platform: MusicPlatform, id: string, signal: AbortSignal, kugouAlbumAudioId?: string | null) {
  const params = platform === 'kugou' && kugouAlbumAudioId ? { kugouAlbumAudioId } : undefined
  return httpGet<CatalogTrack>(`/${platform}/tracks/${encodeURIComponent(id)}`, { signal, params })
}

// 按平台目录的稳定编号读取一页歌手作品或专辑曲目。
export async function getCatalogCollection(
  platform: MusicPlatform, kind: CatalogCollectionKind, id: string,
  pageNum: number, pageSize: number, signal: AbortSignal
) {
  const collection = kind === 'artist' ? 'artists' : 'albums'
  try {
    return await httpGet<CatalogCollectionPage>(`/${platform}/${collection}/${encodeURIComponent(id)}`, {
      params: { pageNum, pageSize }, signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'route_not_found')
      throw new Error('当前音乐服务尚未提供这个目录接口，请更新 MiraiMusic-Server 后重试。')
    throw error
  }
}

// 旧版曲库只有展示名称时，回查同一平台的原曲；仅接受与所点署名唯一对应的编号。
export async function resolveCatalogCollectionId(
  platform: MusicPlatform, kind: CatalogCollectionKind, trackId: string, name: string, signal: AbortSignal,
  kugouAlbumAudioId?: string | null,
): Promise<string> {
  const track = await getCatalogTrack(platform, trackId, signal, kugouAlbumAudioId)
  const sameTrack = platform === 'kugou' ? track.id.toLowerCase() === trackId.toLowerCase() : track.id === trackId
  if (track.platform !== platform || !sameTrack) throw new Error('返回的歌曲与所选平台曲目不一致。')
  if (platform === 'kugou' && kugouAlbumAudioId && track.kugouAlbumAudioId !== kugouAlbumAudioId)
    throw new Error('酷狗未确认所选专辑版本的曲目编号。')
  if (!('artistRefs' in track) && !('albumRef' in track))
    throw new Error('音乐服务尚未返回歌手和专辑编号，请更新 MiraiMusic-Server 后重试。')
  const refs = kind === 'artist' ? track.artistRefs : track.albumRef ? [track.albumRef] : []
  const id = creditedCollectionId(refs, name)
  if (!id) throw new Error('音乐服务未返回可确认的' + (kind === 'artist' ? '歌手' : '专辑') + '编号。')
  return id
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

// 将本设备的网易云授权只发给对应平台的每日推荐接口。
export function getAccountDailyTracks(signal: AbortSignal): Promise<CatalogTrack[]> {
  const token = playbackBearer()
  if (!token) return Promise.reject(new Error('需要网易云登录授权'))
  return httpGet<CatalogTrack[]>('/netease/auth/recommendations/daily', {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  })
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
export async function getCatalogPlayback(
  platform: MusicPlatform,
  id: string,
  signal: AbortSignal,
  quality?: string
) {
  if (platform === 'netease') await restorePlaybackGrant()
  const token = platform === 'netease' ? playbackBearer() : ''
  try {
    const result = await httpGet<CatalogPlayback>(
      `/${platform}/tracks/${encodeURIComponent(id)}/playback`,
      {
        signal,
        params: { quality },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    )
    return { ...result, accountPlayback: !!token }
  } catch (error) {
    if (
      token &&
      token === playbackBearer() &&
      error instanceof Error &&
      error.name === 'playback_session_expired'
    )
      clearPlaybackGrant()
    throw error
  }
}

// 音频元素直接读取支持 Range 的接口，保持浏览器的流式播放及拖动进度。
export function getCatalogAudioUrl(
  platform: MusicPlatform,
  id: string,
  quality?: string
): string {
  const query = quality ? '?' + new URLSearchParams({ quality }) : ''
  return `${apiBaseUrl}/${platform}/tracks/${encodeURIComponent(id)}/audio${query}`
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
