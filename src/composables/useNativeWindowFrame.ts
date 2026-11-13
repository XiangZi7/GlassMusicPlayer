import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { notify } from '@/services/notification'

type ResizeDirection = Parameters<
  ReturnType<typeof getCurrentWindow>['startResizeDragging']
>[0]

// Windows 10 的自绘外框统一处理最大化状态与边缘缩放，其他系统不额外监听。
export function useNativeWindowFrame() {
  const custom = window.__MIRAI_WINDOW_FRAME__?.custom === true
  const maximized = shallowRef(false)
  const needsCustomFrame = computed(() => custom && !maximized.value)
  let disposed = false
  let stopResize: UnlistenFn | undefined

  const resizeHandles: { direction: ResizeDirection; class: string }[] = [
    {
      direction: 'North',
      class: 'inset-x-[8px] top-0 h-[4px] cursor-n-resize',
    },
    {
      direction: 'South',
      class: 'inset-x-[8px] bottom-0 h-[4px] cursor-s-resize',
    },
    {
      direction: 'East',
      class: 'inset-y-[8px] right-0 w-[4px] cursor-e-resize',
    },
    {
      direction: 'West',
      class: 'inset-y-[8px] left-0 w-[4px] cursor-w-resize',
    },
    {
      direction: 'NorthEast',
      class: 'top-0 right-0 size-[8px] cursor-ne-resize',
    },
    {
      direction: 'NorthWest',
      class: 'top-0 left-0 size-[8px] cursor-nw-resize',
    },
    {
      direction: 'SouthEast',
      class: 'right-0 bottom-0 size-[8px] cursor-se-resize',
    },
    {
      direction: 'SouthWest',
      class: 'bottom-0 left-0 size-[8px] cursor-sw-resize',
    },
  ]

  // 最大化与系统贴靠状态改变时移除补偿外框，还原时恢复小圆角和阴影。
  async function syncMaximized(): Promise<void> {
    const value = await getCurrentWindow().isMaximized()
    if (!disposed) maximized.value = value
  }

  // 自绘阴影使系统缩放边缘移到透明区，补上贴近可见窗口边缘的缩放入口。
  async function startResize(direction: ResizeDirection): Promise<void> {
    if (!needsCustomFrame.value || !isTauri()) return
    try {
      await getCurrentWindow().startResizeDragging(direction)
    } catch {
      notify('调整窗口大小失败，请重试', 'error')
    }
  }

  onMounted(async () => {
    if (!custom || !isTauri()) return
    await syncMaximized()
    const stop = await getCurrentWindow().onResized(syncMaximized)
    if (disposed) stop()
    else stopResize = stop
  })

  onUnmounted(() => {
    disposed = true
    stopResize?.()
  })

  return { needsCustomFrame, resizeHandles, startResize }
}
