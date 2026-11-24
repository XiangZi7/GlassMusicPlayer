import { shallowRef } from 'vue'
import { useEventListener } from '@vueuse/core'

// WebView 在脚本恢复焦点时可能沿用上一次键盘状态，用实际输入方式决定胶囊焦点环。
export function useIslandKeyboardFocus() {
  const keyboardFocus = shallowRef(false)
  useEventListener(document, 'keydown', event => {
    if (event.key === 'Tab' || event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      keyboardFocus.value = true
    }
  }, { capture: true })
  useEventListener(document, 'pointerdown', () => { keyboardFocus.value = false }, { capture: true })
  return keyboardFocus
}
