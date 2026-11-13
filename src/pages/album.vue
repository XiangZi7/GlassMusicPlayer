<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
import {computed} from 'vue';
import TrackList from '@/components/player/TrackList.vue';
import {usePlayer} from '@/composables/usePlayer';
const {state,tracks}=usePlayer();
const albumIndices=computed(()=>tracks.map((_,index)=>index).filter(index=>tracks[index]!.album===tracks[state.playlistIdx]!.album));
</script>

<template>
<!-- album 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="album">
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
      <div class="pl-head">
        <img data-ad-cover alt="专辑封面" />
        <div class="pl-info">
          <div class="pl-kicker">专辑 · ALBUM</div>
          <h3 data-ad-name></h3>
          <p data-ad-desc></p>
          <div class="pl-actions">
            <BaseButton class="banner-play" data-ad-play
              ><svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" /></svg
              >播放全部</BaseButton
            ><span data-ad-meta></span>
          </div>
        </div>
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
            { label: '默认', value: 'ad:def' },
            { label: '歌名', value: 'ad:title' },
            { label: '歌手', value: 'ad:artist' },
            { label: '时长', value: 'ad:dur' },
          ]"
        />
      </div>
      <div class="table-head">
        <span>#</span><span>标题</span><span>专辑</span
        ><span style="text-align: right">时长</span><span></span>
      </div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
<TrackList :indices="albumIndices" list-key="ad" />
    </div>
</template>
