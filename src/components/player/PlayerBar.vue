<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerQueueMenu from '@/components/player/PlayerQueueMenu.vue'
import PlayerPlayButton from '@/components/player/PlayerPlayButton.vue'
import BaseChoiceMenu from '@/components/ui/BaseChoiceMenu.vue'
import { computed, toRefs } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '@/composables/usePlayer'
import { emptyTrack, playbackQualities } from '@/constants/music'
import { collectionRoute, trackArtistNames } from '@/services/player/library'

const { state, tracks, setSetting, controller } = usePlayer()
const router = useRouter()
const { settings, stage } = toRefs(state)
const current = computed(() => tracks[state.idx])
const artistLinks = computed(() =>
  trackArtistNames(current.value).map(name => ({
    name,
    route: router.resolve(collectionRoute('artist', current.value!, state.idx, name)),
  }))
)
const albumLink = computed(() => {
  const name = current.value?.album.trim()
  if (!name || name === '—' || name === '未知专辑') return
  return { name, route: router.resolve(collectionRoute('album', current.value!, state.idx, name)) }
})

// 以当前曲目的来源搜索歌名或作品说明，继续播放当前队列。
function searchMetadata(text: string): void {
  const track = current.value
  if (track && text.trim()) controller()?.setQuery(text, track.catalog?.platform ?? 'local')
}

// 普通点击进入播放器详情页并保留返回历史，带修饰键的点击由链接本身处理。
function openDetail(event: MouseEvent, page: 'artist' | 'album', path: string): void {
  const player = controller()
  if (
    !player || event.defaultPrevented || event.button !== 0 ||
    event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
  ) return
  event.preventDefault()
  player.navigate(page, state.idx, false, path)
}
const supportsQuality = computed(
  () => tracks[state.idx]?.catalog?.platform === 'netease'
)
// 酷狗与酷我跟随平台音源，直接显示后端已报告的档位或码率。
const actualLabel = computed(() =>
  playbackQualities.find(item => item.value === state.actualQuality)?.label ?? state.actualQuality
)
const qualityHint = computed(() => {
  if (actualLabel.value) return `当前音源实际音质：${actualLabel.value}`
  return !supportsQuality.value
    ? '播放档位由音源平台提供'
    : '选择请求的播放音质，实际音质由平台返回'
})
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <div
    class="win-bottom relative z-[4] grid h-[72px] flex-none grid-cols-[minmax(200px,1fr)_auto_minmax(295px,1fr)] items-center gap-[14px] p-[10px_18px_8px]"
  >
    <div class="mini flex min-w-[0] items-center gap-[11px]">
      <BaseButton
        class="mini-cover h-[48px] w-[48px] flex-none overflow-hidden rounded-[11px] border-none bg-none p-0"
        data-stage-toggle
        :aria-busy="state.stageLoading || undefined"
        aria-label="打开全屏播放页"
        title="打开全屏播放"
        ><img
          decoding="async"
          loading="lazy"
          data-cover
          alt="专辑封面"
      /></BaseButton>
      <!-- 底栏曲目信息以独立入口呈现，封面和红心各自保留原有操作。 -->
      <div class="mini-txt min-w-0" :inert="stage">
        <b v-if="!current">{{ emptyTrack.title }}</b>
        <template v-else>
          <b>
            <BaseButton
              class="metadata-link block"
              :aria-label="'搜索歌曲：' + current.title"
              :title="'搜索歌曲：' + current.title"
              @click="searchMetadata(current.title)"
            >
              {{ current.title }}
            </BaseButton>
          </b>
          <div class="metadata-credits flex min-w-0 items-baseline gap-1 text-[12px]">
            <template v-for="(artist, index) in artistLinks" :key="artist.name">
              <i v-if="index" class="shrink-0 not-italic" aria-hidden="true">/</i>
              <a
                class="metadata-link"
                :href="artist.route.href"
                :aria-label="'查看歌手：' + artist.name"
                :title="'查看歌手：' + artist.name"
                @click="openDetail($event, 'artist', artist.route.fullPath)"
              >{{ artist.name }}</a>
            </template>
            <i v-if="!artistLinks.length && current.artist" class="truncate not-italic">{{ current.artist }}</i>
            <i v-if="current.artist && albumLink" class="shrink-0 not-italic" aria-hidden="true">·</i>
            <a
              v-if="albumLink"
              class="metadata-link"
              :href="albumLink.route.href"
              :aria-label="'查看专辑：' + albumLink.name"
              :title="'查看专辑：' + albumLink.name"
              @click="openDetail($event, 'album', albumLink.route.fullPath)"
            >{{ albumLink.name }}</a>
          </div>
          <small v-if="current.subtitle" class="track-subtitle">
            <BaseButton
              class="metadata-link block"
              :aria-label="'搜索：' + current.subtitle"
              :title="'搜索：' + current.subtitle"
              @click="searchMetadata(current.subtitle)"
            >
              {{ current.subtitle }}
            </BaseButton>
          </small>
        </template>
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
    <div class="center-ctl flex min-w-[0] flex-col gap-[2px] self-center">
      <div class="controls flex items-center justify-center gap-[8px]">
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
    </div>
    <div class="right-ctl flex flex-wrap items-center justify-end gap-[6px]">
      <BaseChoiceMenu
        label="音质"
        :hint="qualityHint"
        :value="supportsQuality ? settings.quality : 'auto'"
        :display-value="supportsQuality ? undefined : actualLabel"
        :enabled="supportsQuality && !stage"
        :motion="settings.motion"
        :options="playbackQualities"
        above
        @select="setSetting('quality', $event)"
      />
      <!-- 底栏队列：从当前按钮上方弹出，不改变全屏或页面状态。 -->
      <PlayerQueueMenu />
      <BaseButton
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
      <BaseButton
        class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
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
          <path d="M18.6 5.4a9.5 9.5 0 010 13.2" /></svg
      ></BaseButton>
      <input
        type="range"
        class="vol"
        min="0"
        max="100"
        value="70"
        aria-label="音量"
        style="--p: 70%"
      />
      <span
        class="vol-tip pointer-events-none absolute z-[7] rounded-[8px] p-[5px_8px] font-mono text-[10.5px] leading-[1] font-bold tracking-[.02em] whitespace-nowrap text-white opacity-[0]"
        data-vol-tip
        aria-hidden="true"
        >70%</span
      >
    </div>
    <div
      class="prow edge-prow top-[0] right-[18px] left-[18px] z-[6] flex h-[15px] items-center gap-[10px] p-0 font-mono text-[9.5px]"
    >
      <span
        class="cur"
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
        class="dur"
        data-dur
        >0:00</span
      ><span
        class="seek-tip pointer-events-none absolute bottom-[19px] left-[50%] rounded-[8px] p-[6px_9px] font-mono text-[10.5px] leading-[1] font-bold tracking-[.02em] whitespace-nowrap text-white opacity-[0]"
        data-seek-tip
        aria-hidden="true"
        >0:00 / 0:00</span
      >
    </div>
    <canvas
      v-show="settings.bottomSpectrum"
      class="player-spectrum pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[14px] w-full"
      data-spectrum
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.metadata-credits {
  color: rgb(255 255 255 / 65%);
}
.metadata-link {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.metadata-link:hover, .metadata-link:focus-visible {
  color: white;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.metadata-link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}
</style>
