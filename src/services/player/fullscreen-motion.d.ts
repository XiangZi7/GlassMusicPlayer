import type { PlayerState } from '@/stores/player'
import type { SourceTrack } from '@/types/prototype'
export function createFullscreenMotion(options: {
  players: () => NodeListOf<HTMLElement>
  state: PlayerState
  tracks: SourceTrack[]
  document: Pick<Document, 'body' | 'createElement'>
  window: Window
  setTimeout: (callback: () => void, delay: number) => number
  queueNextTi: () => number | null
}): (direction: number, oldTrack: SourceTrack) => void
