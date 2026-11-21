export type TrayMenuAction =
  'main' | 'mini' | 'lyrics' | 'media' | 'settings' | 'exit'

export type TrayAction = TrayMenuAction | 'toggle'

export interface TrayMenuEntry {
  id: TrayMenuAction
  label: string
  icon: 'window' | 'mini' | 'lyrics' | 'media' | 'settings' | 'power'
}

export const trayDesktopEntries: readonly TrayMenuEntry[] = [
  { id: 'mini', label: '迷你播放器', icon: 'mini' },
  { id: 'lyrics', label: '桌面歌词', icon: 'lyrics' },
  { id: 'media', label: '媒体控制卡片', icon: 'media' },
]

export const trayUtilityEntries: readonly TrayMenuEntry[] = [
  { id: 'settings', label: '设置', icon: 'settings' },
  { id: 'exit', label: '退出播放器', icon: 'power' },
]

// 托盘入口保持原有顺序，供菜单渲染和回归测试复用。
export const trayMainEntry: TrayMenuEntry = {
  id: 'main',
  label: '打开主播放器',
  icon: 'window',
}

export function nextTrayFocus(
  key: string,
  index: number,
  count: number,
  shift = false
): number {
  if (count <= 0) return -1
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  const backwards = key === 'ArrowUp' || (key === 'Tab' && shift)
  if (index < 0) return backwards ? count - 1 : 0
  return (index + (backwards ? -1 : 1) + count) % count
}

export function validTrayHeight(height: number): boolean {
  return Number.isFinite(height) && height >= 220 && height <= 640
}

export function trayErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.trim().slice(0, 180) || '托盘操作失败，请重试。'
}

export function canRunTrayAction(
  action: TrayAction,
  busy: TrayAction | null,
  miniEnabled: boolean,
  hasTrack: boolean
): boolean {
  return (
    busy === null &&
    (action !== 'mini' || miniEnabled) &&
    (action !== 'toggle' || hasTrack)
  )
}
