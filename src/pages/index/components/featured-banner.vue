<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
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
// 摘要行把来源、首数与总时长拼成一行；时长只在全部曲目可计时时由 useDailyMix 给出。
const metaLine = computed(() => {
  const parts = [props.sourceLabel]
  if (props.songs.length) parts.push(`${props.songs.length} 首歌`)
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
</script>
<template>
  <section
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
      <img
        class="banner-landscape"
        src="/images/pop-hero.webp"
        width="2736"
        height="912"
        alt=""
        decoding="async"
      />
    </div>

    <!-- 半调点阵层：独立于插画的一层，落在文案列与人物之间的中段空白带，左侧以 mask 渐隐避开文案列。 -->
    <HalftoneDots class="banner-dots" />

    <!-- 展开态文案列：日期 kicker、时段问候、日推摘要与主操作自上而下排布，折叠时整列让位给迷你条。 -->
    <div class="banner-content">
      <p class="banner-kicker">{{ dateline }}</p>
      <h2
        id="home-banner-title"
        data-banner-title
      >
        {{ greeting }}
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

/* 半调点阵层：只占中段桥接带——文案列右侧到人物脸前方的平涂空白，上下留边不铺满高；
   左缘 mask 再渐隐一道，与点阵自身的基础剖面（左小右大）叠出干净的收尾。
   位于插画之上、内容（z-index 2）之下，文案始终压在点阵上方。 */
.banner-dots {
  position: absolute;
  z-index: 1;
  top: 14%;
  /* 组件自带 height:100%，这里显式给高让上下留边真正生效，剖面中心回到横幅中线。 */
  height: 72%;
  left: 35%;
  width: 25%;
  mask-image: linear-gradient(90deg, transparent, #000 26%);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 26%);
  pointer-events: none;
}
/* 窄窗时人物右偏、文案列变宽，桥接带随之右移收窄，继续躲开标题与人物脸。 */
@container (max-width: 700px) {
  .banner-dots {
    left: 42%;
    width: 22%;
  }
}
/* 折叠成迷你条后点阵整层隐藏：画布归零后频谱服务自然停画，不在迷你条上空耗。 */
.main.compact .banner-dots {
  display: none;
}

/* ---------- 展开态 hero ---------- */
/* 展开高度约 272px 承载完整文案列与左下频谱，滚动折叠时仍回到全局迷你条高度。 */
.banner.home-topbar {
  height: 272px;
}
.main.compact .banner.home-topbar {
  height: var(--banner-compact-height);
}
@container (max-width: 700px) {
  .banner.home-topbar {
    height: 238px;
  }
}
/* 波普插画全幅铺满：左半自带深蓝留白承载文案列，右侧人物与贴纸完整透出，色彩由插画承担。 */
.home-topbar .banner-landscape {
  width: 100%;
  mask-image: none;
  object-position: 50% 36%;
  opacity: 1;
}
/* 轻罩面：左侧给文案列压一层深蓝托底保证可读，底部一道渐隐与页面衔接。 */
.home-topbar .banner-bg::after {
  background:
    linear-gradient(90deg, rgb(7 18 48 / 30%), transparent 46%),
    linear-gradient(0deg, rgb(10 8 18 / 42%), transparent 34%);
}
/* 窄窗时裁切窗口右偏：人物保持完整入框，文字仍落在左侧平整的深蓝留白上。 */
@container (max-width: 700px) {
  .home-topbar .banner-landscape {
    object-position: 88% 36%;
  }
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
/* 大标题改走无衬线粗体，贴参考图的编辑式排版，不再用原稿的斜体衬线。 */
.home-topbar .banner-content h2 {
  margin: 10px 0 4px;
  font-family: inherit;
  font-style: normal;
  font-size: clamp(36px, 4.8cqw, 54px);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.01em;
}
/* 摘要行：来源、首数与总时长一行排完，过长时省略不换行。 */
.banner-meta-line {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.5;
  color: rgb(255 250 247 / 78%);
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 主操作一行：白色播放胶囊在前，玻璃查看胶囊在后，间距与上方摘要拉开。 */
.banner-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
}
.home-topbar .banner-actions .banner-play {
  margin-top: 0;
}
/* 查看歌单走玻璃胶囊：半透明白底加细边，压在插画上仍读得清。 */
.home-topbar .banner-open {
  background: rgb(255 255 255 / 12%);
  color: #fff;
  border-color: rgb(255 255 255 / 38%);
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
