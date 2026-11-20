<script setup lang="ts">
import { computed } from 'vue'
import LibraryTabs from '@/components/player/LibraryTabs.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'

const { tracks } = usePlayer()
const indices = computed(() => tracks.map((_, index) => index))
const totalTime = computed(() =>
  formatTime(tracks.reduce((sum, track) => sum + track.dur, 0))
)
</script>

<template>
  <div
    class="page-panel hidden h-full"
    data-panel="library"
  >
    <div class="flex h-full min-h-0 flex-col">
      <!-- 音乐库分类：每个标签页独立展示对应内容。 -->
      <LibraryTabs flush />
      <div
        class="mt-3 flex flex-none flex-wrap items-center justify-between gap-2"
      >
        <!-- 歌曲排序：复用播放器排序按钮。 -->
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
        <span class="text-xs opacity-70"
          >{{ indices.length }} 首 · {{ totalTime }}</span
        >
      </div>
      <div
        class="table-head mt-3 mb-1 grid flex-none grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] px-[10px] pb-2 text-[11px] font-extrabold tracking-[.08em] opacity-50"
      >
        <span>#</span><span>标题</span><span>专辑</span>
        <span class="text-right">时长</span><span></span>
      </div>
      <!-- 曲库列表：根据当前窗口可用高度分页。 -->
      <TrackList
        :indices="indices"
        list-key="lib"
        fit-height
      />
    </div>
  </div>
</template>
