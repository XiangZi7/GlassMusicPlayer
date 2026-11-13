<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import FeaturedBanner from '@/pages/index/components/featured-banner.vue';
import {computed} from 'vue';
import TrackList from '@/components/player/TrackList.vue';
import {usePlayer} from '@/composables/usePlayer';
const {state,tracks,controller}=usePlayer();
const allIndices=computed(()=>tracks.map((_,index)=>index));
const albumIndicesForCards=computed(()=>tracks.map((_,i)=>i).filter(i=>tracks.findIndex(t=>t.album===tracks[i]!.album)===i));
</script>
<template>
<!-- 首页内容区：推荐专辑、曲库列表与分页。 -->
<div class="home-content">
    <div class="main-top">
      <div>
        <h3>晚上好</h3>
        <p>继续听 Night Drive · 上次听到第 2 首</p>
      </div>
      <div class="main-top-right">
        <div class="main-chips">
          <BaseButton class="on">全部</BaseButton><BaseButton>专辑</BaseButton
          ><BaseButton>歌手</BaseButton>
        </div>
      </div>
    </div>
    <!-- 首页主打横幅组件：展示当前主打、叠层封面与视差。 -->
<FeaturedBanner />
    <div class="feat-head">
      <h5>为你推荐</h5>
      <span>专辑 · 点击即播</span>
    </div>
    <!-- 推荐专辑组件区：按原稿点击封面即播。 -->
<div class="feat-grid"><BaseButton v-for="index in albumIndicesForCards" :key="index" class="feat" :class="{on:tracks[index]!.album===tracks[state.idx]!.album}" :data-ti="index" @click="controller()?.selectTrack(index,true)"><img :src="tracks[index]!.cover" :alt="tracks[index]!.album+' 封面'"><b>{{tracks[index]!.album}}</b><span>{{tracks[index]!.artist}}</span></BaseButton></div>
    <div class="table-head">
      <span>#</span><span>标题</span><span>专辑</span
      ><span style="text-align: right">时长</span><span></span>
    </div>
    <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
<TrackList :indices="allIndices" list-key="home" />
    <p
      style="
        font-size: 12px;
        opacity: 0.5;
        line-height: 1.7;
        margin: 14px 2px 0;
      "
    >
      主区故意用不透明纯色：桌面一屏要放十几行歌，玻璃铺到这里文字就糊了。这是两版共同的底线，差别只在侧边栏、右栏和播放栏。
    </p>
    </div>
</template>