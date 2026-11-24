<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import { defaultCover } from '@/constants/music'
import { artworkColor } from '@/services/player/artwork-color'
import { formatTime } from '@/utils/format'
import { catalogKey } from '@/services/player/catalog'
import type { SourceTrack } from '@/types/prototype'

const props = defineProps<{ songs: SourceTrack[]; sourceLabel: string; retryAccount: boolean; loading: boolean }>()
const emit = defineEmits<{ play: []; retry: []; open: [] }>()
const { state: playerState, tracks, controller } = usePlayer()
const state = reactive({
  // 当前无法加载的缩略图，回退到通用封面。
  failedCover: '',
  // 当前封面的主色，供横幅渐变派生相邻色相。
  accent: '',
})
// 只在所有曲目都有时长时展示整组总时长。
const duration = computed(() => {
  let total = 0
  for (const song of props.songs) {
    const seconds = song.dur
    if (!seconds) return ''
    total += seconds
  }
  return formatTime(total)
})
// 整份队列与今日曲单一致时，海报按钮控制正在播放的那一首。
const currentMix = computed(() => {
  const queue = playerState.queue
  return !playerState.radioOn && queue?.length === props.songs.length &&
    queue.every((index, position) => {
      const current = tracks[index]?.catalog
      const pick = props.songs[position]?.catalog
      return current && pick && catalogKey(current) === catalogKey(pick)
    }) &&
    queue.includes(playerState.idx)
})
const playing = computed(() => currentMix.value && playerState.playing)
const pending = computed(() => currentMix.value && playerState.audioLoading)
// 当前曲单的播放和取源状态决定海报主按钮的操作。
const actionLabel = computed(() => {
  if (props.loading) return '加载中'
  if (pending.value) return '取消加载'
  if (playing.value) return '暂停'
  return currentMix.value && playerState.t > 0 ? '继续播放' : '播放歌单'
})
const cover = computed(() => {
  const source = props.songs[0]?.cover
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

// 开始今日曲单，已在这份队列中时支持暂停、继续与取消加载。
function playFeatured(): void {
  if (!props.songs.length) return
  if (currentMix.value)
    controller()?.dispatch({ type: 'toggle' })
  else emit('play')
}
</script>
<template>
  <section
    class="banner"
    :class="{ 'banner-calm': !playerState.settings.motion }"
    data-banner
    aria-labelledby="home-mix-title"
  >
    <div
      class="banner-bg"
      data-banner-bg
      :style="state.accent ? { '--banner-accent': state.accent } : undefined"
      aria-hidden="true"
    >
      <img
        class="banner-landscape"
        src="/images/ginkgo-station.webp"
        width="2172"
        height="724"
        alt=""
        decoding="async"
      />
    </div>
    <BaseButton class="banner-open" data-open-daily aria-label="查看每日推荐完整歌单" @click="emit('open')">
      <span>查看歌单 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></span>
    </BaseButton>
    <div class="banner-content">
      <h2 id="home-mix-title" data-banner-title>每日推荐</h2>
      <p class="banner-credit" data-banner-sub>{{ sourceLabel }}<span v-if="songs.length"> · {{ songs.length }} 首歌</span>
        <button v-if="retryAccount" class="ml-2 rounded underline underline-offset-2 focus-visible:outline-2" @click="emit('retry')">重试账号推荐</button>
      </p>
      <BaseButton
        class="banner-play"
        data-banner-play
        :loading="loading"
        :disabled="!songs.length"
        :aria-busy="pending || loading"
        :title="pending ? '正在获取音频，点击取消' : undefined"
        @click="playFeatured"
      >
        <span
          v-if="pending"
          class="banner-pending"
          aria-hidden="true"
        ></span>
        <svg
          v-else-if="!loading"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            :d="playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5.5v13l11-6.5z'"
          />
        </svg>
        {{ actionLabel }}
      </BaseButton>
    </div>
    <div class="banner-caption">
      <canvas
        class="banner-spectrum"
        data-banner-spectrum
        aria-hidden="true"
      />
      <span
        v-if="duration"
        data-banner-meta
        >共 {{ duration }}</span
      >
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
        @click="playFeatured"
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
.banner-open { position: absolute; inset: 0; z-index: 1; border: 0; border-radius: inherit; background: transparent; color: white; cursor: default; }
.banner-open span { position: absolute; top: 14px; right: 16px; display: inline-flex; align-items: center; gap: 3px; border: 1px solid #ffffff38; border-radius: 999px; padding: 5px 9px 5px 12px; background: #201a19b3; font: 650 12px/1.4 var(--font-sans); }
.banner-open:hover span { background: #201a19e0; }
@media (min-width: 1021px) {
  .banner-open span { right: 32px; }
}
.banner-open:focus-visible { outline: 2px solid white; outline-offset: -4px; }
.banner-content, .banner-mini, .banner-caption { pointer-events: none; }
.banner-content button, .banner-mini button { pointer-events: auto; }
.main.compact .banner-open span { display: none; }
.banner-content h2 {
  margin-top: 0;
  font-size: clamp(22px, 7cqw, 76px);
  font-style: normal;
  line-height: 1.25;
}
</style>
