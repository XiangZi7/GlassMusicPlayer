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
const { settings, radioOn } = toRefs(player.state)
const root = useTemplateRef<HTMLElement>('root')
const panel = useTemplateRef<HTMLElement>('panel')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const queueList = useTemplateRef<InstanceType<typeof QueueList>>('queueList')
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

// 将焦点交给已展开的非模态面板，并让当前曲目进入可见范围。
async function toggle(): Promise<void> {
  state.open = !state.open
  if (!state.open) return
  await nextTick()
  if (!state.open) return
  panel.value?.focus({ preventScroll: true })
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
  queueList.value?.browse(event)
}

// 按钮和面板位于不同的 DOM 容器，两个区域之间移动焦点时保持打开。
function containsTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Node &&
    !!(root.value?.contains(target) || panel.value?.contains(target))
  )
}

// 点击外部、焦点移出或窗口失焦时收起队列。
useEventListener(document, 'pointerdown', event => {
  if (state.open && !containsTarget(event.target)) close()
})
useEventListener(document, 'focusin', event => {
  if (state.open && !containsTarget(event.target)) close()
})
// 拖放或虚拟行回收可能让浏览器暂时把焦点交给 body，Escape 仍然归当前气泡处理。
useEventListener(document, 'keydown', event => {
  if (state.open && event.key === 'Escape') void keydown(event)
}, { capture: true })
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
    <Teleport
      defer
      to="[data-player]"
    >
      <Transition
        name="queue-bubble"
        :css="settings.motion"
      >
        <section
          v-if="open"
          :id="menuId"
          ref="panel"
          role="dialog"
          aria-label="播放队列"
          tabindex="-1"
          class="main-queue absolute right-[14px] bottom-[88px] z-[12] flex max-h-[calc(100%-176px)] w-[352px] max-w-[calc(100%-28px)] flex-col rounded-[18px] p-[12px] text-left text-white outline-none"
          :class="{ 'queue-calm': !settings.motion }"
          @keydown="keydown"
        >
          <!-- 气泡标题区：当前队列计数与关闭操作。 -->
          <header class="m-[2px_4px_10px] flex shrink-0 items-center gap-[8px]">
            <h3 class="m-0 text-[12px] font-extrabold tracking-[.1em]">
              播放队列 · QUEUE
            </h3>
            <!-- 波普星星贴纸：只做面板识别点缀，倾斜与投影走共享 .pop-sticker。 -->
            <span class="queue-sticker pop-sticker" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path class="sticker-halo" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
                <path class="sticker-star" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
              </svg>
            </span>
            <span
              v-if="radioOn"
              class="q-radio-chip rounded-full px-2 py-[3px] text-[9.5px] font-extrabold"
              >电台续播中</span
            >
            <span
              class="ml-auto font-mono text-[10.5px] font-bold tracking-[.02em] whitespace-nowrap text-white/55"
              >{{ count }} 首</span
            >
            <BaseButton
              class="mq-close grid size-[30px] shrink-0 place-items-center rounded-full border border-white/22 bg-white/10 p-0 text-white transition-colors hover:bg-white/18"
              aria-label="关闭播放队列"
              @click="close(true)"
            >
              <svg
                class="size-[14px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </BaseButton>
          </header>
          <!-- 气泡列表区：复用真实队列与下一首播放操作，空态不展示演示曲目。 -->
          <QueueList
            ref="queueList"
            v-if="count"
            compact
          />
          <EmptyState
            v-else
            class="min-h-[140px]"
            icon="playlist"
            label="播放队列为空"
          />
        </section>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* 队列贴纸：与首页榜单贴纸同一星形配方（白晕 + 黄星粗黑描边），尺寸收小到标题旁。 */
.queue-sticker {
  width: 17px;
  height: 17px;
  flex: none;
}
.queue-sticker svg {
  display: block;
  width: 100%;
  height: 100%;
}
.queue-sticker .sticker-halo {
  fill: #fff;
}
.queue-sticker .sticker-star {
  fill: var(--pop-yellow);
  stroke: var(--pop-ink);
  stroke-width: 1.4;
  transform: scale(0.76);
  transform-origin: center;
}
.main-queue {
  border: 1px solid rgb(255 255 255 / 18%);
  background: rgb(18 18 26 / 94%);
  backdrop-filter: blur(20px);
  box-shadow: 0 24px 48px rgb(0 0 0 / 45%);
}
.liquid-win .main-queue {
  border-color: rgb(255 255 255 / 38%);
  background: linear-gradient(165deg, rgb(30 42 46 / 93%), rgb(14 20 22 / 95%));
  backdrop-filter: blur(12px) saturate(1.7);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 45%),
    0 24px 48px rgb(0 0 0 / 45%);
}
.liquid-win .mq-close {
  border-color: rgb(255 255 255 / 45%);
  background: linear-gradient(
    160deg,
    rgb(255 255 255 / 30%),
    rgb(255 255 255 / 8%)
  );
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 60%);
}
.main-queue :deep(.qt span) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.main-queue :deep(:focus-visible) {
  outline: 2px solid rgb(255 255 255 / 0.75);
  outline-offset: -2px;
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
  transform: translateY(10px);
}
.queue-calm.queue-bubble-enter-active,
.queue-calm.queue-bubble-leave-active {
  transition: none;
}
@media (max-width: 640px) {
  .main-queue {
    inset: 54px 12px auto;
    width: auto;
    max-width: none;
    max-height: calc(100% - 230px);
  }
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
