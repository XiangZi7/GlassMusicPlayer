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
      const url = new URL(link.replace(/[，。；、！？!?,;)\]）】]+$/, ''))
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.port
      )
        return ''
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
      if (
        path.origin !== url.origin ||
        !hosts.includes(url.hostname) ||
        !userPath
      )
        return ''
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
  // 响应式状态
  const state = reactive({
    // 当前展示歌单的平台。
    active: null as MusicPlatform | null,
    // 当前用户的公开歌单页。
    page: null as PublicUserPlaylists | null,
    // 已勾选的歌单 ID，跨分页保留选择。
    selected: [] as string[],
    // 独立的公开歌单分享链接。
    link: '',
    // 当前正在执行的读取或导入操作。
    loading: null as 'profile' | 'link' | 'selection' | null,
    // 导入过程已经读取的曲目数量。
    loaded: 0,
    // 连接弹窗中的校验或接口错误。
    profileError: '',
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

  // 仅在真实读取成功后提交关联，取消或过期请求不能更新新的弹窗。
  async function loadProfile(
    platform: PublicProfilePlatform,
    uid: string,
    pageNum: number,
    notifyErrors = true
  ): Promise<boolean> {
    if (state.loading) return false
    const request = new AbortController()
    pending = request
    state.loading = 'profile'
    state.profileError = ''
    try {
      const result = await getPublicUserPlaylists(
        platform,
        uid,
        pageNum,
        20,
        request.signal
      )
      if (request.signal.aborted || pending !== request) return false
      if (
        result.platform !== platform ||
        result.userId !== uid ||
        !Array.isArray(result.playlists)
      )
        throw new Error('平台返回的资料不匹配，请重试。')
      player.setLinkedProfile(platform, {
        userId: result.userId,
        displayName: result.displayName,
        syncedAt: Date.now(),
      })
      state.active = platform
      state.page = result
      return true
    } catch (error) {
      if (!request.signal.aborted && pending === request) {
        state.profileError =
          error instanceof Error ? error.message : '读取公开歌单失败。'
        if (notifyErrors) notify(state.profileError, 'error')
      }
      return false
    } finally {
      if (pending === request) {
        pending = undefined
        state.loading = null
      }
    }
  }

  // 已关联的平台直接读取歌单；重复点击不会把当前平台关闭。
  function openPlatform(platform: MusicPlatform): void {
    if (state.loading) return
    state.active = platform
    state.page = null
    state.selected = []
    state.profileError = ''
    if (platform !== 'kugou') {
      const saved = player.state.linkedProfiles[platform]
      if (saved) void loadProfile(platform, saved.userId, 1)
    }
  }

  // 弹窗提交指定平台的个人主页，错误保留在弹窗内供用户纠正。
  async function connectProfile(
    platform: MusicPlatform,
    input: string
  ): Promise<boolean> {
    if (state.loading) return false
    state.profileError = ''
    if (platform === 'kugou') {
      state.profileError = '酷狗主页歌单需要账户授权，请使用登录方式。'
      return false
    }
    const uid = readUid(input, platform)
    if (!uid) {
      state.profileError =
        '请输入该平台的个人主页链接或数字 UID，不能使用歌手或歌单链接。'
      return false
    }
    const connected = await loadProfile(platform, uid, 1, false)
    if (connected) state.selected = []
    return connected
  }

  function clearProfileError(): void {
    state.profileError = ''
  }

  // 关闭弹窗立即取消读取，旧请求的 finally 不得清除新请求的 loading。
  function cancelProfileConnection(): void {
    if (state.loading === 'profile') {
      pending?.abort()
      pending = undefined
      state.loading = null
    }
    state.profileError = ''
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
      if (pending === request && !request.signal.aborted) state.loaded = count
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
      if (pending === request) {
        pending = undefined
        state.loading = null
      }
    }
  }

  // 路由缓存离开页面时取消请求；重新进入可以立即发起新操作。
  function cancelPending(): void {
    const request = pending
    pending = undefined
    state.loading = null
    request?.abort()
  }
  onBeforeUnmount(cancelPending)
  onDeactivated(cancelPending)
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
    clearProfileError,
    cancelProfileConnection,
    changePage,
    disconnect,
    importPlaylists,
    isImported,
  }
}
