import { computed, reactive, shallowRef, watch, type Ref } from 'vue'
import type { CatalogPlaylist, MusicPlatform } from '@/api'
import type { LinkedProfiles } from '@/stores/player'
import type { SourceTrack } from '@/types/prototype'
import { notify } from '@/services/notification'
import { platformNames } from '@/services/player/catalog'
import { preferenceTrackKey } from '@/services/player/preferences'
import {
  playbackAccount,
  playbackBearer,
  playbackRevision,
  restorePlaybackGrant,
} from '@/services/player/playback-session'
import { httpGet, httpPost } from '@/utils/http'

// 红心提示在主窗和独立小窗共用，平台缺少写权限时说明可用的操作。
export function favoriteHint(track?: SourceTrack): string {
  const platform = track?.catalog?.platform
  if (!platform) return '本机收藏'
  if (platform !== 'netease')
    return '当前服务尚未接入' + platformNames[platform] + '账号收藏'
  return playbackAccount.value?.favorites
    ? '同步到网易云音乐'
    : '请扫码登录网易云并授权红心同步'
}

// 按平台和账号维护红心，完整列表与已确认的写回都可用于之后才登记的歌曲。
export function useTrackFavorites(
  tracks: SourceTrack[],
  savedLocalKeys: string[],
  profiles: Ref<LinkedProfiles>,
  playlists: Ref<CatalogPlaylist[]>,
  updateImported: (owner: string, track: SourceTrack, liked: boolean) => void
) {
  const localKeys = reactive(new Set(savedLocalKeys))
  // 旧版收藏没有平台账号归属，单独展示这些记录，避免替用户上传或覆盖。
  const legacyIndices = computed(() =>
    tracks.flatMap((track, index) =>
      track.catalog && localKeys.has(preferenceTrackKey(track)) ? [index] : []
    )
  )
  const browsedList = shallowRef<CatalogPlaylist>()
  const accountState = reactive({
    /** 经过当前授权确认的完整网易云红心集合，首次读取前保留公开歌单依据。 */
    ids: null as Set<string> | null,
    /** 当前账号已写回的结果，优先于可能过期的导入歌单。 */
    writes: new Map<string, boolean>(),
    /** 正在提交的最终意图，重复点击同一首时只由首个请求负责写回。 */
    pending: new Map<string, boolean>(),
  })
  let loading: Promise<void> | undefined
  let request: AbortController | undefined
  let generation = 0
  let writtenDuringRead: Set<string> | undefined
  let refreshedAt = 0
  let reportedReadError = false

  // 登录、切号或退出后立即丢弃上一个身份的快照和操作。
  watch(
    [
      playbackRevision,
      () => playbackAccount.value?.userId,
      () => profiles.value.netease?.userId,
    ],
    () => {
      generation++
      browsedList.value = undefined
      request?.abort()
      request = undefined
      writtenDuringRead = undefined
      loading = undefined
      refreshedAt = 0
      reportedReadError = false
      accountState.ids = null
      accountState.writes.clear()
      accountState.pending.clear()
    },
    { flush: 'sync' }
  )

  // 网易云以实际登录账号为先，公开模式和其他来源沿用用户关联的 UID。
  function ownerOf(platform: MusicPlatform): string | undefined {
    if (platform === 'netease' && playbackAccount.value)
      return playbackAccount.value.userId
    return profiles.value[platform]?.userId
  }

  // 只采信平台标注归属的系统喜欢歌单；同名普通歌单和其他人的喜欢歌单均独立。
  const playlistKeys = computed(() => {
    const keys = new Set<string>()
    const lists = browsedList.value
      ? [...playlists.value, browsedList.value]
      : playlists.value
    for (const list of lists) {
      const owner = ownerOf(list.platform)
      if (!owner || list.favoriteOwnerId !== owner) continue
      for (const track of list.tracks) {
        if (track.platform === list.platform)
          keys.add(track.platform + ':' + track.id)
      }
    }
    return keys
  })

  // 曲库索引只负责界面定位，所有平台匹配都用稳定歌曲 ID。
  const liked = computed(() => {
    const result: Record<number, boolean> = {}
    tracks.forEach((track, index) => {
      const key = preferenceTrackKey(track)
      const source = track.catalog
      let selected = source ? playlistKeys.value.has(key) : localKeys.has(key)
      if (source?.platform === 'netease') {
        selected =
          accountState.pending.get(source.id) ??
          accountState.writes.get(source.id) ??
          accountState.ids?.has(source.id) ??
          selected
      }
      if (selected) result[index] = true
    })
    return result
  })

  // 读取当前扫码账号的红心列表，正在读取时发生的成功写入优先于旧响应。
  async function refreshFavorites(): Promise<void> {
    const token = playbackBearer()
    if (
      !token ||
      !playbackAccount.value?.favorites ||
      Date.now() - refreshedAt < 60_000
    )
      return
    if (loading) return loading
    if (accountState.pending.size) return
    const controller = new AbortController()
    request = controller
    const changes = new Set<string>()
    writtenDuringRead = changes
    loading = httpGet<{ ids: string[] }>('/netease/auth/favorites', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(result => {
        if (controller.signal.aborted || token !== playbackBearer()) return
        if (
          !Array.isArray(result.ids) ||
          !result.ids.every(id => typeof id === 'string' && /^\d+$/.test(id))
        ) {
          throw new Error('网易云返回的红心列表无效')
        }
        accountState.ids = new Set(result.ids)
        // 请求发出后新确认的写入仍覆盖这份快照。
        for (const id of accountState.writes.keys()) {
          if (!changes.has(id)) accountState.writes.delete(id)
        }
        refreshedAt = Date.now()
        reportedReadError = false
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          token !== playbackBearer() ||
          reportedReadError
        )
          return
        reportedReadError = true
        notify(
          '网易云红心列表读取失败。' +
            (error instanceof Error ? error.message : '请稍后重试。'),
          'error'
        )
      })
      .finally(() => {
        if (request === controller) {
          loading = undefined
          writtenDuringRead = undefined
        }
      })
    return loading
  }

  // 首次浏览系统喜欢歌单时即可显示红心，无需把该歌单另行导入曲库。
  function observeFavoritePlaylist(list: CatalogPlaylist): void {
    const owner = ownerOf(list.platform)
    if (owner && list.favoriteOwnerId === owner) browsedList.value = list
  }

  // 在点击时锁定曲目与身份，按平台确认结果收敛，同一首快速连续点击合并到最后一次。
  async function toggleFavorite(index: number): Promise<void> {
    const track = tracks[index]
    if (!track) return
    const wanted = !liked.value[index]
    const source = track.catalog
    if (!source) {
      const key = preferenceTrackKey(track)
      if (wanted) localKeys.add(key)
      else localKeys.delete(key)
      return
    }
    if (source.platform !== 'netease') {
      notify(favoriteHint(track))
      return
    }
    const revision = playbackRevision.value
    try {
      await restorePlaybackGrant()
    } catch (error) {
      notify(
        error instanceof Error ? error.message : '无法恢复网易云授权',
        'error'
      )
      return
    }
    const token = playbackBearer()
    if (revision !== playbackRevision.value) return
    const account = playbackAccount.value
    if (!token || !account?.favorites) {
      notify(favoriteHint(track))
      return
    }
    const id = source.id
    if (accountState.pending.has(id)) {
      accountState.pending.set(id, !accountState.pending.get(id))
      return
    }
    const started = generation
    // 写回和失败回滚只作用于发起点击的同一份账号授权。
    const current = () => started === generation && token === playbackBearer()
    accountState.pending.set(id, wanted)
    try {
      while (current()) {
        const desired = accountState.pending.get(id)
        if (desired === undefined) break
        try {
          await httpPost(
            `/netease/auth/favorites/${encodeURIComponent(id)}`,
            { liked: desired },
            {
              headers: { Authorization: `Bearer ${token}` },
              validateStatus: status => status === 204,
            }
          )
          if (!current()) return
          writtenDuringRead?.add(id)
          accountState.writes.set(id, desired)
          updateImported(account.userId, track, desired)
        } catch (error) {
          if (desired === accountState.pending.get(id)) throw error
        }
        if (desired === accountState.pending.get(id)) break
      }
    } catch (error) {
      if (current())
        notify(
          '网易云收藏未能确认。' +
            (error instanceof Error ? error.message : '请重试。'),
          'error'
        )
    } finally {
      if (current()) accountState.pending.delete(id)
    }
  }

  return {
    liked,
    localKeys,
    legacyIndices,
    refreshFavorites,
    observeFavoritePlaylist,
    toggleFavorite,
    pending: accountState.pending,
  }
}
