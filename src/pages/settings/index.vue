<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  reactive,
  toRefs,
  useTemplateRef,
  watch,
} from 'vue'
import { useEventListener } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import PlayerWindowFrame from '@/components/player/PlayerWindowFrame.vue'
import WindowControls from '@/components/ui/WindowControls.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import SettingsPanel from '@/pages/settings/components/settings-panel.vue'
import { playerKey } from '@/composables/usePlayer'
import { useSlidingPill } from '@/composables/useSlidingPill'
import {
  createDefaultSettings,
  usePlayerStore,
  type PlayerSettings,
} from '@/stores/player'
import { notify } from '@/services/notification'
import { defaultCover } from '@/constants/music'
import { getStorageInfo, updateStorageConfig } from '@/services/storage'
import type {
  SettingsAction,
  SettingsSection,
  SettingsSnapshot,
} from '@/types/settings'

const {
  state: playerState,
  tracks,
  saveIslandPreferences,
  savePreferences,
} = usePlayerStore()
const router = useRouter()
const navigation = useTemplateRef<HTMLElement>('navigation')
const content = useTemplateRef<HTMLElement>('content')
const sections: {
  key: SettingsSection
  label: string
  title: string
  description: string
  icon: string
}[] = [
  {
    key: 'general',
    label: '通用',
    title: '通用设置',
    description: '播放衔接、音量与睡眠定时。',
    icon: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  },
  {
    key: 'audio',
    label: '音质',
    title: '音质设置',
    description: '播放音质、输出设备与预设音效。',
    icon: 'M5 9H2v6h3l5 4V5L5 9zm9-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  },
  {
    key: 'storage',
    label: '缓存与下载',
    title: '缓存与下载',
    description: '本机目录、下载音质、占用与安全清理。',
    icon: 'M3 7h18v13H3zM3 7V4h7l2 3M12 10v7m-3-3 3 3 3-3',
  },
  {
    key: 'appearance',
    label: '外观',
    title: '外观设置',
    description: '玻璃材质、天气与播放器界面。',
    icon: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a1.5 1.5 0 0 1 0-3h3a6 6 0 0 0 0-12zM7 9h.01M10 6h.01M15 6h.01M7 13h.01',
  },
  {
    key: 'desktop',
    label: '桌面',
    title: '桌面设置',
    description: '悬浮歌词、窗口锁定与迷你播放器。',
    icon: 'M3 4h18v12H3zM8 21h8m-4-5v5',
  },
  {
    key: 'shortcuts',
    label: '快捷键',
    title: '快捷键',
    description: '播放器常用键盘操作。',
    icon: 'M3 5h18v14H3zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10',
  },
  {
    key: 'about',
    label: '关于',
    title: '关于播放器',
    description: '应用信息与数据来源。',
    icon: 'M12 8h.01M11 12h1v5m9-5a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  },
]

// 响应式状态：分类导航、设置草稿和主窗口同步快照集中管理。
const state = reactive({
  /** 首次接收主窗口状态后开放表单。 */ ready: !isTauri(),
  /** 提交期间禁止重复点击。 */ saving: false,
  /** 当前曲目封面，曲库为空时使用默认封面。 */ cover: tracks[0]?.cover || defaultCover,
  /** 设置分类历史，供标题栏前进和后退使用。 */ history: [
    'general',
  ] as SettingsSection[],
  /** 当前分类在历史中的位置。 */ historyIndex: 0,
  /** 已应用设置，用于识别和撤销未提交的修改。 */ baseline: {
    ...playerState.settings,
  },
  /** 已应用的正在播放面板展开状态。 */ baselinePanel: playerState.npOpen,
})
const { ready, saving, cover } = toRefs(state)
const section = computed(() => state.history[state.historyIndex]!)
const activeSection = computed(() =>
  sections.find(item => item.key === section.value)!
)
const canBack = computed(() => state.historyIndex > 0)
const canForward = computed(() => state.historyIndex < state.history.length - 1)
const glassStyle = computed(() => playerState.settings.glassStyle)
const hasChanges = computed(
  () =>
    playerState.npOpen !== state.baselinePanel ||
    (Object.keys(state.baseline) as (keyof PlayerSettings)[]).some(
      key => playerState.settings[key] !== state.baseline[key]
    )
)
let disposed = false
let stopSnapshot: UnlistenFn | undefined

provide(playerKey, {
  state: playerState,
  tracks,
  controller: () => undefined,
  setSetting,
  setNowPlaying,
})
useSlidingPill(navigation, () => section.value)

// 左侧分类加入本窗口历史，不改变主播放器所在页面。
function selectSection(key: SettingsSection): void {
  if (key === section.value) return
  state.history = state.history.slice(0, state.historyIndex + 1)
  state.history.push(key)
  state.historyIndex = state.history.length - 1
}

// 标题栏前进和后退只切换设置分类。
function moveHistory(direction: number): void {
  const next = state.historyIndex + direction
  if (next >= 0 && next < state.history.length) state.historyIndex = next
}

// 表单先更新本窗口草稿，点击应用或保存后统一交给主播放器。
function setSetting<K extends keyof PlayerSettings>(
  key: K,
  value: PlayerSettings[K]
): void {
  playerState.settings[key] = value
}

// 面板开关与其他偏好保持相同的草稿提交方式。
function setNowPlaying(open: boolean): void {
  playerState.npOpen = open
}

// 重置仅修改草稿，取消时不会覆盖主窗口当前设置。
function resetSettings(): void {
  Object.assign(playerState.settings, createDefaultSettings())
  playerState.npOpen = true
}

// 主窗口持续更新背景和已应用快照，保留用户尚未提交的表单内容。
function applySnapshot(snapshot: SettingsSnapshot): void {
  const keepDraft = state.ready && hasChanges.value && !state.saving
  Object.assign(state.baseline, snapshot.settings)
  state.baselinePanel = snapshot.npOpen
  state.cover = snapshot.track.cover
  if (snapshot.equalizerStatus)
    playerState.equalizerStatus = snapshot.equalizerStatus
  if (!keepDraft) {
    Object.assign(playerState.settings, snapshot.settings)
    playerState.npOpen = snapshot.npOpen
  }
  state.ready = true
}

// 一次提交整份草稿；成功后更新基线，让取消只撤销之后的修改。
async function applySettings(): Promise<boolean> {
  if (!state.ready || state.saving) return false
  state.saving = true
  const action: SettingsAction = {
    kind: 'apply',
    settings: { ...playerState.settings },
    npOpen: playerState.npOpen,
  }
  try {
    if (isTauri()) {
      const current = await getStorageInfo()
      const stored = await updateStorageConfig({
        cacheDirectory:
          action.settings.cacheDirectory || current.cacheDirectory,
        downloadDirectory:
          action.settings.downloadDirectory || current.downloadDirectory,
      })
      action.settings.cacheDirectory = stored.cacheDirectory
      action.settings.downloadDirectory = stored.downloadDirectory
      Object.assign(playerState.settings, action.settings)
      await emitTo('main', 'settings-change', action)
    } else {
      saveIslandPreferences()
      savePreferences()
    }
    Object.assign(state.baseline, action.settings)
    state.baselinePanel = action.npOpen
    notify('设置已应用')
    return true
  } catch {
    notify('设置同步失败，请重试', 'error')
    return false
  } finally {
    state.saving = false
  }
}

// 保存先应用草稿，再关闭当前设置窗；主播放器继续运行。
async function saveSettings(): Promise<void> {
  if (await applySettings()) await closeSettings()
}

// 取消或 Escape 丢弃未应用草稿，浏览器预览返回播放器首页。
async function closeSettings(): Promise<void> {
  if (state.saving) return
  if (isTauri()) {
    await getCurrentWindow().close()
  } else {
    Object.assign(playerState.settings, state.baseline)
    playerState.npOpen = state.baselinePanel
    await router.push('/')
  }
}

// 新分类淡入前恢复顶部位置，旧内容淡出时保持原阅读位置。
function resetSectionScroll(): void {
  content.value?.scrollTo({ top: 0 })
}
// 在设置窗预览动效偏好，主窗口在应用后才更新。
watch(
  () => playerState.settings.motion,
  value => document.body.classList.toggle('calm', !value),
  { immediate: true }
)
// Escape 与底栏取消执行相同的关闭逻辑。
useEventListener('keydown', event => {
  if (event.key === 'Escape') void closeSettings()
})

// 先建立快照订阅再通知主窗口，避免新窗口错过首帧设置。
onMounted(async () => {
  if (!isTauri()) return
  try {
    const stop = await listen<SettingsSnapshot>('settings-snapshot', event =>
      applySnapshot(event.payload)
    )
    if (disposed) {
      stop()
      return
    }
    stopSnapshot = stop
    await emitTo('main', 'settings-ready')
  } catch {
    notify('读取设置失败，请重新打开设置窗口', 'error')
  }
})

// 关闭设置窗口时释放事件订阅，重新打开只保留一个接收入口。
onUnmounted(() => {
  disposed = true
  stopSnapshot?.()
})
</script>

<template>
  <!-- 设置原生窗口：复用主播放器的玻璃外框、圆角、阴影和缩放行为。 -->
  <PlayerWindowFrame
    :class="{ 'settings-calm': !playerState.settings.motion }"
    :cover="cover"
    :glass-style="glassStyle"
  >
    <!-- 设置标题栏：按参考布局放置标题、分类前后导航和关闭入口。 -->
    <header
      class="relative z-[5] flex h-[48px] shrink-0 items-center gap-[16px] border-b border-white/10 bg-white/[.025] pl-[18px]"
      data-tauri-drag-region
    >
      <span
        class="text-[13px] font-extrabold"
        data-tauri-drag-region
        >设置</span
      >
      <div class="chrome-nav flex items-center gap-[4px]">
        <!-- 分类历史按钮：沿用主界面前进、后退图标与按钮样式。 -->
        <BaseButton
          :disabled="!canBack"
          aria-label="上一个设置分类"
          @click="moveHistory(-1)"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></svg
        ></BaseButton>
        <!-- 分类历史按钮：可返回刚才浏览的设置分组。 -->
        <BaseButton
          :disabled="!canForward"
          aria-label="下一个设置分类"
          @click="moveHistory(1)"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></svg
        ></BaseButton>
      </div>
      <div
        class="h-full flex-1"
        data-tauri-drag-region
      />
      <!-- 关闭窗口组件：复用 Windows 标题栏控件，只关闭设置窗。 -->
      <WindowControls close-only />
    </header>
    <!-- 设置主体：左侧固定分类，右侧分组内容和独立滚动区域。 -->
    <div class="relative z-[3] flex min-h-0 flex-1">
      <aside
        class="sidebar panel-scroll w-[190px] shrink-0 overflow-y-auto p-[14px_12px] max-[760px]:w-[160px]"
        aria-label="设置分类"
      >
        <nav
          ref="navigation"
          class="relative flex flex-col gap-[4px]"
          aria-label="设置分类导航"
        >
          <!-- 分类导航按钮：复用主侧栏样式与原稿滑动胶囊。 -->
          <BaseButton
            v-for="item in sections"
            :key="item.key"
            class="navitem flex min-h-[38px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[9px_10px] text-left text-[13.5px] font-bold text-inherit"
            :class="{ on: section === item.key }"
            :data-slide-value="item.key"
            :aria-current="section === item.key ? 'page' : undefined"
            @click="selectSection(item.key)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="item.icon" />
            </svg>
            {{ item.label }}
          </BaseButton>
          <span
            class="side-pill pointer-events-none absolute top-0 left-0 z-[1] opacity-0"
            data-slide-pill
            aria-hidden="true"
          />
        </nav>
      </aside>
      <main
        class="main flex min-h-0 min-w-0 flex-1 flex-col p-0"
        :aria-busy="!ready"
      >
        <!-- 当前分类标题区：与可滚动设置表单分开，切换分类时始终可见。 -->
        <div class="shrink-0 border-b border-white/[.07] px-[20px] py-[15px]">
          <h2 class="m-0 text-[15px] font-extrabold">
            {{ activeSection.title }}
          </h2>
          <p class="mt-[4px] mb-0 text-[11.5px] leading-[1.5] text-white/[.58]">
            {{ activeSection.description }}
          </p>
        </div>
        <div
          ref="content"
          class="panel-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          role="region"
          tabindex="0"
          :aria-label="activeSection.title"
        >
          <!-- 设置加载区域：等待主窗口快照时在表单容器中央显示。 -->
          <div
            v-if="!ready"
            class="absolute inset-0 grid place-items-center"
            role="status"
            aria-label="正在读取设置"
          >
            <span
              class="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
            />
          </div>
          <!-- 当前分类的设置表单：原有卡片、开关和标签控件保持原样。 -->
          <div v-if="ready" class="p-[18px_20px_24px]">
            <Transition name="settings-section" mode="out-in" @before-enter="resetSectionScroll">
              <SettingsPanel :key="section" :section="section" />
            </Transition>
          </div>
        </div>
        <!-- 固定底部操作栏：左侧重置，右侧取消、应用和保存。 -->
        <footer
          class="panel-actions flex items-center justify-between gap-[12px]"
        >
          <!-- 重置操作：只改当前草稿，点击应用或保存后才写回主播放器。 -->
          <BaseButton
            class="newpl-btn min-h-[30px] shrink-0 rounded-full px-[12px] text-[11.5px] font-bold disabled:opacity-40"
            :disabled="!ready || saving"
            @click="resetSettings"
            >重置为默认</BaseButton
          >
          <div class="main-chips flex items-center gap-[7px]">
            <!-- 取消操作：放弃未应用的修改并关闭设置窗口。 -->
            <BaseButton
              class="min-h-[30px] rounded-full px-[13px] py-[6px] text-[11.5px] font-bold disabled:opacity-40"
              :disabled="saving"
              @click="closeSettings"
              >取消</BaseButton
            >
            <!-- 应用操作：写回主播放器并继续停留在设置窗口。 -->
            <BaseButton
              class="min-h-[30px] rounded-full px-[13px] py-[6px] text-[11.5px] font-bold disabled:opacity-40"
              :disabled="!ready || !hasChanges || saving"
              @click="applySettings"
              >应用</BaseButton
            >
            <!-- 保存操作：应用全部修改后关闭当前设置窗口。 -->
            <BaseButton
              class="on flex min-h-[30px] items-center gap-[6px] rounded-full px-[13px] py-[6px] text-[11.5px] font-bold disabled:opacity-40"
              :loading="saving"
              :disabled="!ready"
              @click="saveSettings"
              >保存设置</BaseButton
            >
          </div>
        </footer>
      </main>
    </div>
  </PlayerWindowFrame>
</template>

<style scoped>
.settings-section-enter-active,
.settings-section-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.settings-section-enter-from,
.settings-section-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
.settings-calm .settings-section-enter-active,
.settings-calm .settings-section-leave-active {
  transition: none;
}
.settings-calm .settings-section-enter-from,
.settings-calm .settings-section-leave-to {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .settings-section-enter-active,
  .settings-section-leave-active {
    transition: none;
  }
  .settings-section-enter-from,
  .settings-section-leave-to {
    transform: none;
  }
}
</style>
