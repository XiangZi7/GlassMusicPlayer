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
import { useEventListener, useResizeObserver } from '@vueuse/core'
import type { MusicPlatform } from '@/api'
import type { LinkedProfile, LinkedProfiles } from '@/stores/player'
import { platformNames } from '@/services/player/catalog'
import { publicAvatar } from '@/services/public-avatar'
import { playbackAccount } from '@/services/player/playback-session'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlatformIcon from '@/components/player/PlatformIcon.vue'

const props = defineProps<{ profiles: LinkedProfiles; motion: boolean }>()
const emit = defineEmits<{ platform: [value: MusicPlatform] }>()
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const panel = useTemplateRef<HTMLElement>('panel')
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
const identity = computed(() => playbackAccount.value ?? latest.value)
const name = computed(() => identity.value?.displayName || (identity.value ? '音乐账号' : '访客'))
const statusIcons = {
  '已关联': 'M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  '扫码连接': 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M6 12h12',
  '公开资料': 'M10 13a4 4 0 0 0 6 .3l3-3a4 4 0 0 0-6-6l-2 2m2 5a4 4 0 0 0-6-.3l-3 3a4 4 0 0 0 6 6l2-2',
}
// 按各平台的真实关联状态显示对应入口和图标。
const rows = computed(() => platforms.map(platform => {
  const status = props.profiles[platform] || (platform === 'netease' && playbackAccount.value)
    ? '已关联' : platform === 'kuwo' ? '公开资料' : '扫码连接'
  return { platform, status, icon: statusIcons[status] }
}))

// 响应式状态
const state = reactive({
  // 头像气泡是否展开，鼠标悬停与键盘点击共享同一个状态。
  open: false,
  // 图片失败时只显示中性用户图标，不伪造登录头像。
  avatarFailed: false,
  // 气泡在所属播放器根层中的位置，随窗口大小更新。
  top: 0,
  right: 8,
})
const { open, avatarFailed } = toRefs(state)
watch(avatar, () => {
  state.avatarFailed = false
})
let leaveTimer: ReturnType<typeof setTimeout> | undefined
// 把气泡对齐头像右侧，在窄窗口两边各保留八像素。
function align(): void {
  const host = root.value?.closest<HTMLElement>('[data-player]')
  if (!state.open || !root.value || !host) return
  const button = root.value.getBoundingClientRect()
  const frame = host.getBoundingClientRect()
  const width = Math.min(272, host.clientWidth - 16)
  state.top = button.bottom - frame.top - host.clientTop + 7
  state.right = Math.max(8, Math.min(host.clientWidth - width - 8, frame.right - host.clientLeft - button.right))
}
useResizeObserver(root, align)
useEventListener(window, 'resize', align)
// 头像和传送到玻璃根层的气泡共同构成悬停与焦点区域。
function inside(target: Node | null): boolean {
  return !!(root.value?.contains(target) || panel.value?.contains(target))
}
// 打开或保持气泡展开，并取消先前的延迟关闭。
function show(): void {
  if (leaveTimer !== undefined) clearTimeout(leaveTimer)
  leaveTimer = undefined
  state.open = true
  align()
}
// 关闭时同时释放尚未结束的悬停计时。
function hide(): void {
  if (leaveTimer !== undefined) clearTimeout(leaveTimer)
  leaveTimer = undefined
  state.open = false
}
// 给指针跨过头像与气泡间隙留出时间，键盘焦点在内部时保持展开。
function leave(): void {
  if (leaveTimer !== undefined) clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => {
    if (!inside(document.activeElement)) hide()
  }, 140)
}
// 关闭气泡并打开选中平台的关联方式。
function select(platform: MusicPlatform): void {
  hide()
  emit('platform', platform)
}
// 在菜单里移动焦点，Escape 返回头像入口。
async function keydown(event: KeyboardEvent): Promise<void> {
  if (event.key === 'Escape' && state.open) {
    event.preventDefault()
    event.stopPropagation()
    hide()
    trigger.value?.focus()
    return
  }
  const activate = event.target === trigger.value && ['Enter', ' '].includes(event.key)
  if (!activate && !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  show()
  await nextTick()
  const items = Array.from(
    panel.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []
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
  if (!inside(event.target as Node)) hide()
})
// 两个区域之间切换焦点时不关闭菜单。
function focusout(event: FocusEvent): void {
  if (!inside(event.relatedTarget as Node)) hide()
}
useEventListener(root, 'focusout', focusout)
useEventListener(panel, 'focusout', focusout)
useEventListener(window, 'blur', hide)
onBeforeUnmount(hide)
</script>

<template>
  <div
    ref="root"
    class="account-control relative flex-none"
    :class="{ 'account-calm': !motion }"
    data-account-menu
    @pointerenter="show"
    @pointerleave="leave"
    @keydown="keydown"
  >
    <button
      ref="trigger"
      type="button"
      class="account-avatar group flex h-9 min-w-9 cursor-default items-center justify-center gap-1 rounded-[10px] border-0 bg-transparent px-1 text-white/70 transition-colors duration-150 hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/75 aria-expanded:bg-white/8"
      aria-label="账号与音乐平台"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :title="name"
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
    </button>
    <Teleport defer to="[data-player]">
    <Transition name="account-bubble" :css="motion">
      <div
        v-if="open"
        :id="menuId"
        ref="panel"
        :style="{ top: state.top + 'px', right: state.right + 'px', maxHeight: 'calc(100% - ' + (state.top + 8) + 'px)' }"
        role="menu"
        aria-label="音乐平台账号"
        class="account-bubble panel-scroll absolute z-[90] overflow-y-auto rounded-[18px] border p-1.5 text-white"
        @pointerenter="show"
        @pointerleave="leave"
        @keydown="keydown"
      >
        <div class="account-identity">
          <span class="identity-icon" aria-hidden="true">
            <img v-if="avatar && !avatarFailed" :src="avatar" alt="" referrerpolicy="no-referrer" @error="avatarFailed = true" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>
          </span>
          <div class="min-w-0"><b class="block truncate text-sm" :title="name">{{ name }}</b>
            <span class="text-xs text-white/70">{{ playbackAccount ? '网易云播放账号' : latest ? '已关联的公开账号' : '音乐平台账号' }}</span>
          </div>
          <span v-if="playbackAccount?.badge" class="account-level" :aria-label="'网易云会员 ' + playbackAccount.badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">
              <path d="m3 7 4.6 3L12 4l4.4 6L21 7l-2 9H5zM6 19h12"/>
            </svg>
            {{ playbackAccount.badge }}
          </span>
        </div>
        <BaseButton
          v-for="{ platform, status, icon } in rows"
          :key="platform"
          type="button"
          role="menuitem"
          class="account-row flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] hover:bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/75"
          @click="select(platform)"
        >
          <PlatformIcon :platform="platform" />
          <span>{{ platformNames[platform] }}</span>
          <span class="account-status" :class="{ linked: status === '已关联' }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="icon"/></svg>{{ status }}
          </span>
        </BaseButton>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.account-avatar { width: 36px; border-radius: 50%; padding: 0; }
.account-level, .account-status { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.account-level {
  flex: none; margin-left: auto; padding-left: 2px; color: #efcf91;
  font: 650 11px/1.45 var(--font-mono);
}
.account-level svg, .account-status svg { width: 13px; height: 13px; }
.account-bubble {
  width: min(272px, calc(100% - 16px)); border-color: #ffffff35;
  background: rgb(25 25 34 / 89%); backdrop-filter: blur(18px);
  box-shadow: 0 12px 32px rgb(0 0 0 / 38%);
}
.liquid-win .account-bubble {
  background: linear-gradient(150deg, rgb(60 60 70 / 79%), rgb(20 22 31 / 82%));
  border-color: #ffffff65; backdrop-filter: blur(16px) saturate(1.45);
  box-shadow: inset 0 1px 1px #ffffff78, 0 12px 32px #0006;
}
.account-identity { display: flex; align-items: center; gap: 11px; margin: 0 4px 4px; padding: 10px 4px 12px; border-bottom: 1px solid #ffffff24; }
.identity-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: none; overflow: hidden; border: 1px solid #ffffff35; border-radius: 50%; background: #ffffff12; }
.identity-icon img { width: 100%; height: 100%; object-fit: cover; }
.identity-icon svg { width: 19px; height: 19px; }
.account-row :deep(.plat-logo) { width: 25px; height: 25px; }
.account-status { margin-left: auto; color: #ffffffbb; font-size: 11px; }
.account-status.linked { color: #a9e4c1; }
.account-bubble-leave-active { pointer-events: none; }
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
.account-calm .account-avatar,
.account-calm .account-avatar > span {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .account-avatar,
  .account-avatar > span,
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
