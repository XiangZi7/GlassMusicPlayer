<script setup lang="ts">
import { onBeforeUnmount, onDeactivated, useTemplateRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

defineProps<{ labelledBy: string; describedBy?: string }>()
const open = defineModel<boolean>({ default: false })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

let transition: Animation | undefined
let transitionRun = 0

// 原生模态层保留焦点与背景隔离；开关先淡入淡出，快速重开会取消旧关闭回调。
watch(
  [open, dialog],
  async ([visible, element]) => {
    const run = ++transitionRun
    transition?.cancel()
    transition = undefined
    if (!element?.isConnected) return
    const reduced =
      document.body.classList.contains('calm') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (visible) {
      element.removeAttribute('data-closing')
      if (!element.open) element.showModal()
      if (!reduced && element.animate)
        transition = element.animate(
          [
            { opacity: 0, transform: 'translateY(8px) scale(.99)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 180, easing: 'cubic-bezier(.22,1,.36,1)' }
        )
    } else if (element.open) {
      element.setAttribute('data-closing', 'true')
      if (!reduced && element.animate) {
        transition = element.animate(
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'translateY(5px) scale(.99)' },
          ],
          { duration: 140, easing: 'ease-in', fill: 'forwards' }
        )
        try {
          await transition.finished
        } catch {
          /* 重开或卸载会取消当前关闭。 */
        }
      }
      if (run === transitionRun && !open.value && element.open) element.close()
    }
  },
  { flush: 'post' }
)

// Escape 同步更新受控状态；迟到的 close 事件不能关闭刚重新打开的弹窗。
useEventListener(dialog, 'cancel', event => {
  event.preventDefault()
  open.value = false
})
useEventListener(dialog, 'close', () => {
  if (!dialog.value?.open) open.value = false
})

// Tab 在首尾控件间循环，不落到浏览器工具栏，也不触发背景播放器快捷键。
useEventListener(dialog, 'keydown', event => {
  const element = dialog.value
  if (!element?.open) return
  event.stopPropagation()
  if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey)
    return
  const controls = Array.from(
    element.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]'
    )
  ).filter(control => {
    if (
      control.tabIndex < 0 ||
      control.matches(':disabled, [type="hidden"]') ||
      !control.getClientRects().length
    )
      return false
    if (
      control instanceof HTMLInputElement &&
      control.type === 'radio' &&
      control.name &&
      !control.checked
    )
      return !element.querySelector(
        `input[type="radio"][name="${CSS.escape(control.name)}"]:checked`
      )
    return true
  })
  const first = controls[0],
    last = controls[controls.length - 1]
  const active = element.ownerDocument.activeElement
  if (!first || !last) {
    event.preventDefault()
    element.focus()
  } else if (
    !controls.includes(active as HTMLElement) ||
    (event.shiftKey ? active === first : active === last)
  ) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
})
useEventListener(dialog, 'keyup', event => event.stopPropagation())

// 只处理真正落在弹窗外的点击，不把内容区点击误当成关闭。
function closeBackdrop(event: PointerEvent): void {
  const element = dialog.value
  if (!element || event.target !== element) return
  const bounds = element.getBoundingClientRect()
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    open.value = false
}

onDeactivated(() => {
  open.value = false
  dialog.value?.close()
})
onBeforeUnmount(() => {
  transitionRun++
  transition?.cancel()
  dialog.value?.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[500px] overflow-y-auto rounded-[22px] border border-white/15 bg-[#18181f] p-0 text-white shadow-[0_24px_96px_rgba(0,0,0,0.55)] backdrop:bg-black/55 backdrop:backdrop-blur-sm"
    :aria-labelledby="labelledBy"
    :aria-describedby="describedBy"
    @pointerdown="closeBackdrop"
  >
    <slot />
  </dialog>
</template>
