<script setup lang="ts">
import LibraryCollectionGrid from '@/components/player/LibraryCollectionGrid.vue'
import LibraryTabs from '@/components/player/LibraryTabs.vue'
</script>

<template>
  <!-- albums 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden h-full"
    data-panel="albums"
  >
    <div class="flex h-full min-h-0 flex-col">
      <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
      <LibraryTabs flush />
      <!-- 专辑卡片区：按视口加载封面，保留曲库顺序与详情入口。 -->
      <LibraryCollectionGrid kind="album" />
    </div>
  </div>
</template>
