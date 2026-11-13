<script setup lang="ts">
import { toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FeaturedBanner from '@/pages/index/components/featured-banner.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, tracks, controller } = usePlayer()
const allIndices = computed(() => tracks.map((_, index) => index))
const albumIndicesForCards = computed(() =>
  tracks
    .map((_, i) => i)
    .filter(i => tracks.findIndex(t => t.album === tracks[i]!.album) === i)
)
const { idx } = toRefs(state)
</script>
<template>
  <!-- 首页内容区：推荐专辑、曲库列表与分页。 -->
  <div class="home-content">
    <div
      class="main-top mb-[14px] flex items-center justify-between gap-[12px]"
    >
      <div>
        <h3>晚上好</h3>
        <p>继续听 Night Drive · 上次听到第 2 首</p>
      </div>
      <div
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
    <!-- 首页主打横幅组件：展示当前主打、叠层封面与视差。 -->
    <FeaturedBanner />
    <div
      class="feat-head relative z-[1] m-[22px_2px_12px] flex min-h-[0] items-baseline justify-between gap-[12px] p-0"
    >
      <h5>为你推荐</h5>
      <span>专辑 · 点击即播</span>
    </div>
    <!-- 推荐专辑组件区：按原稿点击封面即播。 -->
    <div class="feat-grid grid grid-cols-[repeat(4,1fr)] gap-[14px]">
      <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
      <BaseButton
        v-for="index in albumIndicesForCards"
        :key="index"
        class="feat relative rounded-[18px] border border-transparent bg-transparent p-[10px_10px_12px] text-left text-inherit"
        :class="{ on: tracks[index]!.album === tracks[idx]!.album }"
        :data-ti="index"
        @click="controller()?.selectTrack(index, true)"
        ><img
          :src="tracks[index]!.cover"
          :alt="tracks[index]!.album + ' 封面'"
        /><b>{{ tracks[index]!.album }}</b
        ><span>{{ tracks[index]!.artist }}</span></BaseButton
      >
    </div>
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
