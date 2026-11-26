<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, toRefs, useId, useTemplateRef, watch } from 'vue'
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
  // 已就绪安装包或手动下载提示的气泡开关。
  open: false,
  // 气泡相对于本窗口玻璃根层的左侧位置。
  left: 0,
  // 气泡相对于本窗口玻璃根层的上侧位置。
  top: 0,
  // 气泡箭头相对于气泡左侧的位置。
  arrow: 0,
})
const { open, left, top, arrow } = toRefs(state)
let requestedHere = false
// 区分本窗口关闭的回执与设置窗口的新操作，避免旧回执盖掉刚刚重开的气泡。
let pendingClose: 'dismiss' | 'defer' | undefined
const visible = computed(() => Boolean(update.version)
  && ['available', 'downloading', 'ready', 'installing', 'error'].includes(update.phase))
const downloading = computed(() => update.phase === 'downloading')
const manualRelease = computed(() => update.phase === 'available' && update.reason === 'manual')
const canOpenPrompt = computed(() => update.phase === 'ready' || manualRelease.value)
const busy = computed(() => downloading.value || update.phase === 'installing')
const panelVisible = computed(() => visible.value && (downloading.value || (canOpenPrompt.value && state.open)))
const progress = computed(() => update.total > 0
  ? Math.min(99, Math.round(update.downloaded / update.total * 100))
  : undefined)
const downloadedSize = computed(() => `${(update.downloaded / 1024 / 1024).toFixed(1)} MiB`)
const panelTitle = computed(() => {
  if (downloading.value) return '正在下载更新'
  return manualRelease.value ? '发现新版本' : '更新下载完成'
})
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
  if (!panelVisible.value || !trigger.value || !host.value || !prompt.value) return
  const frame = host.value.getBoundingClientRect()
  const button = trigger.value.getBoundingClientRect()
  const width = prompt.value.offsetWidth
  const right = button.right - frame.left - host.value.clientLeft
  state.left = Math.max(8, Math.min(right - width, host.value.clientWidth - width - 8))
  state.top = button.bottom - frame.top - host.value.clientTop + 10
  state.arrow = right - button.width / 2 - state.left
}
watch([panelVisible, prompt, host], align, { flush: 'post' })
useResizeObserver([host, trigger, prompt], align)
useEventListener(window, 'resize', align)

// 关闭气泡时保留已下载的更新，仅在键盘操作结束时还原焦点。
function closePrompt(action: 'dismiss' | 'defer', returnFocus = false): void {
  state.open = false
  if (update.phase === 'ready') {
    if (!update.dismissed || (action === 'defer' && !update.deferred)) pendingClose = action
    void updater.command(action)
  }
  if (returnFocus) trigger.value?.focus({ preventScroll: true })
}

// 用户主动展开气泡后，将键盘焦点交给第一个操作按钮。
async function focusPrompt(): Promise<void> {
  await nextTick()
  if (state.open) prompt.value?.querySelector('button')?.focus({ preventScroll: true })
}

// 支持应用内更新时开始下载；已就绪或需手动下载时展开对应选择。
function activate(): void {
  if (busy.value) return
  if (canOpenPrompt.value) {
    if (state.open) closePrompt('dismiss', true)
    else {
      state.open = true
      void focusPrompt()
    }
  } else {
    requestedHere = true
    void updater.command(update.phase === 'error' && update.errorStage === 'install' ? 'install' : 'download')
  }
}

// 根据用户明确选择启动安装或打开正式发行页。
function confirmUpdate(): void {
  if (!state.open || !canOpenPrompt.value) return
  state.open = false
  trigger.value?.focus({ preventScroll: true })
  if (manualRelease.value) {
    void updater.openRelease()
    return
  }
  requestedHere = true
  void updater.command('install')
}

// 等待后台校验后自动展开气泡，不干扰当前输入焦点；其他窗口的推迟操作同步收起。
watch([() => update.phase, () => update.dismissed, () => update.deferred, manualRelease, () => update.version], ([phase, dismissed, deferred], previous) => {
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
      :aria-expanded="canOpenPrompt ? open : undefined"
      :aria-controls="panelVisible ? promptId : undefined"
      :aria-haspopup="canOpenPrompt ? 'dialog' : undefined"
      :aria-disabled="busy || undefined"
      :aria-busy="busy || undefined"
      data-update-trigger
      @click.stop="activate"
      @keydown.tab="handleTab"
    >
      <svg
        viewBox="0 0 24 24"
        :class="downloading ? 'size-5' : 'size-[19px]'"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <template v-if="downloading">
          <circle cx="12" cy="12" r="9" opacity=".18" />
          <g transform="rotate(-90 12 12)">
            <circle
              cx="12" cy="12" r="9" pathLength="100"
              :stroke-dasharray="progress === undefined ? '25 75' : '100'"
              :stroke-dashoffset="progress === undefined ? 0 : 100 - progress"
              :class="progress === undefined ? 'update-spin' : 'update-ring-fill'"
            />
          </g>
        </template>
        <path v-else-if="update.phase === 'installing'" class="update-spin" d="M21 12a9 9 0 1 1-9-9" />
        <template v-else>
          <circle cx="12" cy="12" r="10" />
          <path v-if="update.phase === 'ready'" d="m9 12 2 2 4-4" />
          <path v-else-if="update.phase === 'error'" d="M12 8v4m0 4h.01" />
          <path v-else d="m16 12-4-4-4 4m4 4V8" />
        </template>
      </svg>
    </button>
  </Transition>
  <Teleport v-if="host" :to="host">
    <Transition name="update-fade" :css="motion">
      <section
        v-if="panelVisible" :id="promptId" ref="prompt"
        class="update-panel absolute z-[90] flex flex-col rounded-xl border text-white"
        :class="{ 'update-calm': !motion }"
        :style="{ left: left + 'px', top: top + 'px', '--update-top': top + 'px', '--arrow': arrow + 'px' }"
        :role="open ? 'dialog' : 'region'"
        aria-label="应用更新"
        :data-update-prompt="open ? '' : undefined"
        :data-update-download="downloading ? '' : undefined"
        @keydown.tab="handleTab" @keydown.space.stop @keydown.enter.stop
      >
        <div class="panel-scroll min-h-0 overflow-y-auto px-3 py-2.5">
          <div class="flex items-center gap-2">
            <svg
              class="size-[17px] shrink-0"
              :class="downloading || manualRelease ? 'text-white/80' : 'text-[#a9e4c1]'"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >
              <path v-if="downloading || manualRelease" d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
              <template v-else>
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </template>
            </svg>
            <strong class="shrink-0 text-xs leading-5" role="status">
              {{ panelTitle }}
            </strong>
            <span class="ml-auto truncate font-mono text-[10px] text-white/70" :title="'v' + update.version">
              v{{ update.version }}
            </span>
          </div>
          <Transition name="update-fade" mode="out-in" :css="motion">
            <div v-if="downloading" class="mt-1.5">
              <p class="mb-1.5 flex justify-between gap-2 font-mono text-[11px] leading-5 text-white/80 tabular-nums">
                <span>{{ downloadedSize }}</span>
                <span v-if="progress !== undefined">{{ progress }}%</span>
              </p>
              <div
                class="update-progress"
                role="progressbar" aria-label="更新下载进度"
                :aria-valuenow="progress" :aria-valuemin="0" :aria-valuemax="100"
              >
                <span
                  class="update-progress-fill"
                  :class="{ 'update-progress-pending': progress === undefined }"
                  :style="{ '--update-progress': (progress ?? 0) / 100 }"
                />
              </div>
            </div>
            <p v-else class="mt-1.5 text-[11px] leading-5 text-white/80">
              {{ manualRelease ? '此版本需要手动更新，可前往发行页下载安装包。' : '更新包已下载，是否立即更新？' }}
            </p>
          </Transition>
        </div>
        <Transition name="update-fade" :css="motion">
          <div v-if="open" class="panel-actions flex flex-wrap items-center justify-end gap-2">
            <BaseButton class="update-action" @click="closePrompt('defer', true)">
              {{ manualRelease ? '关闭' : '稍后' }}
            </BaseButton>
            <BaseButton class="update-action update-primary" @click="confirmUpdate">
              {{ manualRelease ? '前往下载' : '立即更新' }}
            </BaseButton>
          </div>
        </Transition>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-trigger { color: rgb(255 255 255 / 80%); background: transparent; cursor: pointer; transition: background-color 150ms, color 150ms; }
.update-trigger:hover, .update-trigger[aria-expanded="true"] { color: white; background: #ffffff18; }
.liquid-win .update-trigger:hover, .liquid-win .update-trigger[aria-expanded="true"] {
  background: linear-gradient(160deg, #ffffff32, #ffffff0f);
  box-shadow: inset 0 1px 0 #ffffff55;
}
.update-trigger.update-ready { color: #a9e4c1; }
.update-trigger[aria-busy="true"] { cursor: progress; }
.update-panel {
  width: min(272px, calc(100% - 16px));
  max-height: calc(100% - var(--update-top) - 8px);
  --surface: rgb(25 25 34 / 89%);
  --edge: rgb(255 255 255 / 20%);
  border-color: var(--edge);
  background: var(--surface);
  backdrop-filter: blur(20px);
  box-shadow: 0 12px 32px rgb(0 0 0 / 38%);
}
.liquid-win .update-panel {
  --surface: rgb(60 60 70 / 79%);
  --edge: rgb(255 255 255 / 38%);
  background: linear-gradient(150deg, var(--surface), rgb(20 22 31 / 82%));
  backdrop-filter: blur(14px) saturate(1.7);
  box-shadow: inset 0 1px 0 #ffffff70, 0 12px 32px #0006;
}
.update-panel::before {
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
.update-primary { background: #e8e8eb; color: #242428; }
.update-primary:hover { background: white; }
.update-action:active { transform: translateY(1px); }
.update-action:focus-visible { outline: 2px solid white; outline-offset: 2px; }
.update-ring-fill { transition: stroke-dashoffset 150ms ease; }
.update-spin { transform-origin: center; animation: update-spin 1s linear infinite; }
@keyframes update-spin { to { transform: rotate(360deg); } }
.update-progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(255 255 255 / 14%);
}
.update-progress-fill {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: rgb(255 255 255 / 85%);
  transform: scaleX(var(--update-progress));
  transform-origin: left;
  transition: transform 150ms ease;
}
.update-progress-pending {
  width: 35%;
  transform: none;
  animation: update-progress-slide 1.4s ease-in-out infinite alternate;
}
@keyframes update-progress-slide { to { transform: translateX(185%); } }
.update-fade-enter-active, .update-fade-leave-active { transition: opacity 170ms ease, transform 170ms ease; }
.update-fade-leave-active { pointer-events: none; }
.update-fade-enter-from, .update-fade-leave-to { opacity: 0; transform: translateY(-3px); }
.update-calm, .update-calm :is(.update-action, .update-ring-fill, .update-progress-fill) { transition: none; }
.update-calm .update-action:active { transform: none; }
.update-calm :is(.update-spin, .update-progress-pending) { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .update-trigger, .update-action, .update-ring-fill, .update-progress-fill, .update-fade-enter-active, .update-fade-leave-active { transition: none; }
  .update-spin, .update-progress-pending { animation: none; }
  .update-action:active, .update-fade-enter-from, .update-fade-leave-to { transform: none; }
}
</style>
