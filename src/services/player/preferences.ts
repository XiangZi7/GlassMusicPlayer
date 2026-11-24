import type { SourceTrack } from '@/types/prototype'
import { defaultCover } from '@/constants/music'

type SettingValue = string | number | boolean
export interface PlayerPreferences<T extends Record<string, SettingValue>> {
  settings: T
  volume: number
  muted: boolean
  panelOpen: boolean
  current: { key: string; time: number } | null
  queue: string[]
  liked: string[]
  recent: string[]
  searchHistory: string[]
  catalogTracks: SourceTrack[]
}
export const preferencesKey = 'miraiMusic.preferences.v1'

// 整理搜索历史，过滤无效值并保留最近使用的十二个不同关键词。
export function recentSearches(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const word = typeof item === 'string' ? item.trim() : ''
    const key = word.toLowerCase()
    if (!word || word.length > 100 || seen.has(key)) continue
    result.push(word)
    seen.add(key)
    if (result.length === 12) break
  }
  return result
}

// 曲目持久化使用平台 ID；演示曲目使用内容标识，避免曲库索引变化指向其它歌曲。
export function preferenceTrackKey(track: SourceTrack): string {
  return track.catalog
    ? `${track.catalog.platform}:${track.catalog.id}`
    : `demo:${encodeURIComponent([track.title, track.artist, track.album].join('|'))}`
}

// 只接受普通对象，防止损坏缓存或原型字段污染播放器偏好。
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

// 恢复曲目仅保留公开展示字段，绝不缓存临时音频 URL、Cookie 或 token。
function publicTrack(value: unknown): SourceTrack | undefined {
  const row = object(value),
    catalog = object(row.catalog)
  if (
    !['netease', 'kugou', 'kuwo'].includes(String(catalog.platform)) ||
    typeof catalog.id !== 'string' ||
    catalog.id.length > 40 ||
    !catalog.id.length
  )
    return
  if (
    typeof row.title !== 'string' ||
    typeof row.artist !== 'string' ||
    typeof row.cover !== 'string' ||
    typeof catalog.sourceUrl !== 'string'
  )
    return
  const cover = row.cover === '/images/night-drive.webp' ? defaultCover : row.cover
  try {
    for (const text of cover === defaultCover ? [catalog.sourceUrl] : [cover, catalog.sourceUrl]) {
      const url = new URL(text)
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return
    }
  } catch {
    return
  }
  return {
    title: row.title.slice(0, 500),
    artist: row.artist.slice(0, 500),
    album: typeof row.album === 'string' ? row.album.slice(0, 500) : '—',
    subtitle: typeof row.subtitle === 'string' ? row.subtitle.slice(0, 1000) : undefined,
    cover,
    dur:
      typeof row.dur === 'number' && Number.isFinite(row.dur)
        ? Math.max(0, Math.min(86400, row.dur))
        : 0,
    q:
      typeof row.q === 'string'
        ? row.q.slice(0, 100)
        : String(catalog.platform),
    glow:
      typeof row.glow === 'string' && /^rgba?\([\d.,\s]+\)$/.test(row.glow)
        ? row.glow
        : 'rgba(110,140,255,.55)',
    catalog: {
      platform: catalog.platform as 'netease' | 'kugou' | 'kuwo',
      id: catalog.id,
      sourceUrl: catalog.sourceUrl,
    },
  }
}

// 限制缓存中的键数量和长度，恢复缺失曲目时由 store 忽略而不是伪造曲库。
function keys(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === 'string' && item.length > 0 && item.length <= 2000
          )
        ),
      ].slice(0, 3000)
    : []
}

// 使用显式默认值白名单恢复偏好；类型不匹配、损坏或过大缓存不会阻止启动。
export function readPlayerPreferences<T extends Record<string, SettingValue>>(
  defaults: T
): PlayerPreferences<T> {
  const result: PlayerPreferences<T> = {
    settings: { ...defaults },
    volume: 70,
    muted: false,
    panelOpen: true,
    current: null,
    queue: [],
    liked: [],
    recent: [],
    searchHistory: [],
    catalogTracks: [],
  }
  try {
    const text = localStorage.getItem(preferencesKey)
    if (!text || text.length > 1000000) return result
    const saved = object(JSON.parse(text))
    if (saved.version !== 1) return result
    const settings = object(saved.settings)
    for (const key of Object.keys(defaults)) {
      const value = settings[key]
      if (
        typeof value !== typeof defaults[key] ||
        (typeof value === 'number' && !Number.isFinite(value)) ||
        (typeof value === 'string' && value.length > 65536)
      )
        continue
      Object.assign(result.settings, { [key]: value })
    }
    if (typeof saved.volume === 'number' && Number.isFinite(saved.volume))
      result.volume = Math.max(0, Math.min(100, saved.volume))
    result.muted = saved.muted === true
    result.panelOpen = saved.panelOpen !== false
    const current = object(saved.current)
    if (
      typeof current.key === 'string' &&
      current.key.length <= 2000 &&
      typeof current.time === 'number' &&
      Number.isFinite(current.time)
    )
      result.current = {
        key: current.key,
        time: Math.max(0, Math.min(86400, current.time)),
      }
    result.queue = keys(saved.queue)
    result.liked = keys(saved.liked)
    result.recent = keys(saved.recent)
    result.searchHistory = recentSearches(saved.searchHistory)
    if (Array.isArray(saved.catalogTracks))
      result.catalogTracks = saved.catalogTracks
        .slice(0, 512)
        .map(publicTrack)
        .filter((track): track is SourceTrack => !!track)
  } catch {
    /* 无本机存储权限或损坏 JSON 时维持默认设置。 */
  }
  return result
}

// 保存用户偏好与公开曲目元数据，写入失败返回 false，不影响正在播放或删除旧数据。
export function writePlayerPreferences<T extends Record<string, SettingValue>>(
  preferences: PlayerPreferences<T>
): boolean {
  try {
    const catalogTracks = preferences.catalogTracks
      .map(publicTrack)
      .filter((track): track is SourceTrack => !!track)
      .slice(0, 512)
    localStorage.setItem(
      preferencesKey,
      JSON.stringify({
        version: 1,
        settings: Object.fromEntries(
          Object.entries(preferences.settings).filter(([key]) =>
            [
              'closeToTray',
              'gapless',
              'crossfadeOn',
              'normalize',
              'weather',
              'motion',
              'glassStyle',
              'crossfade',
              'quality',
              'bottomSpectrum',
              'output',
              'eq',
              'eqEnabled',
              'eqPreamp',
              'eqGains',
              'eqAutoHeadroom',
              'eqCustomPresets',
              'downloadQuality',
              'cacheDirectory',
              'downloadDirectory',
              'rememberPlayback',
              'sleep',
              'deskLyrics',
              'deskLock',
              'lyricIsland',
              'lyricIslandSnap',
              'trayMini',
              'smtc',
            ].includes(key)
          )
        ),
        volume: preferences.volume,
        muted: preferences.muted,
        panelOpen: preferences.panelOpen,
        current: preferences.current
          ? { key: preferences.current.key, time: preferences.current.time }
          : null,
        queue: keys(preferences.queue),
        liked: keys(preferences.liked),
        recent: keys(preferences.recent),
        searchHistory: recentSearches(preferences.searchHistory),
        catalogTracks,
      })
    )
    return true
  } catch {
    return false
  }
}
