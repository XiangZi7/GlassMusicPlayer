<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  reactive,
  toRefs,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { useEventListener } from '@vueuse/core'
import QueueList from '@/components/player/QueueList.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'

const player = usePlayer()
const { settings } = toRefs(player.state)
const root = useTemplateRef<HTMLElement>('root')
const panel = useTemplateRef<HTMLElement>('panel')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const menuId = useId()
const count = computed(() => player.state.queue?.length || 0)
// 响应式状态
const state = reactive({
  // 底栏气泡独立展开，不复用全屏页队列状态。
  open: false,
})
const { open } = toRefs(state)

// 关闭就地队列；Escape 或关闭按钮将焦点还给入口，外部点击不抢焦点。
function close(restoreFocus = false): void {
  state.open = false
  if (restoreFocus) trigger.value?.focus()
}

// 点击入口切换气泡，打开后滚到当前曲目但不跳页、不改变播放。
async function toggle(): Promise<void> {
  state.open = !state.open
  if (!state.open) return
  await nextTick()
  panel.value
    ?.querySelector<HTMLElement>('.qrow.on')
    ?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
}

// 队列内方向键浏览曲目，阻断背景音量快捷键；不强制困住非模态 Tab 焦点。
async function keydown(event: KeyboardEvent): Promise<void> {
  if (event.key === 'Escape' && state.open) {
    event.preventDefault()
    event.stopPropagation()
    close(true)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  if (!state.open) {
    state.open = true
    await nextTick()
  }
  const rows = Array.from(
    panel.value?.querySelectorAll<HTMLElement>('.qrow') || []
  )
  if (!rows.length) return
  const current = rows.indexOf(
    document.activeElement?.closest('.qrow') as HTMLElement
  )
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? rows.length - 1
        : event.key === 'ArrowUp'
          ? current <= 0
            ? rows.length - 1
            : current - 1
          : (current + 1) % rows.length
  rows[index]?.focus({ preventScroll: true })
  rows[index]?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
}

// 点击外部、焦点移出或窗口失焦时收起；不影响其它窗口和全屏状态。
useEventListener(document, 'pointerdown', event => {
  if (!root.value?.contains(event.target as Node)) close()
})
useEventListener(root, 'focusout', event => {
  if (!root.value?.contains(event.relatedTarget as Node)) close()
})
useEventListener(window, 'blur', () => close())
// 打开全屏后隐藏底栏气泡，两个队列入口不会抢同一个开关。
watch(
  () => player.state.stage,
  visible => {
    if (visible) close()
  }
)
onBeforeUnmount(() => close())
</script>

<template>
  <!-- 底栏队列入口：气泡就地展开，完整队列仍沿用播放器唯一状态。 -->
  <div
    ref="root"
    class="player-queue-control relative flex-none"
    :class="{ 'queue-calm': !settings.motion }"
    @keydown="keydown"
  >
    <button
      ref="trigger"
      type="button"
      class="ctl small grid size-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
      :class="{ on: open }"
      data-bottom-queue-toggle
      aria-label="播放队列"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="menuId"
      title="播放队列"
      @click.stop="toggle"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M4 7h13M4 12h13M4 17h9" />
        <circle
          cx="20"
          cy="17"
          r="2.2"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    </button>
    <Transition name="queue-bubble">
      <section
        v-if="open"
        :id="menuId"
        ref="panel"
        role="dialog"
        aria-label="播放队列"
        class="queue-bubble absolute right-[-10px] bottom-[calc(100%+16px)] z-[80] flex w-[340px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[18px] border border-white/15 bg-[#1b1c26]/95 text-white shadow-[0_20px_64px_rgba(0,0,0,.48)]"
      >
        <!-- 气泡标题区：当前队列计数与关闭操作。 -->
        <header
          class="flex shrink-0 items-center justify-between border-b border-white/10 px-[14px] py-[10px]"
        >
          <div>
            <h3 class="m-0 text-[13px] font-bold">播放队列</h3>
            <p class="mt-[3px] mb-0 text-[11px] text-white/55">
              {{ count }} 首 · 点击播放，拖动排序
            </p>
          </div>
          <BaseButton
            class="grid size-[30px] place-items-center rounded-[9px] bg-transparent text-white/65 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="关闭播放队列气泡"
            @click="close(true)"
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </BaseButton>
        </header>
        <!-- 气泡列表区：复用真实队列与下一首播放操作，空态不展示演示曲目。 -->
        <div
          class="queue-bubble-list max-h-[min(420px,calc(100dvh-180px))] min-h-0 overflow-y-auto p-[8px]"
        >
          <QueueList v-if="count" />
          <EmptyState
            v-else
            class="min-h-[140px]"
            icon="playlist"
            label="播放队列为空"
          />
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.queue-bubble {
  backdrop-filter: blur(20px);
  transform-origin: bottom right;
}
.queue-bubble-list {
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / 0.16) transparent;
}
.queue-bubble-list :deep(.qrow) {
  margin-bottom: 5px;
  border-radius: 10px;
  padding: 8px;
  min-height: 48px;
}
.queue-bubble-list :deep(.qrow img) {
  width: 30px;
  height: 30px;
  border-radius: 7px;
}
.queue-bubble-list :deep(.qt) {
  min-width: 0;
}
.queue-bubble-list :deep(.qt b) {
  font-size: 12px;
  line-height: 1.5;
}
.queue-bubble-list :deep(.qt span),
.queue-bubble-list :deep(.qd) {
  font-size: 10.5px;
}
.player-queue-control :deep(:focus-visible) {
  outline: 2px solid rgb(255 255 255 / 0.75);
  outline-offset: 2px;
}
.queue-bubble-enter-active,
.queue-bubble-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.queue-bubble-enter-from,
.queue-bubble-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
.queue-calm .queue-bubble-enter-active,
.queue-calm .queue-bubble-leave-active {
  transition: none;
}
.queue-calm .queue-bubble-enter-from,
.queue-calm .queue-bubble-leave-to {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .queue-bubble-enter-active,
  .queue-bubble-leave-active {
    transition: none;
  }
  .queue-bubble-enter-from,
  .queue-bubble-leave-to {
    transform: none;
  }
}
</style>
