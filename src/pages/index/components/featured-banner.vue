<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import HalftoneDots from '@/components/ui/HalftoneDots.vue'
import { usePlayer } from '@/composables/usePlayer'
import { defaultCover } from '@/constants/music'
import { artworkColor } from '@/services/player/artwork-color'
import { useDailyMix } from '@/pages/index/use-daily-mix'
import type { SourceTrack } from '@/types/prototype'

const props = defineProps<{
  songs: SourceTrack[]
  sourceLabel: string
  retryAccount: boolean
  loading: boolean
  // 顶部问候语与日期行，由首页按本地时间组装。
  greeting: string
  dateline: string
}>()
const emit = defineEmits<{ play: []; retry: []; open: [] }>()
const { state: playerState } = usePlayer()
const state = reactive({
  // 已加载失败的封面地址，对应位置统一回退到通用封面。
  failedCovers: [] as string[],
  // 第一首封面的主色，供顶部条渐变派生相邻色相。
  accent: '',
  // 点阵画布是否处于实频（live）：由画布的 data-spectrum-mode 同步，驱动静态点层图
  // 与画布之间的交叉淡化（live 时点层图淡出、画布淡入接管动态点）。
  dotsLive: false,
})
const { pending, playing, duration, actionLabel, playFeatured } = useDailyMix(
  () => props.songs,
  () => props.loading
)
// 第一首的封面，折叠迷你条继续用它当曲单脸面。
const cover = computed(() => {
  const source = props.songs[0]?.cover
  return source && !state.failedCovers.includes(source) ? source : defaultCover
})
// kicker 行对齐参照 hero：时段问候领起，其后是今日推荐的中英双语小字（拉丁部分靠
// text-transform 与字距呈现大写跟踪效果），问候不另占一行。
const kickerLine = computed(() => `${props.greeting} · 今日推荐 · TODAY'S RECOMMENDATION`)
// 大标题对齐参照 hero 用歌单名做题：日推歌单在主打 tile 里的定名就是「今日主打歌单」，
// 横幅与 tile 同名同指；尚无曲目时回退到栏目名「每日推荐」。
const mixTitle = computed(() => (props.songs.length ? '今日主打歌单' : '每日推荐'))
// 摘要行对齐参照 hero 的 meta 结构：日期打头，其后是首数、来源与总时长；时长只在全部
// 曲目可计时时由 useDailyMix 给出。日期从 dateline 里取月日与星期两段，不带推荐语尾巴。
const metaLine = computed(() => {
  const parts = props.dateline.split(' · ').slice(0, 2)
  if (props.songs.length) parts.push(`${props.songs.length} 首歌`)
  parts.push(props.sourceLabel)
  if (props.songs.length && duration.value) parts.push(`共 ${duration.value}`)
  return parts.join(' · ')
})

// 记录加载失败的封面地址，顶部条内所有使用处随之回退通用封面。
function markCoverFailed(source?: string): void {
  if (source && source !== defaultCover && !state.failedCovers.includes(source))
    state.failedCovers.push(source)
}

// 只取第一首封面的颜色，换歌或隐藏顶部条后忽略上一次取色结果。
watch(
  cover,
  async (source, _, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    if (source === defaultCover) {
      state.accent = ''
      return
    }
    const rgb = await artworkColor(source, document)
    if (current) state.accent = rgb ? `rgb(${rgb.join(' ')})` : ''
  },
  { immediate: true }
)

// 缩略图加载失败时恢复通用封面和默认渐变，忽略已经切走的图片。
function fallbackCover(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  const source = image.getAttribute('src')
  if (source && cover.value !== defaultCover && source === cover.value) markCoverFailed(source)
}

// 主按钮点击：已是当前队列时切换播放状态，否则交给首页按日推顺序起播。
function onPlay(): void {
  playFeatured(() => emit('play'))
}

const bannerRef = ref<HTMLElement>()
const landscapeRef = ref<HTMLImageElement>()
let dotsGeometryObserver: ResizeObserver | undefined
let dotsModeObserver: MutationObserver | undefined

// 追踪点阵画布的频谱模式属性：频谱服务在模式切换时写 data-spectrum-mode，组件据此
// 把 state.dotsLive 同步过去，层栈随之交叉淡化（静态点层图 ↔ 实频画布）。
function watchDotsMode(): void {
  const canvas = bannerRef.value?.querySelector<HTMLCanvasElement>('[data-halftone-dots]')
  if (!canvas) return
  const apply = () => {
    state.dotsLive = canvas.dataset.spectrumMode === 'live'
  }
  apply()
  dotsModeObserver = new MutationObserver(apply)
  dotsModeObserver.observe(canvas, {
    attributes: true,
    attributeFilter: ['data-spectrum-mode'],
  })
}

// 把插画在点阵画布上的覆盖矩形（归一化坐标）写入画布 dataset：频谱服务据此把画布点
// 映射回插画坐标采样点田剖面。取景由 .banner-art 的统一变换承担、三层图与画布同盒同
// 尺寸，所以这里不复算任何裁切公式，直接量两者的实际渲染矩形作差——取景参数怎么改，
// 点田都自动跟着同一套几何走，不会各算一套而错位。
function syncDotsGeometry(): void {
  const section = bannerRef.value
  const image = landscapeRef.value
  if (!section || !image) return
  const canvas = section.querySelector<HTMLCanvasElement>('[data-halftone-dots]')
  if (!canvas) return
  const artRect = image.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  if (!artRect.width || !artRect.height) return
  const rect = [
    (canvasRect.left - artRect.left) / artRect.width,
    (canvasRect.top - artRect.top) / artRect.height,
    (canvasRect.right - artRect.left) / artRect.width,
    (canvasRect.bottom - artRect.top) / artRect.height,
  ].map(n => n.toFixed(4))
  const keys = ['imgU0', 'imgV0', 'imgU1', 'imgV1'] as const
  keys.forEach((key, index) => {
    if (canvas.dataset[key] !== rect[index]) canvas.dataset[key] = rect[index]
  })
}

onMounted(() => {
  syncDotsGeometry()
  watchDotsMode()
  landscapeRef.value?.addEventListener('load', syncDotsGeometry)
  if (typeof ResizeObserver !== 'undefined' && bannerRef.value) {
    dotsGeometryObserver = new ResizeObserver(syncDotsGeometry)
    dotsGeometryObserver.observe(bannerRef.value)
  }
})

onBeforeUnmount(() => {
  dotsGeometryObserver?.disconnect()
  dotsModeObserver?.disconnect()
  landscapeRef.value?.removeEventListener('load', syncDotsGeometry)
})
</script>
<template>
  <section
    ref="bannerRef"
    class="banner home-topbar"
    :class="{
      'banner-calm': !playerState.settings.motion,
      'banner-dots-live': state.dotsLive,
    }"
    data-banner
    aria-labelledby="home-banner-title"
  >
    <div
      class="banner-bg"
      data-banner-bg
      :style="state.accent ? { '--banner-accent': state.accent } : undefined"
      aria-hidden="true"
    >
      <!-- 层栈仍装在这一个子元素内部（data-banner-bg 单子元素契约不变），自下而上：
           干净渐变背景 → 静态点层图（从原图逐点提取的点田，未播时它就是点田本体）→
           点阵画布（只在实频时接管动态点，稳态非 live 全透明）→ 全画幅透明的人物+
           贴纸层。人物层在所有状态下都是同一个元素、永不更换；播放/未播切换只在
           点层图与画布之间交叉淡化，人物位移问题从根上不存在。 -->
      <div class="banner-art">
        <img
          ref="landscapeRef"
          class="banner-landscape"
          src="/images/pop-hero-bg.webp"
          width="2736"
          height="912"
          alt=""
          decoding="async"
        />
        <img
          class="banner-landscape banner-dots-static"
          src="/images/pop-hero-dots.webp"
          width="2736"
          height="912"
          alt=""
          decoding="async"
          aria-hidden="true"
        />
        <HalftoneDots class="banner-dots" />
        <img
          class="banner-landscape banner-chara"
          src="/images/pop-hero-chara.webp"
          width="2736"
          height="912"
          alt=""
          decoding="async"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- 展开态文案列：kicker、日推歌单名大标题、日期与曲单摘要、主操作自上而下排布，
         折叠时整列让位给迷你条。 -->
    <div class="banner-content">
      <p class="banner-kicker">{{ kickerLine }}</p>
      <h2
        id="home-banner-title"
        data-banner-title
      >
        {{ mixTitle }}
      </h2>
      <p
        class="banner-meta-line"
        data-banner-meta
        data-banner-sub
      >
        {{ metaLine }}
      </p>
      <div class="banner-actions">
        <BaseButton
          class="banner-play"
          data-banner-play
          :loading="loading"
          :disabled="!songs.length"
          :aria-busy="pending || loading"
          :title="pending ? '正在获取音频，点击取消' : undefined"
          @click="onPlay"
        >
          <span
            v-if="pending"
            class="banner-pending"
            aria-hidden="true"
          ></span>
          <svg
            v-else-if="playing"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          {{ actionLabel }}
        </BaseButton>
        <BaseButton
          class="banner-play banner-open"
          data-open-daily
          @click="emit('open')"
        >
          查看歌单
        </BaseButton>
      </div>
    </div>

    <!-- 横幅频谱：移到左下与文案列同侧呈现为 EQ 条带，继续走既有频谱绑定，折叠时随全局规则隐藏。 -->
    <div class="banner-caption">
      <canvas
        class="banner-spectrum"
        data-banner-spectrum
        aria-hidden="true"
      />
    </div>

    <div class="banner-mini">
      <img
        :key="cover"
        data-banner-mini-cover
        :src="cover"
        decoding="async"
        alt=""
        @error="fallbackCover"
      />
      <div class="banner-mini-caption">
        {{ songs.length ? songs.length + ' 首歌' : sourceLabel }}<span data-banner-mini-title>每日推荐</span>
      </div>
      <BaseButton
        class="banner-play"
        data-banner-play
        :loading="loading"
        :disabled="!songs.length"
        :aria-busy="pending || loading"
        :title="pending ? '正在获取音频，点击取消' : undefined"
        @click="onPlay"
      >
        <span
          v-if="pending"
          class="banner-pending"
          aria-hidden="true"
        ></span>
        {{ actionLabel }}
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.banner-caption { pointer-events: none; }

/* 静态点层图：从原图逐点提取的点田，与背景/人物两层同盒同裁切（banner-landscape），
   位于背景渐变之上、画布之下。未播时它就是点田本体（opacity 1）；进入实频后淡出，
   让位给画布在同一片田上画的动态点。迷你条用同一套层栈，点层随盒子一起裁切。 */
.banner-dots-static {
  z-index: 1;
  opacity: 1;
  transition: opacity 300ms ease;
}
/* 祖先链多带一层 .banner-art 提优先级：.home-topbar .banner-landscape 也写了 opacity: 1
   且同分时靠后，不能让它在 live 时把点层图按住不放。 */
.banner-dots-live .banner-art .banner-dots-static {
  opacity: 0;
}
/* 点阵画布：只在实频时接管（稳态非 live 时频谱服务不画点、画布全透明），默认
   opacity 0 藏在静态点层之下，live 时淡入；人物与贴纸本体所在格剖面为零不会冒点，
   且人物层盖在上面，轮廓光晕不压人物。 */
.banner-dots {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 300ms ease;
}
.banner-dots-live .banner-dots {
  opacity: 1;
}
/* 关动效（banner-calm）或系统减动效时，点层图与画布之间直接切换、不做交叉淡化。 */
.banner-calm .banner-dots-static,
.banner-calm .banner-dots {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .banner-dots-static,
  .banner-dots {
    transition: none;
  }
}
/* 人物层：全画幅透明 PNG 式图层，永远盖在点阵之上（z-index 2），两种播放状态共用。 */
.home-topbar .banner-chara {
  z-index: 2;
}

/* ---------- 展开态 hero ---------- */
/* 展开高度约 272px 承载完整文案列与左下频谱，滚动折叠时仍回到全局迷你条高度。 */
.banner.home-topbar {
  height: 272px;
}
.main.compact .banner.home-topbar {
  height: var(--banner-compact-height);
  /* 迷你条保持流内布局：随滚动先缩成迷你条、继续滚动就随页面滚走，不钉顶。曾试过
     sticky 钉在滚动容器顶部，真机观感是迷你条浮在内容之上不好看，用户明确要求恢复
     原来的流内滚动，不要再加回 position: sticky。 */
}
@container (max-width: 700px) {
  .banner.home-topbar {
    height: 238px;
  }
}
/* 三层图只负责把 .banner-art 包裹层铺满：包裹层与原图同宽高比（2736:912），cover
   没有多余空间可裁，object-position 在这里不再起作用——取景（放大窗口与锚点）统一
   由 .banner-art 的尺寸与 translate 承担，三层与点阵画布共用同一套几何。 */
.home-topbar .banner-landscape {
  width: 100%;
  mask-image: none;
  opacity: 1;
}
/* 罩面只罩左侧文字区：横向深蓝从 58% 起、33% 处全透，右 2/3 艺术区不罩，保持原图
   本色；底部渐隐只落在左 55% 宽、底 30% 高的角落（background-size 限定），与页面
   衔接的同时不压人物与贴纸。放大取景后左区底图是点田，文字可读性就靠这道局部罩。 */
.home-topbar .banner-bg::after {
  background:
    linear-gradient(90deg, rgb(9 22 54 / 58%), rgb(9 22 54 / 26%) 20%, transparent 33%),
    linear-gradient(0deg, rgb(10 8 18 / 40%), transparent 100%);
  background-size:
    100% 100%,
    55% 30%;
  background-position:
    0 0,
    0 100%;
  background-repeat: no-repeat;
}
/* 层栈包裹层 = 全横幅唯一的取景层：背景图、静态点层图、点阵画布、人物图在里面同盒
   同尺寸叠放，取景只由这一层的尺寸与 translate 决定，各层不再各算裁切。
   取景按用户参考图配准（黄星/笑脸/闪电四地标均匀缩放拟合，残差 <1px）：参考图里
   原图显示宽是画面宽的 1.637 倍、右边缘与画面右缘对齐，所以这里宽度取盒宽的
   1/0.611、translateX -38.9%（可见窗 u 38.9%→100%）；纵向按眼线对齐参考图
   （眼睛带中心在原图 38.5%，落在画高约 35%），发顶 3%、下巴 67.5% 的实测下
   translateY 取 -18.5%，可见头高约占横幅高 86%。translate 百分比以包裹层自身
   尺寸为基准，盒宽怎么变窗口比例都不变；展开/折叠切换时与横幅高度同拍过渡。 */
.banner-art {
  position: absolute;
  left: 0;
  top: 0;
  width: calc(100% / 0.611);
  aspect-ratio: 2736 / 912;
  transform: translate(-38.9%, -18.5%);
  transition: transform 220ms ease;
}
/* 关动效或系统减动效时，取景切换直接到位，不做滑动过渡。 */
.banner-calm .banner-art {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .banner-art {
    transition: none;
  }
}
/* 迷你条单独给纵向取景：58px 条在展开取景下只露出约 12% 的图高，把窗口上沿移到
   眼睛带中心（38.5%）减去半个可见高，眼睛就落在条的中线附近；横向与展开态一致，
   人物的脸保持在画面中右。 */
.main.compact .home-topbar .banner-art {
  transform: translate(-38.9%, -32.4%);
}
/* 文案列加宽到左半区，底部留出左下频谱条带的高度，整列垂直居中。 */
.home-topbar .banner-content {
  width: min(54%, 500px);
  padding-bottom: 38px;
}
@container (max-width: 700px) {
  .home-topbar .banner-content {
    width: 62%;
  }
}
/* kicker 对齐参照 hero：11px 大写跟踪小字、字距 .18em、白 55%，前导横线保留全局样式。 */
.home-topbar .banner-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: rgb(255 255 255 / 55%);
  text-transform: uppercase;
}
/* 大标题对齐参照 hero：约 40px 无衬线 800 粗的歌单名。参照里拉丁部分是斜体，中文歌单名
   用伪斜体会糊字形，这里保持正体，只借它的字重与字号气质。 */
.home-topbar .banner-content h2 {
  margin: 12px 0 0;
  font-family: inherit;
  font-style: normal;
  font-size: clamp(34px, 4.6cqw, 44px);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.01em;
}
/* 摘要行对齐参照 hero 的 meta：14px、白 75%，与大标题拉开约 10px。 */
.banner-meta-line {
  max-width: 100%;
  margin: 10px 0 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 550;
  line-height: 1.5;
  color: rgb(244 242 250 / 75%);
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 主操作一行对齐参照 hero：白色播放胶囊在前，描边玻璃查看胶囊在后，高约 40px、
   间距 12px，与上方摘要拉开约 22px（参照 54px 高按钮按横幅高度比例折算）。 */
.banner-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
}
.home-topbar .banner-actions .banner-play {
  margin-top: 0;
  padding: 0 24px;
  font-size: 14px;
}
/* 查看歌单走描边玻璃胶囊：8% 白底、28% 白边加背景模糊，对齐参照 ghost 按钮。 */
.home-topbar .banner-open {
  background: rgb(255 255 255 / 8%);
  color: #fff;
  border-color: rgb(255 255 255 / 28%);
  backdrop-filter: blur(8px);
}
.liquid-win .home-topbar .banner-open {
  background: rgb(255 255 255 / 16%);
  color: #fff;
  box-shadow: inset 0 1px 1px rgb(255 255 255 / 35%);
}
/* 频谱条带与文案列同侧落在左下，左缘与文案列对齐同一 inset。 */
.home-topbar .banner-caption {
  right: auto;
  left: var(--banner-inset);
  bottom: 16px;
  align-items: flex-start;
}
.home-topbar .banner-spectrum {
  width: clamp(128px, 15cqw, 176px);
  height: 28px;
}
</style>
