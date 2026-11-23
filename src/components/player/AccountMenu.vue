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
import type { MusicPlatform } from '@/api'
import type { LinkedProfile, LinkedProfiles } from '@/stores/player'
import { platformNames } from '@/services/player/catalog'
import { publicAvatar } from '@/services/public-avatar'
import { playbackAccount } from '@/services/player/playback-session'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = defineProps<{ profiles: LinkedProfiles }>()
const emit = defineEmits<{ platform: [value: MusicPlatform] }>()
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const menuId = useId()
const platforms: MusicPlatform[] = ['netease', 'kugou', 'kuwo']
const latest = computed(
  () =>
    Object.values(props.profiles)
      .filter((item): item is LinkedProfile => !!item)
      .sort((a, b) => b.syncedAt - a.syncedAt)[0]
)
const avatar = computed(() =>
  publicAvatar((playbackAccount.value ?? latest.value)?.avatarUrl)
)

// 响应式状态
const state = reactive({
  // 头像气泡是否展开，鼠标悬停与键盘点击共享同一个状态。
  open: false,
  // 图片失败时只显示中性用户图标，不伪造登录头像。
  avatarFailed: false,
})
const { open, avatarFailed } = toRefs(state)
watch(avatar, () => {
  state.avatarFailed = false
})
let leaveTimer: ReturnType<typeof setTimeout> | undefined
function show(): void {
  if (leaveTimer !== undefined) clearTimeout(leaveTimer)
  leaveTimer = undefined
  state.open = true
}
function hide(): void {
  if (leaveTimer !== undefined) clearTimeout(leaveTimer)
  leaveTimer = undefined
  state.open = false
}
function leave(): void {
  leaveTimer = setTimeout(() => {
    if (!root.value?.contains(document.activeElement)) hide()
  }, 140)
}
function select(platform: MusicPlatform): void {
  hide()
  emit('platform', platform)
}
async function keydown(event: KeyboardEvent): Promise<void> {
  if (event.key === 'Escape' && state.open) {
    event.preventDefault()
    event.stopPropagation()
    hide()
    trigger.value?.focus()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  show()
  await nextTick()
  const items = Array.from(
    root.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []
  )
  if (!items.length) return
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowUp'
          ? index <= 0
            ? items.length - 1
            : index - 1
          : (index + 1) % items.length
  items[next]?.focus()
}
useEventListener(document, 'pointerdown', event => {
  if (!root.value?.contains(event.target as Node)) hide()
})
useEventListener(root, 'focusout', event => {
  if (!root.value?.contains(event.relatedTarget as Node)) hide()
})
useEventListener(window, 'blur', hide)
onBeforeUnmount(hide)
</script>

<template>
  <div
    ref="root"
    class="account-control relative flex-none"
    data-account-menu
    @pointerenter="show"
    @pointerleave="leave"
    @keydown="keydown"
  >
    <button
      ref="trigger"
      type="button"
      class="account-avatar group flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1 rounded-[10px] border-0 bg-transparent px-1 text-white/70 transition-colors duration-150 hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/75 aria-expanded:bg-white/8"
      aria-label="账号与音乐平台"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click.stop="show"
    >
      <span
        class="grid size-7 place-items-center rounded-full border border-white/8 bg-white/3 transition-colors duration-150 group-hover:border-white/15 group-hover:bg-white/6"
      >
        <img
          decoding="async"
          loading="lazy"
          v-if="avatar && !avatarFailed"
          :src="avatar"
          alt=""
          class="size-[26px] rounded-full object-cover"
          referrerpolicy="no-referrer"
          @error="avatarFailed = true"
        />
        <svg
          v-else
          class="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="8"
            r="3.5"
          />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </svg>
      </span>
      <span
        v-if="playbackAccount?.badge"
        class="rounded-full border border-amber-200/25 bg-amber-200/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-200"
        :aria-label="'网易云会员 ' + playbackAccount.badge"
        >{{ playbackAccount.badge }}</span
      >
    </button>
    <Transition name="account-bubble">
      <div
        v-if="open"
        :id="menuId"
        role="menu"
        aria-label="音乐平台账号"
        class="account-bubble absolute top-[calc(100%+8px)] right-0 z-[100] w-[222px] rounded-[16px] border border-white/15 bg-[#22232d] p-2 text-white shadow-[0_12px_32px_rgba(0,0,0,.32)]"
      >
        <div class="px-3 pt-2 pb-2 text-[11px] font-bold text-white/55">
          {{ latest?.displayName || '账号与音乐平台' }}
        </div>
        <BaseButton
          v-for="platform in platforms"
          :key="platform"
          type="button"
          role="menuitem"
          class="flex min-h-10 w-full items-center justify-between gap-3 rounded-[10px] bg-transparent px-3 text-left text-[12px] text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/70"
          @click="select(platform)"
        >
          <span>{{ platformNames[platform] }}</span>
          <span class="text-[10px] text-white/50">{{
            profiles[platform]
              ? '已关联'
              : platform === 'kuwo'
                ? '公开资料'
                : '扫码连接'
          }}</span>
        </BaseButton>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.account-bubble::before {
  content: '';
  position: absolute;
  top: -5px;
  right: 14px;
  width: 9px;
  height: 9px;
  background: #22232d;
  border-top: 1px solid rgb(255 255 255 / 0.15);
  border-left: 1px solid rgb(255 255 255 / 0.15);
  transform: rotate(45deg);
}
.account-bubble-enter-active,
.account-bubble-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.account-bubble-enter-from,
.account-bubble-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .account-bubble-enter-active,
  .account-bubble-leave-active {
    transition: none;
  }
  .account-bubble-enter-from,
  .account-bubble-leave-to {
    transform: none;
  }
}
</style>
