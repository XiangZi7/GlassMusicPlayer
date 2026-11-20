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
      <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
      <LibraryTabs flush />
      <!-- 紧凑工具栏：排序与清空历史共用一行，不重复页面标题。 -->
      <div
        class="sortbar mt-3 mb-1 flex flex-none flex-wrap items-center justify-between gap-2"
      >
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
        <BaseButton
          class="clear-btn min-h-[28px] flex-none rounded-full p-[6px_13px] text-[11.5px] font-extrabold"
          data-clear-recent
          type="button"
          >清空历史</BaseButton
        >
      </div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
      <TrackList
        :indices="recent"
        list-key="recent"
        fit-height
        empty-icon="history"
        empty="还没有播放记录。"
      />
    </div>
  </div>
</template>
