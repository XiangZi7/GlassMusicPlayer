import { invoke } from '@tauri-apps/api/core'
import type { CatalogTrack } from '@/api'
import type { KugouEdition, TuneWeavePlatform } from '@/services/player/tuneweave-session'
import type { SourceTrack } from '@/types/prototype'

export type FavoriteCloudPlatform = TuneWeavePlatform

interface FavoriteRow {
  id: string
  albumAudioId?: string | null
  hash?: string | null
  name: string
  artist: string
  album: string
  cover?: string | null
  durationMs?: number | null
}

interface FavoritePage {
  items: FavoriteRow[]
  nextOffset: number | null
  snapshotId?: string | null
}

interface HashSearchPage {
  albumAudioId: string | null
  nextOffset: number | null
  total: number
}

const hashPattern = /^[a-f\d]{32}$/i
const numericId = /^[1-9]\d{0,19}$/
const pageSize = 100
// 每次账号会话拥有自己的 hash 映射，旧请求无法把身份信息交给另一个账号。
const sessionMappings = new WeakMap<AbortSignal, { uid: string; edition: KugouEdition; ids: Map<string, string | null> }>()

// 仅收录酷狗明确返回的专辑曲目编号，同 hash 的多个编号必须保留歧义。
function rememberMapping(ids: Map<string, string | null>, hash: string, id: string): void {
  ids.set(hash, !ids.has(hash) || ids.get(hash) === id ? id : null)
}

// 将字符串形式的原生错误交给播放器，避免泛化掉扫码失效、平台拒绝等原因。
async function request<T>(command: string, args: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  try {
    const result = await invoke<T>(command, args)
    signal.throwIfAborted()
    return result
  } catch (error) {
    signal.throwIfAborted()
    throw error instanceof Error ? error : new Error(typeof error === 'string' ? error : '收藏服务请求失败')
  }
}

// 平台偶尔省略收藏条目的 hash，仅为这些曲目查询公开详情，找不到时仍保留其收藏编号。
async function fillMissingHashes(rows: FavoriteRow[], signal: AbortSignal): Promise<void> {
  const missing = new Map<string, FavoriteRow[]>()
  for (const row of rows) {
    if (row.hash && hashPattern.test(row.hash)) continue
    const entries = missing.get(row.id) ?? []
    entries.push(row)
    missing.set(row.id, entries)
  }
  const groups = [...missing.entries()]
  for (let index = 0; index < groups.length; index += 4) {
    signal.throwIfAborted()
    await Promise.all(groups.slice(index, index + 4).map(async ([id, entries]) => {
      const hash = await request<string | null>('tuneweave_kugou_track_hash', { trackId: id }, signal)
        .catch(() => { signal.throwIfAborted(); return null })
      if (hash && hashPattern.test(hash)) for (const row of entries) row.hash = hash
    }))
  }
}

// 读取同一账户的完整快照；可播放曲目使用 Mirai 的歌曲标识，缺 hash 的酷狗收藏单独保留编号。
export async function readTuneWeaveFavorites(
  platform: FavoriteCloudPlatform, userId: string, signal: AbortSignal, edition?: KugouEdition
) {
  const ids = new Set<string>()
  const tracks = new Map<string, CatalogTrack>()
  const mappings = new Map<string, string | null>()
  const unmapped = new Set<string>()
  let offset = 0
  let snapshot: string | null = null
  while (true) {
    const page = await request<FavoritePage>('tuneweave_favorites', {
      platform, uid: userId, edition, offset, limit: pageSize,
    }, signal)
    if (!Array.isArray(page.items) || page.items.length > pageSize ||
      (offset > 0 && (page.snapshotId ?? null) !== snapshot))
      throw new Error('平台喜欢列表已变化或分页无效，请重新读取。')
    snapshot = page.snapshotId ?? null
    if (page.items.some(row => !numericId.test(row.id) || (platform === 'kugou' && row.albumAudioId !== row.id)))
      throw new Error('平台未确认收藏歌曲的编号，请重新读取。')
    if (platform === 'kugou') await fillMissingHashes(page.items, signal)
    for (const row of page.items) {
      let id = row.id
      if (platform === 'kugou') {
        if (!row.hash || !hashPattern.test(row.hash)) { unmapped.add(row.id); continue }
        id = row.hash.toLowerCase()
        rememberMapping(mappings, id, row.id)
      }
      ids.add(id)
      if (!row.name?.trim() || tracks.has(id)) continue
      tracks.set(id, {
        platform, id, title: row.name, artists: row.artist ? [row.artist] : [],
        album: row.album || null, coverUrl: row.cover || null, durationMs: row.durationMs ?? null,
        sourceUrl: platform === 'kuwo'
          ? `https://www.kuwo.cn/play_detail/${id}`
          : `https://www.kugou.com/song/#hash=${id}`,
      })
    }
    if (page.nextOffset === null) break
    if (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset || !page.items.length)
      throw new Error('平台返回的收藏分页位置无效。')
    offset = page.nextOffset
  }
  signal.throwIfAborted()
  if (platform === 'kugou' && edition) {
    sessionMappings.set(signal, { uid: userId, edition, ids: mappings })
    for (const track of tracks.values()) track.kugouAlbumAudioId = mappings.get(track.id)
    for (const id of mappings.values()) if (id) unmapped.delete(id)
  }
  return { ids: [...ids], tracks: [...tracks.values()], unmappedKugouIds: [...unmapped] }
}

// 旧曲库只提供 hash，按曲名歌手查本机 TuneWeave，完整结果中只有一个匹配编号才可写入。
async function resolveKugouId(track: SourceTrack, signal: AbortSignal): Promise<string> {
  const hash = track.catalog!.id.toLowerCase()
  const query = [track.title, track.artist === '未知歌手' ? '' : track.artist].join(' ').trim().slice(0, 100)
  let candidate: string | null = null
  let offset = 0
  let expectedTotal: number | null = null
  while (query) {
    const page = await request<HashSearchPage>('tuneweave_kugou_search_hash', { query, hash, offset }, signal)
    if (expectedTotal !== null && page.total !== expectedTotal) break
    expectedTotal = page.total
    if (page.albumAudioId !== null) {
      if (!numericId.test(page.albumAudioId) || (candidate && candidate !== page.albumAudioId)) break
      candidate = page.albumAudioId
    }
    if (page.nextOffset === null) {
      if (candidate) return candidate
      break
    }
    if (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset || page.nextOffset >= page.total) break
    offset = page.nextOffset
  }
  throw new Error('无法唯一确认这首酷狗歌曲对应的收藏编号。')
}

// 按当前账户和原曲编号写入收藏，只有原生端确认目标状态后才返回。
export async function writeTuneWeaveFavorite(
  platform: FavoriteCloudPlatform, userId: string, track: SourceTrack, liked: boolean,
  signal: AbortSignal, edition?: KugouEdition
): Promise<void> {
  signal.throwIfAborted()
  const source = track.catalog
  if (!source || source.platform !== platform) throw new Error('收藏歌曲与当前平台不一致。')
  let id = source.id
  if (platform === 'kugou') {
    if (!hashPattern.test(id)) throw new Error('缺少有效的酷狗歌曲 hash。')
    const snapshot = sessionMappings.get(signal)
    const mapped = snapshot?.uid === userId && snapshot.edition === edition ? snapshot.ids.get(id.toLowerCase()) : undefined
    const declared = source.kugouAlbumAudioId
    if (mapped === null || declared === null || (mapped && declared && mapped !== declared))
      throw new Error('同一酷狗文件对应多个歌曲编号，无法确认要修改哪一首。')
    id = declared ?? mapped ?? await resolveKugouId(track, signal)
  }
  if (!numericId.test(id)) throw new Error('缺少平台确认的收藏歌曲编号。')
  const confirmed = await request<boolean>('tuneweave_set_favorite', {
    platform, uid: userId, edition, trackId: id, liked,
  }, signal)
  if (confirmed !== liked) throw new Error('平台尚未确认这次收藏更改，请刷新后查看。')
}
