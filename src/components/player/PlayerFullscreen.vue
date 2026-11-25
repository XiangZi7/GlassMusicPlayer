<script setup lang="ts">
import {
  computed,
  reactive,
  toRefs,
  useTemplateRef,
  watch,
  nextTick,
  onBeforeUnmount,
} from 'vue'
import {
  useResizeObserver,
  useEventListener,
  useLocalStorage,
} from '@vueuse/core'
import { artworkColor } from '@/services/player/artwork-color'
import { defaultCover } from '@/constants/music'
import BaseButton from '@/components/ui/BaseButton.vue'
import SlidingTabs from '@/components/ui/SlidingTabs.vue'
import PlayerPlayButton from '@/components/player/PlayerPlayButton.vue'
import FullscreenScenery from '@/components/player/FullscreenScenery.vue'
import QueueList from '@/components/player/QueueList.vue'
import LocalWeather from '@/components/player/LocalWeather.vue'
import { usePlayer } from '@/composables/usePlayer'

const player = usePlayer()
const { settings, stage, playing, fsQ } = toRefs(player.state)
const lyrics = useTemplateRef<HTMLElement>('lyrics')
const fullscreen = useTemplateRef<HTMLElement>('fullscreen')
const themes = [
  { value: 'magazine', label: '时尚' },
  { value: 'ink', label: '手书' },
  { value: 'cinema', label: '字幕' },
  { value: 'chat', label: '对话' },
] as const
type LyricsTheme = (typeof themes)[number]['value']
const savedTheme = useLocalStorage<string>('miraiMusic.lyricTheme', themes[0].value)

// 响应式状态
const state = reactive({
  // 原文与译文是否同时显示，仅影响当前全屏页的阅读方式。
  showTranslation: true,
  // 阅读模式将歌词放到舞台中央，不改变播放或全局布局设置。
  reading: false,
  // 全屏歌词的样式，跨会话保留。
  theme:
    themes.find(option => option.value === savedTheme.value)?.value ?? themes[0].value,
})
const { showTranslation, reading, theme } = toRefs(state)
// 对话主题用当前曲目封面作为来信头像，切歌时同步替换。
const chatCover = computed(() => {
  const cover = player.tracks[player.state.idx]?.cover
  return state.theme === 'chat' && cover
    ? `url("${CSS.escape(cover)}")`
    : 'none'
})

// 全屏封面兜底状态：只服务背景视觉判定，不参与播放与舞台逻辑。
const art = reactive({
  /** 当前曲目的封面图是否加载失败（模板内封面图 error 时置位，切歌时复位）。 */
  failed: false,
})
// 无封面判定：封面为空、仍是默认占位图，或真实封面加载失败——此时舞台背景改用波普舞台插画。
const noCover = computed(() => {
  const cover = player.tracks[player.state.idx]?.cover
  return !cover || cover === defaultCover || art.failed
})
// 切歌时复位失败标记，避免上一首的坏封面让新曲目误入兜底背景。
watch(
  () => player.state.idx,
  () => {
    art.failed = false
  }
)
// 封面图加载失败时记录失败状态，背景随即切换到波普舞台插画。
function markCoverFailed(): void {
  art.failed = true
}

let switchRun = 0
let switchAnimations: Animation[] = []
let requested = { ...state }
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// 退出、切歌或关闭动效时释放本次过渡，旧 Promise 不得恢复旧布局。
function stopLyricsSwitch(commit = false): void {
  switchRun++
  switchAnimations.forEach(animation => animation.cancel())
  switchAnimations = []
  if (commit && player.state.stage) Object.assign(state, requested)
  else requested = { ...state }
}

// 阅读、译文和主题共用一次可打断的淡入淡出，最后一次操作生效。
async function applyLyricsView(
  patch: Partial<typeof state>,
  affectsLayout: boolean
): Promise<void> {
  Object.assign(requested, patch)
  const run = ++switchRun
  const scene =
    affectsLayout ||
    switchAnimations.some(animation =>
      (animation.effect as KeyframeEffect)?.target?.matches('.fs-main')
    )
  const selector = scene
    ? '.fs-main, .fs-giant, .fs-side, .fs-scenery'
    : '.fs-lyrics'
  const elements = [
    ...(fullscreen.value?.querySelectorAll<HTMLElement>(selector) ?? []),
  ]
  const animate =
    player.state.stage && player.state.settings.motion && !reducedMotion.matches
  // 先记录可见层的实际透明度，再取消旧动画，连续点击时从眼前的画面接续。
  const outgoing = elements
    .filter(el => el.getClientRects().length)
    .map(el => ({
      el,
      opacity: getComputedStyle(el).opacity,
    }))
  switchAnimations.forEach(animation => animation.cancel())
  switchAnimations = []
  if (animate) {
    switchAnimations = outgoing.map(({ el, opacity }) =>
      el.animate([{ opacity }, { opacity: 0 }], {
        duration: 170,
        easing: 'ease-in',
        fill: 'both',
      })
    )
    await Promise.allSettled(
      switchAnimations.map(animation => animation.finished)
    )
    if (run !== switchRun || !player.state.stage) return
  }
  Object.assign(state, requested)
  await nextTick()
  if (run !== switchRun) return
  switchAnimations.forEach(animation => animation.cancel())
  switchAnimations = []
  if (animate) {
    switchAnimations = elements
      .filter(el => el.getClientRects().length)
      .map(el => {
        const opacity = getComputedStyle(el).opacity
        const frames = el.matches('.fs-main')
          ? [
              { opacity: 0, transform: 'translateY(10px)' },
              { opacity, transform: 'none' },
            ]
          : [{ opacity: 0 }, { opacity }]
        return el.animate(frames, {
          duration: scene ? 330 : 200,
          easing: 'cubic-bezier(.22,1,.36,1)',
          fill: 'both',
        })
      })
    await Promise.allSettled(
      switchAnimations.map(animation => animation.finished)
    )
    if (run === switchRun) {
      switchAnimations.forEach(animation => animation.cancel())
      switchAnimations = []
    }
  }
}

// 阅读与译文沿用原来的两个独立开关。
function toggleLyricsView(kind: 'reading' | 'showTranslation'): void {
  void applyLyricsView({ [kind]: !requested[kind] }, kind === 'reading')
}

// 点击舞台胶囊切换主题，旧画面淡出后再提交排版和偏好。
function selectLyricsTheme(value: string): void {
  const selected = themes.find(option => option.value === value)
  if (selected && selected.value !== requested.theme)
    void applyLyricsView({ theme: selected.value }, true)
}

// 在主题胶囊中即时移动键盘焦点，回车或空格沿用按钮的选择行为。
function focusTheme(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const buttons = [
    ...(event.currentTarget as HTMLElement).querySelectorAll('button'),
  ]
  const current = buttons.indexOf(event.target as HTMLButtonElement)
  if (current < 0) return
  event.preventDefault()
  event.stopPropagation()
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (current + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) %
          buttons.length
  buttons[next]?.focus()
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
watch(() => [state.showTranslation, state.reading, state.theme], alignLyrics, {
  flush: 'post',
})
// 首次挂载也写回有效主题，将旧版微光偏好迁移到时尚。
watch(theme, (value: LyricsTheme) => {
  savedTheme.value = value
}, { immediate: true })
useResizeObserver(lyrics, alignLyrics)
// 本地手书字体加载后行宽可能改变，重新居中当前唱句。
useEventListener(document.fonts, 'loadingdone', () => {
  if (state.theme === 'ink') alignLyrics()
})

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
    :data-lyric-theme="theme"
    :style="{ '--chat-cover': chatCover }"
    :class="{
      'fs-reading': reading,
      'fs-no-translation': !showTranslation,
      'fs-paused': !playing,
      'fs-calm': !settings.motion,
      'fs-nocover': noCover,
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
    <FullscreenScenery
      :theme="theme"
      :moving="
        stage &&
        settings.motion &&
        (playing || theme === 'ink' || theme === 'chat')
      "
    />
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
        ></span>
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
        <!-- 译文与阅读操作收进顶栏，歌词列留给对话与定位。 -->
        <BaseButton
          class="fs-tool grid size-[30px] flex-none place-items-center rounded-[9px]"
          :aria-pressed="showTranslation"
          aria-label="显示译文"
          :title="showTranslation ? '隐藏译文' : '显示译文'"
          @click="toggleLyricsView('showTranslation')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M3 5h12M9 3v2M5 8c1 4 4.1 7.4 8 9m0-12c-.7 5.8-4.2 9.9-9 12m10 4 4-9 4 9m-6.5-3h5"
            />
          </svg>
        </BaseButton>
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
        <LocalWeather
          :enabled="settings.weather && stage"
          :motion="settings.motion"
          variant="fullscreen"
        />
        <BaseButton
          class="fs-topbtn grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-white"
          data-fsq-toggle
          aria-label="播放队列"
          :aria-expanded="fsQ"
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
      class="fs-themebar relative z-[3] flex flex-none justify-center px-5 pt-[10px] max-sm:pt-[7px]"
    >
      <SlidingTabs
        class="set-seg fs-theme-seg flex flex-none"
        role="group"
        aria-label="全屏舞台主题"
        kind="segment"
        :model-value="theme"
        :options="themes"
        @update:model-value="selectLyricsTheme"
        @keydown="focusTheme"
      />
    </div>
    <div
      class="fs-giant pointer-events-none absolute top-[9%] left-[-12px] z-[1] text-[clamp(96px,13.5vw,172px)] leading-[1] font-extrabold tracking-[-.02em] whitespace-nowrap text-transparent opacity-[.29]"
      data-fs-giant
      aria-hidden="true"
    ></div>
    <div
      class="fs-side pointer-events-none absolute top-[50%] left-[16px] z-[3] text-[10px] font-extrabold tracking-[.34em] whitespace-nowrap opacity-[.5]"
      aria-hidden="true"
    >
      NOW PLAYING — MiraiPlayer
    </div>
    <div
      class="fs-main relative z-[3] flex min-h-[0] flex-1 items-center p-[6px_46px_4px_58px]"
    >
      <!-- 封面、倒影、曲目信息和收藏操作共用浮动层，内层继续负责入场与切歌。 -->
      <div
        class="fs-artwork flex min-w-0 items-center"
        :class="{ 'fs-artwork-floating': stage && settings.motion && !reading }"
      >
        <div class="fs-coverwrap relative w-[min(328px,100%)]">
          <div class="fs-coverkb relative">
            <img
              decoding="async"
              loading="lazy"
              class="fs-cover"
              data-cover
              alt="专辑封面"
              @error="markCoverFailed"
            />
            <div
              class="fs-reflect"
              aria-hidden="true"
            >
              <img
                decoding="async"
                loading="lazy"
                data-cover
                alt=""
                @error="markCoverFailed"
              />
            </div>
          </div>
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
          <small class="track-subtitle" data-track-subtitle hidden></small>
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
      </div>
      <div class="fs-lyrcol">
        <BaseButton
          class="fs-lyrreturn fs-tool absolute top-1 right-2 z-[3] min-h-[30px] rounded-full px-[9px] text-[11px] font-semibold"
          data-lyrreturn
          hidden
          title="回到当前播放的歌词"
          >回到当前</BaseButton
        >
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
        class="fs-index pointer-events-none absolute right-[30px] bottom-[8px] z-[2] text-[64px] leading-[1] font-extrabold tracking-[-.02em] text-transparent opacity-[.24]"
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
            decoding="async"
            loading="lazy"
            class="dock-cover h-[44px] w-[44px] flex-none rounded-[10px] object-cover"
            data-cover
            alt="专辑封面"
            @error="markCoverFailed"
          />
          <div class="dock-meta min-w-[0]">
            <b data-title></b><span data-artist></span>
            <small class="track-subtitle" data-track-subtitle hidden></small>
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
          <PlayerPlayButton
            class="playbtn relative grid h-[48px] w-[48px] flex-none place-items-center rounded-full border-none"
          />
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
            ></span>
          </div>
          <BaseButton
            class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-fsq-toggle
            :aria-expanded="fsQ"
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
      class="fs-queue absolute top-[66px] right-[16px] z-[4] flex max-h-[calc(100%_-_86px)] w-[302px] max-w-[calc(100%_-_32px)] flex-col rounded-[18px] p-[12px]"
      :inert="!fsQ"
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
      <QueueList
        v-if="stage"
        :show-current="fsQ"
        compact
      />
    </div>
  </div>
</template>

<style scoped>
@font-face {
  font-family: 'Ma Shan Zheng';
  src: url('/fonts/ma-shan-zheng.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

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
.fs.fs-calm .fs-theme-seg :deep(.tab-pill) {
  transition: none;
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
  padding: clamp(9px, 1.3vh, 14px) 12px;
  opacity: 0.25;
  filter: blur(0.75px);
  transform: scale(0.98);
  transform-origin: left center;
  transition:
    opacity 240ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}
.fs .fs-main :deep(.fl-line .fl-o) {
  font-size: clamp(21px, 3vw, 42px);
  font-weight: 800;
  line-height: 1.24;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}
.fs .fs-main :deep(.fl-line .fl-tr) {
  font-size: clamp(12px, 1.2vw, 16px);
  line-height: 1.4;
  margin-top: 6px;
  overflow-wrap: anywhere;
}
.fs .fs-main :deep(.fl-line.d1) {
  opacity: 0.46;
  filter: blur(0.25px);
}
.fs .fs-main :deep(.fl-line.on) {
  color: #fff;
  opacity: 1;
  filter: none;
  transform: none;
}
.fs .fs-main :deep(.fl-line.on .fl-o) {
  text-shadow: 0 3px 22px rgb(255 255 255 / 14%);
}
.fs .fs-main :deep(.fl-line.on .fl-tr) {
  opacity: 1;
}
.fs .fs-main :deep(.fl-timed) {
  white-space: break-spaces;
}
.fs .fs-main :deep(.fl-line.on .fl-word) {
  background: linear-gradient(
    to right,
    #fff 0 var(--sung, 0%),
    var(--lyric-unsung, rgb(255 255 255 / 48%)) var(--sung, 0%) 100%
  );
  background-clip: text;
  color: transparent;
  text-shadow: none;
}
.fs .fs-main :deep(.fl-line:hover),
.fs .fs-main :deep(.fl-line.focus),
.fs .fs-main :deep(.fl-line:focus-visible) {
  filter: none;
  background: rgb(255 255 255 / 0.055);
}
.fs .fs-main :deep(.fl-line:not(.on):is(:hover, .focus, :focus-visible)) {
  opacity: 0.95;
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
  padding-block: 0;
  overscroll-behavior: contain;
  touch-action: pan-y;
  mask-image: linear-gradient(
    180deg,
    transparent,
    #000 17%,
    #000 80%,
    transparent
  );
}
/* 把首尾留白放进可滚动内容，缩窗时留白随视口缩小。 */
.fs-lyrics::before,
.fs-lyrics::after {
  content: '';
  display: block;
  height: var(--lyric-space, 12px);
}
.fs .fs-main .fs-lyrics.keyboard-browsing {
  scroll-behavior: auto;
}
.fs-lyrics:has(> .fl-group) {
  overflow-anchor: none;
}
.fs-paused .amb,
.fs-paused .fs-giant {
  animation-play-state: paused;
}
.fs .dock-time {
  font-variant-numeric: tabular-nums;
}

.fs-artwork {
  --artwork-lift: min(15px, 1.8vh);
}

/* 紧凑版沿用舞台的封面列和文字列，歌词继续独占下一行。 */
:where(.fs[data-lyric-theme='cinema']) .fs-artwork {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  --artwork-lift: 5px;
}

@media (max-width: 640px) {
  .fs-artwork {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    --artwork-lift: 6px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .fs-artwork-floating {
    animation: artwork-float 28s ease infinite;
  }
}

@keyframes artwork-float {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(calc(var(--artwork-lift) * -0.67)); }
  50% { transform: translateY(calc(var(--artwork-lift) * 0.27)); }
  70% { transform: translateY(calc(var(--artwork-lift) * -1)); }
}

/* 阅读模式直接切换空间布局，不用长过渡拖慢高频操作。 */
.fs-reading .fs-main {
  justify-content: center;
}
.fs-reading .fs-artwork {
  display: none;
}
.fs-reading .fs-main .fs-lyrcol {
  flex: 0 1 720px;
  max-height: none;
  margin: 0;
  padding-inline-start: 0;
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
  opacity: 0.46;
  padding: 12px 16px;
}
.fs-reading .fs-main :deep(.fl-line.on) {
  opacity: 1;
}
.fs-reading .fs-main :deep(.fl-line .fl-o) {
  font-size: clamp(24px, 3.3vw, 48px);
}
.fs-reading .fs-main :deep(.fl-line .fl-tr) {
  font-size: 14px;
}
.fs .fs-main .lyrics-unavailable :deep(.fl-line .fl-o) {
  font-size: 15px;
  font-weight: 600;
  color: rgb(255 255 255 / 58%);
  text-shadow: none;
}

/* 手书用暖色笔画和较大的行距，字幕把唱词放到舞台中央。 */
.fs[data-lyric-theme='ink'] {
  --lyric-unsung: rgb(255 228 200 / 46%);
}
.fs[data-lyric-theme='ink'] .fs-lyrics:not(.lyrics-unavailable) :deep(.fl-o) {
  font-family: 'Ma Shan Zheng', 'KaiTi', 'Segoe Print', sans-serif;
  font-weight: 400;
  line-height: 1.38;
  letter-spacing: 0.015em;
}
.fs[data-lyric-theme='ink']
  .fs-lyrics:not(.lyrics-unavailable)
  :deep(.fl-line:nth-child(even)) {
  width: calc(100% - 22px);
  margin-left: 22px;
}
.fs[data-lyric-theme='ink'] :deep(.fl-line.on .fl-o) {
  position: relative;
}
.fs[data-lyric-theme='ink'] :deep(.fl-line.on .fl-o::after) {
  content: '';
  display: block;
  height: 2px;
  margin-top: 4px;
  width: min(64%, 220px);
  background: linear-gradient(
    90deg,
    rgb(237 199 132 / 80%),
    rgb(219 174 104 / 20%),
    transparent
  );
  transform-origin: left center;
}
.fs[data-lyric-theme='cinema'] .fs-main {
  display: grid;
  grid-template-columns: min(66px, 16vw) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  row-gap: 8px;
}
.fs[data-lyric-theme='cinema'].fs-reading .fs-main {
  grid-template-rows: minmax(0, 1fr);
}
.fs[data-lyric-theme='cinema'] .fs-main .fs-coverwrap {
  width: 100%;
  padding-bottom: 0;
}
.fs[data-lyric-theme='cinema'] .fs-titleblock {
  margin-left: 14px;
  max-width: 100%;
}
.fs[data-lyric-theme='cinema'] .fs-titleblock h4 {
  margin-top: 0;
  font-size: clamp(19px, 2vw, 26px);
  line-height: 1.14;
  -webkit-line-clamp: 2;
}
.fs[data-lyric-theme='cinema'] .fs-titleblock p {
  margin-top: 4px;
  font-size: 12px;
}
.fs[data-lyric-theme='cinema']
  :is(.fs-reflect, .fs-kicker, .fs-titleactions, .fs-side, .fs-index) {
  display: none;
}
.fs[data-lyric-theme='cinema'] .fs-main .fs-lyrcol {
  grid-column: 1 / -1;
  width: min(100%, 780px);
  margin-inline: auto;
  padding-inline-start: 0;
}
.fs[data-lyric-theme='cinema'] :deep(.fl-line) {
  text-align: center;
  transform-origin: center;
}
.fs[data-lyric-theme='cinema']
  .fs-lyrics:not(.lyrics-unavailable)
  :deep(.fl-o) {
  font-size: clamp(23px, 3.8vw, 56px);
  letter-spacing: -0.04em;
  text-wrap: balance;
}

/* 对话直接叠在专辑氛围层上，来信和回信沿两侧排列。 */
.fs[data-lyric-theme='chat'] {
  & :is(.fs-giant, .fs-side, .fs-index) {
    display: none;
  }
  & .fs-main .fs-titleblock {
    margin-left: -30px;
    max-width: 308px;
  }
  & .fs-titleblock h4 {
    font-size: 33px;
    line-height: 1.1;
  }
  & .fs-main .fs-lyrcol {
    padding: 2px 2px 0;
    border: 0;
  }
  &:not(.fs-reading) .fs-main .fs-lyrcol {
    flex: 0 1 min(452px, 52%);
  }
  & .fs-lyrseek {
    left: auto;
    right: 12px;
  }
  & .fs-lyrics:not(.lyrics-unavailable) {
    display: flex;
    flex-direction: column;
    gap: clamp(14px, 2.4vh, 24px);
    padding: 0 8px 0 4px;
    /* 首尾留白和长句都保留实际高度，供滚动与按句定位测量。 */
    &::before,
    &::after {
      flex-shrink: 0;
    }
    & :deep(.fl-group) {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      gap: inherit;
    }
    & :deep(.fl-line) {
      position: relative;
      flex: none;
      align-self: flex-start;
      width: fit-content;
      max-width: calc(62% + var(--chat-width) * 18%);
      min-height: 0;
      margin: var(--chat-gap) 0 0 38px;
      padding: 12px 17px 13px;
      border: 1px solid rgb(255 255 255 / 20%);
      border-radius: 22px 22px 22px 7px;
      background: linear-gradient(
        rgb(255 255 255 / 21%),
        rgb(255 255 255 / 10%)
      );
      box-shadow:
        inset 0 1px 0 rgb(255 255 255 / 22%),
        0 6px 18px rgb(0 0 0 / 20%);
      backdrop-filter: blur(14px) saturate(1.5);
      filter: none;
      transform: none;
      opacity: 0.75;
    }
    & :deep(.fl-line:nth-child(odd)::before) {
      content: '';
      position: absolute;
      left: -38px;
      bottom: 0;
      width: 29px;
      height: 29px;
      border: 1px solid rgb(255 255 255 / 35%);
      border-radius: 50%;
      background: rgb(255 255 255 / 10%) var(--chat-cover) center / cover;
      box-shadow: 0 3px 8px rgb(0 0 0 / 35%);
    }
    & :deep(.fl-line:nth-child(even)) {
      align-self: flex-end;
      max-width: calc(66% + var(--chat-width) * 18%);
      margin-left: 0;
      border-radius: 22px 22px 7px 22px;
      background: linear-gradient(rgb(64 168 255 / 55%), rgb(10 110 240 / 48%));
      transform-origin: right center;
    }
    & :deep(.fl-line .fl-o) {
      font-size: calc(15px * var(--chat-size));
      font-weight: 500;
      line-height: 1.4;
      letter-spacing: normal;
    }
    & :deep(.fl-line .fl-tr) {
      margin-top: 5px;
      font-size: 12px;
    }
    & :deep(.fl-line:not(.on) .fl-tr) {
      opacity: 0.75;
    }
    & :deep(.fl-line.d1) {
      opacity: 0.9;
    }
    & :deep(.fl-line.on) {
      opacity: 1;
      box-shadow:
        inset 0 1px 0 rgb(255 255 255 / 30%),
        0 12px 28px rgb(0 0 0 / 32%);
    }
    & :deep(.fl-line:nth-child(even).on) {
      box-shadow:
        inset 0 1px 0 rgb(255 255 255 / 32%),
        0 6px 18px rgb(10 90 180 / 20%);
    }
    & :deep(.fl-line.on .fl-o) {
      font-weight: 700;
    }
    & :deep(.fl-line:is(.focus, :focus-visible)) {
      opacity: 1;
      outline: 2px solid rgb(255 255 255 / 55%);
      outline-offset: 2px;
    }
  }
}
@media (prefers-reduced-motion: no-preference) {
  .fs[data-lyric-theme='chat']:not(.fs-calm)
    .fs-lyrics:not(.lyrics-unavailable)
    :deep(.fl-line.on) {
    animation: bubble-arrive 340ms cubic-bezier(0.2, 0.8, 0.25, 1) both;
  }
}
@keyframes bubble-arrive {
  from {
    opacity: 0.68;
    transform: translateY(7px) scale(0.96);
  }
  70% {
    transform: translateY(-1px) scale(1.025);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 1020px) {
  .fs[data-lyric-theme='chat'] .fs-titleblock h4 {
    font-size: 28px;
  }
  .fs[data-lyric-theme='chat']:not(.fs-reading) .fs-main .fs-lyrcol {
    flex-basis: min(396px, 52%);
  }
}
@media (max-width: 640px) {
  .fs[data-lyric-theme='chat'] .fs-main .fs-titleblock {
    max-width: 100%;
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .fs:not(.fs-calm)[data-lyric-theme='ink'] :deep(.fl-line.on .fl-o) {
    animation: ink-reveal 300ms ease-out both;
  }
  .fs:not(.fs-calm)[data-lyric-theme='cinema'] :deep(.fl-line.on .fl-o) {
    animation: lyric-reveal 250ms ease-out both;
  }
  .fs:not(.fs-calm)[data-lyric-theme='ink'] :deep(.fl-line.on .fl-o::after) {
    animation: brush-stroke 440ms cubic-bezier(0.18, 0.68, 0.25, 1) both;
  }
}
@keyframes brush-stroke {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
@keyframes ink-reveal {
  from {
    opacity: 0.55;
    transform: translateX(-9px) rotate(-1deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes lyric-reveal {
  from {
    opacity: 0.65;
    transform: translateY(7px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .fs-reading .fs-main {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fs-theme-seg :deep(.tab-pill),
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

/* 无封面兜底：背景层换成波普舞台插画——只做轻模糊与压暗，保留聚光灯锥与人物轮廓，不走真封面同款重模糊；
   背景图需压过运行时写入背景层的行内封面图，故仅此一处用 !important。 */
.fs.fs-nocover .fs-bg {
  background-image: url('/images/pop-stage.webp') !important;
  filter: blur(4px) saturate(1.06) brightness(0.72);
  transform: scale(1.07);
}
</style>
