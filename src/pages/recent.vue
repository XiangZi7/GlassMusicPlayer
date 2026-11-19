<script setup lang="ts">
import { toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import LibraryTabs from '@/components/player/LibraryTabs.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state } = usePlayer()

const { recent } = toRefs(state)
</script>

<template>
  <!-- recent 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden h-full"
    data-panel="recent"
  >
    <div class="flex h-full min-h-0 flex-col">
      <div class="pg-head flex-none">
        <h3>最近播放</h3>
        <p>按最近一次播放的顺序排列 — 点任意一行继续听。</p>
      </div>
      <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
      <LibraryTabs />
      <div
        class="secttl-row flex flex-none items-start justify-between gap-[10px]"
      >
        <div
          class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          播放历史
        </div>
        <!-- 页面操作按钮：清空历史。 -->
        <BaseButton
          class="clear-btn m-[22px_2px_8px_0] min-h-[28px] flex-none rounded-full p-[6px_13px] text-[11.5px] font-extrabold"
          data-clear-recent
          type="button"
          >清空历史</BaseButton
        >
      </div>
      <div
        class="sortbar m-[12px_2px_2px] flex flex-none flex-wrap items-center gap-[9px]"
      >
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
            { label: '默认', value: 'recent:def' },
            { label: '歌名', value: 'recent:title' },
            { label: '歌手', value: 'recent:artist' },
            { label: '时长', value: 'recent:dur' },
          ]"
        />
      </div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
      <TrackList
        :indices="recent"
        list-key="recent"
        fit-height
        empty="还没有播放记录。"
      />
    </div>
  </div>
</template>
