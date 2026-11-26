<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  toRefs,
  useTemplateRef,
  watch,
} from 'vue'
import { useRoute } from 'vue-router'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { Menu, MenuItem, type MenuOptions } from '@tauri-apps/api/menu'
import BaseButton from '@/components/ui/BaseButton.vue'
import { formatTime } from '@/utils/format'
import {
  animateSourceDesktop,
  animateSourceLyric,
} from '@/services/player/desktop-motion'
import type { SourceAction, SourceSnapshot } from '@/types/prototype'

const route = useRoute()
const root = useTemplateRef<HTMLElement>('root')
const surface = useTemplateRef<HTMLElement>('surface')
const mode = computed(() => String(route.params.mode))
// 响应式状态：小窗只接收原稿快照，不创建另一套播放器或改写原稿卡片。
const state = reactive({
  // 原稿主窗口的曲目、歌词和音量。
  snapshot: {
    track: {
      title: '',
      artist: '',
      album: '',
      cover: '',
      dur: 0,
      q: '',
      glow: '',
    },
    playing: false,
    time: 0,
    volume: 70,
    liked: false,
    lyrics: [],
    lyricIndex: 0,
    motion: true,
    fontSize: 21,
    locked: false,
    index: -1,
    direction: 1,
  } as SourceSnapshot,
})
// 桌面窗口音量气泡：只在本窗拖动音量时短暂显示，不参与跨窗快照同步。
const volTip = reactive({
  // 是否正在显示气泡。
  show: false,
  // 气泡中心相对滑杆左缘的像素位置，跟随 thumb 移动。
  left: '0px',
  // 气泡文案：百分比，音量为 0 时显示「静音」。
  text: '',
})
let volTipTimer: number | undefined
const { snapshot } = toRefs(state)
const track = computed(() => state.snapshot.track)
const previousLyric = computed(
  () => state.snapshot.lyrics[state.snapshot.lyricIndex - 1] || ''
)
const currentLyric = computed(
  () => state.snapshot.lyrics[state.snapshot.lyricIndex] || ''
)
const nextLyric = computed(
  () => state.snapshot.lyrics[state.snapshot.lyricIndex + 1] || ''
)
const progress = computed(
  () =>
    `${track.value.dur ? Math.min(100, (state.snapshot.time / track.value.dur) * 100) : 0}%`
)
let unlisten: UnlistenFn | undefined
let disposed = false
let lastSurfaceSize = ''
let contextMenu: Menu | undefined
let lockMenuItem: MenuItem | undefined
let contextOpening = false

// 菜单只作用于当前桌面卡片，不使用会退出整个应用的全局 Quit 项。
async function openContextMenu(event: MouseEvent): Promise<void> {
  if (!isTauri() || contextOpening) return
  const window = getCurrentWindow()
  if (!['lyrics', 'mini', 'media'].includes(window.label)) return
  contextOpening = true
  try {
    if (!contextMenu) {
      const items: NonNullable<MenuOptions['items']> = [
        {
          id: `${window.label}-open-main`,
          text: '打开主播放器',
          action: () => sendAction('focus'),
        },
      ]
      if (mode.value === 'lyrics') {
        lockMenuItem = await MenuItem.new({
          id: 'lyrics-lock',
          text: '锁定桌面歌词',
          action: () => {
            const locked = !state.snapshot.locked
            state.snapshot = { ...state.snapshot, locked }
            void emitTo('main', 'desktop-lock', locked)
          },
        })
        items.push(lockMenuItem)
      }
      items.push(
        { item: 'Separator' },
        {
          id: `${window.label}-close`,
          text: '关闭小窗',
          action: () => {
            void window.close()
          },
        }
      )
      contextMenu = await Menu.new({ items })
    }
    if (lockMenuItem)
      await lockMenuItem.setText(
        state.snapshot.locked ? '解除歌词锁定' : '锁定桌面歌词'
      )
    await contextMenu.popup(
      new LogicalPosition(event.clientX, event.clientY),
      window
    )
  } catch (error) {
    console.warn('打开桌面卡片菜单失败', error)
  } finally {
    contextOpening = false
  }
}

// 只把卡片的内容高度同步到自身原生窗口，阴影在卡片外，不拉伸内层。
useResizeObserver(
  surface,
  () => {
    if (!isTauri() || !surface.value) return
    // 使用小数边框高度，Rust 向上取整后才不会在高 DPI 下少留一像素。
    const height = surface.value.getBoundingClientRect().height
    const key = `${mode.value}:${height}`
    if (height < 48 || key === lastSurfaceSize) return
    lastSurfaceSize = key
    void invoke('resize_desktop_surface', { contentHeight: height }).catch(
      error => {
        console.warn('调整桌面卡片大小失败', error)
      }
    )
  },
  { box: 'border-box' }
)
useEventListener('keydown', event => {
  if (event.key === 'Escape' && mode.value === 'mini' && isTauri())
    void getCurrentWindow().close()
})

// 原稿小窗操作定向交回主窗口，继续调用原来的播放、切歌与收藏方法。
function sendAction(type: SourceAction['type'], value?: number): void {
  if (isTauri()) void emitTo('main', 'player-action', { type, value })
}
// 原稿进度条点击时换算为歌曲的相对位置。
function seekNative(event: MouseEvent): void {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  sendAction('seek', (event.clientX - bounds.left) / bounds.width)
}
// 原稿音量滑块继续控制主窗口的统一音量，并刷新本窗气泡的位置与文案，停手 1.2 秒后淡出。
function setNativeVolume(event: Event): void {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  sendAction('volume', value)
  const thumb = 14
  const center = thumb / 2 + (input.clientWidth - thumb) * (value / 100)
  volTip.left = `${center}px`
  volTip.text = value === 0 ? '静音' : `${value}%`
  volTip.show = true
  window.clearTimeout(volTipTimer)
  volTipTimer = window.setTimeout(() => {
    volTip.show = false
  }, 1200)
}
// 原稿迷你卡片的打开主窗口入口恢复主窗口并收起当前迷你窗口。
async function focusMain(): Promise<void> {
  sendAction('focus')
  if (isTauri()) await getCurrentWindow().close()
}
watch(
  () => state.snapshot.locked,
  locked => {
    if (isTauri() && mode.value === 'lyrics')
      void invoke('set_desktop_lock', { locked }).catch(error =>
        console.warn('同步桌面歌词锁定失败', error)
      )
  }
)
watch(
  () => state.snapshot,
  async (current, previous) => {
    await nextTick()
    if (!root.value) return
    if (previous.index >= 0 && current.index !== previous.index) {
      animateSourceDesktop(
        root.value,
        current.direction,
        previous.track,
        current.motion
      )
    } else if (current.lyricIndex !== previous.lyricIndex) {
      animateSourceLyric(root.value, current.motion)
    }
  }
)
onMounted(async () => {
  document.documentElement.dataset.desktopSurface = 'true'
  if (!isTauri()) return
  const stop = await listen<SourceSnapshot>('player-snapshot', event => {
    state.snapshot = event.payload
  })
  if (disposed) {
    stop()
    return
  }
  unlisten = stop
  await emitTo('main', 'player-ready')
})
onUnmounted(() => {
  delete document.documentElement.dataset.desktopSurface
  window.clearTimeout(volTipTimer)
  disposed = true
  unlisten?.()
  void contextMenu?.close().catch(() => undefined)
  void lockMenuItem?.close().catch(() => undefined)
  root.value
    ?.getAnimations({ subtree: true })
    .forEach(animation => animation.cancel())
})
</script>

<template>
  <!-- 原稿桌面表面：仅适配为独立原生窗口，内部 DOM、SVG 和类名保持一致。 -->
  <div
    ref="root"
    id="desk"
    class="desk native-desktop border-line relative h-[400px] overflow-hidden rounded-[20px] border text-left"
    @contextmenu.prevent="openContextMenu"
  >
    <div
      v-if="mode === 'lyrics'"
      class="desk-lyr absolute top-[24px] left-[26px] z-[3] w-[min(440px,calc(100%_-_52px))] rounded-[16px] p-[12px_16px_13px] text-white"
      id="deskLyr"
      ref="surface"
    >
      <div
        class="desk-lyr-head mb-[8px] flex cursor-default items-center gap-[8px] text-[10.5px] font-extrabold tracking-[.1em] opacity-[.75] select-none"
        id="deskLyrHead"
        data-tauri-drag-region
      >
        <img src="@/assets/miraiplayer.png" width="18" height="18" class="pointer-events-none" alt="" /><span>桌面歌词 · Mirai Player</span
        ><span
          class="desk-lyr-state ml-auto font-mono text-[10px] tracking-normal"
          id="deskLyrState"
          >{{ snapshot.locked ? '已锁定' : '可拖动' }}</span
        >
      </div>
      <div
        class="desk-lyr-prev"
        data-desk-prev
      >
        {{ previousLyric }}
      </div>
      <div
        class="desk-lyr-cur m-[3px_0] overflow-hidden text-[21px] leading-[1.45] font-extrabold tracking-[.01em] text-ellipsis whitespace-nowrap"
        data-desk-cur
        :style="{ fontSize: `${snapshot.fontSize}px` }"
      >
        {{ currentLyric }}
      </div>
      <div
        class="desk-lyr-next"
        data-desk-next
      >
        {{ nextLyric }}
      </div>
      <div
        class="desk-lyr-prog mt-[9px] h-[3px] overflow-hidden rounded-[99px]"
      >
        <i
          data-desk-prog
          :style="{ width: progress }"
        ></i>
      </div>
      <div
        class="desk-lyr-meta mt-[7px] flex justify-between gap-[10px] font-mono text-[10.5px] opacity-[.55]"
      >
        <span data-desk-title>{{ track.title }}</span><span data-desk-time
          >{{ formatTime(snapshot.time) }} / {{ formatTime(track.dur) }}</span
        >
      </div>
    </div>
    <div
      v-else-if="mode === 'mini'"
      class="tray-pop absolute right-[12px] bottom-[56px] z-[6] w-[324px] max-w-[calc(100%_-_24px)] rounded-[18px] p-[14px] text-white"
      id="trayPop"
      ref="surface"
    >
      <div
        class="tray-pop-head mb-[11px] flex items-center justify-between text-[11px] font-extrabold tracking-[.1em]"
      >
        <span class="flex items-center gap-2"><img src="@/assets/miraiplayer.png" width="18" height="18" alt="" />正在播放 · Mirai Player</span><!-- 页面操作按钮：打开主窗口。 -->
        <BaseButton
          type="button"
          data-desk-open
          @click="focusMain"
          >打开主窗口</BaseButton
        >
      </div>
      <div class="tray-pop-main flex items-center gap-[11px]">
        <img decoding="async" loading="lazy"
          :src="track.cover"
          data-desk-cover
          alt="专辑封面"
        />
        <div class="tray-pop-txt min-w-[0] flex-1">
          <b data-desk-title>{{ track.title }}</b><span data-desk-artist
            >{{ track.artist }} · {{ track.album }}</span
          >
        </div>
        <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          class="heart grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
          data-desk-like
          :class="{ liked: snapshot.liked }"
          :aria-pressed="snapshot.liked"
          :aria-busy="snapshot.favoriteBusy"
          :title="snapshot.favoriteHint"
          @click="sendAction('like')"
          :aria-label="snapshot.liked ? '取消收藏' : '收藏'"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5 5 7.6 5c1.7 0 3.4 1 4.4 2.6C13 6 14.7 5 16.4 5 19 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8z"
            /></svg
        ></BaseButton>
      </div>
      <div
        class="tray-prog m-[12px_0_10px] h-[5px] cursor-pointer overflow-hidden rounded-[99px]"
        data-desk-seekbar
        @click="seekNative"
      >
        <i
          data-desk-prog
          :style="{ width: progress }"
        ></i>
      </div>
      <div class="tray-pop-ctl flex items-center gap-[5px]">
        <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          type="button"
          data-desk-prev-btn
          @click="sendAction('previous')"
          aria-label="上一首"
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg
        ></BaseButton>
        <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          type="button"
          class="tray-play"
          data-desk-play
          @click="sendAction('toggle')"
          aria-label="播放或暂停"
          ><svg
            v-if="snapshot.playing"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect
              x="6"
              y="5"
              width="4"
              height="14"
              rx="1"
            />
            <rect
              x="14"
              y="5"
              width="4"
              height="14"
              rx="1"
            /></svg
          ><svg
            v-else
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5.5v13l11-6.5z" /></svg
        ></BaseButton>
        <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          type="button"
          data-desk-next-btn
          @click="sendAction('next')"
          aria-label="下一首"
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
        ></BaseButton>
        <div class="relative ml-[6px] flex-1">
          <input
            type="range"
            class="vol tray-vol block w-full"
            id="trayVol"
            min="0"
            max="100"
            :value="snapshot.volume"
            @input="setNativeVolume"
            aria-label="音量"
            :style="{ '--p': `${snapshot.volume}%` }"
          />
          <span
            class="vol-tip pointer-events-none absolute bottom-[calc(100%+9px)] z-[7] rounded-[8px] p-[5px_8px] font-mono text-[10.5px] leading-[1] font-bold tracking-[.02em] whitespace-nowrap text-white opacity-[0]"
            :class="{ on: volTip.show }"
            :style="{ left: volTip.left }"
            aria-hidden="true"
            >{{ volTip.text }}</span
          >
        </div>
      </div>
    </div>
    <div
      v-else
      class="desk-smtc absolute top-[26px] right-[22px] z-[3] flex w-[min(368px,calc(100%_-_44px))] items-center gap-[12px] rounded-[16px] p-[12px_14px] text-white"
      id="deskSmtc"
      ref="surface"
    >
      <span
        class="smtc-tag absolute top-[-9px] left-[12px] rounded-[99px] bg-white p-[2px_8px] text-[9px] font-extrabold tracking-[.08em]"
        >系统媒体控制 · SMTC</span
      >
      <img decoding="async" loading="lazy"
        :src="track.cover"
        data-desk-cover
        alt="专辑封面"
      />
      <div class="smtc-txt min-w-[0] flex-1">
        <b data-desk-title>{{ track.title }}</b><span data-desk-artist
          >{{ track.artist }} · {{ track.album }}</span
        >
        <div class="smtc-prog mt-[8px] h-[3px] overflow-hidden rounded-[99px]">
          <i
            data-desk-prog
            :style="{ width: progress }"
          ></i>
        </div>
      </div>
      <div class="smtc-btns flex flex-none items-center gap-[4px]">
        <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          type="button"
          data-desk-prev-btn
          @click="sendAction('previous')"
          aria-label="上一首"
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg></BaseButton
        ><!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          type="button"
          data-desk-play
          @click="sendAction('toggle')"
          aria-label="播放或暂停"
          ><svg
            v-if="snapshot.playing"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect
              x="6"
              y="5"
              width="4"
              height="14"
              rx="1"
            />
            <rect
              x="14"
              y="5"
              width="4"
              height="14"
              rx="1"
            /></svg
          ><svg
            v-else
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5.5v13l11-6.5z" /></svg></BaseButton
        ><!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          type="button"
          data-desk-next-btn
          @click="sendAction('next')"
          aria-label="下一首"
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
        ></BaseButton>
      </div>
    </div>
  </div>
</template>
<style scoped>
:global(html[data-desktop-surface]),
:global(html[data-desktop-surface] body),
:global(html[data-desktop-surface] #app) {
  background: transparent !important;
}
.native-desktop {
  width: 100%;
  height: auto;
  min-height: 0;
  margin: 0;
  padding: 32px;
  border: 0;
  border-radius: 0;
  background: transparent;
  /* 外层只是透明画布，不能继承原稿模拟桌面的大矩形阴影。 */
  box-shadow: none;
}
.native-desktop::before {
  display: none;
}
.native-desktop .desk-lyr,
.native-desktop .tray-pop,
.native-desktop .desk-smtc {
  position: relative;
  inset: auto;
  max-width: 100%;
  height: auto;
  margin: 0;
  /* CSS blur 只处理同一 WebView 内的背景；暗衬底独立遮蔽其他窗口的文字。
     未启用或声称原生桌面磨砂，仍保留原稿暗玻璃渐变和边缘高光。 */
  background: linear-gradient(
    135deg,
    rgba(32, 35, 46, 0.985),
    rgba(14, 16, 24, 0.98)
  );
  border: 1px solid rgba(255, 255, 255, 0.18);
  -webkit-backdrop-filter: blur(22px) saturate(1.25);
  backdrop-filter: blur(22px) saturate(1.25);
}
.native-desktop .desk-lyr {
  width: 440px;
  border-radius: 16px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.native-desktop .tray-pop {
  width: 324px;
  border-radius: 18px;
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.native-desktop .desk-smtc {
  width: 368px;
  border-radius: 16px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
/* 迷你播放器波普点缀：播放键由原稿白底改 pop-pink 平涂底衬配白图标，歌词模式本体不动。 */
.native-desktop .tray-pop-ctl .tray-play {
  background: var(--pop-pink);
  color: #fff;
}
</style>
