<script setup lang="ts">
import {
  reactive,
  toRefs,
  useTemplateRef,
  watch,
  nextTick,
  onBeforeUnmount,
} from 'vue'
import { useResizeObserver, useEventListener } from '@vueuse/core'
import { artworkColor } from '@/services/player/artwork-color'
import BaseButton from '@/components/ui/BaseButton.vue'
import QueueList from '@/components/player/QueueList.vue'
import LocalWeather from '@/components/player/LocalWeather.vue'
import { usePlayer } from '@/composables/usePlayer'

const player = usePlayer()
const { settings, stage, playing } = toRefs(player.state)
const lyrics = useTemplateRef<HTMLElement>('lyrics')
const fullscreen = useTemplateRef<HTMLElement>('fullscreen')

// 响应式状态
const state = reactive({
  // 原文与译文是否同时显示，仅影响当前全屏页的阅读方式。
  showTranslation: true,
  // 阅读模式将歌词放到舞台中央，不改变播放或全局布局设置。
  reading: false,
})
const { showTranslation, reading } = toRefs(state)

let switchRun = 0
let switchAnimation: Animation | undefined
let requested = { reading: false, showTranslation: true }
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// 退出、切歌或关闭动效时释放本次过渡，旧 Promise 不得恢复旧布局。
function stopLyricsSwitch(commit = false): void {
  switchRun++
  switchAnimation?.cancel()
  switchAnimation = undefined
  if (commit && player.state.stage) Object.assign(state, requested)
  else
    requested = {
      reading: state.reading,
      showTranslation: state.showTranslation,
    }
}

// 离散阅读/译文切换先淡出旧内容再淡入新内容，快速连点以最后意图为准。
async function toggleLyricsView(
  kind: 'reading' | 'showTranslation'
): Promise<void> {
  requested[kind] = !requested[kind]
  const run = ++switchRun
  const element =
    kind === 'reading'
      ? fullscreen.value?.querySelector<HTMLElement>('.fs-main')
      : lyrics.value
  const opacity = element ? Number(getComputedStyle(element).opacity) : 1
  switchAnimation?.cancel()
  switchAnimation = undefined
  const animate =
    element &&
    player.state.stage &&
    player.state.settings.motion &&
    !reducedMotion.matches &&
    element.animate
  if (animate) {
    switchAnimation = element.animate([{ opacity }, { opacity: 0 }], {
      duration: 120,
      easing: 'ease-out',
      fill: 'forwards',
    })
    try {
      await switchAnimation.finished
    } catch {
      /* 下一次切换会取消旧过渡。 */
    }
    if (run !== switchRun || !player.state.stage) return
  }
  Object.assign(state, requested)
  await nextTick()
  if (run !== switchRun) return
  switchAnimation?.cancel()
  if (animate) {
    const entrance = element.animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 180, easing: 'cubic-bezier(.22,1,.36,1)' }
    )
    switchAnimation = entrance
    try {
      await entrance.finished
    } catch {
      /* 关闭或后续切换无需等待本次动画。 */
    }
    if (run === switchRun) {
      entrance.cancel()
      switchAnimation = undefined
    }
  }
}

// 非必要动效随系统偏好即时关闭，保留用户已请求的阅读方式。
useEventListener(reducedMotion, 'change', () => {
  if (reducedMotion.matches) stopLyricsSwitch(true)
})
watch(
  () => [player.state.stage, player.state.settings.motion, player.state.idx],
  () => stopLyricsSwitch(player.state.stage)
)
onBeforeUnmount(() => stopLyricsSwitch())

// 字幕显示、阅读模式和窗口尺寸改变后，重新对齐当前句；浏览期间不抢滚动。
function alignLyrics(): void {
  const viewport = lyrics.value
  if (!player.state.stage || !viewport) return
  viewport.style.setProperty(
    '--lyric-space',
    `${Math.max(12, viewport.clientHeight / 2 - 32)}px`
  )
  player.state._lyrKey = ''
  player.controller()?.render()
}

// 歌词显示方式变化后等待 Vue 完成布局，再交还原有歌词跟随逻辑。
watch(() => [state.showTranslation, state.reading], alignLyrics, {
  flush: 'post',
})
useResizeObserver(lyrics, alignLyrics)

// 在线封面复用频谱的取色缓存；切歌、退出或图片无 CORS 时不沿用上一首颜色。
watch(
  () => [player.state.idx, player.state.stage] as const,
  async ([index, visible], _previous, onCleanup) => {
    const surface = fullscreen.value
    if (!surface) return
    for (const key of ['--amb1', '--amb2', '--amb3'])
      surface.style.removeProperty(key)
    const track = player.tracks[index]
    if (!visible || !track?.catalog) return
    let current = true
    onCleanup(() => {
      current = false
    })
    const color = await artworkColor(track.cover, surface.ownerDocument)
    if (!current || !color || !player.state.stage || player.state.idx !== index)
      return
    const [r, g, b] = color
    const light = color.map(channel =>
      Math.round(channel + (255 - channel) * 0.3)
    )
    const dark = color.map(channel => Math.round(channel * 0.62))
    surface.style.setProperty('--amb1', `rgba(${r},${g},${b},.42)`)
    surface.style.setProperty('--amb2', `rgba(${light.join(',')},.30)`)
    surface.style.setProperty('--amb3', `rgba(${dark.join(',')},.38)`)
  },
  { flush: 'post' }
)
// 原稿粒子参数逐项保留：横坐标、周期、负延迟和直径。
const dust = [
  [6, 21, 3, 3],
  [14, 26, 11, 2],
  [23, 19, 6, 3.5],
  [31, 24, 15, 2],
  [42, 18, 1, 3],
  [50, 27, 19, 2],
  [58, 22, 8, 3],
  [67, 20, 13, 2.5],
  [76, 25, 4, 3],
  [85, 19, 17, 2],
]
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <div
    ref="fullscreen"
    :class="{
      'fs-reading': reading,
      'fs-no-translation': !showTranslation,
      'fs-paused': !playing,
      'fs-calm': !settings.motion,
    }"
    class="fs absolute inset-0 z-[30] hidden flex-col overflow-hidden"
    data-fs
    aria-label="全屏播放页"
  >
    <div
      class="fs-bg"
      data-fs-bg
    ></div>
    <div
      class="fs-amb"
      aria-hidden="true"
    >
      <i class="amb a1" /><i class="amb a2" /><i class="amb a3" />
    </div>
    <div class="fs-shade absolute inset-0 z-[1]"></div>
    <div
      class="fs-grain"
      aria-hidden="true"
    />
    <div
      class="fs-dust"
      aria-hidden="true"
    >
      <i
        v-for="(particle, index) in dust"
        :key="index"
        :style="{
          '--dx': particle[0] + '%',
          '--dd': particle[1] + 's',
          '--dl': '-' + particle[2] + 's',
          '--ds': particle[3] + 'px',
        }"
      />
    </div>
    <div
      class="fs-top relative z-[3] flex items-center justify-between p-[16px_20px_2px]"
      data-tauri-drag-region
    >
      <div
        class="fs-topleft flex min-w-[0] items-center gap-[12px]"
        data-tauri-drag-region
      >
        <BaseButton
          class="fs-topbtn grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-white"
          data-stage-toggle
          aria-label="关闭全屏播放"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          >
            <path d="M6 9l6 6 6-6" /></svg></BaseButton
        ><span
          class="fs-specmono overflow-hidden font-mono text-[10.5px] font-bold tracking-[.1em] text-ellipsis whitespace-nowrap opacity-[.6]"
          data-fs-spec
          data-tauri-drag-region
          ></span
        >
      </div>
      <span
        class="fs-toptitle text-[11px] font-extrabold tracking-[.16em] opacity-[.65]"
        data-tauri-drag-region
        >正在播放 · NOW PLAYING</span
      >
      <div
        class="fs-topright flex flex-none items-center gap-[8px]"
        data-tauri-drag-region
      >
        <LocalWeather
          :enabled="settings.weather && stage"
          variant="fullscreen"
        />
        <BaseButton
          class="fs-topbtn grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-white"
          data-fsq-toggle
          aria-label="播放队列"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M4 7h13M4 12h13M4 17h9" />
            <circle
              cx="20"
              cy="17"
              r="2.2"
              fill="currentColor"
              stroke="none"
            /></svg
        ></BaseButton>
      </div>
    </div>
    <div
      class="fs-giant pointer-events-none absolute top-[9%] left-[-12px] z-[1] text-[clamp(96px,13.5vw,172px)] leading-[1] font-extrabold tracking-[-.02em] whitespace-nowrap text-transparent opacity-[.5]"
      data-fs-giant
      aria-hidden="true"
    ></div>
    <div
      class="fs-side pointer-events-none absolute top-[50%] left-[16px] z-[3] text-[10px] font-extrabold tracking-[.34em] whitespace-nowrap opacity-[.5]"
      aria-hidden="true"
    >
      NOW PLAYING — AURA PLAYER
    </div>
    <div
      class="fs-main relative z-[3] flex min-h-[0] flex-1 items-center p-[6px_46px_4px_58px]"
    >
      <div class="fs-coverwrap relative w-[min(328px,100%)]">
        <div class="fs-coverkb relative">
          <img
            class="fs-cover"
            data-cover
            alt="专辑封面"
          />
        </div>
        <img
          class="fs-reflect mt-[8px] block h-[46px] w-full rounded-[22px] object-cover opacity-[.26]"
          data-cover
          alt=""
          aria-hidden="true"
        />
        <div
          class="fs-sheen"
          aria-hidden="true"
        >
          <i />
        </div>
      </div>
      <div
        class="fs-titleblock pointer-events-none relative z-[4] ml-[-58px] max-w-[400px] min-w-[0]"
      >
        <div
          class="fs-kicker overflow-hidden font-mono text-[10.5px] font-bold tracking-[.14em] text-ellipsis whitespace-nowrap opacity-[.62]"
          data-fs-spec
        ></div>
        <h4 data-title></h4>
        <p data-artist></p>
        <div
          class="fs-titleactions pointer-events-auto mt-[14px] flex items-center gap-[6px]"
        >
          <BaseButton
            class="heart grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-like
            aria-label="收藏"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5 5 7.6 5c1.7 0 3.4 1 4.4 2.6C13 6 14.7 5 16.4 5 19 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8z"
              /></svg></BaseButton
          ><span>收藏到音乐库</span>
        </div>
      </div>
      <div class="fs-lyrcol">
        <div
          class="fs-lyrhead mb-[6px] flex flex-none items-center justify-between gap-[10px] p-[0_2px_10px]"
        >
          <span>歌词 · LYRICS</span>
          <!-- 歌词工具区：按需显示译文、切换阅读模式和恢复当前句。 -->
          <div class="fs-lyrtools flex min-w-0 items-center gap-[4px]">
            <BaseButton
              class="fs-lyrreturn fs-tool min-h-[30px] rounded-full px-[9px] text-[11px] font-semibold"
              data-lyrreturn
              hidden
              title="回到当前播放的歌词"
              >回到当前</BaseButton
            >
            <BaseButton
              class="fs-tool grid size-[30px] flex-none place-items-center rounded-[9px] text-[11px] font-bold"
              :aria-pressed="showTranslation"
              aria-label="显示译文"
              :title="showTranslation ? '隐藏译文' : '显示译文'"
              @click="toggleLyricsView('showTranslation')"
              >译</BaseButton
            >
            <BaseButton
              class="fs-tool grid size-[30px] flex-none place-items-center rounded-[9px]"
              :aria-pressed="reading"
              aria-label="歌词阅读模式"
              :title="reading ? '返回封面与歌词' : '专注阅读歌词'"
              @click="toggleLyricsView('reading')"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M12 5.5c-2.7-1.6-5.6-1.7-9-.5v14c3.4-1.2 6.3-1.1 9 .5 2.7-1.6 5.6-1.7 9-.5V5c-3.4-1.2-6.3-1.1-9 .5Z"
                />
                <path d="M12 5.5v14" /></svg
            ></BaseButton>
          </div>
        </div>
        <div
          class="fs-lyrics mt-[16px] min-h-[0] flex-1 overflow-y-auto p-[4px_6px_4px_0]"
          data-fs-lyrics
          ref="lyrics"
          role="region"
          aria-label="同步歌词，可用上下方向键浏览，回车跳到选中句"
        ></div>
        <BaseButton
          class="fs-lyrseek pointer-events-none absolute top-[50%] left-[12px] z-[6] flex cursor-pointer items-center gap-[9px] rounded-full p-[7px_12px_7px_11px] text-white opacity-[0]"
          data-lyrseek
          aria-label="跳到定位的这句歌词"
          ><span
            class="fs-lyrseek-t font-mono text-[12px] leading-[1] font-bold"
            data-lyrseek-t
            >0:00</span
          ><span
            class="fs-lyrseek-go text-[11.5px] leading-[1] font-extrabold whitespace-nowrap opacity-[.85]"
            >▶ 跳到这句</span
          ></BaseButton
        >
      </div>
      <div
        class="fs-index pointer-events-none absolute right-[30px] bottom-[8px] z-[2] text-[64px] leading-[1] font-extrabold tracking-[-.02em] text-transparent opacity-[.55]"
        data-fsnum
        aria-hidden="true"
      ></div>
    </div>
    <div
      class="fs-dock relative z-[3] m-[0_auto_20px] flex w-[min(880px,calc(100%_-_48px))] flex-none flex-col gap-[9px] rounded-[28px] p-[13px_20px_12px]"
    >
      <div
        class="fs-dock-top flex items-center gap-[12px] font-mono text-[11px]"
      >
        <span
          class="dock-time w-[38px] flex-none"
          data-cur
          >0:00</span
        ><input
          type="range"
          data-seek
          min="0"
          max="1000"
          value="0"
          aria-label="播放进度"
        /><span
          class="dock-time rem w-[38px] flex-none"
          data-remain
          >-0:00</span
        >
      </div>
      <div class="fs-dock-main flex items-center gap-[14px]">
        <div class="dock-left flex min-w-[0] flex-1 items-center gap-[11px]">
          <img
            class="dock-cover h-[44px] w-[44px] flex-none rounded-[10px] object-cover"
            data-cover
            alt="专辑封面"
          />
          <div class="dock-meta min-w-[0]">
            <b data-title></b><span data-artist></span>
          </div>
          <BaseButton
            class="heart grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-like
            aria-label="收藏"
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
          class="fs-controls dock-controls m-0 flex flex-none items-center justify-center gap-[10px]"
        >
          <BaseButton
            class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-shuffle
            aria-label="随机播放"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg
          ></BaseButton>
          <BaseButton
            class="ctl grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-prev
            aria-label="上一首"
            ><svg
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg
          ></BaseButton>
          <BaseButton
            class="playbtn relative grid h-[48px] w-[48px] flex-none place-items-center rounded-full border-none"
            data-play
            aria-label="播放或暂停"
          ></BaseButton>
          <BaseButton
            class="ctl grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-next
            aria-label="下一首"
            ><svg
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
          ></BaseButton>
          <BaseButton
            class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-repeat
            aria-label="循环播放"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 01-4 4H3" /></svg
          ></BaseButton>
        </div>

        <div
          class="dock-right flex min-w-[0] flex-1 items-center justify-end gap-[9px]"
        >
          <div
            class="dock-nextwrap flex max-w-[134px] min-w-[0] flex-none flex-col items-start gap-[4px]"
          >
            <div
              class="dock-next flex max-w-[118px] min-w-[0] flex-col gap-[1px]"
            >
              <span>下一首</span><b data-next-title></b>
            </div>
            <span
              class="quality-badge rounded-full p-[5px_8px] font-mono text-[9.5px] leading-[1] font-bold tracking-[.05em] whitespace-nowrap"
              data-meta1
              ></span
            >
          </div>
          <BaseButton
            class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-fsq-toggle
            aria-label="播放队列"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M4 7h13M4 12h13M4 17h9" />
              <circle
                cx="20"
                cy="17"
                r="2.2"
                fill="currentColor"
                stroke="none"
              /></svg></BaseButton
          ><BaseButton
            class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            disabled
            aria-label="输出设备：系统默认"
            title="输出设备 · 系统默认"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="12"
                rx="2"
              />
              <path d="M8 20h8M12 16v4" /></svg
          ></BaseButton>
          <div
            class="fs-vol flex flex-none items-center gap-[8px] opacity-[.9]"
          >
            <BaseButton
              class="volbtn"
              data-volbtn
              aria-label="音量 70% — 点击静音"
              title="音量 70% — 点击静音"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M11 5L6 9H3v6h3l5 4z" />
                <path d="M15.5 8.5a5 5 0 010 7" />
                <path d="M18.6 5.4a9.5 9.5 0 010 13.2" /></svg></BaseButton
            ><input
              type="range"
              class="vol"
              min="0"
              max="100"
              value="70"
              aria-label="音量"
              style="--p: 70%"
            />
          </div>
        </div>
      </div>
    </div>
    <div
      class="fs-queue absolute top-[66px] right-[16px] z-[4] hidden max-h-[calc(100%_-_86px)] w-[302px] max-w-[calc(100%_-_32px)] overflow-y-auto rounded-[18px] p-[12px]"
    >
      <div
        class="fs-queue-head m-[2px_4px_10px] flex items-center justify-between text-[12px] font-extrabold tracking-[.1em]"
      >
        <span>播放队列 · QUEUE</span
        ><span
          class="q-radio-chip rounded-full p-[3px_8px] text-[9.5px] font-extrabold tracking-[.06em] whitespace-nowrap text-white"
          data-radio-chip
          hidden
          >电台续播中</span
        ><BaseButton
          class="fs-topbtn grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-white"
          data-fsq-toggle
          aria-label="关闭队列"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" /></svg
        ></BaseButton>
      </div>
      <QueueList fullscreen />
    </div>
  </div>
</template>

<style scoped>
/* 歌词工具只在需要时突出，避免和当前歌词竞争注意力。 */
.fs-tool {
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: rgb(255 255 255 / 0.58);
  transition:
    background-color 150ms ease,
    color 150ms ease;
}
.fs-tool svg {
  width: 16px;
  height: 16px;
}
.fs-tool:hover,
.fs-tool[aria-pressed='true'] {
  background: rgb(255 255 255 / 0.09);
  color: rgb(255 255 255 / 0.92);
}
.fs-tool:focus-visible,
.fs :deep(button:focus-visible) {
  outline: 2px solid rgb(255 255 255 / 0.78);
  outline-offset: 3px;
}
.fs-lyrreturn {
  border-color: rgb(255 255 255 / 0.14);
}
.fs-lyrhead {
  flex-wrap: wrap;
}
.fs-lyrhead > span {
  letter-spacing: 0.1em;
}

/* 行高保持稳定，强调通过透明度与轻微缩放完成，不逐句动画字号。 */
.fs .fs-main :deep(.fl-line) {
  display: block;
  width: 100%;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  font-size: 17px;
  line-height: 1.5;
  opacity: 0.34;
  filter: blur(0.45px);
  transform: scale(0.97);
  transform-origin: left center;
  transition:
    opacity 240ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}
.fs .fs-main :deep(.fl-line .fl-o) {
  font-size: clamp(17px, 1.4vw, 20px);
  line-height: 1.5;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}
.fs .fs-main :deep(.fl-line .fl-tr) {
  font-size: 12px;
  line-height: 1.5;
  margin-top: 5px;
  overflow-wrap: anywhere;
}
.fs .fs-main :deep(.fl-line.d1) {
  opacity: 0.62;
  filter: none;
}
.fs .fs-main :deep(.fl-line.on) {
  opacity: 1;
  filter: none;
  transform: scale(1.04);
}
.fs .fs-main :deep(.fl-line.on .fl-o) {
  font-size: clamp(17px, 1.4vw, 20px);
  line-height: 1.5;
}
.fs .fs-main :deep(.fl-line:hover),
.fs .fs-main :deep(.fl-line.focus),
.fs .fs-main :deep(.fl-line:focus-visible) {
  filter: none;
  opacity: 0.95;
  background: rgb(255 255 255 / 0.055);
}
.fs .fs-main :deep(.fl-line:focus-visible) {
  outline-offset: -2px;
  transition: none;
}
.fs-no-translation :deep(.fl-tr) {
  display: none;
}
.fs .fs-main .fs-lyrics {
  position: relative;
  padding-top: var(--lyric-space, 12px);
  padding-bottom: var(--lyric-space, 12px);
  overscroll-behavior: contain;
  touch-action: pan-y;
}
.fs .fs-main .fs-lyrics.keyboard-browsing {
  scroll-behavior: auto;
}
.fs-paused .amb,
.fs-paused .fs-giant {
  animation-play-state: paused;
}
.fs .dock-time {
  font-variant-numeric: tabular-nums;
}

/* 阅读模式直接切换空间布局，不用长过渡拖慢高频操作。 */
.fs-reading .fs-main {
  justify-content: center;
}
.fs-reading .fs-main .fs-coverwrap,
.fs-reading .fs-titleblock {
  display: none;
}
.fs-reading .fs-main .fs-lyrcol {
  width: min(640px, 100%);
  max-height: none;
  margin: 0;
  padding-left: 0;
  border-left: 0;
  align-self: stretch;
}
.fs-reading .fs-giant {
  opacity: 0.16;
}
.fs-reading .fs-index,
.fs-reading .fs-side {
  opacity: 0.16;
}
.fs-reading .fs-main :deep(.fl-line) {
  filter: none;
  opacity: 0.54;
  padding: 12px 16px;
}
.fs-reading .fs-main :deep(.fl-line.on) {
  opacity: 1;
}
.fs-reading .fs-main :deep(.fl-line .fl-o),
.fs-reading .fs-main :deep(.fl-line.on .fl-o) {
  font-size: clamp(20px, 2vw, 28px);
}
.fs-reading .fs-main :deep(.fl-line .fl-tr) {
  font-size: 14px;
}
.fs-reading .fs-main .fs-lyrics {
  padding-top: var(--lyric-space, 14px);
  padding-bottom: var(--lyric-space, 14px);
}

@media (prefers-reduced-motion: reduce) {
  .fs-tool,
  .fs .fs-main :deep(.fl-line) {
    transition: none;
  }
  .fs .fs-main :deep(.fl-line),
  .fs .fs-main :deep(.fl-line.on),
  .fs .fs-main :deep(.fl-line.d1) {
    transform: none;
    filter: none;
  }
  .fs .fs-main .fs-lyrics {
    scroll-behavior: auto;
  }
}
.fs.fs-calm .fs-main :deep(.fl-line),
.fs.fs-calm .fs-main :deep(.fl-line.on),
.fs.fs-calm .fs-main :deep(.fl-line.d1) {
  transition: none;
  transform: none;
  filter: none;
}
.fs.fs-calm .fs-main .fs-lyrics {
  scroll-behavior: auto;
}
</style>
