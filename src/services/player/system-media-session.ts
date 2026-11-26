import { invoke } from '@tauri-apps/api/core'
import { catalogPlaybackKey } from '@/services/player/preferences'
import type { PlayerState } from '@/stores/player'
import type { SourceTrack } from '@/types/prototype'

type PlaybackState = Pick<PlayerState,
  'playing' | 'catalogStatus' | 't' | 'streamDuration' | 'queue' | 'radioOn' | 'shuffle'>

interface SystemPlayback {
  track: { id: string; title: string; artist: string; album: string; coverUrl: string | null }
  playing: boolean
  canNext: boolean
  canPrevious: boolean
  duration: number
  position: number
}

// 主窗口只往系统发布一份媒体会话，跳过无变化的时钟帧并合并等待中的更新。
export function createSystemMediaSession() {
  let startedTrack: SourceTrack | undefined
  let pending: SystemPlayback | null | undefined
  let publishing = false
  let lastPublished = 'null'
  let reportedError = false

  // 同一时间只发送一次 IPC，慢响应期间只保留最新状态，避免快速切歌后恢复旧卡片。
  async function publish(playback: SystemPlayback | null): Promise<void> {
    pending = playback
    if (publishing) return
    publishing = true
    while (pending !== undefined) {
      const next: SystemPlayback | null = pending
      pending = undefined
      const signature = JSON.stringify(next && { ...next, position: Math.floor(next.position) })
      if (signature === lastPublished) continue
      try {
        await invoke('update_system_media_session', { playback: next })
        lastPublished = signature
        reportedError = false
      } catch (error) {
        if (!reportedError) console.warn('同步 Windows 媒体会话失败', error)
        reportedError = true
      }
    }
    publishing = false
  }

  // 撤下空曲目或播放失败的会话，恢复的历史进度等到用户实际播放后才上报。
  function clear(): void {
    startedTrack = undefined
    void publish(null)
  }

  // 发布实际播放过的歌曲、当前音频时长和队列按钮状态，暂停时保留控制入口。
  function update(track: SourceTrack | undefined, state: PlaybackState): void {
    if (!track?.catalog || state.catalogStatus === 'unavailable' || state.catalogStatus === 'error') {
      clear()
      return
    }
    if (state.playing) startedTrack = track
    if (startedTrack !== track) {
      clear()
      return
    }
    const duration = Number.isFinite(state.streamDuration) ? Math.max(0, state.streamDuration) : 0
    const position = Number.isFinite(state.t) ? Math.max(0, Math.min(duration, state.t)) : 0
    const hasOtherTracks = (state.queue?.length ?? 0) > 1
    void publish({
      track: {
        id: catalogPlaybackKey(track.catalog),
        title: track.title,
        artist: track.artist,
        album: track.album === '—' ? '' : track.album,
        coverUrl: /^https?:\/\//i.test(track.cover) ? track.cover : null,
      },
      playing: state.playing,
      canNext: hasOtherTracks || (state.radioOn && !state.shuffle),
      canPrevious: hasOtherTracks || position > 3,
      duration,
      position,
    })
  }

  return { update, clear }
}
