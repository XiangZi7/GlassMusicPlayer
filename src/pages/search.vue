<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerSearchBox from '@/components/player/PlayerSearchBox.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import TrackRow from '@/components/player/TrackRow.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import SlidingTabs from '@/components/ui/SlidingTabs.vue'
import {
  searchPageSize,
  useCatalogSearch,
} from '@/composables/useCatalogSearch'
import { usePlayer } from '@/composables/usePlayer'
import {
  catalogKey,
  defaultCover,
  platformNames,
  toSourceTrack,
} from '@/services/player/catalog'
import { usePlayerStore } from '@/stores/player'
import { firstTrackIndices } from '@/services/player/library'
const { state, tracks, controller } = usePlayer()
const { registerCatalogTracks } = usePlayerStore()
const {
  query,
  platform,
  pageNum,
  result,
  loading,
  failed,
  retry,
  kind,
  activeKind,
  supportsPlaylists,
} = useCatalogSearch(state)
const sources = { ...platformNames, local: '本地曲库' } as const
const kinds = [
  { label: '歌曲', value: 'tracks' },
  { label: '歌单', value: 'playlists' },
]
const songPage = computed(() =>
  result.value && 'tracks' in result.value ? result.value : null
)
const playlistPage = computed(() =>
  result.value && 'playlists' in result.value ? result.value : null
)
const emptyMessage = computed(() =>
  activeKind.value === 'playlists' ? '没有找到匹配的歌单' : '没有找到匹配的歌曲'
)
const onlineRows = computed(() =>
  (songPage.value?.tracks || []).map(toSourceTrack)
)
const activeCatalog = computed(() => tracks[state.idx]?.catalog)
const searchIndices = computed(() =>
  tracks
    .map((_, index) => index)
    .filter(index => {
      const track = tracks[index]!
      return (
        !track.catalog &&
        (!state.query.trim() ||
          [track.title, track.artist, track.album, track.subtitle]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(state.query.trim().toLowerCase()))
      )
    })
)
const artistCards = computed(() => firstTrackIndices(tracks, 'artist', true))

// 用搜索结果页建立播放队列，从用户点选的位置开始播放。
function playOnline(position: number): void {
  if (!songPage.value) return
  const indices = registerCatalogTracks(songPage.value.tracks)
  const index = indices[position]
  if (index !== undefined) controller()?.playTracks(indices, index)
}
// 用搜索页返回的平台和歌单 ID 打开已有详情页，沿用完整曲目分页和播放流程。
function openPlaylist(id: string): void {
  if (!playlistPage.value) return
  controller()?.navigate(
    'discovery',
    undefined,
    false,
    `/discovery/${playlistPage.value.platform}/${encodeURIComponent(id)}`
  )
}
const searchLabel = computed(() =>
  state.query.trim()
    ? `搜索结果 · ${searchIndices.value.length} 首`
    : '全部歌曲 · 输入关键词筛选'
)
</script>

<template>
  <!-- search 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="search"
  >
    <div class="pg-head">
      <h3>搜索</h3>
      <p>选择曲库，输入关键词搜索。</p>
    </div>
    <PlayerSearchBox
      variant="page"
      :label="activeKind === 'playlists' ? '搜索歌单' : '搜索歌曲、歌手'"
    />
    <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
      <!-- 曲库选择区：三个在线平台共用关键词，保留本地曲库筛选。 -->
      <div
        class="search-tags flex flex-wrap items-center gap-[7px]"
        role="group"
        aria-label="搜索曲库"
      >
        <BaseButton
          v-for="(label, key, order) in sources"
          :key="key"
          class="src-chip"
          :class="{ on: platform === key }"
          :aria-pressed="platform === key"
          @click="platform = key"
          >{{ label
          }}<span
            v-if="order === 0"
            class="pop-hot-tag pop-sticker"
            style="--pop-sticker-angle: 6deg"
            aria-hidden="true"
            >热门</span
          ></BaseButton
        >
      </div>
      <!-- 搜索类型切换复用双材质滑动胶囊，仅在当前曲库有歌单接口时出现。 -->
      <Transition
        name="search-fade"
        :css="state.settings.motion"
      >
        <SlidingTabs
          v-if="supportsPlaylists"
          class="set-seg inline-flex"
          role="group"
          aria-label="搜索类型"
          kind="segment"
          :model-value="activeKind"
          :options="kinds"
          @update:model-value="
            kind = $event === 'playlists' ? 'playlists' : 'tracks'
          "
        />
      </Transition>
    </div>
    <!-- 在线列表使用服务端分页，点击曲目进入同一播放队列。 -->
    <Transition
      name="search-fade"
      mode="out-in"
      :css="state.settings.motion"
    >
      <div
        v-if="platform !== 'local'"
        :key="platform + ':' + activeKind"
        class="mt-4 min-h-[220px]"
        :aria-busy="loading"
      >
        <div
          v-if="loading"
          class="grid min-h-[120px] place-items-center text-[13px]"
          role="status"
        >
          搜索中…
        </div>
        <!-- 初始状态：波普贴纸插画作空态视觉，文案说明当前平台。 -->
        <div
          v-else-if="!query"
          class="pop-search-empty"
          role="img"
          :aria-label="'输入关键词搜索' + platformNames[platform]"
        >
          <img
            class="pop-sticker pop-sticker--framed pop-search-art"
            style="--pop-sticker-angle: -3deg"
            src="/images/pop-boombox.webp"
            alt=""
            decoding="async"
          />
          <span>输入关键词搜索{{ platformNames[platform] }}</span>
        </div>
        <div
          v-else-if="failed"
          class="grid min-h-[120px] place-items-center"
        >
          <BaseButton
            class="rounded-full border border-white/25 px-4 py-2 text-sm"
            @click="retry++"
            >重新搜索</BaseButton
          >
        </div>
        <!-- 无结果状态：沿用同一张贴纸插画，文案区分未命中。 -->
        <div
          v-else-if="!onlineRows.length && !playlistPage?.playlists.length"
          class="pop-search-empty"
          role="img"
          :aria-label="emptyMessage"
        >
          <img
            class="pop-sticker pop-sticker--framed pop-search-art"
            style="--pop-sticker-angle: -3deg"
            src="/images/pop-boombox.webp"
            alt=""
            decoding="async"
          />
          <span>{{ emptyMessage }}</span>
        </div>
        <!-- 歌单摘要只展示当前页，点击歌单后才读取曲目。 -->
        <div
          v-else-if="playlistPage"
          class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2"
          aria-label="歌单搜索结果"
        >
          <BaseButton
            v-for="item in playlistPage.playlists"
            :key="item.id"
            class="artist-card playlist-hit"
            :title="item.title"
            @click="openPlaylist(item.id)"
          >
            <img
              :src="item.coverUrl || defaultCover"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div class="min-w-0">
              <strong class="block truncate text-[13px]">{{
                item.title
              }}</strong>
              <small
                v-if="item.trackCount !== null"
                class="text-xs opacity-70"
                >{{ item.trackCount }} 首</small
              >
            </div>
          </BaseButton>
        </div>
        <template v-else>
          <TrackRow
            v-for="(track, position) in onlineRows"
            :key="catalogKey(track.catalog!) + ':' + position"
            :track="track"
            :number="(pageNum - 1) * searchPageSize + position + 1"
            :active="
              !!activeCatalog &&
              catalogKey(activeCatalog) === catalogKey(track.catalog!)
            "
            @play="playOnline(position)"
          />
        </template>
        <!-- 根据结果类型显示分页单位。 -->
        <PaginationBar
          v-if="result?.total != null"
          v-model:current="pageNum"
          page-key="catalog-search"
          :total="Math.min(result.total, searchPageSize * 1000)"
          :unit="activeKind === 'playlists' ? '个歌单' : '首'"
        />
      </div>
      <div
        v-else
        key="local"
      >
        <div
          class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
          data-search-label
        >
          {{ searchLabel }}
        </div>
        <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
        <TrackList
          :indices="searchIndices"
          list-key="search"
          empty-icon="search"
          empty="没有找到匹配的歌曲"
        />
        <div
          v-if="artistCards.length"
          class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          歌手 · 点击按歌手筛选
        </div>
        <!-- 歌手筛选卡片区：沿用原稿封面、文字与点击筛选。 -->
        <div class="artist-row grid grid-cols-[repeat(4,1fr)] gap-[14px]">
          <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
          <BaseButton
            v-for="index in artistCards"
            :key="index"
            class="artist-card cursor-pointer rounded-[18px] border border-transparent p-[10px_10px_12px] text-left text-inherit"
            @click="controller()?.setQuery(tracks[index]!.artist)"
            ><img
              decoding="async"
              loading="lazy"
              :src="tracks[index]!.cover"
              :alt="tracks[index]!.artist"
            /><b>{{ tracks[index]!.artist }}</b
            ><span>{{ tracks[index]!.album }}</span></BaseButton
          >
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 页头标题与首页版块标题同规格。 */
.pg-head h3 {
  font-size: 17px;
}
/* 来源 chip 本体保持玻璃，首个 chip 右上角压一枚黄色小贴纸作唯一波普点缀。 */
.src-chip {
  position: relative;
}
.src-chip[aria-pressed='true'] {
  outline: 1px solid rgb(255 255 255 / 0.65);
}
.playlist-hit {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 14px;
  text-align: left;
  color: inherit;
}
.playlist-hit img {
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
}
.playlist-hit:hover {
  border-color: rgb(255 255 255 / 0.45);
}
.playlist-hit:focus-visible,
.src-chip:focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  .search-fade-enter-active,
  .search-fade-leave-active {
    transition: opacity 160ms ease;
  }
  .search-fade-enter-from,
  .search-fade-leave-to {
    opacity: 0;
  }
}
.pop-hot-tag {
  position: absolute;
  top: -9px;
  right: -8px;
  z-index: 1;
  padding: 2px 6px;
  border: 1.5px solid var(--pop-ink);
  border-radius: 999px;
  background: var(--pop-yellow);
  color: var(--pop-ink);
  font-size: 9.5px;
  font-weight: 800;
  line-height: 1.3;
  white-space: nowrap;
}
/* 在线搜索空态：贴纸框插画居中，文案在其下，与原空态占位高度相当。 */
.pop-search-empty {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 0 8px;
  font-size: 13px;
  color: rgb(255 255 255 / 0.72);
}
.pop-search-art {
  width: 180px;
  height: 180px;
  border-radius: 22px;
  object-fit: cover;
}
</style>
