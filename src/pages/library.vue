<script setup lang="ts">
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
import {computed} from 'vue';
import TrackList from '@/components/player/TrackList.vue';
import {usePlayer} from '@/composables/usePlayer';
const {state,tracks}=usePlayer();
const allIndices=computed(()=>tracks.map((_,index)=>index));
const likedIndices=computed(()=>tracks.map((_,index)=>index).filter(index=>state.liked[index]));
</script>

<template>
<!-- library 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="library">
      <div class="pg-head">
        <h3>音乐库</h3>
        <p>
          本地音乐库的全部内容 — 用上方标签在全部歌曲 / 专辑 / 歌手 / 我喜欢的 /
          最近播放之间切换，列表带分页，点任意一行即可播放。
        </p>
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
      <div class="lib-stats">
        <div><b data-lib-nsongs>24</b><span>歌曲</span></div>
        <div><b data-lib-nalbums>4</b><span>专辑</span></div>
        <div><b data-lib-nartists>4</b><span>歌手</span></div>
        <div><b data-lib-total>0:00</b><span>总时长</span></div>
      </div>
      <div class="pg-secttl">全部歌曲</div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'lib:def' },
            { label: '歌名', value: 'lib:title' },
            { label: '歌手', value: 'lib:artist' },
            { label: '时长', value: 'lib:dur' },
          ]"
        />
      </div>
      <div class="table-head">
        <span>#</span><span>标题</span><span>专辑</span
        ><span style="text-align: right">时长</span><span></span>
      </div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
<TrackList :indices="allIndices" list-key="lib" />
      <div class="pg-secttl">我的收藏 · <span data-lib-liked>0</span> 首</div>
      <div class="sortbar">
        <span class="sort-lab">排序</span
        ><SlidingTabs
          kind="segment"
          class="sort-seg"
          role="group"
          aria-label="列表排序"
          hook="data-sort"
          :options="[
            { label: '默认', value: 'libLiked:def' },
            { label: '歌名', value: 'libLiked:title' },
            { label: '歌手', value: 'libLiked:artist' },
            { label: '时长', value: 'libLiked:dur' },
          ]"
        />
      </div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
<TrackList :indices="likedIndices" list-key="libLiked" empty="还没有收藏的歌曲 — 在播放栏或全屏页点爱心，收藏的歌会出现在这里。" />
      <div class="pg-secttl">智能歌单 · 按规则自动生成</div>
      <div class="smart-grid" data-smart-grid></div>
    </div>
</template>
