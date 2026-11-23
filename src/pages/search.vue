<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerSearchBox from '@/components/player/PlayerSearchBox.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import TrackRow from '@/components/player/TrackRow.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  searchPageSize,
  useCatalogSearch,
} from '@/composables/useCatalogSearch'
import { usePlayer } from '@/composables/usePlayer'
import {
  catalogKey,
  platformNames,
  toSourceTrack,
} from '@/services/player/catalog'
import { usePlayerStore } from '@/stores/player'
import { firstTrackIndices } from '@/services/player/library'
const { state, tracks, controller } = usePlayer()
const { registerCatalogTracks } = usePlayerStore()
const { query, platform, pageNum, result, loading, failed } =
  useCatalogSearch(state)
const sources = { ...platformNames, local: '本地曲库' } as const
const onlineRows = computed(() =>
  (result.value?.tracks || []).map(toSourceTrack)
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
          (track.title + ' ' + track.artist + ' ' + track.album)
            .toLowerCase()
            .includes(state.query.trim().toLowerCase()))
      )
    })
)
const artistCards = computed(() => firstTrackIndices(tracks, 'artist', true))

// 用搜索结果页建立播放队列，从用户点选的位置开始播放。
function playOnline(position: number): void {
  if (!result.value) return
  const indices = registerCatalogTracks(result.value.tracks)
  const index = indices[position]
  if (index !== undefined) controller()?.playTracks(indices, index)
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
      <p>选择曲库，按歌曲或歌手搜索。</p>
    </div>
    <PlayerSearchBox variant="page" />
    <!-- 曲库选择区：三个在线平台共用关键词，保留本地曲库筛选。 -->
    <div
      class="search-tags mt-[12px] flex flex-wrap items-center gap-[7px]"
      role="group"
      aria-label="搜索曲库"
    >
      <BaseButton
        v-for="(label, key) in sources"
        :key="key"
        :class="{ on: platform === key }"
        :aria-pressed="platform === key"
        @click="platform = key"
        >{{ label }}</BaseButton
      >
    </div>
    <!-- 在线列表使用服务端分页，点击曲目进入同一播放队列。 -->
    <div
      v-if="platform !== 'local'"
      class="mt-[16px]"
      :aria-busy="loading"
    >
      <div
        v-if="loading"
        class="grid min-h-[120px] place-items-center text-[13px]"
        role="status"
      >
        搜索中…
      </div>
      <EmptyState
        v-else-if="!query"
        class="min-h-[160px]"
        icon="search"
        :label="'输入关键词搜索' + platformNames[platform]"
      />
      <p
        v-else-if="failed"
        class="empty-note p-[14px_4px] text-[13px]"
        role="alert"
      >
        搜索暂不可用。
      </p>
      <EmptyState
        v-else-if="!onlineRows.length"
        class="min-h-[160px]"
        icon="search"
        label="没有找到匹配的歌曲"
      />
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
        <!-- 搜索页码发送给 FastAPI，显示平台返回的总条数。 -->
        <PaginationBar
          v-if="result?.total != null"
          v-model:current="pageNum"
          page-key="catalog-search"
          :total="Math.min(result.total, searchPageSize * 1000)"
        />
      </template>
    </div>
    <template v-else>
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
          ><img decoding="async" loading="lazy"
            :src="tracks[index]!.cover"
            :alt="tracks[index]!.artist"
          /><b>{{ tracks[index]!.artist }}</b
          ><span>{{ tracks[index]!.album }}</span></BaseButton
        >
      </div>
    </template>
  </div>
</template>
