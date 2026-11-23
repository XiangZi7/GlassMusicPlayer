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
  // 当前封面的主色，供人物背后的柔光渐变使用。
  accent: '',
})
const featuredIndex = computed(() =>
  tracks[playerState.idx]?.catalog
    ? playerState.idx
    : tracks.findIndex(track => track.catalog)
)
const featured = computed(() => tracks[featuredIndex.value])
const title = computed(() => {
  const track = featured.value
  return track && track.album !== '—' && track.album
    ? track.album
    : track?.title
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
    state.accent = ''
    if (source === defaultCover) return
    const rgb = await artworkColor(source, document)
    if (current && rgb) state.accent = `rgb(${rgb.join(' ')})`
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
  <!-- 首页主打区：人物立于右侧频谱前，折叠时显示缩略图。 -->
  <section
    v-if="featured"
    class="banner relative z-[3] m-[2px_0_8px] h-[208px] flex-none overflow-hidden rounded-[20px]"
    :class="{ 'banner-calm': !playerState.settings.motion }"
    data-banner
    aria-label="今日主打横幅"
  >
    <div
      class="banner-bg absolute inset-0 z-[0]"
      data-banner-bg
      :style="state.accent ? { '--banner-accent': state.accent } : undefined"
    ></div>
    <!-- 横幅频谱：与底部播放栏共用音频分析的画布。 -->
    <canvas
      class="banner-spectrum pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2"
      data-banner-spectrum
      aria-hidden="true"
    />
    <div
      class="banner-content pointer-events-none absolute top-[0] bottom-[0] left-[22px] z-[4] flex w-[39%] flex-col justify-center"
    >
      <span
        class="banner-kicker text-[10.5px] font-extrabold tracking-[.16em] opacity-[.78]"
        >今日主打 · FEATURED</span
      >
      <h4
        data-banner-title
        :title="title"
      >
        {{ title }}
      </h4>
      <p
        class="banner-sub m-[7px_0_0] overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap opacity-[.78]"
        data-banner-sub
      >
        {{ [featured.title, featured.artist].filter(Boolean).join(' — ') }}
      </p>
      <div
        class="banner-actions pointer-events-auto mt-[15px] flex items-center gap-[12px]"
      >
        <!-- 页面操作按钮：立即播放。 -->
        <BaseButton
          class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
          data-banner-play
          @click="playFeatured"
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              :d="playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5.5v13l11-6.5z'"
            /></svg
          >{{ playing ? '暂停' : '立即播放' }}</BaseButton
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
    <div
      class="banner-stage pointer-events-none absolute top-[0] right-[0] bottom-[0] z-[3] w-[50%]"
    >
      <img
        class="banner-girl absolute top-[auto] right-[12px] bottom-[0] z-[5] h-[198px] w-[auto] max-w-none"
        src="/images/featured-singer-clean.png"
        alt="二次元女主唱立绘"
      />
    </div>
    <div
      class="banner-mini absolute top-[0] right-[16px] bottom-[0] left-[16px] z-[5] hidden items-center gap-[10px] text-[13.5px] font-extrabold"
    >
      <img
        :key="cover"
        data-banner-mini-cover
        :src="cover"
        alt=""
        @error="fallbackCover"
      />
      <div style="min-width: 0">
        今日主打 · <span data-banner-mini-title>{{ title }}</span>
      </div>
      <!-- 页面操作按钮：播放。 -->
      <BaseButton
        class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
        data-banner-play
        @click="playFeatured"
        >{{ playing ? '暂停' : '播放' }}</BaseButton
      >
    </div>
  </section>
</template>
