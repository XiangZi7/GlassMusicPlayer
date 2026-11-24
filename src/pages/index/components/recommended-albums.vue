<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, reactive, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
import type { SourceTrack } from '@/types/prototype'
import type { CatalogPlaylist, CatalogTrack } from '@/api'
import { catalogKey, defaultCover, platformNames } from '@/services/player/catalog'
import { loadDiscoveryPlaylist } from '@/pages/index/public-playlists'
import { notify } from '@/services/notification'

const props = defineProps<{ playlists: CatalogPlaylist[]; loading: boolean; incomplete: boolean }>()
const emit = defineEmits<{ retry: []; playPublic: [songs: CatalogTrack[]] }>()
const { state, tracks, controller } = usePlayer()
const router = useRouter()
const root = useTemplateRef<HTMLElement>('root')
const actions = reactive({
  // 等待整单的快捷播放按钮。
  pending: '',
  // 返回首页时恢复到原来的歌单卡。
  opened: '',
})
let playbackRequest: AbortController | undefined
const mediumScreen = useMediaQuery('(min-width: 40rem)')
const wideScreen = useMediaQuery('(min-width: 48rem)')
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const pageSize = computed(() => wideScreen.value ? 6 : mediumScreen.value ? 4 : 2)
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
// 首页只需预览数据，公开歌单以真实平台和 ID 打开详情，离线专辑保留原有点播操作。
const cards = computed(() => props.playlists.length ? props.playlists.map(list => ({
  key: catalogKey(list), name: list.title || '公开歌单',
  subtitle: platformNames[list.platform] + (list.total != null ? ' · ' + list.total + ' 首' : ''),
  label: '查看《' + (list.title || '公开歌单') + '》 · ' + platformNames[list.platform],
  cover: list.coverUrl || list.tracks[0]?.coverUrl || defaultCover,
  playlist: list,
  open: () => {
    cancelPlay()
    actions.opened = catalogKey(list)
    const path = router.resolve({ name: 'discovery', params: { platform: list.platform, id: list.id } }).fullPath
    controller()?.navigate('discovery', undefined, false, path)
  },
})) : albums.value.map(({ track, indices }) => ({
  key: albumKey(track), name: track.album, subtitle: track.artist, cover: track.cover,
  label: '播放《' + track.album + '》 · ' + track.artist,
  playlist: undefined,
  open: () => controller()?.playTracks(indices, indices[0]!),
})))

// 切换目标或离开卡片页后，旧请求不能覆盖现有队列。
function cancelPlay(): void {
  playbackRequest?.abort()
  playbackRequest = undefined
  actions.pending = ''
}
onBeforeUnmount(cancelPlay)
onDeactivated(cancelPlay)
watch([() => state.queue, () => state.idx], cancelPlay, { flush: 'sync' })
onActivated(async () => {
  if (!actions.opened) return
  await nextTick()
  root.value?.querySelector<HTMLElement>('[data-card-key="' + CSS.escape(actions.opened) + '"]')?.focus({ preventScroll: true })
  actions.opened = ''
})

// 快捷播放先取完全部分页，失败保留原队列，多个请求以最后一次为准。
async function playFull(playlist: CatalogPlaylist): Promise<void> {
  cancelPlay()
  const request = new AbortController()
  playbackRequest = request
  actions.pending = catalogKey(playlist)
  try {
    const full = await loadDiscoveryPlaylist(playlist.platform, playlist.id, request.signal)
    if (request.signal.aborted) return
    if (full.tracks.length) emit('playPublic', full.tracks)
    else notify('歌单里没有可播放的曲目。')
  } catch (error) {
    if (!request.signal.aborted) notify(error instanceof Error ? error.message : '无法读取整份歌单，请重试。', 'error')
  } finally {
    if (playbackRequest === request) cancelPlay()
  }
}
const lastPage = computed(() => Math.max(0, Math.ceil(cards.value.length / pageSize.value) - 1))
const visibleCards = computed(() =>
  cards.value.slice(
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
  <section ref="root" aria-labelledby="home-recommend-title">
    <div
      class="feat-head relative z-[1] m-[22px_2px_12px] flex items-center justify-between gap-3"
    >
      <div class="flex flex-wrap items-baseline gap-x-3">
        <h5 id="home-recommend-title">{{ playlists.length || !albums.length ? '发现歌单' : '曲库专辑' }}</h5>
      </div>
      <div class="flex items-center gap-2">
        <!-- 各平台独立重试，已成功的推荐保留在原位。 -->
        <BaseButton v-if="incomplete" class="recommend-link" :loading="loading" @click="emit('retry')">重试公开歌单</BaseButton>
        <!-- 推荐翻页按钮：边界状态保持可见，使用原有左右箭头。 -->
        <BaseButton
          v-for="direction in lastPage > 0 ? [-1, 1] : []"
          :key="direction"
          class="recommend-arrow grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.07] text-white aria-disabled:cursor-default aria-disabled:opacity-35"
          :class="{ 'recommend-arrow-motion': animated }"
          :aria-label="direction === -1 ? '上一页推荐' : '下一页推荐'"
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
        v-if="cards.length"
        name="recommend-page"
        mode="out-in"
        :css="animated"
      >
        <div
          :key="(playlists.length ? 'public-' : 'library-') + page"
          class="grid grid-cols-2 gap-3.5 sm:grid-cols-4 md:grid-cols-6"
        >
          <div v-for="card in visibleCards" :key="card.key" class="discover-card relative min-w-0">
          <BaseButton
            class="feat relative w-full min-w-0 rounded-[18px] border border-transparent bg-transparent p-[10px_10px_12px] text-left text-inherit"
            :class="{ on: card.key === activeAlbum }"
            :data-card-key="card.key"
            :title="card.label" :aria-label="card.label"
            @click="card.open"
          >
            <img decoding="async" loading="lazy"
              :src="card.cover"
              alt=""
            />
            <b>{{ card.name }}</b>
            <span class="block truncate">{{ card.subtitle }}</span>
          </BaseButton>
          <BaseButton v-if="card.playlist" class="discover-play" :class="{ 'has-motion': animated }"
            :loading="actions.pending === card.key" :aria-label="'播放完整歌单《' + card.name + '》'"
            :title="'播放完整歌单《' + card.name + '》'" @click="playFull(card.playlist)">
            <svg v-if="actions.pending !== card.key" width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
          </BaseButton>
          </div>
        </div>
      </Transition>
      <div v-else-if="loading" role="status" class="grid min-h-40 place-content-center text-sm text-white/70">正在加载公开歌单…</div>
      <!-- 推荐空态：提供重试、搜索和导入入口。 -->
      <div
        v-else
        class="grid min-h-[160px] place-content-center justify-items-center gap-2 rounded-[18px] border border-white/10 bg-white/[.035] py-5"
      >
        <EmptyState label="公开歌单暂不可用" aria-hidden="true" />
        <p class="m-0 text-[13px] text-white/70">暂时无法获取公开歌单</p>
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
.discover-play { position: absolute; right: 17px; bottom: 61px; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 1px solid #ffffffa6; color: #1b1c22; background: #fffffff2; box-shadow: 0 3px 12px #0006; }
.liquid-win .discover-play { background: linear-gradient(150deg, white, #e4e8efe8); box-shadow: inset 0 1px white, 0 3px 12px #0007; }
@media (hover: hover) {
  .discover-card:not(:hover):not(:focus-within) .discover-play:not([aria-busy=true]) { opacity: 0; pointer-events: none; transform: translateY(3px); }
  .discover-play.has-motion { transition: opacity 160ms ease, transform 160ms ease; }
}
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
