<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  useTemplateRef,
  watch,
} from 'vue'
import {
  onClickOutside,
  useEventListener,
  usePreferredReducedMotion,
  useResizeObserver,
} from '@vueuse/core'
import TrayIcon from '@/components/tray/TrayIcon.vue'
import TrayMenuItem from '@/components/tray/TrayMenuItem.vue'
import TrayNowPlaying from '@/components/tray/TrayNowPlaying.vue'
import type { SourceSnapshot } from '@/types/prototype'
import {
  nextTrayFocus,
  trayDesktopEntries,
  trayMainEntry,
  trayUtilityEntries,
  type TrayAction,
  type TrayMenuAction,
} from '@/types/tray'

const props = defineProps<{
  snapshot: SourceSnapshot | null
  glassStyle: string
  motion: boolean
  miniEnabled: boolean
  busy: TrayAction | null
  error: string
  cycle: number
  opened: boolean
}>()
const emit = defineEmits<{
  action: [action: TrayMenuAction]
  toggle: []
  dismiss: []
  resize: [height: number]
}>()
const surface = useTemplateRef<HTMLElement>('surface')
const reducedMotion = usePreferredReducedMotion()
const liquid = computed(() => props.glassStyle === 'liquid')
const animate = computed(() => props.motion && reducedMotion.value !== 'reduce')
let disposed = false
let entrance: Animation | undefined

// 测量完整内容而非被小屏幕限制后的视口，高 DPI/换屏后仍能恢复完整菜单。
function reportSize(): void {
  if (disposed || !surface.value) return
  const element = surface.value
  const last = element.lastElementChild as HTMLElement | null
  const style = getComputedStyle(element)
  const naturalHeight = last
    ? last.getBoundingClientRect().bottom -
      element.getBoundingClientRect().top +
      element.scrollTop +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderBottomWidth) +
      parseFloat(getComputedStyle(last).marginBottom)
    : element.scrollHeight + 2
  // scrollHeight 为整数；完整子节点边界向上取整，避免普通/高 DPI 下少留一像素。
  emit('resize', Math.max(Math.ceil(naturalHeight), element.scrollHeight + 2))
}
useResizeObserver(surface, reportSize, { box: 'border-box' })
useEventListener(window, 'resize', reportSize)
onClickOutside(surface, () => emit('dismiss'))

function keydown(event: KeyboardEvent): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab'].includes(event.key))
    return
  const selector =
    event.key === 'Tab'
      ? 'button:not(:disabled)'
      : '[role="menuitem"]:not(:disabled)'
  const buttons = Array.from(
    surface.value?.querySelectorAll<HTMLButtonElement>(selector) ?? []
  )
  if (!buttons.length) return
  event.preventDefault()
  event.stopPropagation()
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const button =
    buttons[nextTrayFocus(event.key, index, buttons.length, event.shiftKey)]
  button?.focus({ preventScroll: true })
  button?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
useEventListener(surface, 'keydown', keydown)
watch(
  () => props.cycle,
  async () => {
    await nextTick()
    if (disposed || !surface.value || !props.opened) return
    surface.value.scrollTop = 0
    surface.value
      .querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus({ preventScroll: true })
    entrance?.cancel()
    if (animate.value)
      entrance = surface.value.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' }
      )
  }
)
watch(animate, enabled => {
  if (!enabled) entrance?.cancel()
})
watch(
  () => props.opened,
  opened => {
    if (!opened) entrance?.cancel()
  }
)
let previousFocus: HTMLButtonElement | null = null
watch(
  () => props.busy,
  async busy => {
    const element = surface.value
    if (busy !== null) {
      const active = document.activeElement
      if (active instanceof HTMLButtonElement && element?.contains(active))
        previousFocus = active
      return
    }
    await nextTick()
    if (
      disposed ||
      !props.opened ||
      !element ||
      element.contains(document.activeElement)
    )
      return
    const button =
      previousFocus && !previousFocus.disabled
        ? previousFocus
        : element.querySelector<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)'
          )
    button?.focus({ preventScroll: true })
  }
)
watch(
  () => props.error,
  () => void nextTick(reportSize)
)
onMounted(async () => {
  await document.fonts.ready
  await nextTick()
  reportSize()
})
onUnmounted(() => {
  disposed = true
  entrance?.cancel()
})
</script>

<template>
  <section
    ref="surface"
    class="tray-menu"
    :data-material="liquid ? 'liquid' : 'frosted'"
    :data-tray-motion="animate ? 'on' : 'off'"
    :style="{ '--tray-glow': snapshot?.track.glow || 'rgba(140,160,255,.35)' }"
    aria-label="MiraiPlayer 托盘快捷菜单"
  >
    <div class="tray-menu-heading">
      <span class="tray-brand-icon"><TrayIcon name="music" /></span>
      <div class="tray-brand-text">
        <b>MiraiPlayer</b>
        <span>音乐与桌面，随手可达</span>
      </div>
      <span class="tray-material">{{ liquid ? 'LIQUID' : 'FROSTED' }}</span>
    </div>
    <TrayNowPlaying
      :snapshot="snapshot"
      :pending="busy !== null"
      :animate="animate && opened"
      @toggle="emit('toggle')"
    />
    <div
      role="menu"
      aria-label="播放器和桌面组件"
      class="tray-menu-entries"
    >
      <TrayMenuItem
        :entry="trayMainEntry"
        :pending="busy !== null"
        :loading="busy === 'main'"
        @select="emit('action', $event)"
      />
      <div class="tray-section-label">桌面组件</div>
      <TrayMenuItem
        v-for="entry in trayDesktopEntries"
        :key="entry.id"
        :entry="entry"
        :disabled="entry.id === 'mini' && !miniEnabled"
        :pending="busy !== null"
        :loading="busy === entry.id"
        @select="emit('action', $event)"
      />
      <div
        role="separator"
        class="tray-menu-divider"
      />
      <TrayMenuItem
        v-for="entry in trayUtilityEntries"
        :key="entry.id"
        :entry="entry"
        :pending="busy !== null"
        :loading="busy === entry.id"
        @select="emit('action', $event)"
      />
    </div>
    <p
      v-if="error"
      class="tray-menu-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="tray-menu-footer">
      <span>左键图标 · 打开主窗口</span>
      <span><kbd>Esc</kbd> 收起</span>
    </div>
  </section>
</template>

<style scoped>
.tray-menu {
  position: relative;
  isolation: isolate;
  width: 288px;
  max-width: 100%;
  max-height: calc(100dvh - 64px);
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: 18px;
  padding: 10px;
  background: linear-gradient(
    135deg,
    rgba(32, 35, 46, 0.985),
    rgba(14, 16, 24, 0.98)
  );
  color: #fff;
  -webkit-backdrop-filter: blur(22px) saturate(1.25);
  backdrop-filter: blur(22px) saturate(1.25);
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / 0.22) transparent;
}
.tray-menu::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(
    220px 120px at 100% 0,
    var(--tray-glow),
    transparent 75%
  );
  content: '';
  opacity: 0.15;
  pointer-events: none;
}
.tray-menu[data-material='liquid'] {
  border-color: rgb(255 255 255 / 0.3);
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.tray-menu[data-material='liquid']::before {
  background:
    linear-gradient(160deg, rgb(255 255 255 / 0.12), transparent 48%),
    radial-gradient(220px 120px at 100% 0, var(--tray-glow), transparent 75%);
  opacity: 0.5;
}
.tray-menu-heading {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 9px;
  padding: 0 3px 7px;
}
.tray-brand-icon {
  display: grid;
  width: 29px;
  height: 29px;
  flex: none;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 9px;
  background: rgb(255 255 255 / 0.09);
}
.tray-brand-icon svg {
  width: 16px;
  height: 16px;
}
.tray-brand-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}
.tray-brand-text b {
  font-size: 12.5px;
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.025em;
}
.tray-brand-text span {
  color: rgb(255 255 255 / 0.62);
  font-size: 9px;
  line-height: 1.4;
}
.tray-material {
  flex: none;
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 5px;
  padding: 3px 5px;
  color: rgb(255 255 255 / 0.68);
  font-family: var(--font-mono);
  font-size: 8px;
  line-height: 1.3;
  letter-spacing: 0.055em;
}
.tray-menu-entries {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tray-section-label {
  padding: 10px 11px 3px;
  color: rgb(255 255 255 / 0.62);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.045em;
}
.tray-menu-divider {
  height: 1px;
  margin: 6px 10px;
  background: rgb(255 255 255 / 0.1);
}
.tray-menu-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 3px 1px;
  border-top: 1px solid rgb(255 255 255 / 0.08);
  padding-top: 9px;
  color: rgb(255 255 255 / 0.62);
  font-size: 9px;
  line-height: 1.5;
}
.tray-menu-footer kbd {
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 4px;
  padding: 1px 4px;
  font-family: var(--font-mono);
  font-size: 8px;
}
.tray-menu-error {
  margin: 8px 3px 0;
  border: 1px solid rgb(248 113 113 / 0.16);
  border-radius: 8px;
  padding: 8px;
  background: rgb(248 113 113 / 0.08);
  color: #ffc4c4;
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
</style>
