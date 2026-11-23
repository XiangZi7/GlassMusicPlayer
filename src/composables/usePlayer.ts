import { inject, type InjectionKey } from 'vue'
import type { SourcePlayer, SourceTrack } from '@/types/prototype'
import type { PlayerPage, PlayerState, PlayerSettings } from '@/stores/player'

export interface PlayerController extends SourcePlayer {
  bind(): void
  refresh(): void
  navigate(page: PlayerPage, index?: number, fromRoute?: boolean): void
  selectTrack(index: number, autoplay?: boolean, direction?: number): void
  openStage(trigger?: HTMLElement): void
  reloadPlayback(resume?: boolean): void
  playTracks(indices: number[], index: number): void
  toggleRadio(): void
  setQuery(query: string): void
  playSmart(): void
  smartList(): number[]
  playNext(index: number): void
  moveQueue(from: number, to: number): void
  render(): void
  addUploadToLibrary(index: number): void
}

export interface PlayerContext {
  state: PlayerState
  tracks: SourceTrack[]
  controller: () => PlayerController | undefined
  setSetting: <K extends keyof PlayerSettings>(
    key: K,
    value: PlayerSettings[K]
  ) => void
  setNowPlaying: (open: boolean) => void
}

export const playerKey: InjectionKey<PlayerContext> = Symbol('player')

// 页面和公共播放器组件读取同一个 Pinia 状态与原稿控制器。
export function usePlayer(): PlayerContext {
  const player = inject(playerKey)
  if (!player) throw new Error('播放器组件必须位于 PlayerLayout 内。')
  return player
}
