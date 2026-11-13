<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { computed } from 'vue'
import { usePlayer } from '@/composables/usePlayer'
const { tracks, controller } = usePlayer()
const indices = computed(() =>
  tracks
    .map((_, i) => i)
    .filter(i => tracks.findIndex(t => t.album === tracks[i]!.album) === i)
)
</script>

<template>
  <!-- albums 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="albums"
  >
    <div class="pg-head">
      <h3>专辑</h3>
      <p>音乐库里的全部专辑 — 点任意一张封面进入专辑详情。</p>
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
    <!-- 专辑卡片区：按原稿排版进入详情页。 -->
    <div
      class="feat-grid grid grid-cols-[repeat(4,1fr)] gap-[14px]"
      style="margin-top: 16px"
    >
      <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
      <BaseButton
        v-for="index in indices"
        :key="index"
        class="feat relative rounded-[18px] border border-transparent bg-transparent p-[10px_10px_12px] text-left text-inherit"
        @click="controller()?.navigate('album', index)"
        ><img
          :src="tracks[index]!.cover"
          :alt="tracks[index]!.album"
        /><b>{{ tracks[index]!.album }}</b
        ><span>{{
          tracks[index]!.artist + ' · ' + tracks[index]!.q
        }}</span></BaseButton
      >
    </div>
  </div>
</template>
