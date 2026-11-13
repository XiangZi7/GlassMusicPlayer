<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, tracks } = usePlayer()
const artistIndices = computed(() =>
  tracks
    .map((_, index) => index)
    .filter(
      index => tracks[index]!.artist === tracks[state.playlistIdx]!.artist
    )
)
</script>

<template>
  <!-- artist 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="artist"
  >
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
    <div class="pl-head flex items-center gap-[18px]">
      <img
        data-ard-cover
        alt="歌手封面"
      />
      <div class="pl-info min-w-[0]">
        <div
          class="pl-kicker font-mono text-[10.5px] font-bold tracking-[.14em] opacity-[.62]"
        >
          歌手 · ARTIST
        </div>
        <h3 data-ard-name></h3>
        <p data-ard-desc></p>
        <div class="pl-actions mt-[14px] flex items-center gap-[12px]">
          <!-- 页面操作按钮：播放全部。 -->
          <BaseButton
            class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
            data-ard-play
            ><svg
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5.5v13l11-6.5z" /></svg
            >播放全部</BaseButton
          ><span data-ard-meta></span>
        </div>
      </div>
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
          { label: '默认', value: 'ard:def' },
          { label: '歌名', value: 'ard:title' },
          { label: '歌手', value: 'ard:artist' },
          { label: '时长', value: 'ard:dur' },
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
      :indices="artistIndices"
      list-key="ard"
    />
  </div>
</template>
