<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, useId, useTemplateRef, watch } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'
import { notify } from '@/services/notification'
import { useAppUpdaterStore } from '@/stores/app-updater'

defineProps<{ motion: boolean }>()
const updater = useAppUpdaterStore()
const { state: update } = updater
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const prompt = useTemplateRef<HTMLElement>('prompt')
const host = computed(() => trigger.value?.closest<HTMLElement>('[data-player]'))
const promptId = useId()
const state = reactive({
  // 确认气泡只在安装包已就绪时展开。
  open: false,
  // 气泡相对于本窗口玻璃根层的左侧和上侧位置。
  left: 0,
  top: 0,
  // 气泡箭头指向标题栏图标的中心。
  arrow: 0,
})
let requestedHere = false
// 区分本窗口关闭的回执与设置窗口的新操作，避免旧回执盖掉刚刚重开的气泡。
let pendingClose: 'dismiss' | 'defer' | undefined
const visible = computed(() => Boolean(update.version)
  && ['available', 'downloading', 'ready', 'installing', 'error'].includes(update.phase))
const busy = computed(() => ['downloading', 'installing'].includes(update.phase))
const progress = computed(() => update.total > 0
  ? Math.min(99, Math.round(update.downloaded / update.total * 100))
  : undefined)
const label = computed(() => {
  switch (update.phase) {
    case 'downloading': return progress.value === undefined ? '正在下载更新' : `正在下载更新 · ${progress.value}%`
    case 'ready': return `更新下载完成 · v${update.version}`
    case 'installing': return '正在安装更新'
    case 'error': return update.errorStage === 'install' ? '安装失败，点击重试安装' : '更新失败，点击重试'
    default: return `${update.reason === 'manual' ? '查看新版本' : '下载更新'} · v${update.version}`
  }
})

// 首次挂载即订阅更新状态，由主窗口统一安排自动检查。
onMounted(() => void updater.start())

// 在播放器根层把气泡右边缘对齐图标，窄窗时限制在两侧留白内。
function align(): void {
  if (!state.open || !trigger.value || !host.value || !prompt.value) return
  const frame = host.value.getBoundingClientRect()
  const button = trigger.value.getBoundingClientRect()
  const width = prompt.value.offsetWidth
  const right = button.right - frame.left - host.value.clientLeft
  state.left = Math.max(8, Math.min(right - width, host.value.clientWidth - width - 8))
  state.top = button.bottom - frame.top - host.value.clientTop + 8
  state.arrow = right - button.width / 2 - state.left
}
watch([() => state.open, prompt, host], align, { flush: 'post' })
useResizeObserver([host, trigger, prompt], align)
useEventListener(window, 'resize', align)

// 关闭气泡时保留已下载的更新，仅在键盘操作结束时还原焦点。
function closePrompt(action: 'dismiss' | 'defer', returnFocus = false): void {
  state.open = false
  if (!update.dismissed || (action === 'defer' && !update.deferred)) pendingClose = action
  void updater.command(action)
  if (returnFocus) trigger.value?.focus({ preventScroll: true })
}

// 用户主动展开气泡后，直接将键盘焦点交给「稍后」。
async function focusPrompt(): Promise<void> {
  await nextTick()
  if (state.open) prompt.value?.querySelector('button')?.focus({ preventScroll: true })
}

// 可用更新开始下载，已就绪更新展开安装选择，手动更新打开此产品的发行页。
function activate(): void {
  if (busy.value) return
  if (update.phase === 'ready') {
    if (state.open) closePrompt('dismiss', true)
    else {
      state.open = true
      void focusPrompt()
    }
  } else if (update.phase === 'available' && update.reason === 'manual') {
    void updater.openRelease()
  } else {
    requestedHere = true
    void updater.command(update.phase === 'error' && update.errorStage === 'install' ? 'install' : 'download')
  }
}

// 只有明确点击「立即更新」才请求安装。
function install(): void {
  requestedHere = true
  state.open = false
  trigger.value?.focus({ preventScroll: true })
  void updater.command('install')
}

// 等待后台校验后自动展开气泡，不干扰当前输入焦点；其他窗口的推迟操作同步收起。
watch([() => update.phase, () => update.dismissed, () => update.deferred], ([phase, dismissed, deferred], previous) => {
  const wasOpen = state.open
  if (phase !== 'ready' || previous[0] !== 'ready') {
    state.open = phase === 'ready' && !dismissed && !deferred
    pendingClose = undefined
  } else if ((dismissed && !previous[1]) || (deferred && !previous[2])) {
    const acknowledged = pendingClose === 'defer' ? deferred : pendingClose === 'dismiss' && !deferred
    if (!acknowledged) state.open = false
    pendingClose = undefined
  }
  if (wasOpen && !state.open && prompt.value?.contains(document.activeElement)) trigger.value?.focus({ preventScroll: true })
  if (phase === 'error' && requestedHere) notify(update.error || '更新失败，请重试', 'error')
  if (phase === 'ready' || phase === 'error') requestedHere = false
}, { immediate: true })

// 外部点击直接关闭，继续保留外部目标的正常焦点。
useEventListener(document, 'pointerdown', event => {
  const target = event.target as Node
  if (state.open && !trigger.value?.contains(target) && !prompt.value?.contains(target)) closePrompt('dismiss')
})

// 气泡先于播放器响应 Escape；原生对话框打开时由其自己处理关闭。
useEventListener(window, 'keydown', event => {
  if (event.key !== 'Escape' || !state.open || event.defaultPrevented || document.querySelector('dialog[open]')) return
  event.preventDefault()
  event.stopPropagation()
  closePrompt('defer', Boolean(prompt.value?.contains(document.activeElement)))
}, { capture: true })

// 气泡在根层，主动把标题栏内的 Tab 顺序接到气泡，再返回相邻设置按钮。
function handleTab(event: KeyboardEvent): void {
  if (!state.open) return
  const controls = prompt.value?.querySelectorAll('button')
  if (!controls?.length) return
  if (!event.shiftKey && event.target === trigger.value) {
    event.preventDefault()
    controls[0].focus()
  } else if (event.shiftKey && event.target === controls[0]) {
    event.preventDefault()
    trigger.value?.focus()
  } else if (!event.shiftKey && event.target === controls[controls.length - 1]) {
    closePrompt('dismiss', true)
  }
}
</script>

<template>
  <Transition name="update-fade" :css="motion">
    <button
      v-if="visible"
      ref="trigger"
      type="button"
      class="update-trigger grid size-9 shrink-0 place-items-center rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/75"
      :class="{ 'update-ready': update.phase === 'ready', 'update-calm': !motion }"
      :title="label"
      :aria-label="label"
      :aria-expanded="update.phase === 'ready' ? state.open : undefined"
      :aria-controls="state.open ? promptId : undefined"
      :aria-haspopup="update.phase === 'ready' ? 'dialog' : undefined"
      :aria-disabled="busy || undefined"
      :aria-busy="busy || undefined"
      data-update-trigger
      @click.stop="activate"
      @keydown.tab="handleTab"
    >
      <svg
        viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"
        :role="update.phase === 'downloading' ? 'progressbar' : undefined"
        :aria-label="update.phase === 'downloading' ? '更新下载进度' : undefined"
        :aria-hidden="update.phase !== 'downloading' || undefined"
        :aria-valuenow="update.phase === 'downloading' ? progress : undefined"
        :aria-valuemax="update.phase === 'downloading' ? 100 : undefined"
        :aria-valuemin="update.phase === 'downloading' ? 0 : undefined"
      >
        <template v-if="busy">
          <circle cx="12" cy="12" r="9" opacity=".23" />
          <g transform="rotate(-90 12 12)">
            <circle
              cx="12" cy="12" r="9" pathLength="100"
              :stroke-dasharray="update.phase === 'downloading' && progress !== undefined ? '100' : '28 72'"
              :stroke-dashoffset="update.phase === 'downloading' && progress !== undefined ? 100 - progress : 0"
              :class="{ 'update-spin': update.phase === 'installing' || progress === undefined }"
            />
          </g>
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="9" />
          <path v-if="update.phase === 'ready'" d="m8 12 2.7 2.7 5.3-5.4" />
          <path v-else-if="update.phase === 'error'" d="M12 7.5v5m0 3.8h.01" />
          <path v-else d="m8.5 11 3.5-3.5 3.5 3.5M12 8v8.5" />
        </template>
      </svg>
    </button>
  </Transition>
  <Teleport v-if="host" :to="host">
    <Transition name="update-fade" :css="motion">
      <section
        v-if="state.open" :id="promptId" ref="prompt"
        class="update-prompt absolute z-[90] flex flex-col rounded-2xl border text-white"
        :class="{ 'update-calm': !motion }"
        :style="{ left: state.left + 'px', top: state.top + 'px', '--arrow': state.arrow + 'px' }"
        role="dialog" aria-label="应用更新" data-update-prompt
        @keydown.tab="handleTab" @keydown.space.stop @keydown.enter.stop
      >
        <div class="panel-scroll overflow-y-auto px-4 py-3">
          <div class="flex items-center gap-2">
            <svg class="size-4 shrink-0 text-[#a9e4c1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="m8 12 2.7 2.7 5.3-5.4" />
            </svg>
            <strong class="shrink-0 text-[13px] leading-5">更新下载完成</strong>
            <span class="ml-auto truncate font-mono text-[11px] text-white/70" :title="'v' + update.version">v{{ update.version }}</span>
          </div>
          <p class="mt-1.5 text-xs leading-5 text-white/80">更新包已下载，是否立即更新？</p>
        </div>
        <div class="panel-actions flex items-center justify-end gap-2">
          <BaseButton class="update-action" @click="closePrompt('defer', true)">稍后</BaseButton>
          <BaseButton class="update-action update-primary" @click="install">立即更新</BaseButton>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-trigger { color: #d1c4ff; background: transparent; cursor: pointer; transition: background-color 150ms, color 150ms; }
.update-trigger:hover, .update-trigger[aria-expanded="true"] { background: #ffffff18; }
.liquid-win .update-trigger:hover, .liquid-win .update-trigger[aria-expanded="true"] {
  background: linear-gradient(160deg, #ffffff32, #ffffff0f);
  box-shadow: inset 0 1px 0 #ffffff55;
}
.update-trigger.update-ready { color: #a9e4c1; }
.update-trigger[aria-busy="true"] { cursor: progress; }
.update-prompt {
  width: min(272px, calc(100% - 16px));
  max-height: calc(100% - 64px);
  --surface: rgb(26 26 36 / 94%);
  --edge: rgb(255 255 255 / 20%);
  border-color: var(--edge);
  background: var(--surface);
  backdrop-filter: blur(20px);
  box-shadow: 0 12px 32px rgb(0 0 0 / 38%);
}
.liquid-win .update-prompt {
  --surface: rgb(48 55 64 / 92%);
  --edge: rgb(255 255 255 / 38%);
  background: linear-gradient(155deg, var(--surface), rgb(19 24 30 / 84%));
  backdrop-filter: blur(14px) saturate(1.7);
  box-shadow: inset 0 1px 0 #ffffff70, 0 12px 32px #0006;
}
.update-prompt::before {
  content: '';
  position: absolute;
  top: -5px; left: clamp(12px, var(--arrow), calc(100% - 12px));
  width: 9px; height: 9px;
  transform: translateX(-50%) rotate(45deg);
  border-top: 1px solid var(--edge); border-left: 1px solid var(--edge);
  background: var(--surface);
}
.update-action { min-height: 30px; padding: 4px 12px; border: 1px solid #ffffff30; border-radius: 9px; color: white; background: #ffffff10; font-size: 12px; font-weight: 650; line-height: 20px; cursor: pointer; transition: background-color 150ms, transform 150ms; }
.update-action:hover { background: #ffffff26; }
.update-primary { background: #e6e3f5; color: #25232f; }
.update-primary:hover { background: white; }
.update-action:active { transform: translateY(1px); }
.update-action:focus-visible { outline: 2px solid white; outline-offset: 2px; }
.update-spin { transform-origin: center; animation: update-spin 1s linear infinite; }
@keyframes update-spin { to { transform: rotate(360deg); } }
.update-fade-enter-active, .update-fade-leave-active { transition: opacity 170ms ease, transform 170ms ease; }
.update-fade-leave-active { pointer-events: none; }
.update-fade-enter-from, .update-fade-leave-to { opacity: 0; transform: translateY(-3px); }
.update-calm, .update-calm .update-action { transition: none; }
.update-calm .update-action:active { transform: none; }
.update-calm .update-spin { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .update-trigger, .update-action, .update-fade-enter-active, .update-fade-leave-active { transition: none; }
  .update-spin { animation: none; }
  .update-action:active, .update-fade-enter-from, .update-fade-leave-to { transform: none; }
}
</style>
