<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, shallowRef, useTemplateRef } from 'vue'
import { useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { currentMonitor, cursorPosition, getCurrentWindow, monitorFromPoint, type Monitor } from '@tauri-apps/api/window'
import { LogicalPosition, LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi'
import { Menu } from '@tauri-apps/api/menu'
import IslandCover from '@/components/player/IslandCover.vue'
import IslandPlayer from '@/components/player/IslandPlayer.vue'
import { useIslandKeyboardFocus } from '@/composables/useIslandKeyboardFocus'
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
const surface = useTemplateRef<HTMLElement>('surface')
const reducedMotion = usePreferredReducedMotion()
const keyboardFocus = useIslandKeyboardFocus()
const panel = reactive({
  // 最后一次开合意图，立即决定按钮和键盘焦点。
  open: false,
  // 原生画布就绪后才开始改变可见外壳。
  expanded: false,
  // 原窗口在新画布中的水平、垂直偏移，贴边展开时保持屏幕锚点。
  anchorX: 0,
  anchorY: 0,
})
let savedPosition: PhysicalPosition | undefined
let resizing = Promise.resolve()
type IslandDrag = {
  id: number; x: number; y: number; running: boolean; pending: boolean; released: boolean
}
let dragStart: IslandDrag | undefined
let dragged = false

// 约束的是可见胶囊；32 像素透明阴影可以移出工作区，贴顶时不会留下空隙。
function fitPosition(x: number, y: number, monitor: Monitor, height: number, snap: boolean): PhysicalPosition {
  const { position, size } = monitor.workArea
  const scale = monitor.scaleFactor
  const inset = Math.round(32 * scale)
  const gap = snap ? Math.round(20 * scale) : 0
  // 沿单个轴吸附，靠近角落时两个方向均可贴齐。
  function fit(value: number, origin: number, extent: number, body: number): number {
    const min = origin - inset
    const max = Math.max(min, min + extent - Math.round(body * scale))
    if (value <= min + gap) return min
    if (value >= max - gap) return max
    return Math.round(value)
  }
  return new PhysicalPosition(fit(x, position.x, size.width, 320), fit(y, position.y, size.height, height))
}

// 每端只调整一次原生画布；中间帧由 WebView 内同一外壳和封面连续过渡。
function resizeIsland(expanded: boolean): void {
  resizing = resizing.then(async () => {
    if (disposed || expanded !== panel.open) return
    const win = getCurrentWindow()
    if (expanded) {
      if (!savedPosition) {
        const [position, monitor] = await Promise.all([win.outerPosition(), currentMonitor()])
        if (!panel.open || disposed) return
        savedPosition = position
        await win.setSize(new LogicalSize(384, 222))
        if (monitor) {
          const { x, y } = fitPosition(position.x, position.y, monitor, 158, false)
          if (x !== position.x || y !== position.y) {
            panel.anchorX = (position.x - x) / monitor.scaleFactor
            panel.anchorY = (position.y - y) / monitor.scaleFactor
            await win.setPosition(new PhysicalPosition(x, y))
          }
        }
      }
      if (panel.open && !disposed) panel.expanded = true
    } else if (savedPosition) {
      await win.setPosition(savedPosition)
      panel.anchorX = 0
      panel.anchorY = 0
      await win.setSize(new LogicalSize(384, 104))
      savedPosition = undefined
    }
  }).catch(() => {
    if (expanded && panel.open) closePanel()
    notify('无法调整桌面灵动岛窗口，请重试', 'error')
  })
}

// 保存指针在透明窗口中的逻辑坐标，跨屏时按目标屏幕缩放换算。
function startDrag(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) return
  event.preventDefault()
  trigger.value?.focus({ preventScroll: true })
  dragged = false
  dragStart = { id: event.pointerId, x: event.clientX, y: event.clientY, running: false, pending: false, released: false }
  trigger.value?.setPointerCapture(event.pointerId)
}

// 合并高频移动；松开后使用最后一次位置和当前设置完成吸附。
async function positionDrag(gesture: IslandDrag): Promise<void> {
  gesture.pending = true
  if (gesture.running) return
  gesture.running = true
  try {
    while (gesture.pending && gesture === dragStart && !disposed) {
      gesture.pending = false
      const cursor = await cursorPosition()
      const monitor = await monitorFromPoint(cursor.x, cursor.y) ?? await currentMonitor()
      if (!monitor || gesture !== dragStart || disposed) break
      const next = fitPosition(cursor.x - gesture.x * monitor.scaleFactor,
        cursor.y - gesture.y * monitor.scaleFactor, monitor, 40,
        gesture.released && snapshot.value?.lyricIslandSnap !== false)
      await getCurrentWindow().setPosition(next)
    }
  } catch {
    if (gesture === dragStart) {
      dragStart = undefined
      notify('无法移动桌面灵动岛，请重试', 'error')
    }
  } finally {
    gesture.running = false
    if (gesture.released && gesture === dragStart) dragStart = undefined
  }
}

// 超过阈值才移动原生窗口，并忽略拖动结束后的合成点击。
function moveDrag(event: PointerEvent): void {
  if (!dragStart || dragStart.id !== event.pointerId || !event.buttons) return
  if (!dragged && Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) < 5) return
  dragged = true
  void positionDrag(dragStart)
}

// 普通点击不写窗口位置；系统取消捕获时放弃未提交的拖动。
function endDrag(event: PointerEvent): void {
  if (!dragStart || dragStart.id !== event.pointerId || dragStart.released) return
  if (!dragged || event.type !== 'pointerup') {
    dragStart = undefined
    return
  }
  dragStart.released = true
  void positionDrag(dragStart)
}

// 点击或键盘激活后就地展开，原生窗口只在开关时调整尺寸。
function openPanel(event: MouseEvent): void {
  if (dragged && event.detail !== 0 || panel.open) return
  panel.open = true
  resizeIsland(true)
}

// 主动收起后恢复键盘焦点，窗口失焦时只收起内容。
async function closePanel(focus = true): Promise<void> {
  if (!panel.open) return
  panel.open = false
  panel.expanded = false
  await nextTick()
  if (panel.open || disposed) return
  if (focus) trigger.value?.focus({ preventScroll: true })
  const transitions = surface.value?.getAnimations() || []
  await Promise.allSettled(transitions.map(animation => animation.finished))
  if (!panel.open && !disposed) resizeIsland(false)
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
    <div v-if="snapshot" ref="surface" class="island-surface"
      :class="{ expanded: panel.expanded, animated: snapshot.motion && reducedMotion !== 'reduce', 'keyboard-focus': keyboardFocus }"
      :style="{ '--anchor-x': panel.anchorX + 'px', '--anchor-y': panel.anchorY + 'px' }"
    >
      <!-- 封面自始至终只挂载一次，在两种尺寸间平移、缩放并改变圆角。 -->
      <IslandCover class="island-art" :src="snapshot.track.cover" :motion="snapshot.motion" large />
      <button
        ref="trigger"
        type="button"
        class="island-trigger flex w-full cursor-grab touch-none items-center gap-[9px] rounded-full text-left text-[12.5px] font-bold text-white select-none active:cursor-grabbing"
        :class="{ playing: snapshot.playing && snapshot.motion }"
        :inert="panel.open"
        aria-label="展开灵动岛播放器"
        aria-haspopup="dialog"
        :aria-expanded="panel.open"
        :aria-controls="panel.open ? 'island-player' : undefined"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @lostpointercapture="endDrag"
        @click="openPanel"
      >
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
        <span class="pointer-events-none grid size-6 shrink-0 place-items-center text-[11px] opacity-70" aria-hidden="true">
          ▸
        </span>
      </button>
      <IslandPlayer embedded :active="panel.open"
        :class="{ 'pointer-controls': !keyboardFocus }"
        :track="snapshot.track" :time="snapshot.time" :duration="snapshot.track.dur"
        :playing="snapshot.playing" :loading="!!snapshot.audioLoading"
        :playable="snapshot.playable ?? !!snapshot.track.catalog"
        :motion="snapshot.motion" open-label="返回主播放器"
        @action="controlPlayer" @close="closePanel()" @open="closePanel(false); focusPlayer()"
      />
    </div>
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
.island-notification { top: 32px; }
.liquid-win .island-surface {
  border-color: rgb(255 255 255 / 48%);
  background: linear-gradient(160deg, rgb(58 58 74 / 98.5%), rgb(20 20 33 / 98%));
  box-shadow: inset 0 1.5px 1px rgb(255 255 255 / 48%), 0 4px 12px rgb(0 0 0 / 24%);
}
.island-surface {
  --island-ease: cubic-bezier(.26,.74,.18,1);
  position: relative;
  left: var(--anchor-x);
  top: var(--anchor-y);
  width: 100%;
  height: 40px;
  overflow: clip;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 20px;
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
.island-surface.expanded {
  height: 158px;
  transform: translate(calc(-1 * var(--anchor-x)), calc(-1 * var(--anchor-y)));
  border-radius: 24px;
}
.island-art {
  position: absolute;
  z-index: 1;
  left: 0;
  top: 0;
  transform-origin: top left;
  transform: translate(8px, 6px) scale(.541667);
  border-radius: 50%;
}
.expanded .island-art { transform: translate(16px, 13px) scale(1); border-radius: 12px; }
.island-trigger {
  position: absolute;
  inset: 0 0 auto;
  height: 38px;
  padding: 0 8px 0 43px;
}
.expanded .island-trigger { opacity: 0; transform: translate(5px, 3px); }
.island-surface :deep(.island-player-embedded) { opacity: 0; transform: translateY(-6px); }
.island-surface.expanded :deep(.island-player-embedded) { opacity: 1; transform: none; }
.animated {
  transition: height 250ms var(--island-ease), transform 250ms var(--island-ease), border-radius 250ms var(--island-ease);
}
.animated .island-art {
  transition: transform 250ms var(--island-ease), border-radius 250ms var(--island-ease);
}
.animated .island-trigger { transition: opacity 100ms ease 55ms, transform 180ms var(--island-ease); }
.animated.expanded .island-trigger { transition-delay: 0ms; }
.animated :deep(.island-player-embedded) { transition: opacity 95ms ease, transform 170ms var(--island-ease); }
.animated.expanded :deep(.island-player-embedded) { transition: opacity 160ms ease 55ms, transform 205ms var(--island-ease) 35ms; }
.island-trigger:focus { outline: none; }
.island-surface.keyboard-focus:has(.island-trigger:focus-visible) {
  outline: 2px solid white;
  outline-offset: 2px;
}
</style>
