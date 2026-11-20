<script setup lang="ts">
import { onBeforeUnmount, onDeactivated, useTemplateRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

defineProps<{ labelledBy: string; describedBy?: string }>()
const open = defineModel<boolean>({ default: false })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

// 原生模态层负责初始焦点、背景不可交互和 Escape 关闭。
watch(
  [open, dialog],
  ([visible, element]) => {
    if (!element?.isConnected) return
    if (visible && !element.open) element.showModal()
    else if (!visible && element.open) element.close()
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
onBeforeUnmount(() => dialog.value?.close())
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
