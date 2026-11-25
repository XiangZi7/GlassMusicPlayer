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
      <!-- 页头波普点缀：与详情页同一半调配方只铺页头带，右端压一枚小星贴纸。 -->
      <div class="coll-head">
        <span class="coll-head-dots pop-halftone" aria-hidden="true" />
        <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
        <LibraryTabs flush />
        <span class="coll-head-star pop-sticker" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path class="sticker-halo" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
            <path class="sticker-star" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
          </svg>
        </span>
      </div>
      <!-- 专辑卡片区：按视口加载封面，保留曲库顺序与详情入口。 -->
      <LibraryCollectionGrid kind="album" empty-art="/images/pop-library.webp" />
    </div>
  </div>
</template>

<style scoped>
/* 页头半调点阵：与歌手详情页同一配方（点阵色 9%、同尺寸），只铺标签条一带。 */
.coll-head { position: relative; }
.coll-head-dots {
  position: absolute;
  inset: -4px -8px;
  --pop-halftone-color: rgb(255 255 255 / 9%);
}
.coll-head > :not(.coll-head-dots):not(.coll-head-star) { position: relative; }
/* 页头星星贴纸：与首页榜单同一星形配方，收小到 20px 贴在页头带右端。 */
.coll-head-star {
  position: absolute;
  top: 50%;
  right: 4px;
  width: 20px;
  height: 20px;
  margin-top: -10px;
}
.coll-head-star svg { display: block; width: 100%; height: 100%; }
.coll-head-star .sticker-halo { fill: #fff; }
.coll-head-star .sticker-star {
  fill: var(--pop-yellow);
  stroke: var(--pop-ink);
  stroke-width: 1.4;
  transform: scale(0.76);
  transform-origin: center;
}
</style>
