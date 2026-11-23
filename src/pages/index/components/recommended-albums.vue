<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
import type { SourceTrack } from '@/types/prototype'

const { state, tracks, controller } = usePlayer()
const narrowScreen = useMediaQuery('(max-width: 640px)')
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const pageSize = computed(() => (narrowScreen.value ? 2 : 6))
const animated = computed(() => state.settings.motion && !reducedMotion.value)
// 当前推荐页，从第 0 页开始。
const page = ref(0)

// 用专辑与歌手区分同名专辑，同时保留曲库中的歌曲顺序。
function albumKey(track: SourceTrack): string {
  return JSON.stringify([track.album, track.artist])
}

// 每张推荐卡使用第一首歌的封面，点击后按专辑曲目顺序播放。
const albums = computed(() => {
  const cards = new Map<string, { track: SourceTrack; indices: number[] }>()
  tracks.forEach((track, index) => {
    if (!track.catalog || !track.album || track.album === '—') return
    const key = albumKey(track)
    const card = cards.get(key)
    if (card) card.indices.push(index)
    else cards.set(key, { track, indices: [index] })
  })
  return [...cards.values()]
})
const lastPage = computed(() =>
  Math.max(0, Math.ceil(albums.value.length / pageSize.value) - 1)
)
const visibleAlbums = computed(() =>
  albums.value.slice(
    page.value * pageSize.value,
    (page.value + 1) * pageSize.value
  )
)
const activeAlbum = computed(() => {
  const current = tracks[state.idx]
  return current ? albumKey(current) : undefined
})

// 曲库数量或窗口宽度变化后，将页码限制在可用区间。
watch(
  lastPage,
  last => {
    page.value = Math.min(page.value, last)
  },
  { flush: 'sync' }
)

// 箭头在第一页和末页保持位置，且不改变已有焦点。
function turnPage(direction: number): void {
  page.value = Math.max(0, Math.min(lastPage.value, page.value + direction))
}
</script>

<template>
  <!-- 首页推荐区：右上角提供专辑播放提示和圆形翻页箭头。 -->
  <section aria-labelledby="home-recommend-title">
    <div
      class="feat-head relative z-[1] m-[22px_2px_12px] flex items-center justify-between gap-3"
    >
      <h5 id="home-recommend-title">为你推荐</h5>
      <div class="flex items-center gap-2">
        <span
          v-if="albums.length"
          class="max-[380px]:hidden"
          >专辑 · 点击即播</span
        >
        <!-- 推荐翻页按钮：边界状态保持可见，使用原有左右箭头。 -->
        <BaseButton
          v-for="direction in [-1, 1]"
          :key="direction"
          class="recommend-arrow grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.07] text-white aria-disabled:cursor-default aria-disabled:opacity-35"
          :class="{ 'recommend-arrow-motion': animated }"
          :aria-label="direction === -1 ? '上一页推荐专辑' : '下一页推荐专辑'"
          :aria-disabled="direction === -1 ? page === 0 : page === lastPage"
          aria-controls="home-recommend-albums"
          @click="turnPage(direction)"
        >
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              :d="
                direction === -1
                  ? 'M14.5 5.5L8 12l6.5 6.5'
                  : 'M9.5 5.5L16 12l-6.5 6.5'
              "
            />
          </svg>
        </BaseButton>
      </div>
    </div>
    <div id="home-recommend-albums">
      <!-- 推荐专辑卡片：翻页时只过渡卡片区，页头和歌曲列表保持位置。 -->
      <Transition
        v-if="albums.length"
        name="recommend-page"
        mode="out-in"
        :css="animated"
      >
        <div
          :key="page"
          class="grid grid-cols-2 gap-3.5 sm:grid-cols-4 md:grid-cols-6"
        >
          <BaseButton
            v-for="{ track, indices } in visibleAlbums"
            :key="albumKey(track)"
            class="feat relative min-w-0 rounded-[18px] border border-transparent bg-transparent p-[10px_10px_12px] text-left text-inherit"
            :class="{ on: albumKey(track) === activeAlbum }"
            :title="`${track.album} · ${track.artist}`"
            @click="controller()?.playTracks(indices, indices[0]!)"
          >
            <img
              :src="track.cover"
              alt=""
            />
            <b>{{ track.album }}</b>
            <span class="block truncate">{{ track.artist }}</span>
          </BaseButton>
        </div>
      </Transition>
      <!-- 推荐空态：引导搜索真实曲目或导入公开歌单。 -->
      <div
        v-else
        class="grid min-h-[160px] place-content-center justify-items-center gap-2 rounded-[18px] border border-white/10 bg-white/[.035] py-5"
      >
        <EmptyState label="暂无推荐专辑" />
        <p class="m-0 text-[13px] text-white/60">暂无推荐专辑</p>
        <div class="flex flex-wrap justify-center gap-2">
          <BaseButton
            class="recommend-link"
            @click="controller()?.navigate('search')"
            >搜索歌曲</BaseButton
          >
          <BaseButton
            class="recommend-link"
            @click="controller()?.navigate('connect')"
            >导入歌单</BaseButton
          >
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.recommend-arrow-motion {
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    opacity 150ms ease;
}

.recommend-arrow:not([aria-disabled='true']):hover,
.recommend-link:hover {
  background-color: rgb(255 255 255 / 13%);
}

button:focus-visible {
  outline: 2px solid rgb(255 255 255 / 70%);
  outline-offset: 2px;
}

.recommend-link {
  padding: 5px 11px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 999px;
  font-size: 12px;
}

.recommend-page-enter-active,
.recommend-page-leave-active {
  transition: opacity 180ms ease;
}

.recommend-page-enter-from,
.recommend-page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .recommend-arrow-motion,
  .recommend-page-enter-active,
  .recommend-page-leave-active {
    transition: none;
  }
}
</style>
