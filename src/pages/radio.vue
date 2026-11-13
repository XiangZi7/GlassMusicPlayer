<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
</script>

<template>
<!-- radio 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="radio">
      <div class="pg-head">
        <h3>歌曲电台</h3>
        <p>
          以正在播放的这首歌为种子 —
          先排同专辑、再同歌手，其余按相似度排队续播；播到队尾不会停，电台会继续往后续。开启后队列头会亮起「电台续播中」，队列顺序就是电台的播放顺序，照样可以拖拽调整。
        </p>
      </div>
      <div class="radio-seed" data-radio-seed></div>
      <div class="pl-actions" style="margin-top: 12px">
        <BaseButton class="banner-play" data-radio-toggle>开始电台</BaseButton
        ><span data-radio-status></span>
      </div>
      <div class="pg-secttl">接下来 · 电台队列</div>
      <div
        data-radio-list
        style="display: flex; flex-direction: column; gap: 5px"
      ></div>
    </div>
</template>
