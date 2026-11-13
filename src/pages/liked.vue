<script setup lang="ts">
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, tracks } = usePlayer()
const likedIndices = computed(() =>
  tracks.map((_, index) => index).filter(index => state.liked[index])
)
</script>

<template>
  <!-- liked 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="liked"
  >
    <div class="pg-head">
      <h3>我喜欢的</h3>
      <p>
        点过爱心的歌曲都在这里 — 共
        <span data-liked-total>0</span> 首，和音乐库的收藏列表同步。
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
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      收藏歌曲
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
          { label: '默认', value: 'liked:def' },
          { label: '歌名', value: 'liked:title' },
          { label: '歌手', value: 'liked:artist' },
          { label: '时长', value: 'liked:dur' },
        ]"
      />
    </div>
    <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
    <TrackList
      :indices="likedIndices"
      list-key="liked"
    />
    <div
      class="empty-note p-[14px_4px] text-[13px] leading-[1.7] opacity-[.55]"
      data-liked-empty
      style="display: none"
    >
      还没有收藏的歌曲 — 在播放栏或全屏页点爱心，收藏的歌会出现在这里。
    </div>
  </div>
</template>
