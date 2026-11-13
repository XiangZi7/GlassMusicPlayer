<script setup lang="ts">
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, tracks } = usePlayer()
const allIndices = computed(() => tracks.map((_, index) => index))
const likedIndices = computed(() =>
  tracks.map((_, index) => index).filter(index => state.liked[index])
)
import SmartPlaylists from '@/pages/library/components/smart-playlists.vue'
import { formatTime } from '@/utils/format'
const totalTime = computed(() =>
  formatTime(tracks.reduce((sum, track) => sum + track.dur, 0))
)
</script>

<template>
  <!-- library 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="library"
  >
    <div class="pg-head">
      <h3>音乐库</h3>
      <p>
        本地音乐库的全部内容 — 用上方标签在全部歌曲 / 专辑 / 歌手 / 我喜欢的 /
        最近播放之间切换，列表带分页，点任意一行即可播放。
      </p>
    </div>
    <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
    <PlayerTabs
      class="pg-tabs mt-[16px] inline-flex max-w-[100%] flex-wrap gap-[4px] rounded-full p-[4px]"
      role="tablist"
      aria-label="音乐库分类"
      hook="data-lib-tab"
      :options="[
        { label: '全部歌曲', value: 'library' },
        { label: '专辑', value: 'albums' },
        { label: '歌手', value: 'artists' },
        { label: '我喜欢的', value: 'liked' },
        { label: '最近播放', value: 'recent' },
      ]"
    />
    <div class="lib-stats mt-[16px] grid grid-cols-[repeat(4,1fr)] gap-[10px]">
      <div>
        <b>{{ tracks.length }}</b><span>歌曲</span>
      </div>
      <div>
        <b>{{ new Set(tracks.map(track => track.album)).size }}</b><span
          >专辑</span
        >
      </div>
      <div>
        <b>{{ new Set(tracks.map(track => track.artist)).size }}</b><span
          >歌手</span
        >
      </div>
      <div>
        <b>{{ totalTime }}</b><span>总时长</span>
      </div>
    </div>
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      全部歌曲
    </div>
    <div class="sortbar m-[12px_2px_2px] flex flex-wrap items-center gap-[9px]">
      <span
        class="sort-lab text-[11px] font-extrabold tracking-[.08em] opacity-[.55]"
        >排序</span
      ><!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
      <PlayerTabs
        kind="segment"
        class="sort-seg inline-flex gap-[3px] rounded-full p-[3px]"
        role="group"
        aria-label="列表排序"
        hook="data-sort"
        :options="[
          { label: '默认', value: 'lib:def' },
          { label: '歌名', value: 'lib:title' },
          { label: '歌手', value: 'lib:artist' },
          { label: '时长', value: 'lib:dur' },
        ]"
      />
    </div>
    <div
      class="table-head mb-[4px] grid grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] p-[0_10px] pt-[16px] pb-[8px] text-[11px] font-extrabold tracking-[.08em] opacity-[.5]"
    >
      <span>#</span><span>标题</span><span>专辑</span
      ><span style="text-align: right">时长</span><span></span>
    </div>
    <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
    <TrackList
      :indices="allIndices"
      list-key="lib"
    />
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      我的收藏 · <span>{{ likedIndices.length }}</span> 首
    </div>
    <div class="sortbar m-[12px_2px_2px] flex flex-wrap items-center gap-[9px]">
      <span
        class="sort-lab text-[11px] font-extrabold tracking-[.08em] opacity-[.55]"
        >排序</span
      ><!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
      <PlayerTabs
        kind="segment"
        class="sort-seg inline-flex gap-[3px] rounded-full p-[3px]"
        role="group"
        aria-label="列表排序"
        hook="data-sort"
        :options="[
          { label: '默认', value: 'libLiked:def' },
          { label: '歌名', value: 'libLiked:title' },
          { label: '歌手', value: 'libLiked:artist' },
          { label: '时长', value: 'libLiked:dur' },
        ]"
      />
    </div>
    <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
    <TrackList
      :indices="likedIndices"
      list-key="libLiked"
      empty="还没有收藏的歌曲 — 在播放栏或全屏页点爱心，收藏的歌会出现在这里。"
    />
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      智能歌单 · 按规则自动生成
    </div>
    <!-- 音乐库智能歌单组件：规则生成、展开预览与播放全部。 -->
    <SmartPlaylists />
  </div>
</template>
