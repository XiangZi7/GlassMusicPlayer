/**
 * API 响应数据转换器
 * 统一处理各种 API 响应格式的数据转换
 */

// ============ 类型定义 ============

export interface BannerData {
  coverImgUrl: string
  title: string
  description: string
  url: string
}

export interface PlaylistData {
  id: number | string
  name: string
  coverImgUrl: string
  playCount: number
  trackCount?: number
}

export interface SongData {
  id: number | string
  name: string
  artist: string
  artistId?: number | string
  artists?: { id: number | string; name: string }[]
  album: string
  albumId?: number | string
  cover: string
  duration: number
  liked?: boolean
  mvId?: number | string
}

export interface ArtistData {
  id: number | string
  name: string
  picUrl: string
  alias?: string[]
  albumSize?: number
  musicSize?: number
  mvSize?: number
}

export interface MVData {
  id: number | string
  name: string
  cover: string
  artist: string
  playCount?: number
  duration?: number
}

export interface AlbumData {
  id: number | string
  name: string
  picUrl: string
  artist: string
  artistId?: number | string
  publishTime?: string
  size?: number
  description?: string
}

export interface PlaylistDetailData {
  name: string
  description: string
  creator: string
  creatorAvatar: string
  createTime: string
  songCount: number
  playCount: string | number
  likes: string | number
  category: string
  coverImgUrl: string
}

// ============ 数据提取器 ============

type ApiResponse = Record<string, unknown>

/**
 * 从 API 响应中提取数据，支持多种响应格式
 */
export function extractData<T>(
  response: ApiResponse,
  ...paths: string[]
): T | undefined {
  for (const path of paths) {
    const keys = path.split('.')
    let result: unknown = response
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = (result as Record<string, unknown>)[key]
      } else {
        result = undefined
        break
      }
    }
    if (result !== undefined) return result as T
  }
  return undefined
}

/**
 * 提取数组数据
 */
export function extractArray<T = unknown>(
  response: ApiResponse,
  ...paths: string[]
): T[] {
  const data = extractData<T[]>(response, ...paths)
  return Array.isArray(data) ? data : []
}

// ============ 转换器 ============

/**
 * 转换 Banner 数据
 */
export function transformBanner(item: Record<string, unknown>): BannerData {
  return {
    coverImgUrl: (item?.pic as string) || (item?.imageUrl as string) || '',
    title: (item?.typeTitle as string) || '',
    description: (item?.title as string) || '',
    url: (item?.url as string) || '',
  }
}

/**
 * 批量转换 Banner
 */
export function transformBanners(
  response: ApiResponse,
  limit?: number
): BannerData[] {
  const list = extractArray(response, 'data.banners', 'banners')
  const result = list.map(item => transformBanner(item as Record<string, unknown>))
  return limit ? result.slice(0, limit) : result
}

/**
 * 转换歌单数据
 */
export function transformPlaylist(
  item: Record<string, unknown>,
  fallbackName = '未知歌单'
): PlaylistData {
  return {
    id: (item?.id as number | string) || 0,
    name: (item?.name as string) || fallbackName,
    coverImgUrl: (item?.picUrl as string) || (item?.coverImgUrl as string) || '',
    playCount: (item?.playCount as number) || 0,
    trackCount: (item?.trackCount as number) || 0,
  }
}

/**
 * 批量转换歌单（推荐歌单）
 */
export function transformPlaylists(
  response: ApiResponse,
  limit?: number,
  fallbackName = '未知歌单'
): PlaylistData[] {
  const list = extractArray(response, 'result', 'data.result', 'playlists', 'data.playlists')
  const result = list.map(item =>
    transformPlaylist(item as Record<string, unknown>, fallbackName)
  )
  return limit ? result.slice(0, limit) : result
}

/**
 * 提取艺术家名称
 */
function extractArtistName(item: Record<string, unknown>): string {
  const ar = item?.ar as Array<Record<string, unknown>> | undefined
  const artists = item?.artists as Array<Record<string, unknown>> | undefined
  const songArtists = (item?.song as Record<string, unknown>)?.artists as
    | Array<Record<string, unknown>>
    | undefined

  const artistList = ar || artists || songArtists
  if (Array.isArray(artistList)) {
    return artistList.map(a => a?.name || '').join(' / ')
  }
  return (item?.artistName as string) || ''
}

/**
 * 转换歌曲数据
 */
export function transformSong(item: Record<string, unknown>): SongData {
  const song = item?.song as Record<string, unknown> | undefined
  const al = item?.al as Record<string, unknown> | undefined
  const album = item?.album as Record<string, unknown> | undefined
  const songAlbum = song?.album as Record<string, unknown> | undefined

  const albumData = al || album || songAlbum

  // 提取歌手数组
  const ar = item?.ar as Array<Record<string, unknown>> | undefined
  const artistsRaw = item?.artists as Array<Record<string, unknown>> | undefined
  const songArtists = song?.artists as Array<Record<string, unknown>> | undefined
  const artistList = ar || artistsRaw || songArtists

  const artists = Array.isArray(artistList)
    ? artistList.map(a => ({
        id: (a?.id as number | string) || 0,
        name: (a?.name as string) || '',
      }))
    : undefined

  // 提取单个歌手 ID（用于只有一个歌手的情况）
  const artistId = artists?.[0]?.id || 0

  return {
    id: (item?.id as number | string) || (song?.id as number | string) || 0,
    name: (item?.name as string) || (song?.name as string) || '',
    artist: extractArtistName(item),
    artistId,
    artists,
    album: (albumData?.name as string) || '',
    albumId: (albumData?.id as number | string) || 0,
    cover: (albumData?.picUrl as string) || (item?.picUrl as string) || '',
    duration: (item?.dt as number) ?? (item?.duration as number) ?? (song?.duration as number) ?? 0,
    liked: false,
    mvId: (item?.mv as number | string) || (item?.mvid as number | string) || 0,
  }
}

/**
 * 批量转换歌曲
 */
export function transformSongs(
  response: ApiResponse,
  limit?: number
): SongData[] {
  const list = extractArray(
    response,
    'songs',
    'data.songs',
    'result',
    'data.result',
    'result.songs'
  )
  const result = list.map(item => transformSong(item as Record<string, unknown>))
  return limit ? result.slice(0, limit) : result
}

/**
 * 转换歌手数据
 */
export function transformArtist(item: Record<string, unknown>): ArtistData {
  return {
    id: (item?.id as number | string) || 0,
    name: (item?.name as string) || '',
    picUrl:
      (item?.picUrl as string) ||
      (item?.img1v1Url as string) ||
      (item?.cover as string) ||
      (item?.avatar as string) ||
      '',
    alias: (item?.alias as string[]) || [],
    albumSize: (item?.albumSize as number) || 0,
    musicSize: (item?.musicSize as number) || 0,
    mvSize: (item?.mvSize as number) || 0,
  }
}

/**
 * 批量转换歌手
 */
export function transformArtists(
  response: ApiResponse,
  limit?: number
): ArtistData[] {
  const list = extractArray(response, 'artists', 'data.artists', 'result.artists')
  const result = list.map(item => transformArtist(item as Record<string, unknown>))
  return limit ? result.slice(0, limit) : result
}

/**
 * 转换 MV 数据
 */
export function transformMV(item: Record<string, unknown>): MVData {
  return {
    id: (item?.id as number | string) || 0,
    name: (item?.name as string) || '',
    cover:
      (item?.cover as string) ||
      (item?.picUrl as string) ||
      (item?.imgurl as string) ||
      '',
    artist: (item?.artistName as string) || '',
    playCount: (item?.playCount as number) || 0,
    duration: (item?.duration as number) || 0,
  }
}

/**
 * 批量转换 MV
 */
export function transformMVs(
  response: ApiResponse,
  limit?: number
): MVData[] {
  const list = extractArray(response, 'result', 'data.result', 'mvs', 'data.mvs', 'result.mvs')
  const result = list.map(item => transformMV(item as Record<string, unknown>))
  return limit ? result.slice(0, limit) : result
}

/**
 * 转换专辑数据
 */
export function transformAlbum(item: Record<string, unknown>): AlbumData {
  const artist = item?.artist as Record<string, unknown> | undefined

  return {
    id: (item?.id as number | string) || 0,
    name: (item?.name as string) || '',
    picUrl: (item?.picUrl as string) || (item?.blurPicUrl as string) || '',
    artist: (artist?.name as string) || (item?.artistName as string) || '',
    artistId: (artist?.id as number | string) || 0,
    publishTime: item?.publishTime
      ? new Date(item.publishTime as number).toLocaleDateString()
      : '',
    size: (item?.size as number) || 0,
    description: (item?.description as string) || '',
  }
}

/**
 * 批量转换专辑
 */
export function transformAlbums(
  response: ApiResponse,
  limit?: number
): AlbumData[] {
  const list = extractArray(
    response,
    'albums',
    'data.albums',
    'hotAlbums',
    'data.hotAlbums',
    'result.albums'
  )
  const result = list.map(item => transformAlbum(item as Record<string, unknown>))
  return limit ? result.slice(0, limit) : result
}

/**
 * 转换歌单详情
 */
export function transformPlaylistDetail(
  response: ApiResponse,
  fallbackCategory = '歌单'
): PlaylistDetailData | null {
  const detail = extractData<Record<string, unknown>>(
    response,
    'playlist',
    'data.playlist',
    'data'
  )

  if (!detail) return null

  const creator = detail?.creator as Record<string, unknown> | undefined
  const tags = detail?.tags as string[] | undefined

  return {
    name: (detail?.name as string) || '',
    description: (detail?.description as string) || '',
    creator: (creator?.nickname as string) || '',
    creatorAvatar: (creator?.avatarUrl as string) || '',
    createTime: detail?.createTime
      ? new Date(detail.createTime as number).toLocaleDateString()
      : '',
    songCount: (detail?.trackCount as number) || 0,
    playCount: detail?.playCount || 0,
    likes: (detail?.subscribedCount as number) || (detail?.bookedCount as number) || 0,
    category: tags?.[0] || fallbackCategory,
    coverImgUrl: (detail?.coverImgUrl as string) || '',
  }
}

/**
 * 转换歌手详情
 */
export function transformArtistDetail(
  response: ApiResponse
): ArtistData | null {
  const artist = extractData<Record<string, unknown>>(
    response,
    'data.artist',
    'artist'
  )

  if (!artist) return null

  return {
    id: (artist?.id as number | string) || 0,
    name: (artist?.name as string) || '',
    picUrl:
      (artist?.cover as string) ||
      (artist?.picUrl as string) ||
      (artist?.avatar as string) ||
      '',
    alias: (artist?.alias as string[]) || [],
    albumSize: (artist?.albumSize as number) || 0,
    musicSize: (artist?.musicSize as number) || 0,
    mvSize: (artist?.mvSize as number) || 0,
  }
}

/**
 * 转换专辑详情
 */
export function transformAlbumDetail(
  response: ApiResponse
): AlbumData | null {
  const album = extractData<Record<string, unknown>>(
    response,
    'album',
    'data.album'
  )

  if (!album) return null

  return transformAlbum(album)
}

// ============ 搜索结果转换器 ============

/**
 * 搜索歌曲结果
 */
export function transformSearchSongs(
  response: ApiResponse,
  limit?: number
): { songs: SongData[]; total: number } {
  const songs = extractArray(response, 'result.songs', 'data.result.songs')
  const total = extractData<number>(response, 'result.songCount', 'data.result.songCount') || songs.length
  const result = songs.map(item => transformSong(item as Record<string, unknown>))
  return {
    songs: limit ? result.slice(0, limit) : result,
    total,
  }
}

/**
 * 搜索歌单结果
 */
export function transformSearchPlaylists(
  response: ApiResponse,
  limit?: number
): { playlists: PlaylistData[]; total: number } {
  const playlists = extractArray(response, 'result.playlists', 'data.result.playlists')
  const total = extractData<number>(response, 'result.playlistCount', 'data.result.playlistCount') || playlists.length
  const result = playlists.map(item => transformPlaylist(item as Record<string, unknown>))
  return {
    playlists: limit ? result.slice(0, limit) : result,
    total,
  }
}

/**
 * 搜索 MV 结果
 */
export function transformSearchMVs(
  response: ApiResponse,
  limit?: number
): { mvs: MVData[]; total: number } {
  const mvs = extractArray(response, 'result.mvs', 'data.result.mvs')
  const total = extractData<number>(response, 'result.mvCount', 'data.result.mvCount') || mvs.length
  const result = mvs.map(item => transformMV(item as Record<string, unknown>))
  return {
    mvs: limit ? result.slice(0, limit) : result,
    total,
  }
}

// ============ 新歌/榜单转换器 ============

/**
 * 转换新歌榜数据 (topSong API)
 */
export function transformTopSongs(
  response: ApiResponse,
  limit?: number
): SongData[] {
  const list = extractArray(
    response,
    'data.data',
    'data.songs',
    'songs',
    'data'
  )
  const result = list.map((item: unknown) => {
    const it = item as Record<string, unknown>
    const artistsRaw = it?.artists as Array<Record<string, unknown>> | undefined
    const album = it?.album as Record<string, unknown> | undefined

    const artists = Array.isArray(artistsRaw)
      ? artistsRaw.map(a => ({
          id: (a?.id as number | string) || 0,
          name: (a?.name as string) || '',
        }))
      : undefined

    return {
      id: (it?.id as number | string) || 0,
      name: (it?.name as string) || '',
      artist: Array.isArray(artistsRaw) ? artistsRaw.map(a => a?.name || '').join(' / ') : '',
      artistId: artists?.[0]?.id || 0,
      artists,
      album: (album?.name as string) || '',
      albumId: (album?.id as number | string) || 0,
      cover: (album?.picUrl as string) || '',
      duration: (it?.duration as number) || 0,
      liked: false,
      mvId: (it?.mvid as number | string) || 0,
    }
  })
  return limit ? result.slice(0, limit) : result
}

/**
 * 转换 MV 列表 (mvAll API)
 */
export function transformMVList(
  response: ApiResponse,
  limit?: number
): MVData[] {
  const list = extractArray(response, 'data', 'mvs', 'result')
  const result = list.map((item: unknown) => {
    const m = item as Record<string, unknown>
    return {
      id: (m?.id as number | string) || (m?.vid as string) || 0,
      name: (m?.name as string) || (m?.title as string) || '',
      cover: (m?.cover as string) || (m?.imgurl as string) || (m?.pic as string) || '',
      artist: (m?.artistName as string) || '',
      playCount: (m?.playCount as number) || 0,
      duration: (m?.duration as number) || 0,
    }
  })
  return limit ? result.slice(0, limit) : result
}
