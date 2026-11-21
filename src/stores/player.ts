import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { tracks as demoTracks } from '@/constants/music'
import { publicAvatar } from '@/services/public-avatar'
import type {
  CatalogPlaylist,
  CatalogTrack,
  PlaybackStatus,
  MusicPlatform,
  PublicUserPlaylists,
} from '@/api'
import {
  catalogKey,
  platformNames,
  toSourceTrack,
} from '@/services/player/catalog'

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
function readImportedPlaylists(): CatalogPlaylist[] {
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
    gapless: true,
    crossfadeOn: true,
    normalize: false,
    weather: true,
    motion: true,
    glassStyle: 'match',
    crossfade: 6,
    quality: 'FLAC · 24-BIT',
    output: '桌面音箱',
    eq: '流行',
    sleep: '关闭',
    deskLyrics: true,
    deskLock: false,
    lyricIsland: true,
    lyricIslandDesktop: false,
    trayMini: true,
    smtc: false,
  }
}

// 原稿播放器状态：保持初始曲目、42 秒进度和所有演示设置。
export const usePlayerStore = defineStore('player', () => {
  const tracks = reactive(demoTracks.map(track => ({ ...track })))
  const islandPreferences = useLocalStorage('miraiMusic.lyricIsland', {
    lyricIsland: true,
    lyricIslandDesktop: false,
  })
  const catalogIndices = new Map<string, number>()
  let savedPlaylists = readImportedPlaylists()
  const state = reactive({
    /** 当前曲目索引。 */ idx: 0,
    /** 播放和进度状态。 */ playing: false,
    t: 42,
    /** 当前在线音频的实际时长与播放状态。 */
    streamDuration: 0,
    catalogStatus: null as PlaybackStatus | 'loading' | 'error' | null,
    /** 收藏集合。 */ liked: {} as Record<number, boolean>,
    /** 播放顺序模式。 */ shuffle: false,
    repeat: 0,
    /** 音量及静音前音量。 */ vol: 70,
    muted: false,
    lastVol: 70,
    /** 全屏、队列和右侧栏展开状态。 */ fsQ: false,
    npOpen: true,
    /** 平台对接和歌曲电台默认使用整行内容宽度。 */
    npWideOpen: false,
    stage: false,
    /** 首页内容筛选。 */ chip: '全部',
    /** 播放计时器。 */ timer: null as number | null,
    /** 当前页面和选中的歌单、专辑或歌手。 */ page: 'home' as PlayerPage,
    playlistIdx: 0,
    /** 全局搜索词。 */ query: '',
    /** 输入草稿与提交次数，编辑不触发搜索。 */
    queryDraft: '',
    queryRevision: 0,
    /** 最近播放记录。 */ recent: [] as number[],
    /** 原稿播放、外观及桌面窗口设置。 */ settings: {
      ...createDefaultSettings(),
      lyricIsland: islandPreferences.value?.lyricIsland !== false,
      lyricIslandDesktop: islandPreferences.value?.lyricIslandDesktop === true,
    },
    /** 已关联的公开资料，搜索或链接导入不会创建关联。 */
    linkedProfiles: readLinkedProfiles(),
    /** 导入和自建歌单。 */ imported: [] as Playlist[],
    myLists: [] as Playlist[],
    customPl: null as Playlist | null,
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
    _hist: [] as { page: PlayerPage; playlistIdx: number }[],
    _fwd: [] as { page: PlayerPage; playlistIdx: number }[],
    _renaming: -1,
    _delPl: null as string | null,
    _renameP: null as HTMLElement | null,
    _plSeq: 0,
    _lyrHoldUntil: 0,
  })

  // 复用已登记曲目的稳定索引，保证收藏、队列和歌单引用同一首歌。
  function registerCatalogTracks(items: CatalogTrack[]): number[] {
    return items.map(item => {
      const key = catalogKey(item)
      const existing = catalogIndices.get(key)
      if (existing !== undefined) return existing
      const index = tracks.length
      tracks.push(toSourceTrack(item))
      catalogIndices.set(key, index)
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
      trackIndices: registerCatalogTracks(item.tracks),
    }
  }

  // 全部曲目加载成功后原子写入本机存储，同平台同 ID 的歌单按重新导入更新。
  function savePublicPlaylist(item: CatalogPlaylist): Playlist {
    const id = catalogKey(item)
    const index = savedPlaylists.findIndex(
      playlist => catalogKey(playlist) === id
    )
    const next = [...savedPlaylists]
    if (index === -1) next.push(item)
    else next[index] = item
    localStorage.setItem(importedKey, JSON.stringify(next))
    savedPlaylists = next
    const playlist = buildImportedPlaylist(item)
    if (index === -1) state.imported.push(playlist)
    else state.imported[index] = playlist
    return playlist
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
      lyricIslandDesktop: state.settings.lyricIslandDesktop,
    }
  }

  state.imported = savedPlaylists.map(buildImportedPlaylist)
  return {
    state,
    tracks,
    registerCatalogTracks,
    savePublicPlaylist,
    setLinkedProfile,
    saveIslandPreferences,
  }
})

export type PlayerState = ReturnType<typeof usePlayerStore>['state']
export type PlayerSettings = PlayerState['settings']
