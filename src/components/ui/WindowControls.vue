<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import BaseButton from '@/components/ui/BaseButton.vue'
import { controlWindow } from '@/services/desktop'

const props = defineProps<{ closeOnly?: boolean }>()

// 当前原生窗口是否最大化，用于同步最大化与还原图标。
const isMaximized = shallowRef(false)
const windowControls = computed(
  () =>
    [
      { action: 'minimize', label: '最小化窗口', title: '最小化' },
      {
        action: 'maximize',
        label: isMaximized.value ? '还原窗口' : '最大化窗口',
        title: isMaximized.value ? '还原' : '最大化',
      },
      { action: 'close', label: '关闭窗口', title: '关闭' },
    ].filter(control => !props.closeOnly || control.action === 'close') as {
      action: 'minimize' | 'maximize' | 'close'
      label: string
      title: string
    }[]
)
let stopResize: UnlistenFn | undefined
let disposed = false

// 启动或窗口尺寸变化时读取系统状态，兼容标题栏双击和系统贴靠操作。
async function syncWindowState(): Promise<void> {
  if (!isTauri()) return
  try {
    const maximized = await getCurrentWindow().isMaximized()
    if (!disposed) isMaximized.value = maximized
  } catch {
    // 系统状态查询失败时保留现有图标，窗口操作失败由公共通知统一反馈。
  }
}

// 统一执行 Windows 标题栏操作，最大化或还原后同步系统状态。
async function handleWindowControl(
  action: 'minimize' | 'maximize' | 'close'
): Promise<void> {
  await controlWindow(action)
  if (action === 'maximize') await syncWindowState()
}

// 在组件挂载后监听原生窗口尺寸，卸载期间完成的订阅立即释放。
onMounted(async () => {
  if (!isTauri()) return
  await syncWindowState()
  const stop = await getCurrentWindow().onResized(syncWindowState)
  if (disposed) stop()
  else stopResize = stop
})

// 释放原生窗口监听，避免页面重载后重复订阅。
onUnmounted(() => {
  disposed = true
  stopResize?.()
})
</script>
<template>
  <div
    class="flex h-full shrink-0 self-stretch"
    role="group"
    aria-label="窗口控制"
  >
    <BaseButton
      v-for="control in windowControls"
      :key="control.action"
      class="grid h-full w-[46px] shrink-0 place-items-center rounded-none border-0 bg-transparent text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white/70"
      :class="
        control.action === 'close'
          ? 'hover:bg-[#c42b1c] active:bg-[#a82318]'
          : 'hover:bg-white/10 active:bg-white/15'
      "
      :aria-label="control.label"
      :title="control.title"
      @click="handleWindowControl(control.action)"
    >
      <svg
        v-if="control.action === 'minimize'"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        class="pointer-events-none"
      >
        <path
          d="M0 5.5h10"
          stroke="currentColor"
        />
      </svg>
      <svg
        v-else-if="control.action === 'maximize' && isMaximized"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        class="pointer-events-none"
      >
        <path
          d="M3.5 3.5v-2h7v7h-2m-7-5h7v7h-7z"
          stroke="currentColor"
        />
      </svg>
      <svg
        v-else-if="control.action === 'maximize'"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        class="pointer-events-none"
      >
        <rect
          x=".5"
          y=".5"
          width="9"
          height="9"
          stroke="currentColor"
        />
      </svg>
      <svg
        v-else
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        class="pointer-events-none"
      >
        <path
          d="m1 1 8 8m0-8L1 9"
          stroke="currentColor"
        />
      </svg>
    </BaseButton>
  </div>
</template>
