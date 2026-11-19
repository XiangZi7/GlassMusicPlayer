import { computed, onBeforeUnmount, onDeactivated, reactive, toRefs } from 'vue'
import { useRouter } from 'vue-router'
import {
  getPublicUserPlaylists,
  type MusicPlatform,
  type PublicProfilePlatform,
  type PublicUserPlaylists,
} from '@/api'
import { notify } from '@/services/notification'
import {
  fetchLinkedPlaylist,
  fetchPublicPlaylist,
} from '@/services/player/catalog'
import { usePlayerStore } from '@/stores/player'

// 从指定平台的公开主页分享文本或用户直接提供的 UID 中提取数字标识。
function readUid(input: string, platform: PublicProfilePlatform): string {
  const value = input.trim()
  let uid = value
  if (!/^[1-9]\d{0,19}$/.test(uid)) {
    const link =
      value.match(/https?:\/\/[^\s<>「」【】]+/i)?.[0] || `https://${value}`
    try {
      const url = new URL(link)
      if (url.username || url.password || url.port) return ''
      const path = url.hash.startsWith('#/')
        ? new URL(url.hash.slice(1), url.origin)
        : url
      const hosts =
        platform === 'netease'
          ? ['music.163.com', 'y.music.163.com', 'm.music.163.com']
          : ['kuwo.cn', 'www.kuwo.cn', 'm.kuwo.cn']
      const userPath = path.pathname.match(
        /^\/(?:m\/|newh5\/|h5app\/)?(?:user\/home|user|user_detail|profile)(?:\/([1-9]\d{0,19}))?\/?$/
      )
      if (!hosts.includes(url.hostname) || !userPath) return ''
      uid =
        userPath[1] ||
        path.searchParams.get('uid') ||
        path.searchParams.get('id') ||
        ''
    } catch {
      return ''
    }
  }
  return /^[1-9]\d{0,19}$/.test(uid) ? uid : ''
}

// 维护公开资料关联、歌单选择和手动分享链接导入的状态。
export function usePlatformImport() {
  const player = usePlayerStore()
  const router = useRouter()
  const state = reactive({
    /** 当前展开的平台和用户输入的公开 UID。 */
    active: null as MusicPlatform | null,
    profileInput: '',
    /** 用户歌单页和已勾选歌单 ID。 */
    page: null as PublicUserPlaylists | null,
    selected: [] as string[],
    /** 独立歌单分享链接、加载进度。 */
    link: '',
    loading: null as 'profile' | 'link' | 'selection' | null,
    loaded: 0,
  })
  let pending: AbortController | undefined
  const connections = computed(
    () => Object.keys(player.state.linkedProfiles).length
  )
  const importedCount = computed(() =>
    player.state.imported.reduce((sum, item) => sum + item.count, 0)
  )
  const latestSync = computed(() => {
    const latest = Math.max(
      0,
      ...Object.values(player.state.linkedProfiles).map(
        item => item?.syncedAt || 0
      )
    )
    return latest
      ? new Date(latest).toLocaleString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'
  })

  // 当前公开歌单列表已导入的项禁止重复勾选。
  function isImported(id: string): boolean {
    return player.state.imported.some(
      item => item.id === `${state.active}:${id}`
    )
  }

  // 加载该 UID 的歌单页，成功后记录公开资料关联与最近同步时间。
  async function loadProfile(
    platform: PublicProfilePlatform,
    uid: string,
    pageNum: number
  ): Promise<void> {
    if (state.loading) return
    const request = new AbortController()
    pending = request
    state.loading = 'profile'
    try {
      const result = await getPublicUserPlaylists(
        platform,
        uid,
        pageNum,
        20,
        request.signal
      )
      if (request.signal.aborted) return
      player.setLinkedProfile(platform, {
        userId: result.userId,
        displayName: result.displayName,
        syncedAt: Date.now(),
      })
      state.page = result
    } catch (error) {
      if (!request.signal.aborted)
        notify(
          error instanceof Error ? error.message : '读取公开歌单失败。',
          'error'
        )
    } finally {
      pending = undefined
      state.loading = null
    }
  }

  // 展开对应平台，已关联的平台自动读取已保存 UID 的公开歌单。
  function openPlatform(platform: MusicPlatform): void {
    if (state.loading) return
    state.active = state.active === platform ? null : platform
    state.page = null
    state.selected = []
    state.profileInput = ''
    if (state.active && platform !== 'kugou') {
      const saved = player.state.linkedProfiles[platform]
      if (saved) void loadProfile(platform, saved.userId, 1)
    }
  }

  // 提交单个平台的 UID，空值或其他网站的链接仍留在表单供纠正。
  function connectProfile(): void {
    const platform = state.active
    if (!platform || platform === 'kugou') return
    const uid = readUid(state.profileInput, platform)
    if (!uid) {
      notify('请输入该平台的数字 UID 或公开主页链接。', 'error')
      return
    }
    void loadProfile(platform, uid, 1)
  }

  // 翻页或刷新时按已确认的 UID 加载。
  function changePage(pageNum: number): void {
    const platform = state.active
    if (!platform || platform === 'kugou') return
    const saved = player.state.linkedProfiles[platform]
    if (saved) void loadProfile(platform, saved.userId, pageNum)
  }

  // 解除公开资料关联并清空本次歌单选择。
  function disconnect(): void {
    const platform = state.active
    if (!platform || platform === 'kugou' || state.loading) return
    try {
      player.setLinkedProfile(platform, null)
      state.page = null
      state.selected = []
    } catch {
      notify('无法保存关联设置，请重试。', 'error')
    }
  }

  // 链接直接导入；用户歌单支持勾选多份，逐份完整保存后报告结果。
  async function importPlaylists(mode: 'link' | 'selection'): Promise<void> {
    const platform = state.active
    if (
      state.loading ||
      (mode === 'link'
        ? !state.link.trim()
        : !platform || !state.selected.length)
    )
      return
    const request = new AbortController()
    pending = request
    state.loading = mode
    state.loaded = 0
    let saved = 0
    const progress = (count: number) => {
      state.loaded = count
    }
    try {
      if (mode === 'link') {
        const playlist = await fetchPublicPlaylist(
          state.link,
          request.signal,
          progress
        )
        if (request.signal.aborted) return
        const item = player.savePublicPlaylist(playlist)
        state.link = ''
        notify(`已导入「${item.name}」，共 ${item.count} 首。`)
        await router.push({ path: '/playlist', query: { playlist: item.id } })
      } else if (platform) {
        for (const id of state.selected) {
          const playlist = await fetchLinkedPlaylist(
            platform,
            id,
            request.signal,
            progress
          )
          if (request.signal.aborted) return
          player.savePublicPlaylist(playlist)
          saved++
        }
        state.selected = []
        notify(`已导入 ${saved} 份歌单，可在左侧「我的歌单」查看。`)
      }
    } catch (error) {
      if (!request.signal.aborted) {
        state.selected = state.selected.filter(id => !isImported(id))
        const message =
          error instanceof Error ? error.message : '歌单导入失败，请重试。'
        notify(saved ? `已保存 ${saved} 份歌单。${message}` : message, 'error')
      }
    } finally {
      pending = undefined
      state.loading = null
    }
  }

  onBeforeUnmount(() => pending?.abort())
  onDeactivated(() => pending?.abort())
  const { linkedProfiles, imported } = toRefs(player.state)
  return {
    ...toRefs(state),
    linkedProfiles,
    imported,
    connections,
    importedCount,
    latestSync,
    openPlatform,
    connectProfile,
    changePage,
    disconnect,
    importPlaylists,
    isImported,
  }
}
