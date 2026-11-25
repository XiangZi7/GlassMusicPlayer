<script setup lang="ts">
import {
  computed,
  nextTick,
  onDeactivated,
  reactive,
  toRef,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'

const props = defineProps<{ variant: 'titlebar' | 'page'; label?: string }>()
const searchLabel = computed(() => props.label ?? (props.variant === 'titlebar' ? '搜索曲库' : '搜索歌曲、歌手'))
const { state, controller } = usePlayer()
const draft = toRef(state, 'queryDraft')
const anchor = useTemplateRef<HTMLFormElement>('anchor')
const input = useTemplateRef<HTMLInputElement>('input')
const bubble = useTemplateRef<HTMLElement>('bubble')
const clearButton = useTemplateRef<HTMLButtonElement>('clearButton')
const listId = useId()
const ui = reactive({
  /** 当前输入框是否展开历史。 */ open: false,
  /** 仅按本次编辑的内容筛选，重新聚焦时展示全部历史。 */ filter: '',
  /** 键盘当前选中的历史项。 */ active: -1,
  /** 相对于播放器的左边距。 */ left: 0,
  /** 气泡顶部与输入框对齐的纵向位置。 */ top: 0,
  /** 气泡宽度受可用窗口宽度限制。 */ width: 0,
  /** 气泡内容可占用的剩余高度。 */ maxHeight: 0,
})
const entries = computed(() =>
  state.searchHistory.filter(word => word.toLowerCase().includes(ui.filter))
)

// 在玻璃根层对齐搜索框，滚出可视区域时收起气泡。
function align(): void {
  const host = anchor.value?.closest<HTMLElement>('[data-player]')
  if (!ui.open || !anchor.value || !host) return
  const box = anchor.value.getBoundingClientRect()
  const frame = host.getBoundingClientRect()
  const clip = anchor.value.closest('main')?.getBoundingClientRect() ?? frame
  if (box.bottom <= clip.top || box.top >= clip.bottom) return close()
  ui.width = Math.min(Math.max(220, box.width), 420, host.clientWidth - 16)
  ui.left = Math.max(
    8,
    Math.min(
      box.left - frame.left - host.clientLeft,
      host.clientWidth - ui.width - 8
    )
  )
  ui.top = box.bottom - frame.top - host.clientTop + 6
  ui.maxHeight = Math.min(300, host.clientHeight - ui.top - 8)
  if (ui.maxHeight < 70) close()
}

// 聚焦或再次点击输入框时展示最近记录。
function show(): void {
  if (!ui.open) {
    ui.active = -1
    ui.filter = ''
  }
  ui.open = true
  align()
}

// 收起当前搜索框的历史，清除临时的键盘选择。
function close(): void {
  ui.open = false
  ui.active = -1
}

// 输入只筛选历史，不提交到曲库。
function edit(event: Event): void {
  show()
  ui.filter = (event.target as HTMLInputElement).value.trim().toLowerCase()
  ui.active = -1
}

// 回车或点击放大镜才提交当前关键词，并打开搜索页。
function submit(word = draft.value): void {
  const player = controller()
  if (!player) return
  close()
  player.setQuery(word)
  if (state.page !== 'search') player.navigate('search')
}

// 选择历史或清空后让键盘焦点回到触发搜索框。
function choose(word: string): void {
  input.value?.focus({ preventScroll: true })
  submit(word)
}

// 只移除本机搜索历史，保留正在查看的搜索结果。
function clearHistory(): void {
  input.value?.focus({ preventScroll: true })
  state.searchHistory = []
  ui.active = -1
}

// 在输入框内浏览历史，输入法选词时保留原生按键行为。
async function keydown(event: KeyboardEvent): Promise<void> {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Escape' && ui.open) {
    event.preventDefault()
    event.stopPropagation()
    input.value?.focus()
    close()
  } else if (
    event.target === input.value &&
    ['ArrowDown', 'ArrowUp'].includes(event.key)
  ) {
    event.preventDefault()
    show()
    const count = entries.value.length
    if (!count) return
    ui.active =
      event.key === 'ArrowDown'
        ? (ui.active + 1) % count
        : ui.active <= 0
          ? count - 1
          : ui.active - 1
    await nextTick()
    document
      .getElementById(listId + '-' + ui.active)
      ?.scrollIntoView({ block: 'nearest' })
  } else if (
    event.target === input.value &&
    event.key === 'Enter' &&
    ui.open &&
    ui.active >= 0
  ) {
    event.preventDefault()
    choose(entries.value[ui.active] ?? draft.value)
  } else if (
    event.key === 'Tab' &&
    ui.open &&
    !event.shiftKey &&
    event.target === input.value &&
    clearButton.value
  ) {
    event.preventDefault()
    clearButton.value.focus()
  } else if (event.key === 'Tab' && event.target === clearButton.value) {
    input.value?.focus()
    if (event.shiftKey) event.preventDefault()
    else close()
  }
}

// 输入框与传送后的气泡共用焦点边界，切到其他控件时关闭。
function dismissOutside(target: EventTarget | null): void {
  if (
    ui.open &&
    !(
      target instanceof Node &&
      (anchor.value?.contains(target) || bubble.value?.contains(target))
    )
  )
    close()
}
useEventListener(
  document,
  'pointerdown',
  event => dismissOutside(event.target),
  { capture: true }
)
useEventListener(window, 'resize', align)
useEventListener(window, 'blur', close)
useEventListener(window, 'scroll', align, { capture: true, passive: true })
// 天气地名加载时标题栏会重新分配宽度，即使搜索框本身未变宽也需移动气泡。
useResizeObserver(() => {
  if (!ui.open || !anchor.value) return []
  const chrome = anchor.value.closest('.win-chrome')
  return chrome
    ? Array.from(chrome.querySelectorAll<HTMLElement>(':scope > *'))
    : [anchor.value]
}, align)
watch(() => [state.page, state.stage], close)
onDeactivated(close)
</script>

<template>
  <!-- 搜索表单只在提交时更新搜索词，继续使用原有的页内与标题栏样式。 -->
  <form
    ref="anchor"
    role="search"
    :class="
      variant === 'titlebar'
        ? 'chrome-search ml-auto flex h-[30px] w-[196px] flex-none items-center gap-[7px] rounded-full px-[10px] text-inherit'
        : 'search-box mt-[16px] flex min-h-[46px] items-center gap-[10px] rounded-[14px] px-[14px]'
    "
    @submit.prevent="submit()"
    @keydown="keydown"
    @focusout="dismissOutside($event.relatedTarget)"
  >
    <BaseButton
      type="submit"
      aria-label="搜索"
      class="grid size-[26px] flex-none place-items-center rounded-full p-0 text-inherit"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.3"
        aria-hidden="true"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    </BaseButton>
    <input
      ref="input"
      v-model="draft"
      maxlength="100"
      type="text"
      :data-top-search="variant === 'titlebar' ? '' : null"
      :data-search-input="variant === 'page' ? '' : null"
      :aria-label="searchLabel"
      :placeholder="searchLabel + '…'"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="ui.open"
      :aria-controls="ui.open ? listId : undefined"
      :aria-activedescendant="
        ui.open && ui.active >= 0 ? listId + '-' + ui.active : undefined
      "
      @focus="show"
      @click="show"
      @input="edit"
    />
    <Teleport
      defer
      to="[data-player]"
    >
      <Transition
        name="search-history"
        :css="state.settings.motion"
      >
        <section
          v-if="ui.open"
          ref="bubble"
          class="search-history panel-scroll absolute z-[16] overflow-y-auto rounded-[14px] border p-2 text-[13px] text-white"
          aria-label="搜索历史"
          :style="{
            top: ui.top + 'px',
            left: ui.left + 'px',
            width: ui.width + 'px',
            maxHeight: ui.maxHeight + 'px',
          }"
          @focusout="dismissOutside($event.relatedTarget)"
          @keydown="keydown"
        >
          <div class="flex min-h-8 items-center justify-between px-2">
            <strong class="text-[12px] font-bold text-white/75"
              >最近搜索</strong
            >
            <button
              v-if="state.searchHistory.length"
              ref="clearButton"
              type="button"
              aria-label="清空搜索历史"
              class="rounded-md px-2 py-1 text-[12px] text-white/70 hover:bg-white/10 focus-visible:outline-2"
              @click="clearHistory"
            >
              清空
            </button>
          </div>
          <ul
            :id="listId"
            role="listbox"
            aria-label="最近搜索"
            class="m-0 list-none p-0"
          >
            <li
              v-for="(word, index) in entries"
              :id="listId + '-' + index"
              :key="word"
              role="option"
              :aria-selected="index === ui.active"
              :title="word"
              class="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-white/10 aria-selected:bg-white/15"
              @pointerdown.prevent
              @click="choose(word)"
            >
              <svg
                class="size-3.5 shrink-0 text-white/55"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                />
                <path d="M12 7v5l3 2" />
              </svg>
              <span class="truncate">{{ word }}</span>
            </li>
          </ul>
          <p
            v-if="!entries.length"
            role="status"
            class="m-0 px-2 py-3 text-white/65"
          >
            {{
              state.searchHistory.length ? '没有匹配的搜索记录' : '暂无搜索记录'
            }}
          </p>
        </section>
      </Transition>
    </Teleport>
  </form>
</template>

<style scoped>
.search-history {
  background: rgb(25 25 34 / 90%);
  border-color: #ffffff35;
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 32px #0006;
}
.liquid-win .search-history {
  background: linear-gradient(150deg, rgb(60 60 70 / 82%), rgb(20 22 31 / 84%));
  border-color: #ffffff65;
  backdrop-filter: blur(16px) saturate(1.45);
  box-shadow:
    inset 0 1px 1px #ffffff78,
    0 12px 32px #0006;
}
.search-history-leave-active {
  pointer-events: none;
}
@media (prefers-reduced-motion: no-preference) {
  .search-history-enter-active,
  .search-history-leave-active {
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }
  .search-history-enter-from,
  .search-history-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
}
</style>
