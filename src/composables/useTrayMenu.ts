import { onMounted, onUnmounted, reactive, toRefs } from 'vue'
import { useEventListener } from '@vueuse/core'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { SourceSnapshot } from '@/types/prototype'
import type { SettingsSnapshot } from '@/types/settings'
import {
  canRunTrayAction,
  trayErrorMessage,
  validTrayHeight,
  type TrayAction,
} from '@/types/tray'

// 托盘仅订阅主窗口快照；不初始化 Pinia 播放器、不创建音频或第二个计时器。
export function useTrayMenu() {
  const native = isTauri()
  // 响应式状态
  const state = reactive({
    // 当前曲目和播放状态直接来自主播放器。
    snapshot: null as SourceSnapshot | null,
    // 沿用主播放器选中的磨砂/液态材质。
    glassStyle: 'match',
    // 主播放器的动效偏好，同时受系统减少动效设置约束。
    motion: true,
    // 托盘每次打开都会再次读取原生迷你播放器偏好。
    miniEnabled: true,
    // 同一时刻只提交一个动作，避免重复创建或退出。
    busy: null as TrayAction | null,
    // 失败信息留在菜单中，不用另开系统消息框。
    error: '',
    // 缓存窗口每次打开时重新聚焦并播放轻量入场动效。
    cycle: 0,
    // 收起后停止歌曲状态的小动效。
    opened: !native,
    // 固定的页面代号，旧页在途命令不能撤销新页的原生回退。
    generation: null as number | null,
    // 原生事件订阅和页面代号获取完成后才允许 ready/尺寸握手。
    connected: false,
    // 保存完整内容高度，订阅和首次测量顺序不同也不会弹出空白菜单。
    surfaceHeight: 0,
  })
  const {
    snapshot,
    glassStyle,
    motion,
    miniEnabled,
    busy,
    error,
    cycle,
    opened,
  } = toRefs(state)
  const unlisteners: UnlistenFn[] = []
  let disposed = false
  let lastHeight = 0
  let resizeQueue = Promise.resolve()

  async function subscribe<T>(
    name: string,
    receive: (payload: T) => void
  ): Promise<void> {
    const stop = await listen<T>(name, event => {
      if (!disposed) receive(event.payload)
    })
    if (disposed) stop()
    else unlisteners.push(stop)
  }

  function resize(height: number): Promise<void> {
    if (!validTrayHeight(height)) return Promise.resolve()
    state.surfaceHeight = height
    resizeQueue = resizeQueue.then(async () => {
      if (
        disposed ||
        !native ||
        !state.connected ||
        state.surfaceHeight === lastHeight
      )
        return
      const contentHeight = state.surfaceHeight
      try {
        await invoke('resize_tray_menu', {
          contentHeight,
          generation: state.generation,
        })
        lastHeight = contentHeight
      } catch (error) {
        if (!disposed) state.error = trayErrorMessage(error)
      }
    })
    return resizeQueue
  }

  async function run(action: TrayAction): Promise<void> {
    if (
      !canRunTrayAction(
        action,
        state.busy,
        state.miniEnabled,
        state.snapshot !== null
      )
    )
      return
    if (!native) {
      state.error = '托盘操作请在 Tauri 桌面客户端中使用。'
      return
    }
    if (!state.connected || state.generation === null) return
    state.busy = action
    state.error = ''
    try {
      await invoke('run_tray_action', { action, generation: state.generation })
    } catch (error) {
      if (!disposed) state.error = trayErrorMessage(error)
    } finally {
      if (!disposed) state.busy = null
    }
  }

  async function dismiss(): Promise<void> {
    if (!native || disposed || !state.connected || state.generation === null)
      return
    try {
      await invoke('dismiss_tray_menu', { generation: state.generation })
      state.opened = false
    } catch (error) {
      if (!disposed) state.error = trayErrorMessage(error)
    }
  }

  useEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    void dismiss()
  })

  onMounted(async () => {
    document.documentElement.dataset.traySurface = 'true'
    if (!native) return
    try {
      await Promise.all([
        subscribe<SourceSnapshot>('player-snapshot', snapshot => {
          state.snapshot = snapshot
        }),
        subscribe<SettingsSnapshot>('settings-snapshot', snapshot => {
          state.glassStyle = snapshot.settings.glassStyle
          state.motion = snapshot.settings.motion
          state.miniEnabled = snapshot.settings.trayMini
        }),
        subscribe<boolean>('tray-opened', enabled => {
          state.miniEnabled = enabled
          state.opened = true
          state.cycle++
          if (state.busy === null) state.error = ''
        }),
        subscribe('tray-closed', () => {
          state.opened = false
        }),
      ])
      if (disposed) return
      const generation = await invoke<number>('start_tray_session')
      if (disposed) return
      if (!Number.isSafeInteger(generation) || generation < 0)
        throw new Error('托盘页面代号无效')
      state.generation = generation
      state.connected = true
      await resize(state.surfaceHeight)
    } catch (error) {
      if (!disposed) state.error = trayErrorMessage(error)
    }
  })
  function dispose(): void {
    if (disposed) return
    disposed = true
    state.connected = false
    state.generation = null
    delete document.documentElement.dataset.traySurface
    unlisteners.splice(0).forEach(stop => stop())
  }
  // 原生 reload 不一定触发 Vue unmount；pagehide 也释放旧页的原生订阅。
  useEventListener('pagehide', dispose)
  onUnmounted(dispose)

  return {
    snapshot,
    glassStyle,
    motion,
    miniEnabled,
    busy,
    error,
    cycle,
    opened,
    run,
    dismiss,
    resize,
  }
}
