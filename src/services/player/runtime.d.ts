import type { SourcePlayerOptions, SourceTrack } from '@/types/prototype';
import type { PlayerPage, PlayerState } from '@/stores/player';
import type { PlayerController } from '@/composables/usePlayer';
export function mountSourcePlayer(root: HTMLElement, options: SourcePlayerOptions & {
  state: PlayerState;
  tracks: SourceTrack[];
  onNavigate: (page: PlayerPage, index: number) => void;
}): PlayerController;
