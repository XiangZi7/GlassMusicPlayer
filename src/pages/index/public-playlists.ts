import { getCatalogPlaylist, type CatalogPlaylist, type CatalogTrack, type MusicPlatform } from '@/api'
import { catalogKey, fetchLinkedPlaylist } from '@/services/player/catalog'
import { metaSeed } from '@/utils/stable-seed'

// 三个平台各取两份可匿名读取的公开歌单，名称、封面和曲目均由后端返回。
const sources: readonly [MusicPlatform, string][] = [
  ['netease', '3779629'], ['kugou', '9095716'], ['kuwo', '1082685104'],
  ['netease', '3778678'], ['kugou', '9183003'], ['kuwo', '2952464073'],
]
const cache = new Map<string, { day: string; playlist: CatalogPlaylist }>()
// 最近完整读完的一份公开歌单供详情和快捷播放复用，与十二首预览分别保存。
let lastFullPlaylist: { day: string; playlist: CatalogPlaylist } | undefined

// 详情和快捷播放都在平台分页全部成功后才交付曲单；失败或取消不会缓存半份结果。
export async function loadDiscoveryPlaylist(platform: MusicPlatform, id: string, signal: AbortSignal, onProgress?: (count: number) => void) {
  const day = new Date().toDateString()
  if (lastFullPlaylist?.day === day && lastFullPlaylist.playlist.platform === platform && lastFullPlaylist.playlist.id === id)
    return lastFullPlaylist.playlist
  const playlist = await fetchLinkedPlaylist(platform, id, signal, onProgress)
  signal.throwIfAborted()
  lastFullPlaylist = { day, playlist }
  return playlist
}

// 读取首页已有的元数据，打开详情时可立即显示歌单名与封面。
export function discoveryPreview(platform: MusicPlatform, id: string) {
  return cache.get(catalogKey({ platform, id }))?.playlist
}

// 网易云每天北京时间 06:00 更新歌单，以此计算推荐日期，设备时区不参与换算。
export function neteaseRecommendationDate(date: Date): string {
  return new Date(date.getTime() + (8 - 6) * 3_600_000).toISOString().slice(0, 10)
}

// 缓存当天成功读取的公开资料；单个来源失败时，保留其余歌单并允许重试。
export async function loadPublicPlaylists(day: string, signal: AbortSignal) {
  const results = await Promise.allSettled(sources.map(async ([platform, id]) => {
    const key = catalogKey({ platform, id })
    const saved = cache.get(key)
    if (saved?.day === day) return saved.playlist
    const playlist = await getCatalogPlaylist(platform, id, 1, 12, signal)
    if (playlist.platform !== platform || playlist.id !== id || !playlist.tracks.length)
      throw new Error('公开歌单暂不可用')
    if (!signal.aborted) cache.set(key, { day, playlist })
    return playlist
  }))
  return {
    playlists: results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []),
    incomplete: results.some(result => result.status === 'rejected'),
  }
}

// 多平台同名同署名的录音使用同一个去重键。
function recordingKey(track: CatalogTrack): string {
  return JSON.stringify([track.title.trim().toLowerCase(), track.artists.map(name => name.trim().toLowerCase()).sort()])
}

// 各平台交替从两份公开歌单取曲，跳过日推预览和已经出现的录音。
export function platformSelections(playlists: CatalogPlaylist[], preview: CatalogTrack[]) {
  const seen = new Set(preview.map(recordingKey))
  const groups = new Map<MusicPlatform, CatalogTrack[]>()
  const longest = Math.max(0, ...playlists.map(list => list.tracks.length))
  for (let i = 0; i < longest; i++) {
    for (const list of playlists) {
      const song = list.tracks[i]
      const songs = groups.get(list.platform) ?? []
      if (!song || songs.length >= 5) continue
      const key = recordingKey(song)
      if (seen.has(key)) continue
      seen.add(key)
      songs.push(song)
      groups.set(list.platform, songs)
    }
  }
  return [...groups].map(([platform, songs]) => ({ platform, songs }))
}

// 从公开歌单中选出作品较多的三位歌手，跳过日推预览和跨平台重复的录音。
export function selectArtistPicks(playlists: CatalogPlaylist[], preview: CatalogTrack[]) {
  const seenIds = new Set(preview.map(catalogKey))
  const seenRecordings = new Set(preview.map(recordingKey))
  const groups = new Map<string, { name: string; songs: CatalogTrack[]; cover: string | null }>()
  for (const list of playlists) {
    for (const track of list.tracks) {
      const name = track.artists[0]?.trim()
      if (!name || name === '未知歌手') continue
      const id = catalogKey(track)
      const recording = recordingKey(track)
      if (seenIds.has(id) || seenRecordings.has(recording)) continue
      seenIds.add(id)
      seenRecordings.add(recording)
      const key = name.toLowerCase()
      const group = groups.get(key) ?? { name, songs: [], cover: null }
      group.songs.push(track)
      group.cover ||= track.coverUrl || null
      groups.set(key, group)
    }
  }
  return [...groups.values()].sort((left, right) => right.songs.length - left.songs.length).slice(0, 3)
}

// 用当前账号歌单里的歌手优先发现新歌；没有口味数据时按账号与日期稳定选曲。
export function pickProfileTracks(
  playlists: CatalogPlaylist[], owned: CatalogTrack[], platform: MusicPlatform, userId: string, day: string,
): CatalogTrack[] {
  const artists = new Set(owned.flatMap(track => track.artists.map(name => name.trim().toLowerCase())))
  const familiar = new Set(owned.map(recordingKey))
  const candidates = [...playlists.flatMap(list => list.tracks), ...owned].map(track => {
    const key = recordingKey(track)
    const matchesArtist = track.artists.some(name => artists.has(name.trim().toLowerCase()))
    const rank = familiar.has(key) ? 2 : matchesArtist ? 0 : 1
    const order = metaSeed(`${catalogKey(track)}|${platform}:${userId}|${day}`)
    return { track, key, rank, order }
  })
  candidates.sort((a, b) => a.rank - b.rank || a.order - b.order)
  const seen = new Set<string>()
  const result: CatalogTrack[] = []
  for (const { track, key } of candidates) {
    if (seen.has(key)) continue
    seen.add(key)
    result.push(track)
    if (result.length === 8) break
  }
  return result
}

// 按日期轮换歌单与起始位置，交叉选取八首，跳过相同的曲目或跨平台重复署名。
export function pickDailyTracks(playlists: CatalogPlaylist[], date: Date): CatalogTrack[] {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
  const selected: CatalogTrack[] = []
  const keys = new Set<string>()
  const recordings = new Set<string>()
  const longest = Math.max(0, ...playlists.map(list => list.tracks.length))
  for (let row = 0; row < longest; row++) {
    for (let column = 0; column < playlists.length; column++) {
      const list = playlists[(column + day) % playlists.length]!.tracks
      if (row >= list.length) continue
      const track = list[(row + day) % list.length]!
      const key = catalogKey(track)
      const recording = recordingKey(track)
      if (keys.has(key) || recordings.has(recording)) continue
      keys.add(key)
      recordings.add(recording)
      selected.push(track)
      if (selected.length === 8) return selected
    }
  }
  return selected
}
