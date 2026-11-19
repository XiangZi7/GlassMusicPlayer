<script setup lang="ts">
import LibraryTabs from '@/components/player/LibraryTabs.vue'
import SmartPlaylists from '@/pages/library/components/smart-playlists.vue'
</script>

<template>
  <div
    class="page-panel hidden h-full"
    data-panel="smart"
  >
    <div class="flex h-full min-h-0 flex-col">
      <div class="pg-head flex-none">
        <h3>智能歌单</h3>
      </div>
      <!-- 音乐库分类：访问其他曲库视图。 -->
      <LibraryTabs />
      <!-- 智能歌单：展开预览时只滚动歌单内容区。 -->
      <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
        <SmartPlaylists />
      </div>
    </div>
  </div>
</template>
