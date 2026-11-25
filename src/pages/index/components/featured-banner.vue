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

// 把插画当前可见矩形（归一化坐标）写入点阵画布的 dataset：频谱服务据此把画布点映射回
// 插画坐标采样点田剖面。窗口变窄、object-position 右移时矩形随之更新，点田始终贴着
// 人物轮廓，而不是钉死在横幅盒子上。
function syncDotsGeometry(): void {
  const section = bannerRef.value
  const image = landscapeRef.value
  if (!section || !image) return
  const canvas = section.querySelector<HTMLCanvasElement>('[data-halftone-dots]')
  if (!canvas) return
  const boxW = image.clientWidth
  const boxH = image.clientHeight
  if (!boxW || !boxH) return
  const iw = image.naturalWidth || 2736
  const ih = image.naturalHeight || 912
  const position = getComputedStyle(image).objectPosition.split(' ')
  const px = (parseFloat(position[0] ?? '50') || 0) / 100
  const py = (parseFloat(position[1] ?? '36') || 0) / 100
  const scale = Math.max(boxW / iw, boxH / ih)
  const dw = iw * scale
  const dh = ih * scale
  const ox = (boxW - dw) * px
  const oy = (boxH - dh) * py
  const rect = [-ox / dw, -oy / dh, (boxW - ox) / dw, (boxH - oy) / dh].map(n =>
    n.toFixed(4)
  )
  const keys = ['imgU0', 'imgV0', 'imgU1', 'imgV1'] as const
  keys.forEach((key, index) => {
    if (canvas.dataset[key] !== rect[index]) canvas.dataset[key] = rect[index]
  })
}

onMounted(() => {
  syncDotsGeometry()
  landscapeRef.value?.addEventListener('load', syncDotsGeometry)
  if (typeof ResizeObserver !== 'undefined' && bannerRef.value) {
    dotsGeometryObserver = new ResizeObserver(syncDotsGeometry)
    dotsGeometryObserver.observe(bannerRef.value)
  }
})

onBeforeUnmount(() => {
  dotsGeometryObserver?.disconnect()
  landscapeRef.value?.removeEventListener('load', syncDotsGeometry)
})
</script>
<template>
  <section
    ref="bannerRef"
    class="banner home-topbar"
    :class="{ 'banner-calm': !playerState.settings.motion }"
    data-banner
    aria-labelledby="home-banner-title"
  >
    <div
      class="banner-bg"
      data-banner-bg
      :style="state.accent ? { '--banner-accent': state.accent } : undefined"
      aria-hidden="true"
    >
      <!-- 三层分离仍装在这一个子元素内部（data-banner-bg 单子元素契约不变）：底层是无
           人物、无点阵的干净渐变背景；中层是点阵画布（静态剖面场/实频动态场都由它单独
           生成）；上层是全画幅透明的人物+贴纸层。人物层在所有状态下都是同一个元素、
           永不更换——播放/未播切换只动点阵层，人物位移问题从根上不存在。 -->
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

/* 半调点阵层：三层栈的中间层，整幅覆盖横幅、与两层插画同一盒子，位于背景渐变之上、
   人物层之下。未播放时频谱服务按采样剖面画静态彩色点田，实频时同一片田随真实频段
   起伏；人物与贴纸本体所在格剖面为零不会冒点，且人物层盖在上面，轮廓光晕不压人物。
   迷你条用同一套层栈：折叠后画布随横幅盒子变小，静态场照常绘制，不再整层隐藏。 */
.banner-dots {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
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
/* 波普插画全幅铺满：左半自带深蓝留白承载文案列，右侧人物与贴纸完整透出，色彩由插画承担。
   裁切对齐参照 hero：人物右置、脸落在上三分之一（纵向 36%），横向略偏右让人物区更靠右。 */
.home-topbar .banner-landscape {
  width: 100%;
  mask-image: none;
  object-position: 62% 36%;
  opacity: 1;
}
/* 罩面对齐参照 hero 的 shade：左侧深蓝 55% 起、34% 处收至 18%、55% 后全透；
   底部再叠一道渐隐与页面衔接。 */
.home-topbar .banner-bg::after {
  background:
    linear-gradient(90deg, rgb(9 22 54 / 55%), rgb(9 22 54 / 18%) 34%, transparent 55%),
    linear-gradient(0deg, rgb(10 8 18 / 42%), transparent 34%);
}
/* 窄窗时裁切窗口右偏：人物保持完整入框，文字仍落在左侧平整的深蓝留白上。 */
@container (max-width: 700px) {
  .home-topbar .banner-landscape {
    object-position: 88% 36%;
  }
}
/* 三层包裹层：占满背景盒，背景图、点阵画布、人物图同盒同裁切上下叠放（类名规则对
   背景与人物两层一致生效）。状态切换不涉及任何图层淡入淡出——只有点阵画布内部的
   静态/动态混合在动，背景与人物纹丝不动。 */
.banner-art {
  position: absolute;
  inset: 0;
}
/* 迷你条里的人物裁切单独对准眼睛带：实测原图眼睛带在纵向 35%–42%、中心约 38.5%，
   58px 通栏 cover 裁切下纵向取 36% 时眼睛正落在条的中线上（31% 时眼睛偏低近下缘）；
   展开态的 62% 36% 不动，背景与人物两层图同类名同步生效。 */
.main.compact .home-topbar .banner-landscape {
  object-position: 50% 36%;
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
