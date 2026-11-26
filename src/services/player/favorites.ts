import { computed, reactive, shallowRef, watch, type Ref } from 'vue'
import type { CatalogPlaylist, CatalogTrack, MusicPlatform } from '@/api'
import type { LinkedProfiles } from '@/stores/player'
import type { CatalogSource, SourceTrack } from '@/types/prototype'
import { notify } from '@/services/notification'
import { platformNames } from '@/services/player/catalog'
import { preferenceTrackKey } from '@/services/player/preferences'
import {
  playbackAccount,
  playbackBearer,
  playbackRevision,
  restorePlaybackGrant,
} from '@/services/player/playback-session'
import {
  refreshTuneWeaveAccount,
  tuneWeaveAccounts,
} from '@/services/player/tuneweave-session'
import {
  readTuneWeaveFavorites,
  resolveKugouFavoriteId,
  writeTuneWeaveFavorite,
} from '@/services/player/tuneweave-favorites'
import { httpGet, httpPost } from '@/utils/http'

// 酷狗账号按专辑曲目编号收藏，旧记录在确认版本前使用单独的查询标识。
function favoriteId(source: CatalogSource): string {
  if (source.platform !== 'kugou') return source.id
  return source.kugouAlbumAudioId || [source.kugouAlbumAudioId === null ? 'ambiguous' : 'hash',
    source.id.toLowerCase(), source.albumRef?.id ?? ''].join(':')
}

// 各窗口按平台与歌曲 ID 判断同一红心的写入进度。
export function favoriteKey(source: CatalogSource): string {
  return source.platform + ':' + favoriteId(source)
}

// 仅已授权的账号可写入收藏，公开主页单独用于歌单归属判断。
function authorizedOwner(platform: MusicPlatform): string | undefined {
  if (platform === 'netease')
    return playbackAccount.value?.favorites && playbackBearer()
      ? playbackAccount.value.userId
      : undefined
  return tuneWeaveAccounts[platform]?.userId
}

// 红心提示说明目标账号，未授权时给出对应的连接入口。
export function favoriteHint(track?: SourceTrack): string {
  const platform = track?.catalog?.platform
  if (!platform) return '本机收藏'
  const owner = authorizedOwner(platform)
  if (platform === 'kugou' && owner) {
    const account = tuneWeaveAccounts.kugou
    const edition = account?.edition === 'concept' ? '概念版' : '标准版'
    return `同步到酷狗${edition} · UID ${owner}`
  }
  if (owner) return `同步到${platformNames[platform]} · UID ${owner}`
  return platform === 'netease'
    ? '请扫码登录网易云并授权红心同步'
    : `请在平台对接中连接${platformNames[platform]}的收藏账号`
}

// 给桌面小窗标记它显示的歌曲与收藏账号，防止迟到的点击改动另一首或另一版账号。
export function favoriteTarget(track?: SourceTrack): string {
  if (!track) return ''
  const source = track.catalog
  if (!source) return preferenceTrackKey(track)
  const edition = source.platform === 'kugou' ? tuneWeaveAccounts.kugou?.edition : ''
  return [favoriteKey(source), authorizedOwner(source.platform) ?? '', edition ?? ''].join('|')
}

// 兼容原生 IPC 的字符串错误与 HTTP 的 Error 对象。
function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '请稍后重试。'
}

// 每个平台独立维护账号快照和写入队列，切号时终止旧会话的后续工作。
function usePlatformFavorites(
  platform: MusicPlatform,
  profiles: Ref<LinkedProfiles>,
  registerTracks: (items: CatalogTrack[]) => unknown,
  updateImported: (owner: string, track: SourceTrack, liked: boolean) => void
) {
  const state = reactive({
    /** 最近一次完整的账号红心快照，null 表示尚未取得。 */
    ids: null as Set<string> | null,
    /** 当前账号会话中已通过完整公开查询确认的旧曲目编号。 */
    resolvedIds: new Map<CatalogSource, string>(),
    /** 在快照读取期间或之后成功写回的歌曲。 */
    writes: new Map<string, boolean>(),
    /** 等待提交或确认的每首歌曲的最终意图。 */
    pending: new Map<string, boolean>(),
  })
  let session = new AbortController()
  let reading: Promise<void> | undefined
  let writesDuringRead: Set<string> | undefined
  let writer = Promise.resolve()
  let refreshedAt = 0
  let reportedReadError = false
  let needsRead = false

  // 完整读取当前账号的红心，保留读列表期间已经写入的结果。
  async function refresh(force = false): Promise<void> {
    const owner = authorizedOwner(platform)
    if (!owner) return
    if (state.pending.size) {
      if (force) needsRead = true
      return
    }
    if (!force && Date.now() - refreshedAt < 60_000) return
    if (reading) return reading
    const { signal } = session
    const changes = new Set<string>()
    writesDuringRead = changes
    reading = (async () => {
      if (platform === 'netease') {
        const result = await httpGet<{ ids: string[] }>(
          '/netease/auth/favorites',
          {
            headers: { Authorization: 'Bearer ' + playbackBearer() },
            signal,
          }
        )
        if (signal.aborted) return
        if (
          !Array.isArray(result.ids) ||
          !result.ids.every(id => typeof id === 'string' && /^\d+$/.test(id))
        )
          throw new Error('网易云返回的红心列表无效')
        state.ids = new Set(result.ids)
      } else {
        const edition =
          platform === 'kugou' ? tuneWeaveAccounts.kugou?.edition : undefined
        const result = await readTuneWeaveFavorites(
          platform,
          owner,
          signal,
          edition
        )
        if (signal.aborted) return
        registerTracks(result.tracks)
        state.ids = new Set(result.ids)
      }
      for (const id of state.writes.keys()) {
        if (!changes.has(id)) state.writes.delete(id)
      }
      refreshedAt = Date.now()
      reportedReadError = false
    })()
      .catch((error: unknown) => {
        if (!signal.aborted && !reportedReadError) {
          reportedReadError = true
          notify(
            platformNames[platform] +
              '红心列表读取失败。' +
              errorMessage(error),
            'error'
          )
          if (platform !== 'netease')
            void refreshTuneWeaveAccount(platform).catch(() => {})
        }
      })
      .finally(() => {
        if (!signal.aborted) {
          reading = undefined
          writesDuringRead = undefined
        }
      })
    return reading
  }

  // 账号变更后立即丢弃前一账号的红心及等待队列，只刷新本平台。
  watch(
    [
      () =>
        platform === 'netease'
          ? playbackRevision.value
          : tuneWeaveAccounts[platform],
      () => (platform === 'netease' ? playbackAccount.value : null),
      () =>
        platform === 'netease' ? profiles.value.netease?.userId : undefined,
    ],
    () => {
      session.abort()
      session = new AbortController()
      reading = undefined
      writer = Promise.resolve()
      writesDuringRead = undefined
      refreshedAt = 0
      needsRead = false
      reportedReadError = false
      state.ids = null
      state.resolvedIds.clear()
      state.writes.clear()
      state.pending.clear()
      void refresh()
    },
    { flush: 'sync' }
  )

  // 旧曲目只有成功定位发行版本后，才能读取该版本的账号红心与写入进度。
  function accountId(source: CatalogSource): string {
    return source.platform === 'kugou' && source.kugouAlbumAudioId === undefined
      ? state.resolvedIds.get(source) ?? favoriteId(source) : favoriteId(source)
  }

  // 当前授权的已确认版本、写入结果和完整列表优先于公开歌单副本。
  function confirmed(source: CatalogSource, inPlaylist: boolean): boolean {
    const id = accountId(source)
    return state.writes.get(id) ?? state.ids?.has(id) ?? inPlaylist
  }

  // 对同账号的写入串行处理，同一首歌反复点击时保留最后意图。
  async function toggle(
    track: SourceTrack,
    inPlaylist: boolean
  ): Promise<void> {
    const source = track.catalog
    if (!source) return
    let id = accountId(source)
    if (platform === 'netease') {
      const revision = playbackRevision.value
      try {
        await restorePlaybackGrant()
      } catch (error) {
        notify(errorMessage(error), 'error')
        return
      }
      if (revision !== playbackRevision.value) return
    }
    const { signal } = session
    const owner = authorizedOwner(platform)
    const kugouAccount = platform === 'kugou' ? tuneWeaveAccounts.kugou : null
    if (!owner) {
      notify(favoriteHint(track))
      return
    }
    if (
      !state.ids &&
      !inPlaylist &&
      !state.writes.has(id) &&
      !state.pending.has(id)
    ) {
      if (state.pending.size) await writer
      if (signal.aborted) return
      reportedReadError = false
      await refresh()
      if (signal.aborted || !state.ids) return
    }
    let targetTrack = track
    let unresolvedIntent: boolean | undefined
    if (platform === 'kugou') {
      try {
        id = await resolveKugouFavoriteId(owner, track, signal, kugouAccount?.edition)
      } catch (error) {
        if (!signal.aborted) notify(errorMessage(error), 'error')
        return
      }
      if (signal.aborted) return
      if (source.kugouAlbumAudioId === undefined) {
        // 第一次确认旧版本时保留用户看到的红心意图，避免点击空心后反而删除已有收藏。
        if (!state.resolvedIds.has(source)) unresolvedIntent = !confirmed(source, inPlaylist)
        state.resolvedIds.set(source, id)
        targetTrack = { ...track, catalog: { ...source, kugouAlbumAudioId: id } }
      }
    }
    const alreadyPending = state.pending.has(id)
    const current = confirmed(source, inPlaylist)
    const wanted = alreadyPending ? !state.pending.get(id) : unresolvedIntent ?? !current
    if (!alreadyPending && wanted === current) return
    if (
      wanted &&
      kugouAccount?.edition === 'concept' &&
      !kugouAccount.canAddFavorites
    ) {
      notify(
        '请在酷狗收藏账号中用标准版补充授权，确认同一份喜欢歌单后即可新增。'
      )
      return
    }
    state.pending.set(id, wanted)
    if (alreadyPending) return
    writer = writer.then(async () => {
      if (signal.aborted) return
      try {
        while (!signal.aborted) {
          const desired = state.pending.get(id)
          if (
            desired === undefined ||
            confirmed(source, inPlaylist) === desired
          )
            break
          if (platform === 'netease') {
            await httpPost(
              `/netease/auth/favorites/${encodeURIComponent(id)}`,
              { liked: desired },
              {
                headers: { Authorization: 'Bearer ' + playbackBearer() },
                signal,
                validateStatus: status => status === 204,
              }
            )
          } else {
            await writeTuneWeaveFavorite(
              platform,
              owner,
              targetTrack,
              desired,
              signal,
              kugouAccount?.edition
            )
          }
          if (signal.aborted) return
          writesDuringRead?.add(id)
          state.writes.set(id, desired)
          updateImported(owner, targetTrack, desired)
        }
      } catch (error) {
        if (!signal.aborted) {
          needsRead = true
          if (platform !== 'netease') void refreshTuneWeaveAccount(platform).catch(() => {})
          notify(
            platformNames[platform] + '收藏未能确认。' + errorMessage(error),
            'error'
          )
        }
      } finally {
        if (!signal.aborted) {
          state.pending.delete(id)
          if (needsRead && !state.pending.size) {
            needsRead = false
            await reading
            if (!signal.aborted) {
              refreshedAt = 0
              await refresh()
            }
          }
        }
      }
    })
    await writer
  }
  return { state, accountId, confirmed, toggle, refresh }
}

// 汇总各平台当前账号的红心，分别保留设备曲目与旧版本机收藏。
export function useTrackFavorites(
  tracks: SourceTrack[],
  savedLocalKeys: string[],
  profiles: Ref<LinkedProfiles>,
  playlists: Ref<CatalogPlaylist[]>,
  updateImported: (owner: string, track: SourceTrack, liked: boolean) => void,
  registerTracks: (items: CatalogTrack[]) => unknown
) {
  const localKeys = reactive(new Set(savedLocalKeys))
  const legacyIndices = computed(() =>
    tracks.flatMap((track, index) =>
      track.catalog && localKeys.has(preferenceTrackKey(track)) ? [index] : []
    )
  )
  const accounts = {
    netease: usePlatformFavorites(
      'netease',
      profiles,
      registerTracks,
      updateImported
    ),
    kugou: usePlatformFavorites(
      'kugou',
      profiles,
      registerTracks,
      updateImported
    ),
    kuwo: usePlatformFavorites(
      'kuwo',
      profiles,
      registerTracks,
      updateImported
    ),
  }
  const browsedList = shallowRef<CatalogPlaylist>()
  // 公开喜欢歌单须由当前平台账号拥有。
  function ownerOf(platform: MusicPlatform): string | undefined {
    return authorizedOwner(platform) ?? profiles.value[platform]?.userId
  }
  const playlistKeys = computed(() => {
    const keys = new Set<string>()
    const preview = browsedList.value
    const saved = playlists.value
    const lists = preview && !saved.some(list => list.platform === preview.platform && list.id === preview.id)
      ? [...saved, preview] : saved
    for (const list of lists) {
      if (
        !list.favoriteOwnerId ||
        list.favoriteOwnerId !== ownerOf(list.platform)
      )
        continue
      for (const track of list.tracks) {
        if (track.platform === list.platform) keys.add(favoriteKey(track))
      }
    }
    return keys
  })
  const liked = computed(() => {
    const result: Record<number, boolean> = {}
    tracks.forEach((track, index) => {
      const source = track.catalog
      if (source) {
        const account = accounts[source.platform]
        if (
          account.state.pending.get(account.accountId(source)) ??
          account.confirmed(source, playlistKeys.value.has(favoriteKey(source)))
        )
          result[index] = true
      } else if (localKeys.has(preferenceTrackKey(track))) {
        result[index] = true
      }
    })
    return result
  })
  const pending = computed(() => {
    const keys = new Set<string>()
    for (const [platform, account] of Object.entries(accounts)) {
      for (const id of account.state.pending.keys())
        keys.add(platform + ':' + id)
      for (const [source, id] of account.state.resolvedIds)
        if (account.state.pending.has(id)) keys.add(favoriteKey(source))
    }
    return keys
  })
  // 打开有明确归属的系统歌单后，即使尚未导入也能立即显示其歌曲的红心。
  function observeFavoritePlaylist(list: CatalogPlaylist): void {
    if (list.favoriteOwnerId && list.favoriteOwnerId === ownerOf(list.platform))
      browsedList.value = list
  }
  // 系统喜欢歌单重新打开后，同步该账号的红心快照，保留并发写入的最终意图。
  async function refreshPlaylistFavorites(list: CatalogPlaylist): Promise<void> {
    if (list.favoriteOwnerId && list.favoriteOwnerId === authorizedOwner(list.platform))
      await accounts[list.platform].refresh(true)
  }
  // 设备曲目直接保存在本机，在线曲目由对应的平台账号确认。
  async function toggleFavorite(index: number): Promise<void> {
    const track = tracks[index]
    if (!track) return
    if (track.catalog)
      return accounts[track.catalog.platform].toggle(
        track,
        playlistKeys.value.has(favoriteKey(track.catalog))
      )
    const key = preferenceTrackKey(track)
    if (localKeys.has(key)) localKeys.delete(key)
    else localKeys.add(key)
  }
  // 返回前台时独立刷新每个已授权平台。
  async function refreshFavorites(): Promise<void> {
    await Promise.all(Object.values(accounts).map(account => account.refresh()))
  }
  return {
    liked,
    localKeys,
    legacyIndices,
    refreshFavorites,
    refreshPlaylistFavorites,
    observeFavoritePlaylist,
    toggleFavorite,
    pending,
  }
}
