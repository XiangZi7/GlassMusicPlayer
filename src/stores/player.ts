import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { tracks } from '@/constants/music'

export interface Playlist {
  name: string
  source: string
  count: number
  cover?: string
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
    trayMini: true,
    smtc: false,
  }
}

// 原稿播放器状态：保持初始曲目、42 秒进度和所有演示设置。
export const usePlayerStore = defineStore('player', () => {
  const state = reactive({
    /** 当前曲目索引。 */ idx: 0,
    /** 播放和进度状态。 */ playing: false,
    t: 42,
    /** 收藏集合。 */ liked: {} as Record<number, boolean>,
    /** 播放顺序模式。 */ shuffle: false,
    repeat: 0,
    /** 音量及静音前音量。 */ vol: 70,
    muted: false,
    lastVol: 70,
    /** 全屏、队列和右侧栏展开状态。 */ fsQ: false,
    npOpen: true,
    stage: false,
    /** 首页内容筛选。 */ chip: '全部',
    /** 播放计时器。 */ timer: null as number | null,
    /** 当前页面和选中的歌单、专辑或歌手。 */ page: 'home' as PlayerPage,
    playlistIdx: 0,
    /** 全局搜索词。 */ query: '',
    /** 最近播放记录。 */ recent: [] as number[],
    /** 原稿播放、外观及桌面窗口设置。 */ settings: createDefaultSettings(),
    /** 平台连接状态和导入选择。 */ platforms: {
      netease: false,
      kugou: false,
      kuwo: false,
    },
    srcToggles: {} as Record<string, boolean>,
    impPicked: {} as Record<string, boolean>,
    /** 导入和自建歌单。 */ imported: [] as Playlist[],
    myLists: [] as Playlist[],
    customPl: null as Playlist | null,
    /** 上传队列与已加入曲库的数量。 */ uploads: [] as UploadFile[],
    upAdded: 0,
    /** 下载暂停状态和原稿流程反馈。 */ dlPaused: {} as Record<number, boolean>,
    impMsg: '',
    upMsg: '',
    linkMsg: '',
    lastSync: '',
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

  return { state, tracks: reactive(tracks.map(track => ({ ...track }))) }
})

export type PlayerState = ReturnType<typeof usePlayerStore>['state']
export type PlayerSettings = PlayerState['settings']
