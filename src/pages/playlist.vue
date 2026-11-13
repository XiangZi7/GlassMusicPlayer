<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
import {computed} from 'vue';
import TrackList from '@/components/player/TrackList.vue';
import {usePlayer} from '@/composables/usePlayer';
const {state,tracks}=usePlayer();
const playlistIndices=computed(()=>tracks.map((_,index)=>(state.playlistIdx+index)%tracks.length));
</script>

<template>
<!-- playlist 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="playlist">
      <div class="pl-head">
        <img data-pl-cover alt="歌单封面" />
        <div class="pl-info">
          <div class="pl-kicker">歌单 · PLAYLIST</div>
          <h3 data-pl-name></h3>
          <p data-pl-desc></p>
          <div class="pl-actions">
            <BaseButton class="banner-play" data-pl-play
              ><svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" /></svg
              >播放全部</BaseButton
            ><span data-pl-meta></span>
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
            { label: '默认', value: 'pl:def' },
            { label: '歌名', value: 'pl:title' },
            { label: '歌手', value: 'pl:artist' },
            { label: '时长', value: 'pl:dur' },
          ]"
        />
      </div>
      <div class="table-head">
        <span>#</span><span>标题</span><span>专辑</span
        ><span style="text-align: right">时长</span><span></span>
      </div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
<TrackList :indices="playlistIndices" list-key="pl" />
    </div>
</template>
