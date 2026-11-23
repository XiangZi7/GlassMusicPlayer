<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import LibraryTabs from '@/components/player/LibraryTabs.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, tracks } = usePlayer()
const albumIndices = computed(() =>
  tracks
    .map((_, index) => index)
    .filter(index => tracks[index]!.album === tracks[state.playlistIdx]?.album)
)
</script>

<template>
  <!-- album 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="album"
  >
    <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
    <LibraryTabs />
    <div class="pl-head flex items-center gap-[18px]">
      <img decoding="async" loading="lazy"
        data-ad-cover
        alt="专辑封面"
      />
      <div class="pl-info min-w-[0]">
        <div
          class="pl-kicker font-mono text-[10.5px] font-bold tracking-[.14em] opacity-[.62]"
        >
          专辑 · ALBUM
        </div>
        <h3 data-ad-name></h3>
        <p data-ad-desc></p>
        <div class="pl-actions mt-[14px] flex items-center gap-[12px]">
          <!-- 页面操作按钮：播放全部。 -->
          <BaseButton
            class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
            data-ad-play
            :disabled="!albumIndices.some(index => tracks[index]?.catalog)"
            ><svg
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5.5v13l11-6.5z" /></svg
            >播放全部</BaseButton
          ><span data-ad-meta></span>
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
          { label: '默认', value: 'ad:def' },
          { label: '歌名', value: 'ad:title' },
          { label: '歌手', value: 'ad:artist' },
          { label: '时长', value: 'ad:dur' },
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
      :indices="albumIndices"
      list-key="ad"
    />
  </div>
</template>
