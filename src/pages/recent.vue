<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
import TrackList from '@/components/player/TrackList.vue';
import {usePlayer} from '@/composables/usePlayer';
const {state}=usePlayer();

</script>

<template>
<!-- recent 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="recent">
      <div class="pg-head">
        <h3>最近播放</h3>
        <p>按最近一次播放的顺序排列 — 点任意一行继续听。</p>
      </div>
      <SlidingTabs
        class="pg-tabs"
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
      <div class="secttl-row">
        <div class="pg-secttl">播放历史</div>
        <BaseButton class="clear-btn" data-clear-recent type="button"
          >清空历史</BaseButton
        >
      </div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
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
      </div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
<TrackList :indices="state.recent" list-key="recent" />
      <div class="empty-note" data-recent-empty style="display: none">
        还没有播放记录 — 点任意一首歌开始播放，历史会出现在这里。
      </div>
    </div>
</template>
