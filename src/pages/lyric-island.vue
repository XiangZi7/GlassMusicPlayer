<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, shallowRef, useTemplateRef } from 'vue'
import { useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalPosition, LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi'
import { Menu } from '@tauri-apps/api/menu'
import IslandCover from '@/components/player/IslandCover.vue'
import IslandPlayer from '@/components/player/IslandPlayer.vue'
import NotificationHost from '@/components/ui/NotificationHost.vue'
import { notify } from '@/services/notification'
import type { SourceAction, SourceSnapshot } from '@/types/prototype'

const snapshot = shallowRef<SourceSnapshot>()
const lyric = computed(
  () => snapshot.value?.capsuleLyric || snapshot.value?.track.title || ''
)
let stopSnapshot: UnlistenFn | undefined
let disposed = false
let contextMenu: Menu | undefined
let contextOpening = false
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const reducedMotion = usePreferredReducedMotion()
const panel = reactive({
  // 展开状态由当前窗口掌管，播放状态由主窗口广播。
  open: false,
})
let savedPosition: PhysicalPosition | undefined
let resizing = Promise.resolve()
let dragStart: { id: number; x: number; y: number } | undefined
let dragged = false

// 根据工作区和缩放比例为面板腾出空间，收起后恢复拖动落点。
function resizeIsland(expanded: boolean): void {
  resizing = resizing.then(async () => {
    if (disposed || expanded !== panel.open) return
    const win = getCurrentWindow()
    if (expanded && !savedPosition) {
      const [position, monitor] = await Promise.all([win.outerPosition(), currentMonitor()])
      savedPosition = position
      if (monitor) {
        const { position: origin, size } = monitor.workArea
        const x = Math.max(origin.x, Math.min(position.x, origin.x + size.width - Math.ceil(384 * monitor.scaleFactor)))
        const y = Math.max(origin.y, Math.min(position.y, origin.y + size.height - Math.ceil(222 * monitor.scaleFactor)))
        if (x !== position.x || y !== position.y) await win.setPosition(new PhysicalPosition(x, y))
      }
    }
    await win.setSize(new LogicalSize(384, expanded ? 222 : 104))
    if (!expanded && savedPosition) {
      await win.setPosition(savedPosition)
      savedPosition = undefined
    }
  }).catch(() => {
    if (expanded && panel.open) closePanel()
    notify('无法调整桌面灵动岛窗口，请重试', 'error')
  })
}

// 原生拖动在移动超过阈值时启动，保留整颗胶囊的普通点击。
function startDrag(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) return
  dragged = false
  dragStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
  trigger.value?.setPointerCapture(event.pointerId)
}

// 交给原生窗口移动后忽略本次手势的合成点击。
function moveDrag(event: PointerEvent): void {
  if (!dragStart || dragStart.id !== event.pointerId || !event.buttons) return
  if (Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) < 5) return
  dragStart = undefined
  dragged = true
  void getCurrentWindow().startDragging().catch(() => notify('无法拖动桌面灵动岛', 'error'))
}

// 点击或键盘激活后就地展开，原生窗口只在开关时调整尺寸。
function openPanel(event: MouseEvent): void {
  if (dragged && event.detail !== 0 || panel.open) return
  panel.open = true
  resizeIsland(true)
}

// 主动收起后恢复键盘焦点，窗口失焦时只收起内容。
function closePanel(focus = true): void {
  if (!panel.open) return
  panel.open = false
  if (focus) void nextTick(() => { if (!panel.open) trigger.value?.focus({ preventScroll: true }) })
}
useEventListener('blur', () => closePanel(false))
useEventListener(document, 'visibilitychange', () => { if (document.hidden) closePanel(false) })

// 所有播放操作转发到已有主播放器。
function controlPlayer(action: SourceAction): void {
  void emitTo('main', 'player-action', action).catch(() => notify('无法控制主播放器，请重试', 'error'))
}

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
    :class="{ 'liquid-win': snapshot?.glassStyle === 'liquid' }"
    @contextmenu.prevent="openContextMenu"
  >
    <div
      v-if="snapshot"
      class="island-surface flex h-[40px] w-full items-center rounded-full border border-white/25 px-2 text-[12.5px] font-bold text-white"
      :class="{ playing: snapshot.playing && snapshot.motion }"
      :style="{ opacity: panel.open ? 0 : undefined }"
      :inert="panel.open"
    >
      <button
        ref="trigger"
        type="button"
        class="flex h-full min-w-0 flex-1 cursor-grab touch-none items-center gap-[9px] rounded-full select-none active:cursor-grabbing"
        aria-label="展开灵动岛播放器"
        aria-haspopup="dialog"
        :aria-expanded="panel.open"
        :aria-controls="panel.open ? 'island-player' : undefined"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @lostpointercapture="dragStart = undefined"
        @click="openPanel"
      >
        <!-- 桌面胶囊从主窗口快照读取当前歌曲的封面和歌词。 -->
        <IslandCover :src="snapshot.track.cover" :motion="snapshot.motion" />
        <span
          class="pointer-events-none min-w-0 flex-1 truncate"
          :title="lyric"
          >{{ lyric }}</span
        >
        <span
          class="cap-eq pointer-events-none flex h-3 flex-none items-end gap-[2.5px]"
          aria-hidden="true"
        >
          <i /><i /><i />
        </span>
      </button>
      <button
        type="button"
        class="size-7 shrink-0 rounded-full text-[11px] opacity-70 hover:bg-white/15 hover:opacity-100"
        aria-label="返回播放器"
        @click="focusPlayer"
      >
        ▸
      </button>
    </div>
    <!-- 展开卡片填满原生窗口的可交互区域，四周继续留出透明阴影。 -->
    <Transition name="island-expand" :css="snapshot?.motion && reducedMotion !== 'reduce'" @after-leave="resizeIsland(false)">
      <IslandPlayer v-if="panel.open && snapshot"
        class="island-expanded"
        :track="snapshot.track" :time="snapshot.time" :duration="snapshot.track.dur"
        :playing="snapshot.playing" :loading="!!snapshot.audioLoading"
        :playable="snapshot.playable ?? !!snapshot.track.catalog"
        :motion="snapshot.motion" open-label="返回主播放器"
        @action="controlPlayer" @close="closePanel()" @open="closePanel(false); focusPlayer()"
      />
    </Transition>
    <NotificationHost class="island-notification" />
  </div>
</template>

<style scoped>
:global(html[data-desktop-surface]),
:global(html[data-desktop-surface] body),
:global(html[data-desktop-surface] #app) {
  background: transparent !important;
}
.island-frame {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 32px;
}
.island-expanded {
  position: absolute;
  top: 32px;
  left: 32px;
  width: calc(100% - 64px);
  max-height: none;
  transform-origin: 50% 20px;
}
.island-notification { top: 32px; }
.liquid-win .island-surface {
  border-color: rgb(255 255 255 / 48%);
  background: linear-gradient(160deg, rgb(58 58 74 / 98.5%), rgb(20 20 33 / 98%));
  box-shadow: inset 0 1.5px 1px rgb(255 255 255 / 48%), 0 4px 12px rgb(0 0 0 / 24%);
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
