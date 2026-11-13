<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import {computed} from 'vue';
import TrackList from '@/components/player/TrackList.vue';
import {usePlayer} from '@/composables/usePlayer';
const {state,tracks,controller}=usePlayer();
const searchIndices=computed(()=>tracks.map((_,index)=>index).filter(index=>{const track=tracks[index]!;return !state.query.trim()||(track.title+" "+track.artist+" "+track.album).toLowerCase().includes(state.query.trim().toLowerCase());}));
const artistCards=computed(()=>tracks.map((_,i)=>i).filter(i=>tracks.findIndex(t=>t.artist===tracks[i]!.artist)===i));
</script>

<template>
<!-- search 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="search">
      <div class="pg-head">
        <h3>搜索</h3>
        <p>在本地音乐库里找歌 — 输入歌名、歌手或专辑即可筛选，两窗口同步。</p>
      </div>
      <div class="search-box">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" /></svg
        ><input
          type="text"
          data-search-input
          placeholder="搜索歌曲、专辑、歌手…"
          aria-label="搜索歌曲、专辑、歌手"
        />
      </div>
      <div class="search-tags">
        <span>热门</span
        ><BaseButton data-tag="Night Drive">Night Drive</BaseButton
        ><BaseButton data-tag="June Harbor">June Harbor</BaseButton
        ><BaseButton data-tag="Chrome">Chrome</BaseButton
        ><BaseButton data-tag="Bauhaus">Bauhaus</BaseButton>
      </div>
      <div class="pg-secttl" data-search-label>全部歌曲</div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
<TrackList :indices="searchIndices" list-key="search" />
      <div class="empty-note" data-search-empty style="display: none">
        没有找到匹配的歌曲，换个关键词试试。
      </div>
      <div class="pg-secttl">歌手 · 点击按歌手筛选</div>
      <!-- 歌手筛选卡片区：沿用原稿封面、文字与点击筛选。 -->
<div class="artist-row"><BaseButton v-for="index in artistCards" :key="index" class="artist-card" @click="controller()?.setQuery(tracks[index]!.artist)"><img :src="tracks[index]!.cover" :alt="tracks[index]!.artist"><b>{{tracks[index]!.artist}}</b><span>{{tracks[index]!.album}}</span></BaseButton></div>
    </div>
</template>
