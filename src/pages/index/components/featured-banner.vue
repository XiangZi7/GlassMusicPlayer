<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import { defaultCover } from '@/constants/music'
import { artworkColor } from '@/services/player/artwork-color'
import { formatTime } from '@/utils/format'

const { state: playerState, tracks, controller } = usePlayer()
const state = reactive({
  // 当前无法加载的缩略图，回退到通用封面。
  failedCover: '',
  // 当前封面的主色，供横幅渐变派生相邻色相。
  accent: '',
})
const featuredIndex = computed(() =>
  tracks[playerState.idx]?.catalog
    ? playerState.idx
    : tracks.findIndex(track => track.catalog)
)
const featured = computed(() => tracks[featuredIndex.value])
// 仅为有实际专辑名的曲目展示可进入详情的专辑卡。
const albumName = computed(() => {
  const album = featured.value?.album.trim()
  return album === '—' ? '' : album
})
const duration = computed(
  () =>
    (featuredIndex.value === playerState.idx
      ? playerState.streamDuration
      : 0) ||
    featured.value?.dur ||
    0
)
const playing = computed(
  () => playerState.playing && featuredIndex.value === playerState.idx
)
// 仅当主打曲目正在请求音频时，在其播放入口显示可取消的等待状态。
const pending = computed(
  () => playerState.audioLoading && featuredIndex.value === playerState.idx
)
const cover = computed(() => {
  const source = featured.value?.cover
  return source && source !== state.failedCover ? source : defaultCover
})

// 只取当前封面的颜色，换歌或隐藏横幅后忽略上一次取色结果。
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
  if (cover.value !== defaultCover && image.getAttribute('src') === cover.value)
    state.failedCover = cover.value
}

// 已选中主打曲目时切换播放状态，首次点击从展示的曲目开始播放。
function playFeatured(): void {
  if (!featured.value) return
  if (featuredIndex.value === playerState.idx)
    controller()?.dispatch({ type: 'toggle' })
  else controller()?.selectTrack(featuredIndex.value, true)
}
</script>
<template>
  <!-- 首页主打区：封面主题色与线框网格铺满横幅，右侧保留人物立绘。 -->
  <section
    v-if="featured"
    class="banner relative z-[3] m-[2px_0_8px] h-[224px] flex-none overflow-hidden rounded-[20px]"
    :class="{ 'banner-calm': !playerState.settings.motion }"
    data-banner
    aria-label="今日主打横幅"
  >
    <div
      class="banner-bg absolute inset-0 z-[0]"
      data-banner-bg
      :style="state.accent ? { '--banner-accent': state.accent } : undefined"
      aria-hidden="true"
    ></div>
    <!-- 横幅频谱：与底部播放栏共用音频分析的画布。 -->
    <canvas
      class="banner-spectrum pointer-events-none absolute z-[2] -translate-y-1/2"
      data-banner-spectrum
      aria-hidden="true"
    />
    <div
      class="banner-content pointer-events-none absolute inset-y-0 z-[4] flex flex-col justify-center"
    >
      <span class="banner-kicker">今日主打</span>
      <h4
        data-banner-title
        :title="featured.title"
      >
        {{ featured.title }}
      </h4>
      <div v-if="featured.artist || albumName" class="banner-byline">
        <p v-if="featured.artist" :title="featured.artist" data-banner-sub>{{ featured.artist }}</p>
        <!-- 专辑入口：整张卡共用一个焦点，宽窗展示封面，窄窗并入署名行。 -->
        <BaseButton
          v-if="albumName"
          class="banner-album"
          :aria-label="`查看专辑：${albumName}`"
          :title="`查看专辑：${albumName}`"
          @click="controller()?.navigate('album', featuredIndex)"
        >
          <img :key="cover" :src="cover" decoding="async" alt="" @error="fallbackCover" />
          <span class="banner-album-info">
            <span class="banner-album-label">收录专辑</span>
            <strong>{{ albumName }}</strong>
          </span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
          </svg>
        </BaseButton>
      </div>
      <div
        class="banner-actions pointer-events-auto mt-[18px] flex flex-wrap items-center gap-x-3.5 gap-y-1.5"
      >
        <!-- 页面操作按钮：立即播放。 -->
        <BaseButton
          class="banner-play inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border-none px-[17px] text-[13px] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          data-banner-play
          :aria-busy="pending"
          :title="pending ? '正在获取音频，点击取消' : undefined"
          @click="playFeatured"
          ><span v-if="pending" class="banner-pending" aria-hidden="true"></span>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              :d="playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5.5v13l11-6.5z'"
            /></svg
          >{{ pending ? '取消加载' : playing ? '暂停' : '立即播放' }}</BaseButton
        >
        <span
          class="banner-meta font-mono text-[10.5px] whitespace-nowrap opacity-[.72]"
          data-banner-meta
          >{{
            [featured.q, duration ? formatTime(duration) : '']
              .filter(Boolean)
              .join(' · ')
          }}</span
        >
      </div>
    </div>
    <!-- 装饰舞台：立绘位于频谱前，跟随窗口材质。 -->
    <div
      class="banner-stage pointer-events-none absolute top-[0] right-[0] bottom-[0] z-[3] w-[50%]"
      aria-hidden="true"
    >
      <img decoding="async" loading="lazy"
        class="banner-girl absolute z-[5] w-auto max-w-none"
        src="/images/featured-singer-clean.png"
        alt=""
      />
    </div>
    <div
      class="banner-mini absolute top-[0] right-[16px] bottom-[0] left-[16px] z-[5] hidden items-center gap-[10px] text-[13.5px] font-extrabold"
    >
      <img decoding="async" loading="lazy"
        :key="cover"
        data-banner-mini-cover
        :src="cover"
        alt=""
        @error="fallbackCover"
      />
      <div style="min-width: 0">
        今日主打 · <span data-banner-mini-title>{{ featured.title }}</span>
      </div>
      <!-- 页面操作按钮：播放。 -->
      <BaseButton
        class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
        data-banner-play
        :aria-busy="pending"
        :title="pending ? '正在获取音频，点击取消' : undefined"
        @click="playFeatured"
        ><span v-if="pending" class="banner-pending" aria-hidden="true"></span>
        {{ pending ? '取消加载' : playing ? '暂停' : '播放' }}</BaseButton
      >
    </div>
  </section>
</template>

<style scoped>
.banner-byline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  min-width: 0;
}

.banner-byline p {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: rgb(255 255 255 / 80%);
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.banner-album {
  pointer-events: auto;
  position: absolute;
  left: max(calc(100% + 10px), calc(48cqw - var(--banner-inset)));
  top: 54%;
  translate: 0 -50%;
  display: flex;
  align-items: center;
  gap: 11px;
  width: clamp(164px, 22cqw, 252px);
  padding: 9px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 17px;
  background: rgb(17 22 33 / 58%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 9%), 0 7px 18px rgb(6 11 21 / 18%);
  backdrop-filter: blur(15px);
  color: white;
  text-align: left;
  cursor: pointer;
}

.banner-album img {
  flex: none;
  width: clamp(42px, 5.7cqw, 64px);
  aspect-ratio: 1;
  border-radius: 10px;
  object-fit: cover;
}

.banner-album-info { flex: 1; min-width: 0; }
.banner-album-label { display: block; margin-bottom: 3px; color: rgb(255 255 255 / 72%); font-size: 10.5px; line-height: 1.4; }
.banner-album strong { display: block; overflow: hidden; font-size: 14px; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.banner-album svg { flex: none; width: 16px; height: 16px; color: rgb(255 255 255 / 82%); }
.banner-album:focus-visible { outline: 2px solid white; outline-offset: 3px; }
.banner-album:is(:hover, :focus-visible) { border-color: rgb(255 255 255 / 65%); }
.banner-album:active { background-color: rgb(14 18 28 / 76%); }

.liquid-win .banner-album {
  border-color: rgb(255 255 255 / 40%);
  background-image: linear-gradient(145deg, rgb(255 255 255 / 22%), transparent 65%);
  backdrop-filter: blur(17px) saturate(1.45);
}

@media (prefers-reduced-motion: no-preference) {
  .banner:not(.banner-calm) .banner-album {
    transition: border-color 150ms ease, background-color 150ms ease;
  }
}

@container (max-width: 42rem) {
  .banner-album {
    position: static;
    translate: none;
    flex: 0 1 auto;
    gap: 3px;
    min-width: 0;
    max-width: 52%;
    width: auto;
    min-height: 30px;
    padding: 1px 6px;
    border-radius: 7px;
    box-shadow: none;
  }
  .banner-album img, .banner-album-label { display: none; }
  .banner-album strong { font-size: 12px; font-weight: 550; }
  .banner-album svg { width: 12px; height: 12px; }
}
</style>
