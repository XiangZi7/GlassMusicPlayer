import { computed, onBeforeUnmount, onDeactivated, reactive, toRefs } from 'vue'
import { useRouter } from 'vue-router'
import {
  getPublicUserPlaylists,
  type MusicPlatform,
  type PublicProfilePlatform,
  type PublicUserPlaylists,
} from '@/api'
import { notify } from '@/services/notification'
import type { QrLoginProfile } from '@/api/auth'
import { publicAvatar } from '@/services/public-avatar'
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

type ImportTask =
  | { kind: 'link'; text: string }
  | { kind: 'selection'; platform: MusicPlatform; id: string }

// 提取批量分享文本中的链接并去重；无协议的单行地址仍兼容原入口。
export function readPlaylistLinks(text: string): string[] {
  if (text.length > 32768) throw new Error('分享内容过长，请分批导入。')
  const links = text.match(/https?:\/\/[^\s<>"'\u3000-\u303f\uff00-\uff65]+/gi)
  const values = links || text.split(/\r?\n/)
  const result = [
    ...new Set(
      values
        .map(value => value.trim().replace(/[!?,;)\]}]+$/, ''))
        .filter(Boolean)
    ),
  ]
  if (result.length > 50)
    throw new Error('每批最多导入 50 个链接，请分批操作。')
  if (result.some(value => value.length > 2048))
    throw new Error('单个分享链接过长。')
  return result
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
    // 本次批次的任务总数。
    importTotal: 0,
    // 本次批次已处理的任务数量，包含失败项。
    importDone: 0,
    // 失败或取消后尚未完成的任务，重试时仅处理这些项。
    retryTasks: [] as ImportTask[],
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

  // 判断当前平台的歌单是否已保存，界面仍允许勾选以完整更新。
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
    notifyErrors = true,
    verifiedDisplayName?: string | null,
    verifiedAvatarUrl?: string | null
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
      const saved = player.state.linkedProfiles[platform]
      player.setLinkedProfile(platform, {
        userId: result.userId,
        displayName: verifiedDisplayName || result.displayName,
        // 优先使用本次返回的头像，无头像时仅沿用同一 UID 的有效缓存。
        avatarUrl:
          publicAvatar(verifiedAvatarUrl) ??
          publicAvatar(result.avatarUrl) ??
          (saved?.userId === uid ? publicAvatar(saved.avatarUrl) : null),
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
    input: string,
    verifiedDisplayName?: string | null,
    verifiedAvatarUrl?: string | null
  ): Promise<boolean> {
    if (state.loading) return false
    state.profileError = ''
    if (platform === 'kugou') {
      state.profileError = '酷狗主页歌单暂未接通，请使用公开歌单分享链接导入。'
      return false
    }
    const uid = readUid(input, platform)
    if (!uid) {
      state.profileError =
        '请输入该平台的个人主页链接或数字 UID，不能使用歌手或歌单链接。'
      return false
    }
    const connected = await loadProfile(
      platform,
      uid,
      1,
      false,
      verifiedDisplayName,
      verifiedAvatarUrl
    )
    if (connected) state.selected = []
    return connected
  }

  // 扫码已由服务端验证。酷狗只关联公开身份，不保留 token 或擅自读取账户歌单。
  async function connectQrProfile(
    platform: MusicPlatform,
    profile: QrLoginProfile
  ): Promise<boolean> {
    if (
      state.loading ||
      (platform !== 'netease' && platform !== 'kugou') ||
      typeof profile.userId !== 'string' ||
      !/^[1-9]\d{0,19}$/.test(profile.userId)
    )
      return false
    if (platform === 'netease')
      // 资料与头像在公开歌单读取成功后一次提交，存储失败时不产生部分关联。
      return connectProfile(
        platform,
        profile.userId,
        profile.displayName,
        profile.avatarUrl
      )
    try {
      player.setLinkedProfile(platform, {
        userId: profile.userId,
        displayName: profile.displayName,
        avatarUrl: publicAvatar(profile.avatarUrl),
        syncedAt: Date.now(),
      })
      state.active = platform
      state.page = null
      state.selected = []
      return true
    } catch {
      state.profileError = '无法保存公开关联资料，请重试。'
      return false
    }
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
    if (!platform || state.loading) return
    try {
      player.setLinkedProfile(platform, null)
      state.page = null
      state.selected = []
    } catch {
      notify('无法保存关联设置，请重试。', 'error')
    }
  }

  // 全选或取消选择当前页，保留其他分页已选的歌单；已保存项也可更新。
  function togglePageSelection(): void {
    if (state.loading || !state.page) return
    const ids = state.page.playlists.map(item => item.id)
    const allSelected = ids.every(id => state.selected.includes(id))
    state.selected = allSelected
      ? state.selected.filter(id => !ids.includes(id))
      : [...new Set([...state.selected, ...ids])]
  }

  // 固定本次任务快照，逐份完整保存；失败不中断后续项，取消保留未完成项。
  async function importPlaylists(
    mode: 'link' | 'selection' | 'retry'
  ): Promise<void> {
    if (state.loading) return
    let tasks: ImportTask[]
    try {
      tasks =
        mode === 'retry'
          ? [...state.retryTasks]
          : mode === 'link'
            ? readPlaylistLinks(state.link).map(text => ({
                kind: 'link' as const,
                text,
              }))
            : state.active
              ? state.selected.map(id => ({
                  kind: 'selection' as const,
                  platform: state.active!,
                  id,
                }))
              : []
    } catch (error) {
      notify(
        error instanceof Error ? error.message : '无法读取分享内容。',
        'error'
      )
      return
    }
    if (!tasks.length) return
    const request = new AbortController()
    pending = request
    state.loading = mode === 'retry' ? 'selection' : mode
    state.loaded = 0
    state.importDone = 0
    state.importTotal = tasks.length
    state.retryTasks = [...tasks]
    let saved = 0
    let firstSavedId: string | undefined
    let failureMessage = ''
    const completed = new Set<ImportTask>()
    const identities = new Set<string>()
    // 分页回调只更新当前有效批次的曲目数。
    const progress = (count: number) => {
      if (pending === request && !request.signal.aborted) state.loaded = count
    }
    try {
      for (const task of tasks) {
        if (request.signal.aborted || pending !== request) return
        state.loaded = 0
        try {
          const playlist =
            task.kind === 'link'
              ? await fetchPublicPlaylist(task.text, request.signal, progress)
              : await fetchLinkedPlaylist(
                  task.platform,
                  task.id,
                  request.signal,
                  progress
                )
          if (request.signal.aborted || pending !== request) return
          const key = `${playlist.platform}:${playlist.id}`
          if (!identities.has(key)) {
            const item = player.savePublicPlaylist(playlist)
            firstSavedId = item.id
            identities.add(key)
            saved++
          }
          completed.add(task)
          if (task.kind === 'selection' && state.active === task.platform)
            state.selected = state.selected.filter(id => id !== task.id)
        } catch (error) {
          if (request.signal.aborted || pending !== request) return
          if (!failureMessage)
            failureMessage =
              error instanceof Error ? error.message : '读取或保存歌单失败。'
          // 单项失败保留在重试列表，不让它阻断剩余歌单。
        }
        state.importDone++
        state.retryTasks = tasks.filter(item => !completed.has(item))
      }
      if (mode === 'link' && !state.retryTasks.length) state.link = ''
      notify(
        state.retryTasks.length
          ? `已保存 ${saved} 份歌单，${state.retryTasks.length} 项未完成，可仅重试未完成项。${failureMessage}`
          : `已导入或更新 ${saved} 份歌单，可在左侧「我的歌单」查看。`,
        state.retryTasks.length ? 'error' : 'info'
      )
      // 仅单链接全部成功时沿用自动打开歌单，批量导入留在当前页。
      if (
        mode === 'link' &&
        tasks.length === 1 &&
        !state.retryTasks.length &&
        firstSavedId
      )
        await router.push({
          path: '/playlist',
          query: { playlist: firstSavedId },
        })
    } finally {
      if (pending === request) {
        pending = undefined
        state.loading = null
      }
    }
  }

  // 用户主动停止批量导入，完整保存过的歌单保留，其余项可直接重试。
  function cancelImport(): void {
    if (!state.loading || state.loading === 'profile') return
    pending?.abort()
    pending = undefined
    state.loading = null
    notify('已停止导入，已保存的歌单保留，可重试未完成项。')
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
    connectQrProfile,
    clearProfileError,
    cancelProfileConnection,
    changePage,
    disconnect,
    importPlaylists,
    togglePageSelection,
    cancelImport,
    isImported,
  }
}
