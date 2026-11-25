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
      <!-- 页头波普点缀：与详情页同一半调配方，只铺标签条一带。 -->
      <div class="lib-pop-head">
        <span class="lib-pop-dots pop-halftone" aria-hidden="true" />
        <!-- 音乐库分类：访问其他曲库视图。 -->
        <LibraryTabs flush />
      </div>
      <!-- 智能歌单：展开预览时只滚动歌单内容区。 -->
      <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
        <SmartPlaylists />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 页头半调点阵：与歌手详情页同一配方（点阵色 9%、同尺寸），只铺页头带。 */
.lib-pop-head { position: relative; }
.lib-pop-dots {
  position: absolute;
  inset: -4px -8px;
  --pop-halftone-color: rgb(255 255 255 / 9%);
}
.lib-pop-head > :not(.lib-pop-dots) { position: relative; }
</style>
