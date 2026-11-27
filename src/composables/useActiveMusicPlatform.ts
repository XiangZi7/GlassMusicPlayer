import { computed } from 'vue'
import type { MusicPlatform } from '@/api'
import { playbackAccount } from '@/services/player/playback-session'
import { tuneWeaveAccounts } from '@/services/player/tuneweave-session'
import { usePlayerStore } from '@/stores/player'

// 首页与音乐库优先采用当前已验证登录，再使用最近关联的公开主页。
export function useActiveMusicPlatform() {
  const { state } = usePlayerStore()
  return computed<MusicPlatform>(() => {
    if (playbackAccount.value) return 'netease'
    if (tuneWeaveAccounts.kugou) return 'kugou'
    if (tuneWeaveAccounts.kuwo) return 'kuwo'
    const linked = (Object.keys(state.linkedProfiles) as MusicPlatform[]).sort(
      (left, right) =>
        state.linkedProfiles[right]!.syncedAt -
        state.linkedProfiles[left]!.syncedAt
    )
    return linked[0] ?? 'netease'
  })
}
