import { reactive, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import type { SourceTrack } from '@/types/prototype'
import { publicAvatar } from '@/services/public-avatar'
import { defaultCover, normalizePlaybackQuality } from '@/constants/music'
import {
  catalogPlaybackKey,
  playbackPreferenceKey,
  preferenceTrackKey,
  readPlayerPreferences,
  writePlayerPreferences,
} from '@/services/player/preferences'
import type {
  CatalogPlaylist,
  CatalogTrack,
  PlaybackStatus,
  MusicPlatform,
  PublicUserPlaylists,
} from '@/api'
import {
  catalogKey,
  fetchLinkedPlaylist,
  platformNames,
  toSourceTrack,
} from '@/services/player/catalog'
import { normalizeBannerCharacter } from '@/services/player/banner-art'
import { useTrackFavorites } from '@/services/player/favorites'
import { trackArtistNames } from '@/services/player/library'
import { notify } from '@/services/notification'

export interface Playlist {
  id?: string
  name: string
  source: string
  count: number
  cover?: string
  trackIndices?: number[]
}

const importedKey = 'miraiMusic.publicPlaylists.v1'
const profilesKey = 'miraiMusic.publicPlatformProfiles.v1'

interface ProfilePosition {
  userId: string
  index: number
}

type SavedPlaylist = CatalogPlaylist & { profilePosition?: ProfilePosition }

export type LinkedProfile = Pick<
  PublicUserPlaylists,
  'userId' | 'displayName'
> & {
  syncedAt: number
  avatarUrl?: string | null
}
export type LinkedProfiles = Partial<Record<MusicPlatform, LinkedProfile>>

// 恢复本机关联记录，只读取公开 UID、昵称和同步时间。
function readLinkedProfiles(): LinkedProfiles {
  try {
    const saved: LinkedProfiles = JSON.parse(
      localStorage.getItem(profilesKey) || '{}'
    )
    const result: LinkedProfiles = {}
    for (const platform of ['netease', 'kugou', 'kuwo'] as const) {
      const profile = saved?.[platform]
      if (
        profile &&
        typeof profile.userId === 'string' &&
        /^(?:[1-9]\d{0,19})$/.test(profile.userId) &&
        Number.isFinite(profile.syncedAt)
      ) {
        result[platform] = {
          userId: profile.userId,
          displayName:
            typeof profile.displayName === 'string'
              ? profile.displayName.slice(0, 200)
              : null,
          syncedAt: profile.syncedAt,
          avatarUrl: publicAvatar(profile.avatarUrl),
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

// 恢复播放器自己保存的公开歌单，旧版本或损坏的缓存不会影响启动。
function readImportedPlaylists(): SavedPlaylist[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(importedKey) || '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter(
      item =>
        item &&
        Object.prototype.hasOwnProperty.call(platformNames, item.platform) &&
        typeof item.id === 'string' &&
        Array.isArray(item.tracks)
    )
  } catch {
    return []
  }
}

export interface UploadFile {
  name: string
  size: string
  ext: string
  folder?: string
  added?: boolean
}

export type PlayerPage =
  | 'home'
  | 'daily'
  | 'discovery'
  | 'search'
  | 'library'
  | 'albums'
  | 'artists'
  | 'album'
  | 'artist'
  | 'liked'
  | 'recent'
  | 'smart'
  | 'playlist'
  | 'settings'
  | 'connect'
  | 'upload'
  | 'downloads'
  | 'hub'
  | 'radio'
export type SortMode = 'def' | 'title' | 'artist' | 'dur'

// 设置弹窗重置和播放器首次启动共用原稿默认值，每次返回独立对象。
export function createDefaultSettings() {
  return {
    // 启动后及使用期间定时发现新版本，下载由用户触发。
    autoUpdate: true,
    // 已应用的更新下载线路。
    updateSource: 'auto',
    // 自定义 HTTPS 转发前缀。
    updateDownloadProxy: '',
    // 关闭主窗口时收起到系统托盘并继续播放。
    closeToTray: true,
    gapless: true,
    crossfadeOn: true,
    normalize: false,
    weather: true,
    motion: true,
    glassStyle: 'match',
    // 首页横幅人物选择：'original' 原始人物 / 'mirai-blade' 栗山未来·血刃 /
    // 'pinkwave' 粉发波浪 / 'tealtwin' 青蓝双马尾 / 'custom' 自定义上传，
    // 选项列表与素材映射在 services/player/banner-art.ts，自定义图本体不进设置。
    bannerCharacter: 'original',
    crossfade: 6,
    quality: 'auto',
    // 主窗口底部频谱独立于首页横幅。
    bottomSpectrum: true,
    output: '桌面音箱',
    eq: '平直',
    eqEnabled: false,
    eqPreamp: 0,
    eqGains: '0,0,0,0,0,0,0,0,0,0',
    eqAutoHeadroom: true,
    eqCustomPresets: '[]',
    downloadQuality: 'exhigh',
    cacheDirectory: '',
    downloadDirectory: '',
    rememberPlayback: true,
    sleep: '关闭',
    deskLyrics: true,
    deskLock: false,
    // 灵动岛默认不启动：首次启动不创建桌面小窗，用户在设置里开启后才按需创建；
    // 已保存过偏好的用户仍以存量值为准（store 初始化时本地存储优先于此默认值）。
    lyricIsland: false,
    lyricIslandSnap: true,
    trayMini: true,
    smtc: false,
  }
}

// 从真实曲库和保存的状态初始化播放器，首次启动时没有选中的曲目。
export const usePlayerStore = defineStore('player', () => {
  const tracks = reactive<SourceTrack[]>([])
  const preferences = readPlayerPreferences(createDefaultSettings())
  preferences.settings.quality = normalizePlaybackQuality(preferences.settings.quality)
  // 存量人物的选项已下线时（如侧脸版 'mirai'）回退原始人物，各窗口共用这一处校验。
  preferences.settings.bannerCharacter = normalizeBannerCharacter(
    preferences.settings.bannerCharacter
  )
  const islandPreferences = useLocalStorage('miraiMusic.lyricIsland', {
    lyricIsland: preferences.settings.lyricIsland,
    lyricIslandSnap: preferences.settings.lyricIslandSnap,
  })
  const catalogIndices = new Map<string, number>()
  const kugouVersions = new Map<string, { known?: string | null; unresolved: Set<number> }>()
  const profilePages = new Map<string, Map<string, number>>()
  const savedPlaylists = shallowRef(readImportedPlaylists())
  const linkedProfiles = shallowRef(readLinkedProfiles())
  const favorites = useTrackFavorites(tracks, preferences.liked, linkedProfiles, savedPlaylists, updateImportedFavorite, registerCatalogTracks)
  const state = reactive({
    /** 当前曲目索引，-1 表示没有选中歌曲。 */ idx: -1,
    /** 播放和进度状态。 */ playing: false,
    /** 当前播放进度。 */ t: 0,
    /** 主窗口和桌面灵动岛共用的当前歌词，无对应句时显示曲名。 */ capsuleLyric: '',
    /** 首次媒体就绪时恢复的位置，明确切歌后清零。 */ resumeTime: 0,
    /** EQ 状态只反映当前真实音频管线，不写入用户偏好。 */ equalizerStatus:
      'bypassed' as 'active' | 'bypassed' | 'pending' | 'unavailable',
    /** 当前在线音频的实际时长与播放状态。 */
    streamDuration: 0,
    /** 当前播放请求正在取源或等待媒体启动，供播放按钮显示加载状态。 */
    audioLoading: false,
    /** 服务端为本曲实际返回的音质或码率。 */
    actualQuality: '',
    catalogStatus: null as PlaybackStatus | 'loading' | 'error' | null,
    /** 当前平台账号及本机曲目实际显示的红心。 */ liked: favorites.liked,
    /** 正在向平台账号写回的歌曲，以平台与曲目 ID 标识。 */ pendingFavorites: favorites.pending,
    /** 播放顺序模式。 */ shuffle: false,
    repeat: 0,
    /** 音量及静音前音量。 */ vol: preferences.volume,
    muted: preferences.muted,
    lastVol: preferences.volume || 70,
    /** 全屏、队列和右侧栏展开状态。 */ fsQ: false,
    npOpen: preferences.panelOpen,
    /** 平台对接和歌曲电台默认使用整行内容宽度。 */
    npWideOpen: false,
    stage: false,
    /** 首次打开全屏时正在加载舞台组件，可再次点击或按 Escape 取消。 */ stageLoading: false,
    /** 当前页面和选中的歌单、专辑或歌手。 */ page: 'home' as PlayerPage,
    playlistIdx: 0,
    /** 全局搜索词。 */ query: '',
    /** 搜索页当前曲库，快捷搜索歌名时跟随歌曲来源。 */
    searchPlatform: 'netease' as MusicPlatform | 'local',
    /** 当前搜索类别，手动提交关键词时保留用户的选择。 */
    searchKind: 'tracks' as 'tracks' | 'playlists',
    /** 输入草稿与提交次数，编辑不触发搜索。 */
    queryDraft: '',
    queryRevision: 0,
    /** 本机最近提交的搜索词，按最近使用顺序排列。 */
    searchHistory: preferences.searchHistory,
    /** 最近播放记录。 */ recent: [] as number[],
    /** 原稿播放、外观及桌面窗口设置。 */ settings: {
      ...preferences.settings,
      // 专用存储中有有效开关时优先采用，缺失时沿用已校验的播放器偏好。
      lyricIsland: typeof islandPreferences.value?.lyricIsland === 'boolean'
        ? islandPreferences.value.lyricIsland
        : preferences.settings.lyricIsland,
      lyricIslandSnap: islandPreferences.value?.lyricIslandSnap !== false,
    },
    /** 已关联的公开资料，搜索或链接导入不会创建关联。 */
    linkedProfiles,
    /** 导入和自建歌单。 */ imported: [] as Playlist[],
    myLists: [] as Playlist[],
    customPl: null as Playlist | null,
    /** 重选当前导入歌单时触发一次平台刷新。 */
    playlistReload: 0,
    /** 上传队列与已加入曲库的数量。 */ uploads: [] as UploadFile[],
    upAdded: 0,
    /** 下载暂停状态和原稿流程反馈。 */ dlPaused: {} as Record<number, boolean>,
    upMsg: '',
    /** 各列表的分页及排序。 */ pg: {} as Record<string, number>,
    sorts: {} as Record<string, SortMode>,
    /** 播放队列和电台种子。 */ queue: null as number[] | null,
    radioOn: false,
    radioSeed: null as number | null,
    smartOpen: null as string | null,
    /** 原稿导航、编辑和渲染缓存；不另建一套播放状态。 */
    _lyrKey: '',
    _util: null as string | null,
    _pageKey: '',
    _pgSig: '',
    _srcKey: '',
    _hist: [] as { page: PlayerPage; playlistIdx: number; path?: string }[],
    _fwd: [] as { page: PlayerPage; playlistIdx: number; path?: string }[],
    _renaming: -1,
    _delPl: null as string | null,
    _renameP: null as HTMLElement | null,
    _plSeq: 0,
    _lyrHoldUntil: 0,
  })

  // 已知专辑曲目编号只属于其自身；缺编号的旧记录在同一文件有多个版本时保留歧义。
  function recordKugouVersion(index: number, declared?: string | null): void {
    const source = tracks[index]?.catalog
    if (source?.platform !== 'kugou') return
    const hash = source.id.toLowerCase()
    const versions = kugouVersions.get(hash) ?? { known: undefined, unresolved: new Set<number>() }
    kugouVersions.set(hash, versions)
    if (!source.kugouAlbumAudioId) versions.unresolved.add(index)
    if (declared === null || (declared && versions.known && versions.known !== declared)) {
      versions.known = null
      for (const unresolved of versions.unresolved) tracks[unresolved]!.catalog!.kugouAlbumAudioId = null
    } else if (declared && versions.known === undefined) {
      versions.known = declared
    }
    if (!source.kugouAlbumAudioId && versions.known === null) source.kugouAlbumAudioId = null
  }

  // 同一发行版本复用稳定索引，酷狗同文件的不同专辑曲目各自进入播放队列。
  function registerCatalogTracks(items: CatalogTrack[], refreshDetails = false): number[] {
    return items.map(item => {
      const key = catalogPlaybackKey(item)
      const existing = catalogIndices.get(key)
      if (existing !== undefined) {
        const track = tracks[existing]!
        if (refreshDetails) {
          track.title = item.title
          if (item.album) track.album = item.album
          if (item.coverUrl) track.cover = item.coverUrl
          if (item.durationMs != null) track.dur = Math.max(0, item.durationMs / 1000)
        }
        if (item.kugouAlbumAudioId === null) recordKugouVersion(existing, null)
        if (item.artists.length && (track.artists?.length !== item.artists.length ||
          item.artists.some((name, i) => name !== track.artists?.[i]))) {
          track.artists = item.artists
          track.artist = item.artists.join(' / ')
        }
        if (item.subtitle) track.subtitle = item.subtitle
        if ((!track.album || track.album === '—') && item.album) track.album = item.album
        if (track.catalog && item.artistRefs?.length) track.catalog.artistRefs = item.artistRefs
        if (track.catalog && item.albumRef?.name === track.album) track.catalog.albumRef = item.albumRef
        if ((!track.cover || track.cover === defaultCover) && item.coverUrl) track.cover = item.coverUrl
        return existing
      }
      const index = tracks.length
      tracks.push(toSourceTrack(item))
      catalogIndices.set(key, index)
      recordKugouVersion(index, item.kugouAlbumAudioId)
      return index
    })
  }

  // 将保存的曲目转换为当前会话的播放器索引，并维持上游排列顺序。
  function buildImportedPlaylist(item: CatalogPlaylist): Playlist {
    return {
      id: catalogKey(item),
      name: item.title || `歌单 ${item.id}`,
      source: platformNames[item.platform],
      count: item.tracks.length,
      cover: item.coverUrl || item.tracks[0]?.coverUrl || undefined,
      trackIndices: registerCatalogTracks(item.tracks, true),
    }
  }

  // 只重排本次来源涉及的槽位，保留其他账号、平台及单独导入的歌单位置。
  function commitPlaylists(items: SavedPlaylist[], order: string[], updated?: CatalogPlaylist): void {
    const ranks = new Map(order.map((key, index) => [key, index]))
    const matches = items.filter(item => ranks.has(catalogKey(item)))
    matches.sort((a, b) => ranks.get(catalogKey(a))! - ranks.get(catalogKey(b))!)
    let cursor = 0
    const sorted = items.map(item => ranks.has(catalogKey(item)) ? matches[cursor++]! : item)
    localStorage.setItem(importedKey, JSON.stringify(sorted))
    savedPlaylists.value = sorted
    const views = new Map(state.imported.map(list => [list.id, list]))
    if (updated) {
      const list = buildImportedPlaylist(updated)
      views.set(list.id, list)
      if (state.customPl?.id === list.id) state.customPl = list
    }
    state.imported = sorted.map(item => views.get(catalogKey(item))!)
  }

  // 平台确认红心后更新该账号已导入的系统喜欢歌单，普通歌单和当前队列保留原序。
  function updateImportedFavorite(owner: string, track: SourceTrack, liked: boolean): void {
    const source = track.catalog
    if (!source) return
    const saved = savedPlaylists.value.find(
      list => list.platform === source.platform && list.favoriteOwnerId === owner
    )
    if (!saved) return
    const { platform, id, kugouAlbumAudioId } = source
    // 酷狗的同一音频可对应不同收藏条目，只修改平台已经确认的那一版。
    function matchesEntry(item: CatalogTrack): boolean {
      if (item.platform !== platform) return false
      if (platform !== 'kugou') return item.id === id
      if (kugouAlbumAudioId) return item.kugouAlbumAudioId === kugouAlbumAudioId
      return !item.kugouAlbumAudioId && item.id.toLowerCase() === id.toLowerCase()
    }
    if (saved.tracks.some(matchesEntry) === liked) return
    const items = saved.tracks.filter(item => !matchesEntry(item))
    if (liked) {
      items.unshift({
        ...source,
        title: track.title,
        artists: trackArtistNames(track),
        album: track.album,
        subtitle: track.subtitle,
        durationMs: track.dur ? track.dur * 1000 : null,
        coverUrl: track.cover,
      })
    }
    const updated = {
      ...saved,
      tracks: items,
      total: saved.total == null ? null : Math.max(0, saved.total + items.length - saved.tracks.length),
    }
    try {
      commitPlaylists(savedPlaylists.value.map(list => list === saved ? updated : list), [], updated)
    } catch {
      notify(platformNames[source.platform] + '已确认红心变更，本机歌单副本保存失败。', 'error')
    }
  }

  // 从已见过的来源页得到跨页顺序，后导入的前页歌单也能排回前面。
  function profileOrder(items: SavedPlaylist[], platform: MusicPlatform, userId: string): string[] {
    return items.filter(item => item.platform === platform && item.profilePosition?.userId === userId)
      .sort((a, b) => a.profilePosition!.index - b.profilePosition!.index)
      .map(catalogKey)
  }

  // 读取公开歌单页时补齐旧缓存的真实位置，并同步已导入歌单的现有视图。
  function syncPublicPlaylistPage(page: PublicUserPlaylists): void {
    const owner = page.platform + ':' + page.userId
    const positions = profilePages.get(owner) ?? new Map<string, number>()
    profilePages.set(owner, positions)
    const summaries = new Map(page.playlists.map(item => [item.id, item]))
    page.playlists.forEach((item, index) => positions.set(item.id, (page.pageNum - 1) * page.pageSize + index))
    const next = savedPlaylists.value.map(item => {
      const index = positions.get(item.id)
      if (item.platform !== page.platform || index === undefined) return item
      const favoriteOwnerId = summaries.get(item.id)?.favoriteOwnerId ?? item.favoriteOwnerId
      if (item.profilePosition?.userId === page.userId && item.profilePosition.index === index &&
          favoriteOwnerId === item.favoriteOwnerId) return item
      return { ...item, favoriteOwnerId, profilePosition: { userId: page.userId, index } }
    })
    const order = profileOrder(next, page.platform, page.userId)
    const current = next.filter(item => item.platform === page.platform && item.profilePosition?.userId === page.userId)
    if (next.some((item, index) => item !== savedPlaylists.value[index]) ||
        current.some((item, index) => catalogKey(item) !== order[index])) commitPlaylists(next, order)
  }

  // 完整导入成功后一次写入内容和顺序，失败重试沿用原账号位置或链接次序。
  function savePublicPlaylist(item: CatalogPlaylist, userId?: string, linkOrder: string[] = []): Playlist {
    const id = catalogKey(item)
    const index = savedPlaylists.value.findIndex(
      playlist => catalogKey(playlist) === id
    )
    const next = [...savedPlaylists.value]
    const rank = userId ? profilePages.get(item.platform + ':' + userId)?.get(item.id) : undefined
    const profilePosition = userId && rank !== undefined ? { userId, index: rank } : next[index]?.profilePosition
    const saved = { ...item, profilePosition }
    if (index === -1) next.push(saved)
    else next[index] = saved
    const order = userId ? profileOrder(next, item.platform, userId) : linkOrder
    commitPlaylists(next, order, item)
    return state.imported.find(list => list.id === id)!
  }

  // 重新进入来源歌单时读取所有分页，完整成功后原位替换；期间有红心写入则重读最新版本。
  async function refreshImportedPlaylist(id: string, signal: AbortSignal): Promise<void> {
    let saved = savedPlaylists.value.find(list => catalogKey(list) === id)
    while (saved) {
      const fresh = await fetchLinkedPlaylist(saved.platform, saved.id, signal)
      signal.throwIfAborted()
      const current = savedPlaylists.value.find(list => catalogKey(list) === id)
      if (!current) return
      if (current.tracks !== saved.tracks) {
        saved = current
        continue
      }
      const updated = { ...fresh, favoriteOwnerId: fresh.favoriteOwnerId ?? current.favoriteOwnerId, profilePosition: current.profilePosition }
      commitPlaylists(savedPlaylists.value.map(list => list === current ? updated : list), [], updated)
      if (updated.favoriteOwnerId) void favorites.refreshPlaylistFavorites(updated)
      return
    }
  }

  // 保存或取消一个平台的公开资料关联，已导入歌单仍可在曲库中打开。
  function setLinkedProfile(
    platform: MusicPlatform,
    profile: LinkedProfile | null
  ): void {
    if (!Object.prototype.hasOwnProperty.call(platformNames, platform))
      throw new Error('无效音乐平台。')
    const next = { ...state.linkedProfiles }
    if (profile) {
      if (
        typeof profile.userId !== 'string' ||
        !/^[1-9]\d{0,19}$/.test(profile.userId) ||
        !Number.isFinite(profile.syncedAt)
      )
        throw new Error('无效公开账号资料。')
      // 即使输入带额外字段，也只保存公开白名单，不保存 Cookie/token 或流程 ID。
      next[platform] = {
        userId: profile.userId,
        displayName:
          typeof profile.displayName === 'string'
            ? profile.displayName.slice(0, 200)
            : null,
        syncedAt: profile.syncedAt,
        avatarUrl: publicAvatar(profile.avatarUrl),
      }
    } else delete next[platform]
    localStorage.setItem(profilesKey, JSON.stringify(next))
    state.linkedProfiles = next
  }

  // 只保存已应用的灵动岛设置，设置窗口的草稿仍可取消。
  function saveIslandPreferences(): void {
    islandPreferences.value = {
      lyricIsland: state.settings.lyricIsland,
      lyricIslandSnap: state.settings.lyricIslandSnap,
    }
  }

  state.imported = savedPlaylists.value.map(buildImportedPlaylist)

  // 只读取可确认属于当前平台与 UID 的导入歌单，切号时沿用各自的歌手偏好。
  function profileTracks(platform: MusicPlatform, userId: string): CatalogTrack[] {
    return savedPlaylists.value
      .filter(list => list.platform === platform && list.profilePosition?.userId === userId)
      .flatMap(list => list.tracks)
  }
  // 旧版只保存文件 hash；用其随附的曲目快照识别原先选中的专辑版本。
  const restoredIndices = new Map<string, number | null>()
  tracks.forEach((track, index) => {
    const legacy = preferenceTrackKey(track)
    restoredIndices.set(legacy, restoredIndices.has(legacy) ? null : index)
  })
  // 先恢复已保存歌单，再补缓存中的搜索曲目，保留每个发行版本自身的元数据。
  for (const track of preferences.catalogTracks) {
    if (!track.catalog) continue
    const key = catalogPlaybackKey(track.catalog)
    let index = catalogIndices.get(key)
    if (index === undefined) {
      index = tracks.length
      catalogIndices.set(key, index)
      tracks.push(track)
    } else if (!tracks[index]!.subtitle && track.subtitle) {
      tracks[index]!.subtitle = track.subtitle
    }
    recordKugouVersion(index, track.catalog.kugouAlbumAudioId)
    restoredIndices.set(preferenceTrackKey(track), index)
  }
  tracks.forEach((track, index) => restoredIndices.set(playbackPreferenceKey(track), index))
  // 缓存不自动播放；失效曲目键忽略，不把旧数组索引强行指向新曲库。
  const currentIndex = preferences.current
    ? restoredIndices.get(preferences.current.key)
    : undefined
  if (currentIndex != null && state.settings.rememberPlayback) {
    state.idx = currentIndex
    state.t = Math.min(
      preferences.current!.time,
      tracks[currentIndex]!.dur || preferences.current!.time
    )
    state.resumeTime = tracks[currentIndex]?.catalog ? state.t : 0
  }
  const queued = preferences.queue
    .map(key => restoredIndices.get(key))
    .filter((index): index is number => index != null)
  if (queued.length) state.queue = queued
  state.recent = preferences.recent
    .map(key => restoredIndices.get(key))
    .filter((index): index is number => index != null)

  // 只在主窗口或用户明确应用时保存，设置窗口的未应用草稿不会覆盖缓存。
  function savePreferences(): boolean {
    const current = tracks[state.idx]
    const used = [
      ...new Set([
        state.idx,
        ...(state.queue || []),
        ...state.recent,
        ...(favorites.localKeys.size ? tracks.flatMap((track, index) =>
          favorites.localKeys.has(preferenceTrackKey(track)) ? [index] : []) : []),
      ]),
    ]
    const keyFor = (index: number) =>
      tracks[index] ? playbackPreferenceKey(tracks[index]!) : ''
    return writePlayerPreferences({
      settings: { ...state.settings },
      volume: state.vol,
      muted: state.muted,
      panelOpen: state.npOpen,
      current:
        current && state.settings.rememberPlayback
          ? { key: playbackPreferenceKey(current), time: state.t }
          : null,
      queue: (state.queue || []).map(keyFor).filter(Boolean),
      liked: [...favorites.localKeys],
      recent: state.recent.map(keyFor).filter(Boolean),
      searchHistory: state.searchHistory,
      catalogTracks: used
        .map(index => tracks[index])
        .filter((track): track is (typeof tracks)[number] => !!track?.catalog),
    })
  }
  return {
    state,
    tracks,
    registerCatalogTracks,
    refreshFavorites: favorites.refreshFavorites,
    refreshImportedPlaylist,
    toggleFavorite: favorites.toggleFavorite,
    observeFavoritePlaylist: favorites.observeFavoritePlaylist,
    legacyFavoriteIndices: favorites.legacyIndices,
    profileTracks,
    savePublicPlaylist,
    syncPublicPlaylistPage,
    setLinkedProfile,
    saveIslandPreferences,
    savePreferences,
  }
})

export type PlayerState = ReturnType<typeof usePlayerStore>['state']
export type PlayerSettings = PlayerState['settings']
