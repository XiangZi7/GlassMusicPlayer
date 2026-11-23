<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import FeaturedBanner from '@/pages/index/components/featured-banner.vue'
import RecommendedAlbums from '@/pages/index/components/recommended-albums.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, tracks } = usePlayer()
const allIndices = computed(() => tracks.map((_, index) => index))
const current = computed(() => tracks[state.idx])
</script>
<template>
  <!-- 首页内容区：推荐专辑、曲库列表与分页。 -->
  <div class="home-content">
    <div
      class="main-top mb-[14px] flex items-center justify-between gap-[12px]"
    >
      <div class="min-w-0">
        <h3>晚上好</h3>
        <p
          v-if="current"
          class="truncate"
          :title="current.title"
        >
          {{ state.playing ? '正在播放' : '当前曲目' }} · {{ current.title }}
        </p>
      </div>
      <div
        v-if="tracks.length"
        class="main-top-right flex flex-wrap items-center justify-end gap-[8px]"
      >
        <div class="main-chips flex gap-[7px]">
          <!-- 页面操作按钮：全部。 -->
          <BaseButton class="on">全部</BaseButton><!-- 页面操作按钮：专辑。 -->
          <BaseButton>专辑</BaseButton><!-- 页面操作按钮：歌手。 -->
          <BaseButton>歌手</BaseButton>
        </div>
      </div>
    </div>
    <!-- 首页主打横幅组件：展示当前主打、人物立绘与背景频谱。 -->
    <FeaturedBanner v-if="tracks.length" />
    <!-- 推荐专辑组件：展示真实曲库中的专辑与翻页控制。 -->
    <RecommendedAlbums />
    <template v-if="allIndices.length">
      <div
        class="table-head mb-[4px] grid grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] p-[0_10px] pt-[16px] pb-[8px] text-[11px] font-extrabold tracking-[.08em] opacity-[.5]"
      >
        <span>#</span><span>标题</span><span>专辑</span
        ><span style="text-align: right">时长</span><span></span>
      </div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
      <TrackList
        :indices="allIndices"
        list-key="home"
      />
    </template>
  </div>
</template>
