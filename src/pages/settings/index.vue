<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  shallowRef,
  watch,
} from 'vue'
import { useEventListener } from '@vueuse/core'
import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import PlayerWindowFrame from '@/components/player/PlayerWindowFrame.vue'
import WindowControls from '@/components/ui/WindowControls.vue'
import SettingsPanel from '@/pages/settings/components/settings-panel.vue'
import { playerKey } from '@/composables/usePlayer'
import { usePlayerStore, type PlayerSettings } from '@/stores/player'
import { notify } from '@/services/notification'
import type { SettingsAction, SettingsSnapshot } from '@/types/settings'

const { state, tracks } = usePlayerStore()
const ready = shallowRef(!isTauri())
const cover = shallowRef(tracks[0]!.cover)
const glassStyle = computed(() => state.settings.glassStyle)
let disposed = false
let stopSnapshot: UnlistenFn | undefined

provide(playerKey, {
  state,
  tracks,
  controller: () => undefined,
  setSetting,
  setNowPlaying,
})

// 设置弹窗只提交偏好动作，播放状态始终由主窗口管理。
function sendChange(action: SettingsAction): void {
  if (!isTauri()) return
  void emitTo('main', 'settings-change', action).catch(() =>
    notify('设置同步失败，请重试', 'error')
  )
}

// 本地控件即时反馈，随后接收主窗口确认后的完整状态。
function setSetting<K extends keyof PlayerSettings>(
  key: K,
  value: PlayerSettings[K]
): void {
  state.settings[key] = value
  sendChange({ kind: 'setting', key, value })
}

// 右侧播放面板的开关同步回主播放器。
function setNowPlaying(open: boolean): void {
  state.npOpen = open
  sendChange({ kind: 'panel', value: open })
}

// 接收主窗口快照时不再次发送动作，避免双向事件形成回环。
function applySnapshot(snapshot: SettingsSnapshot): void {
  Object.assign(state.settings, snapshot.settings)
  state.npOpen = snapshot.npOpen
  cover.value = snapshot.track.cover
  ready.value = true
}

watch(
  () => state.settings.motion,
  value => document.body.classList.toggle('calm', !value),
  { immediate: true }
)
useEventListener('keydown', event => {
  if (event.key === 'Escape' && isTauri()) void getCurrentWindow().close()
})

onMounted(async () => {
  if (!isTauri()) return
  const stop = await listen<SettingsSnapshot>('settings-snapshot', event =>
    applySnapshot(event.payload)
  )
  if (disposed) {
    stop()
    return
  }
  stopSnapshot = stop
  await emitTo('main', 'settings-ready')
})

onUnmounted(() => {
  disposed = true
  stopSnapshot?.()
})
</script>

<template>
  <!-- 设置原生窗口：与主播放器复用外框、材质、圆角阴影及缩放入口。 -->
  <PlayerWindowFrame
    :cover="cover"
    :glass-style="glassStyle"
  >
    <!-- 设置标题栏：沿用主界面的原生窗口控制和拖动区域。 -->
    <header
      class="relative z-[5] flex h-[48px] shrink-0 items-center gap-[12px] border-b border-white/10 bg-white/[.025] pl-[18px]"
      data-tauri-drag-region
    >
      <span
        class="text-[13px] font-bold text-white/80"
        data-tauri-drag-region
        >设置 · Aura Player</span
      >
      <div
        class="h-full flex-1"
        data-tauri-drag-region
      />
      <!-- 原生窗口控制组件：关闭当前设置窗口，主播放器继续运行。 -->
      <WindowControls />
    </header>
    <!-- 设置内容区域：同步完成前在容器内显示加载状态。 -->
    <main
      class="main show-page relative z-[3] min-h-0 flex-1 overflow-y-auto p-[18px_22px_20px]"
      :aria-busy="!ready"
    >
      <div
        v-if="!ready"
        class="page-panel active"
      >
        <div
          class="absolute inset-0 grid place-items-center"
          role="status"
          aria-label="正在读取设置"
        >
          <span
            class="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
          />
        </div>
      </div>
      <!-- 设置表单组件：复用原主界面的所有设置控件和内容排版。 -->
      <SettingsPanel v-else />
    </main>
  </PlayerWindowFrame>
</template>
