import type { SourceTrack } from '@/types/prototype'
import type { PlayerState } from '@/stores/player'
import { notify } from '@/services/notification'
import { httpPost } from '@/utils/http'
import {
  playbackAccount,
  playbackBearer,
  playbackRevision,
  restorePlaybackGrant,
} from '@/services/player/playback-session'

// 每个播放器独立串行处理同曲红心，切歌后仍操作点击时的歌曲和账号。
export function createFavoriteToggle(
  state: PlayerState,
  tracks: SourceTrack[],
  render: () => void
) {
  const pending = new Map<number, { revision: number; wanted: boolean }>()

  // 本机立即反馈，平台失败时恢复最后一次确认的状态，允许用户重新点击。
  return async function toggleFavorite(): Promise<void> {
    const index = state.idx
    const track = tracks[index]
    if (!track) return
    let confirmed = !!state.liked[index]
    const wanted = !confirmed
    state.liked[index] = wanted
    render()
    const catalog = track.catalog
    if (catalog?.platform !== 'netease') return

    const revision = playbackRevision.value
    const existing = pending.get(index)
    if (existing?.revision === revision) {
      existing.wanted = wanted
      return
    }
    const action = { revision, wanted }
    pending.set(index, action)
    try {
      await restorePlaybackGrant()
      if (revision !== playbackRevision.value) return
      const token = playbackBearer()
      const account = playbackAccount.value
      if (!token || !account) return
      if (!account.favorites) {
        notify(
          '仅更新本机收藏。请使用支持红心同步的服务端并重新扫码登录网易云。'
        )
        return
      }
      while (
        token === playbackBearer() &&
        revision === playbackRevision.value
      ) {
        const liked = action.wanted
        try {
          await httpPost(
            `/netease/auth/favorites/${encodeURIComponent(catalog.id)}`,
            { liked },
            {
              headers: { Authorization: `Bearer ${token}` },
              validateStatus: status => status === 204,
            }
          )
          confirmed = liked
        } catch (error) {
          if (liked === action.wanted) throw error
        }
        if (liked === action.wanted) break
      }
    } catch (error) {
      if (revision === playbackRevision.value) {
        state.liked[index] = confirmed
        render()
        notify(
          '网易云收藏未能确认。' +
            (error instanceof Error ? error.message : '请重试。'),
          'error'
        )
      }
    } finally {
      if (pending.get(index) === action) pending.delete(index)
    }
  }
}
