<script setup lang="ts">
import LibraryTabs from '@/components/player/LibraryTabs.vue'
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
    class="page-panel hidden h-full"
    data-panel="liked"
  >
    <div class="flex h-full min-h-0 flex-col">
      <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
      <LibraryTabs flush />
      <!-- 收藏与最近播放共用紧凑排序布局，分类标签已说明当前页面。 -->
      <div
        class="sortbar mt-3 mb-1 flex flex-none flex-wrap items-center gap-2"
      >
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
        fit-height
        empty-icon="heart"
        empty="还没有收藏的歌曲。在播放栏或全屏播放页点爱心，即可收藏。"
      />
    </div>
  </div>
</template>
