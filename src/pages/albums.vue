<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import LibraryTabs from '@/components/player/LibraryTabs.vue'
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
    class="page-panel hidden h-full"
    data-panel="albums"
  >
    <div class="flex h-full min-h-0 flex-col">
      <div class="pg-head flex-none">
        <h3>专辑</h3>
        <p>音乐库里的全部专辑 — 点任意一张封面进入专辑详情。</p>
      </div>
      <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
      <LibraryTabs />
      <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
        <!-- 专辑卡片区：按原稿排版进入详情页。 -->
        <div class="feat-grid grid grid-cols-[repeat(4,1fr)] gap-[14px]">
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
    </div>
  </div>
</template>
