<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    options: readonly { value: string; label: string; icon?: string }[]
    above?: boolean
    hint?: string
    displayValue?: string
    motion?: boolean
    enabled?: boolean
    variant?: 'compact' | 'field'
    descriptionId?: string
  }>(),
  { motion: true, enabled: true, variant: 'compact' }
)
const emit = defineEmits<{ select: [value: string] }>()
const root = useTemplateRef<HTMLElement>('root')
const menu = useTemplateRef<HTMLElement>('menu')
const menuId = useId()
const host = computed(() => root.value?.closest<HTMLElement>('[data-player]'))
const scrollport = computed(() =>
  root.value?.closest<HTMLElement>('.panel-scroll')
)
const scrollContent = computed(() => {
  const element = scrollport.value?.firstElementChild
  return element instanceof HTMLElement ? element : undefined
})
const field = computed(() => props.variant === 'field')
const canOpen = computed(() => props.enabled && props.options.length > 0)
const selected = computed(() =>
  props.options.find(option => option.value === props.value)
)
const visibleValue = computed(
  () =>
    props.displayValue ||
    selected.value?.label ||
    (field.value ? '未选择' : '自动')
)
// 键盘和鼠标共用展开状态，序号防止旧的打开操作抢走焦点。
const open = ref(false)
let openRequest = 0

// 在所属窗口根层定位，空间不足时翻转并限制在可见设置内容区内。
function alignMenu(): void {
  const anchor = root.value
  const frame = host.value
  const panel = menu.value
  if (!open.value || !anchor || !frame || !panel) return
  const button = anchor.getBoundingClientRect()
  const bounds = frame.getBoundingClientRect()
  const clip = scrollport.value?.getBoundingClientRect() ?? bounds
  const inset = 8
  if (button.bottom <= clip.top || button.top >= clip.bottom) {
    close()
    return
  }

  const originX = bounds.left + frame.clientLeft
  const originY = bounds.top + frame.clientTop
  const maxWidth = Math.max(0, frame.clientWidth - inset * 2)
  panel.style.maxWidth = `${maxWidth}px`
  panel.style.minWidth = `${Math.min(Math.max(140, button.width), maxWidth)}px`
  const width = panel.offsetWidth
  const height = panel.scrollHeight + panel.offsetHeight - panel.clientHeight
  const top = button.top - originY
  const bottom = button.bottom - originY
  const topLimit = Math.max(0, clip.top - originY) + inset
  const bottomLimit =
    Math.min(frame.clientHeight, clip.bottom - originY) - inset
  const roomAbove = Math.max(0, top - topLimit - inset)
  const roomBelow = Math.max(0, bottomLimit - bottom - inset)
  const preferredRoom = props.above ? roomAbove : roomBelow
  const otherRoom = props.above ? roomBelow : roomAbove
  const flip = preferredRoom < height && otherRoom > preferredRoom
  const above = flip ? !props.above : props.above
  const maxHeight = above ? roomAbove : roomBelow
  const left = Math.max(
    inset,
    Math.min(button.right - originX - width, frame.clientWidth - width - inset)
  )

  panel.style.left = `${left}px`
  panel.style.top = `${above ? top - inset - Math.min(height, maxHeight) : bottom + inset}px`
  panel.style.maxHeight = `${maxHeight}px`
  panel.style.setProperty('--choice-offset', above ? '4px' : '-4px')
}
useResizeObserver([root, host, scrollport, scrollContent], alignMenu)
useEventListener(window, 'resize', alignMenu)
useEventListener(scrollport, 'scroll', alignMenu, { passive: true })

// 关闭气泡，主动选择或按 Escape 时将焦点还给入口。
function close(restoreFocus = false): void {
  open.value = false
  if (restoreFocus)
    root.value?.querySelector('button')?.focus({ preventScroll: true })
}

// 将键盘目标滚入弹层可视区，保留设置表单原有的滚动位置。
function focusOption(item?: HTMLButtonElement): void {
  const panel = menu.value
  if (!panel || !item) return
  item.focus({ preventScroll: true })
  const top = item.offsetTop
  const bottom = top + item.offsetHeight
  if (top < panel.scrollTop) panel.scrollTop = top
  else if (bottom > panel.scrollTop + panel.clientHeight)
    panel.scrollTop = bottom - panel.clientHeight
}

// 打开后立即定位并聚焦已选项，Home 和 End 可直接从两端打开。
async function openMenu(edge?: 'first' | 'last'): Promise<void> {
  if (!canOpen.value || !host.value) return
  const request = ++openRequest
  open.value = true
  await nextTick()
  if (!open.value || request !== openRequest) return
  alignMenu()
  if (!open.value) return
  const items = menu.value?.querySelectorAll<HTMLButtonElement>('[data-choice]')
  if (!items?.length) return
  focusOption(
    edge === 'last'
      ? items[items.length - 1]
      : edge === 'first'
        ? items[0]
        : (menu.value?.querySelector<HTMLButtonElement>(
            '[data-selected="true"]'
          ) ?? items[0])
  )
}

// 入口点击切换展开状态。
function toggle(): void {
  if (open.value) close()
  else void openMenu()
}

// 提交选项并保留键盘焦点，排版切换由使用方完成。
function choose(value: string): void {
  if (!open.value) return
  close(true)
  emit('select', value)
}

// 方向键只在选择器内导航，Tab 仍可离开，Escape 不触发背景快捷键。
function keydown(event: KeyboardEvent): void {
  if (event.key === 'Tab' && open.value) {
    // 弹层挂在窗口末尾，从触发器继续浏览原来的 Tab 顺序。
    close(true)
    return
  }
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    close(true)
    return
  }
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  const edge =
    event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : undefined
  if (!open.value) {
    void openMenu(edge)
    return
  }
  const items = Array.from(
    menu.value?.querySelectorAll<HTMLButtonElement>('[data-choice]') ?? []
  )
  if (!items.length) return
  const index = items.findIndex(item => item === document.activeElement)
  const step = event.key === 'ArrowUp' ? -1 : 1
  const target =
    edge === 'first'
      ? 0
      : edge === 'last'
        ? items.length - 1
        : (index + step + items.length) % items.length
  focusOption(items[target])
}

// 外部交互和窗口离开时收起菜单，背景上的原有操作仍可使用。
// Teleport 后按钮和弹层仍属同一焦点区域。
function closeOutside(event: Event): void {
  const target = event.target as Node
  if (
    open.value &&
    !root.value?.contains(target) &&
    !menu.value?.contains(target)
  )
    close()
}
useEventListener(document, 'pointerdown', closeOutside)
useEventListener(document, 'focusin', closeOutside)
useEventListener(window, 'blur', () => close())
// 入口失效或选项清空时结束当前选择，避免提交已禁用的菜单。
watch(canOpen, enabled => {
  if (!enabled) close()
})
</script>

<template>
  <div
    ref="root"
    class="relative max-w-full flex-none"
    :class="{ 'choice-calm': !motion }"
    @keydown="keydown"
  >
    <BaseButton
      class="choice-trigger flex max-w-full items-center gap-1.5 rounded-[9px] border border-white/14 font-semibold enabled:cursor-pointer disabled:opacity-55"
      :class="
        field
          ? 'min-h-9 min-w-24 justify-between px-2.5 text-xs text-white'
          : 'h-[30px] px-2 text-[11px] text-white/80'
      "
      :aria-label="`${label}，${visibleValue}`"
      :aria-describedby="descriptionId"
      :title="hint || label"
      :aria-haspopup="field ? 'listbox' : 'menu'"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :disabled="!canOpen"
      @click.stop="toggle"
    >
      <svg
        v-if="selected?.icon"
        viewBox="0 0 24 24"
        class="size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="selected.icon" />
      </svg>
      <span class="min-w-0 truncate">{{ visibleValue }}</span>
      <svg
        v-if="field || canOpen"
        viewBox="0 0 16 16"
        class="choice-indicator size-3 shrink-0 opacity-65"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </BaseButton>
    <Teleport
      v-if="host"
      :to="host"
    >
      <Transition name="choice">
        <div
          v-show="open"
          :id="menuId"
          ref="menu"
          :role="field ? 'listbox' : 'menu'"
          :aria-label="label"
          :inert="!open"
          class="choice-panel panel-scroll absolute z-20 flex w-max flex-col gap-0.5 overflow-y-auto rounded-xl border p-1.5 text-white"
          :class="{ 'choice-calm': !motion }"
          @keydown="keydown"
        >
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            :role="field ? 'option' : 'menuitemradio'"
            tabindex="-1"
            :aria-checked="field ? undefined : value === option.value"
            :aria-selected="field ? value === option.value : undefined"
            :data-selected="value === option.value"
            :data-choice="option.value"
            class="choice-option flex min-h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-semibold text-white/85"
            @click="choose(option.value)"
          >
            <svg
              v-if="option.icon"
              viewBox="0 0 24 24"
              class="size-4 shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="option.icon" />
            </svg>
            <span class="min-w-0 wrap-anywhere">{{ option.label }}</span>
            <svg
              viewBox="0 0 16 16"
              class="ml-auto size-3 shrink-0"
              :class="{ invisible: value !== option.value }"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m3 8 3 3 7-7" />
            </svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.choice-trigger {
  background-color: rgb(255 255 255 / 5%);
}
.choice-panel {
  border-color: rgb(255 255 255 / 24%);
  background: rgb(22 22 31 / 74%);
  backdrop-filter: blur(16px);
  box-shadow: 0 14px 28px rgb(0 0 0 / 38%);
}
.liquid-win .choice-panel {
  background:
    linear-gradient(165deg, rgb(255 255 255 / 22%), rgb(255 255 255 / 7%) 55%),
    rgb(14 20 24 / 76%);
  border-color: rgb(255 255 255 / 48%);
  backdrop-filter: blur(14px) saturate(1.25);
  box-shadow:
    inset 0 1.5px 1px rgb(255 255 255 / 70%),
    0 16px 30px rgb(0 0 0 / 34%);
}
.glass-win .choice-trigger {
  background-color: rgb(255 255 255 / 9%);
  border-color: rgb(255 255 255 / 20%);
}
.liquid-win .choice-trigger,
.liquid-win .choice-option[data-selected='true'] {
  background-image: linear-gradient(
    160deg,
    rgb(255 255 255 / 20%),
    rgb(255 255 255 / 7%)
  );
  border-color: rgb(255 255 255 / 40%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 50%);
}
.choice-trigger:enabled:is(:hover, [aria-expanded='true']) {
  background-color: rgb(255 255 255 / 13%);
}
.choice-trigger:enabled:active {
  background-color: rgb(255 255 255 / 18%);
}
.choice-trigger[aria-expanded='true'] .choice-indicator {
  transform: rotate(180deg);
}
.choice-option[data-selected='true'] {
  background-color: rgb(255 255 255 / 10%);
  color: white;
}
.choice-option:is(:hover, :focus-visible) {
  background-color: rgb(255 255 255 / 15%);
  color: white;
}
.choice-trigger:focus-visible {
  outline: 2px solid rgb(255 255 255 / 75%);
  outline-offset: 2px;
}
.choice-option:focus-visible {
  outline: 1px solid rgb(255 255 255 / 75%);
  outline-offset: -1px;
}
.choice-trigger,
.choice-option {
  transition: background-color 140ms ease;
}
.choice-indicator {
  transition: transform 140ms ease;
}
.choice-leave-active {
  pointer-events: none;
}
.choice-enter-active,
.choice-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.choice-enter-from,
.choice-leave-to {
  opacity: 0;
  transform: translateY(var(--choice-offset, -4px));
}
.choice-calm:is(.choice-enter-active, .choice-leave-active) {
  transition: none;
}
.choice-calm :is(.choice-option, .choice-trigger, .choice-indicator) {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .choice-enter-active,
  .choice-leave-active,
  .choice-trigger,
  .choice-option,
  .choice-indicator {
    transition: none;
  }
}
</style>
