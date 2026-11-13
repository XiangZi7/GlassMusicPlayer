<script setup lang="ts">
import { toRefs } from 'vue'
import {
  KeepAlive,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useMutationObserver } from '@vueuse/core'
import { isTauri } from '@tauri-apps/api/core'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerTitlebar from '@/components/player/PlayerTitlebar.vue'
import PlayerSidebar from '@/components/player/PlayerSidebar.vue'
import PlayerNowPlaying from '@/components/player/PlayerNowPlaying.vue'
import PlayerFullscreen from '@/components/player/PlayerFullscreen.vue'
import PlayerBar from '@/components/player/PlayerBar.vue'
import { playerKey, type PlayerController } from '@/composables/usePlayer'
import { usePlayerStore, type PlayerPage } from '@/stores/player'
import { mountSourcePlayer } from '@/services/player/runtime'
import { openDesktop } from '@/services/desktop'
import type { SourceAction, SourceSnapshot } from '@/types/prototype'

const root = useTemplateRef<HTMLElement>('root')
const route = useRoute()
const router = useRouter()
const { state, tracks } = usePlayerStore()
const unlisteners: UnlistenFn[] = []
const player = shallowRef<PlayerController>()
let disposed = false

provide(playerKey, { state, tracks, controller: () => player.value })

// 路由缓存和组件热更新出现新控件时，只补绑定新节点，不重启播放或动画。
useMutationObserver(
  root,
  mutations => {
    const controls =
      '[data-play],[data-nav],[data-stage-toggle],[data-top-search],[data-seek],[data-conn-btn],[data-up-add],[data-banner-play],[data-nav-back],[data-set-toggle],[data-search-input]'
    if (
      mutations.some(change =>
        [...change.addedNodes].some(
          node =>
            node instanceof HTMLElement &&
            (node.matches(controls) || node.querySelector(controls))
        )
      )
    )
      player.value?.bind()
  },
  { childList: true, subtree: true }
)

// 原稿导航统一落到真实路由，保留前进、后退和歌单索引。
function navigate(page: PlayerPage, index: number): void {
  const path = page === 'home' ? '/' : `/${page}`
  const query = ['playlist', 'album', 'artist'].includes(page)
    ? { index: String(index) }
    : {}
  void router.push({ path, query })
}

// 独立窗口只接收主播放器快照，避免出现第二套播放时钟。
function publishSnapshot(snapshot: SourceSnapshot): void {
  if (isTauri()) void emit('player-snapshot', snapshot)
}

// 保留原稿桌面入口，打开对应的 Tauri 独立窗口。
function openSourceDesktop(mode: 'mini' | 'lyr' | 'media'): void {
  void openDesktop(mode === 'lyr' ? 'lyrics' : mode)
}

// 桌面小窗动作回到同一播放器，聚焦动作交给原生窗口。
async function handleAction(action: SourceAction): Promise<void> {
  if (action.type === 'focus' && isTauri()) {
    await getCurrentWindow().show()
    await getCurrentWindow().setFocus()
  } else player.value?.dispatch(action)
}

// 路由视图更新后再测量胶囊、歌词和横幅，防止读取已卸载节点。
async function syncRoute(): Promise<void> {
  const page = (route.meta.playerPage || 'home') as PlayerPage
  const index =
    route.query.index === undefined
      ? state.playlistIdx
      : Math.max(0, Math.min(tracks.length - 1, Number(route.query.index) || 0))
  player.value?.navigate(page, index, true)
  await nextTick()
  player.value?.refresh()
}

watch(() => route.fullPath, syncRoute, { flush: 'post' })

onMounted(async () => {
  if (!root.value) return
  player.value = mountSourcePlayer(root.value, {
    state,
    tracks,
    onNavigate: navigate,
    onStateChange: publishSnapshot,
    onDesktop: openSourceDesktop,
  })
  await syncRoute()
  if (!isTauri()) return
  const callbacks = await Promise.all([
    listen<SourceAction>('player-action', event => {
      void handleAction(event.payload)
    }),
    listen('player-ready', () => {
      if (player.value) publishSnapshot(player.value.getSnapshot())
    }),
  ])
  if (disposed) callbacks.forEach(stop => stop())
  else unlisteners.push(...callbacks)
})

onUnmounted(() => {
  disposed = true
  unlisteners.forEach(stop => stop())
  player.value?.destroy()
})
const { page } = toRefs(state)
</script>

<template>
  <!-- 公共播放器布局：切换页面时保持播放、全屏和桌面窗口连接。 -->
  <div
    ref="root"
    class="native-player h-full w-full"
  >
    <section
      id="colA"
      class="col h-full w-full"
    >
      <div class="glass-win h-full w-full">
        <div
          class="win relative flex h-[660px] flex-col overflow-hidden rounded-[18px] text-left text-white"
          data-player
        >
          <div
            class="win-bg absolute inset-[-50px] z-[0]"
            data-bg
          />
          <div class="win-veil absolute inset-0 z-[1]" />
          <PlayerTitlebar />
          <div
            class="win-body relative z-[3] grid min-h-[0] flex-1 grid-cols-[228px_minmax(0,1fr)_296px]"
          >
            <PlayerSidebar />
            <main
              class="main min-w-[0] overflow-y-auto p-[18px_22px_20px]"
              :class="{ 'show-page': page !== 'home' }"
            >
              <RouterView v-slot="{ Component }"
                ><KeepAlive><component :is="Component" /></KeepAlive
              ></RouterView>
            </main>
            <BaseButton
              class="np-toggle absolute top-[14px] right-[282px] z-[9] grid h-[28px] w-[28px] place-items-center rounded-full p-0 text-white"
              data-np-toggle
              aria-expanded="true"
              aria-label="收起正在播放面板"
              title="收起正在播放面板"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9.5 5.5L16 12l-6.5 6.5" />
              </svg>
            </BaseButton>
            <PlayerNowPlaying />
          </div>
          <PlayerFullscreen />
          <PlayerBar />
        </div>
      </div>
    </section>
  </div>
</template>
