<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { Menu } from '@tauri-apps/api/menu'
import type { SourceAction, SourceSnapshot } from '@/types/prototype'

const snapshot = shallowRef<SourceSnapshot>()
const lyric = computed(
  () => snapshot.value?.capsuleLyric || snapshot.value?.track.title || ''
)
let stopSnapshot: UnlistenFn | undefined
let disposed = false
let contextMenu: Menu | undefined
let contextOpening = false

// 独立灵动岛和三张桌面卡片一样，可右键收起自身，不退出主播放器。
async function openContextMenu(event: MouseEvent): Promise<void> {
  if (!isTauri() || contextOpening) return
  const window = getCurrentWindow()
  if (window.label !== 'island') return
  contextOpening = true
  try {
    contextMenu ??= await Menu.new({
      items: [
        { id: 'island-open-main', text: '打开主播放器', action: focusPlayer },
        { item: 'Separator' },
        {
          id: 'island-close',
          text: '关闭小窗',
          action: () => {
            void window.close()
          },
        },
      ],
    })
    await contextMenu.popup(
      new LogicalPosition(event.clientX, event.clientY),
      window
    )
  } catch (error) {
    console.warn('打开灵动岛菜单失败', error)
  } finally {
    contextOpening = false
  }
}

// 先订阅播放快照，再向主窗口请求当前歌词。
onMounted(async () => {
  document.documentElement.dataset.desktopSurface = 'true'
  document.body.classList.add('desktop-island')
  if (!isTauri()) return
  const stop = await listen<SourceSnapshot>('player-snapshot', event => {
    snapshot.value = event.payload
  })
  if (disposed) {
    stop()
    return
  }
  stopSnapshot = stop
  await emitTo('main', 'player-ready')
})

onUnmounted(() => {
  disposed = true
  stopSnapshot?.()
  void contextMenu?.close().catch(() => undefined)
  delete document.documentElement.dataset.desktopSurface
  document.body.classList.remove('desktop-island')
})

// 胶囊末端的按钮恢复主窗口，拖动区由原生窗口处理。
function focusPlayer(): void {
  if (isTauri())
    void emitTo<SourceAction>('main', 'player-action', { type: 'focus' })
}
</script>

<template>
  <!-- 透明外框只给阴影留白；320 × 40 胶囊仍是独立的原生拖动小窗。 -->
  <div
    class="island-frame"
    @contextmenu.prevent="openContextMenu"
  >
    <div
      v-if="snapshot"
      class="island-surface flex h-[40px] w-full items-center rounded-full border border-white/25 px-2 text-[12.5px] font-bold text-white"
      :class="{ playing: snapshot.playing && snapshot.motion }"
    >
      <div
        class="flex h-full min-w-0 flex-1 cursor-grab items-center gap-[9px] pl-2 select-none active:cursor-grabbing"
        data-tauri-drag-region
      >
        <span
          class="cap-eq pointer-events-none flex h-3 flex-none items-end gap-[2.5px]"
          aria-hidden="true"
        >
          <i /><i /><i />
        </span>
        <span
          class="pointer-events-none truncate"
          :title="lyric"
          >{{ lyric }}</span
        >
      </div>
      <button
        type="button"
        class="size-7 shrink-0 rounded-full text-[11px] opacity-70 hover:bg-white/15 hover:opacity-100"
        aria-label="返回播放器"
        @click="focusPlayer"
      >
        ▸
      </button>
    </div>
  </div>
</template>

<style scoped>
:global(html[data-desktop-surface]),
:global(html[data-desktop-surface] body),
:global(html[data-desktop-surface] #app) {
  background: transparent !important;
}
.island-frame {
  width: 100%;
  height: 100%;
  padding: 32px;
}
.island-surface {
  /* 和桌面卡片相同的高遮蔽暗玻璃；CSS blur 不会模糊其他应用的桌面。 */
  background: linear-gradient(
    135deg,
    rgba(32, 35, 46, 0.985),
    rgba(14, 16, 24, 0.98)
  );
  -webkit-backdrop-filter: blur(22px) saturate(1.25);
  backdrop-filter: blur(22px) saturate(1.25);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.island-surface button:focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}
</style>
