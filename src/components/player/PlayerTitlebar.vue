<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { UnlistenFn } from '@tauri-apps/api/event'
import BaseButton from '@/components/ui/BaseButton.vue'
import { controlWindow } from '@/services/desktop'

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
    ] as const
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
  <!-- Windows 标题栏：保留原稿搜索和导航钩子，移除 macOS 红黄绿装饰。 -->
  <div
    class="win-chrome windows-titlebar relative z-[5] flex h-[42px] flex-none items-center gap-[14px] p-[0_16px]"
    data-tauri-drag-region
  >
    <div class="chrome-nav flex flex-none items-center gap-[4px]">
      <BaseButton
        data-nav-back
        aria-label="后退"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14.5 5.5L8 12l6.5 6.5" /></svg></BaseButton
      ><BaseButton
        data-nav-fwd
        aria-label="前进"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9.5 5.5L16 12l-6.5 6.5" /></svg
      ></BaseButton>
    </div>
    <span
      aria-hidden="true"
      class="h-3.5 w-px shrink-0 bg-white/10"
    ></span>
    <div
      class="chrome-title flex-1 text-center text-[12.5px] font-bold tracking-[.02em] opacity-[.85]"
      data-chrome-title
      data-tauri-drag-region
    >
      首页
    </div>
    <label
      class="chrome-search ml-auto flex h-[30px] w-[196px] flex-none items-center gap-[7px] rounded-full p-[0_12px_0_10px] text-inherit"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        />
        <path d="M20 20l-3.5-3.5" /></svg
      ><input
        type="text"
        data-top-search
        placeholder="搜索歌曲、专辑、歌手"
        aria-label="搜索歌曲、专辑、歌手"
        autocomplete="off"
        spellcheck="false"
    /></label>
    <div
      class="weather-pill flex min-h-[34px] items-center gap-[7px] rounded-full p-[4px_12px_4px_7px] whitespace-nowrap text-white"
      role="img"
      aria-label="本地天气：夜晚多云，19度，演示数据"
      title="本地天气 · 演示数据，正式版接定位与天气接口后为实时"
    >
      <svg
        class="wx-icon h-[29px] w-[29px] flex-none overflow-visible"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <circle
          class="wx-star"
          cx="7.5"
          cy="6.5"
          r="1.3"
          fill="#FFE9A8"
        />
        <circle
          class="wx-star s2"
          cx="14.5"
          cy="3.6"
          r=".9"
          fill="#ffffff"
        />
        <path
          class="wx-moon"
          d="M24.6 3.4a8.2 8.2 0 1 0 7.9 11.9A9.6 9.6 0 0 1 24.6 3.4z"
          fill="#F6DC8A"
        />
        <g class="wx-cloud">
          <path
            d="M8.4 27.8a5.2 5.2 0 0 1-.7-10.35 7.2 7.2 0 0 1 13.9-1.55A5.6 5.6 0 0 1 26.2 21.3c.3 3.4-2.2 6.5-6 6.5H8.4z"
            fill="rgba(255,255,255,.94)"
          />
        </g></svg
      ><span
        class="wx-temp text-[15px] leading-[1] font-extrabold tracking-[-.01em]"
        >19°</span
      ><span class="wx-cond text-[12px] leading-[1] font-bold opacity-[.85]"
        >多云</span
      >
    </div>
    <!-- Windows 窗口操作区：公共按钮组件提供完整点击区域与键盘焦点。 -->
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
  </div>
</template>

<style scoped>
/* 仅覆盖 Windows 标题栏的宿主尺寸，原稿其余区域继续使用原样式。 */
.windows-titlebar {
  height: 48px;
  gap: 12px;
  padding: 0 0 0 16px;
}

.windows-titlebar .chrome-nav button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.windows-titlebar .chrome-title {
  position: static;
  flex: 1 1 0;
  min-width: 0;
  max-width: none;
  transform: none;
  text-align: left;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: 0;
  opacity: 0.7;
}

.windows-titlebar .chrome-search {
  width: clamp(240px, 24vw, 340px);
  margin-left: 0;
  font-size: 13px;
}

.windows-titlebar .chrome-search input {
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0;
}

.windows-titlebar .chrome-search svg {
  width: 14px;
  height: 14px;
}
</style>
