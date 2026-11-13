<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <aside class="right">
    <div class="right-head">
      <span>正在播放</span><span data-meta2>TRACK 01 / 04</span
      ><BaseButton
        class="np-head-btn"
        data-np-toggle
        aria-label="收起正在播放面板"
        title="收起面板"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5.5 9.5L12 16l6.5-6.5" /></svg
      ></BaseButton>
    </div>
    <div class="r-coverwrap">
      <div class="r-glow" data-glow></div>
      <img class="r-cover" data-cover alt="专辑封面" />
    </div>
    <div class="r-ttl">
      <div>
        <h4 data-title></h4>
        <p data-artist></p>
      </div>
      <BaseButton class="heart" data-like aria-label="收藏"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5 5 7.6 5c1.7 0 3.4 1 4.4 2.6C13 6 14.7 5 16.4 5 19 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8z"
          /></svg
      ></BaseButton>
    </div>
    <div class="subrow">
      <BaseButton data-lyricbtn>歌词</BaseButton
      ><BaseButton data-airbtn>输出 · 桌面音箱</BaseButton>
    </div>
    <div class="lyricbox" data-lyric>
      <div class="dim">城市把灯都调成了慢动作</div>
      <div>而你刚好路过我的副歌</div>
      <div class="dim">晚风替我说完那句抱歉</div>
      <div class="dim">我们就不再绕远了</div>
    </div>
    <div class="secttl q-secttl">
      <span>接下来播放 · QUEUE</span
      ><span class="q-radio-chip" data-radio-chip hidden>电台续播中</span
      ><BaseButton class="q-radio-btn" data-radio-quick type="button"
        >开启电台</BaseButton
      >
    </div>
    <div class="queue" data-queue></div>
    <BaseButton class="np-expand" data-np-toggle aria-label="展开正在播放面板"
      ><span>正在播放</span
      ><span class="np-expand-meta" data-meta2>TRACK 01 / 04</span
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5.5 14.5L12 8l6.5 6.5" /></svg
    ></BaseButton>
  </aside>
</template>
