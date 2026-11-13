import type { PlayerSettings } from '@/stores/player'
import type { SourceTrack } from '@/types/prototype'

export interface SettingsSnapshot {
  settings: PlayerSettings
  npOpen: boolean
  track: SourceTrack
}

export type SettingsAction =
  | {
      kind: 'setting'
      key: keyof PlayerSettings
      value: PlayerSettings[keyof PlayerSettings]
    }
  | { kind: 'panel'; value: boolean }
