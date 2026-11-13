<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
import {computed} from 'vue';
import {usePlayer} from '@/composables/usePlayer';
import {formatTime} from '@/utils/format';
const {tracks,controller}=usePlayer();
const indices=computed(()=>tracks.map((_,i)=>i).filter(i=>tracks.findIndex(t=>t.artist===tracks[i]!.artist)===i));
</script>

<template>
<!-- artists 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="artists">
      <div class="pg-head">
        <h3>歌手</h3>
        <p>音乐库里的全部歌手 — 点任意一位进入歌手详情。</p>
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
      <!-- 歌手卡片区：按原稿排版进入详情页。 -->
<div class="artist-row" style="margin-top:16px"><BaseButton v-for="index in indices" :key="index" class="artist-card" @click="controller()?.navigate('artist',index)"><img :src="tracks[index]!.cover" :alt="tracks[index]!.artist"><b>{{tracks[index]!.artist}}</b><span>{{tracks[index]!.album+' · '+formatTime(tracks[index]!.dur)}}</span></BaseButton></div>
    </div>
</template>
