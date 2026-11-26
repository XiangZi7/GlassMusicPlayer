import type { SourcePlayerOptions, SourceTrack } from '@/types/prototype'
import type { PlayerPage, PlayerState } from '@/stores/player'
import type { PlayerController } from '@/composables/usePlayer'
export function mountSourcePlayer(
  root: HTMLElement,
  options: SourcePlayerOptions & {
    state: PlayerState
    tracks: SourceTrack[]
    toggleFavorite: (index: number) => Promise<void>
    onNavigate: (page: PlayerPage, index: number, path?: string) => void
    currentPath: () => string
  }
): PlayerController
