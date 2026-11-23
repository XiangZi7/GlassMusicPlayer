<script setup lang="ts">
import { computed, nextTick, reactive, useId, useTemplateRef, watch } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    options: readonly { value: string; label: string; icon?: string }[]
    above?: boolean
    hint?: string
    motion?: boolean
    enabled?: boolean
  }>(),
  { motion: true, enabled: true }
)
const emit = defineEmits<{ select: [value: string] }>()
const root = useTemplateRef<HTMLElement>('root')
const menu = useTemplateRef<HTMLElement>('menu')
const menuId = useId()
const selected = computed(() =>
  props.options.find(option => option.value === props.value)
)
const state = reactive({
  // 键盘和鼠标共用菜单的展开状态。
  open: false,
  // 弹层以播放器内缘为基准，对齐入口右边和上下边缘。
  position: {} as Record<string, string>,
})

// 将气泡放在独立玻璃层，使背景取样覆盖底栏以外的真实页面。
function alignMenu(): void {
  const anchor = root.value
  const host = anchor?.closest<HTMLElement>('[data-player]')
  if (!state.open || !anchor || !host) return
  const button = anchor.getBoundingClientRect()
  const frame = host.getBoundingClientRect()
  state.position = {
    right: Math.max(8, Math.min(host.clientWidth - 148, frame.right - host.clientLeft - button.right)) + 'px',
    ...(props.above
      ? { bottom: frame.bottom - host.clientTop - button.top + 8 + 'px' }
      : { top: button.bottom - frame.top - host.clientTop + 8 + 'px' }),
  }
}
useResizeObserver(root, alignMenu)
useEventListener(window, 'resize', alignMenu)

// 关闭气泡，主动选择或按 Escape 时将焦点还给入口。
function close(restoreFocus = false): void {
  state.open = false
  if (restoreFocus)
    root.value?.querySelector<HTMLButtonElement>('.choice-trigger')?.focus()
}

// 等菜单渲染后聚焦已选项，Home 和 End 可直接从两端打开。
async function open(edge?: 'first' | 'last'): Promise<void> {
  if (!props.enabled) return
  state.open = true
  alignMenu()
  await nextTick()
  if (!state.open) return
  const items = menu.value?.querySelectorAll<HTMLButtonElement>(
    '[role="menuitemradio"]'
  )
  if (!items?.length) return
  const item =
    edge === 'last'
      ? items[items.length - 1]
      : edge === 'first'
        ? items[0]
        : (menu.value?.querySelector<HTMLButtonElement>(
            '[aria-checked="true"]'
          ) ?? items[0])
  item?.focus({ preventScroll: true })
}

// 入口点击切换展开状态。
function toggle(): void {
  if (state.open) close()
  else void open()
}

// 提交选项并保留键盘焦点，排版切换由使用方完成。
function choose(value: string): void {
  close(true)
  emit('select', value)
}

// 方向键只在选择器内导航，Tab 仍可离开，Escape 不触发背景快捷键。
function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && state.open) {
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
  if (!state.open) {
    void open(edge)
    return
  }
  const items = Array.from(
    menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ??
      []
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
  items[target]?.focus({ preventScroll: true })
}

// 外部交互和窗口离开时收起菜单，背景上的原有操作仍可使用。
// Teleport 后按钮和弹层仍属同一焦点区域。
function closeOutside(event: Event): void {
  const target = event.target as Node
  if (state.open && !root.value?.contains(target) && !menu.value?.contains(target)) close()
}
useEventListener(document, 'pointerdown', closeOutside)
useEventListener(document, 'focusin', closeOutside)
useEventListener(window, 'blur', () => close())
watch(
  () => props.enabled,
  enabled => {
    if (!enabled) close()
  }
)
</script>

<template>
  <div
    ref="root"
    class="relative flex-none"
    :class="{ 'choice-calm': !motion }"
    @keydown="keydown"
  >
    <BaseButton
      class="choice-trigger flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[9px] border border-white/14 bg-white/5 px-2 text-[11px] font-semibold text-white/80 hover:bg-white/12"
      :aria-label="label"
      :title="hint || label"
      aria-haspopup="menu"
      :aria-expanded="state.open"
      :aria-controls="state.open ? menuId : undefined"
      :disabled="!enabled"
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
      <span>{{ label }} · {{ selected?.label ?? '自动' }}</span>
      <svg
        viewBox="0 0 16 16"
        class="size-3 shrink-0 opacity-65"
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
    <Teleport defer to="[data-player]">
    <Transition name="choice">
      <div
        v-if="state.open"
        :id="menuId"
        ref="menu"
        role="menu"
        :aria-label="label"
        class="choice-panel absolute z-20 grid w-[140px] gap-0.5 rounded-xl border p-1.5 text-white"
        :class="{ 'choice-calm': !motion }"
        :style="state.position"
        @keydown="keydown"
      >
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          role="menuitemradio"
          tabindex="-1"
          :aria-checked="value === option.value"
          :data-choice="option.value"
          class="choice-option flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[12px] font-semibold text-white/75"
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
          {{ option.label }}
          <svg
            v-if="value === option.value"
            viewBox="0 0 16 16"
            class="ml-auto size-3 shrink-0"
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
.choice-panel {
  border-color: rgb(255 255 255 / 24%);
  background: rgb(22 22 31 / 74%);
  backdrop-filter: blur(16px);
  box-shadow: 0 14px 28px rgb(0 0 0 / 38%);
}
.liquid-win .choice-panel {
  background:
    linear-gradient(165deg, rgb(255 255 255 / 30%), rgb(255 255 255 / 9%) 55%),
    rgb(14 20 24 / 48%);
  border-color: rgb(255 255 255 / 48%);
  backdrop-filter: blur(14px) saturate(1.25);
  box-shadow:
    inset 0 1.5px 1px rgb(255 255 255 / 70%),
    0 16px 30px rgb(0 0 0 / 34%);
}
.glass-win .choice-trigger {
  background: rgb(255 255 255 / 9%);
  border-color: rgb(255 255 255 / 20%);
}
.liquid-win .choice-trigger, .liquid-win .choice-option[aria-checked='true'] {
  background: linear-gradient(160deg, rgb(255 255 255 / 26%), rgb(255 255 255 / 7%));
  border-color: rgb(255 255 255 / 40%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 50%);
}
.choice-option:is(:hover, :focus-visible, [aria-checked='true']) {
  background: rgb(255 255 255 / 10%);
  color: white;
}
.choice-trigger:focus-visible,
.choice-option:focus-visible {
  outline: 2px solid rgb(255 255 255 / 75%);
  outline-offset: 2px;
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
  transform: translateY(-4px);
}
.choice-calm:is(.choice-enter-active, .choice-leave-active) {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .choice-enter-active,
  .choice-leave-active {
    transition: none;
  }
}
</style>
