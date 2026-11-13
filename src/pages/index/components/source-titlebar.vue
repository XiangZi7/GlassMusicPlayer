<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { controlWindow } from "@/services/desktop";
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <div class="win-chrome" data-tauri-drag-region>
    <div class="traffic"><i></i><i></i><i></i></div>
    <div class="chrome-nav">
      <BaseButton data-nav-back aria-label="后退"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14.5 5.5L8 12l6.5 6.5" /></svg></BaseButton
      ><BaseButton data-nav-fwd aria-label="前进"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9.5 5.5L16 12l-6.5 6.5" /></svg
      ></BaseButton>
    </div>
    <div class="chrome-title" data-chrome-title>首页</div>
    <label class="chrome-search"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" /></svg
      ><input
        type="text"
        data-top-search
        placeholder="搜索歌曲、专辑、歌手…"
        aria-label="搜索歌曲、专辑、歌手"
    /></label>
    <div
      class="weather-pill"
      role="img"
      aria-label="本地天气：夜晚多云，19度，演示数据"
      title="本地天气 · 演示数据，正式版接定位与天气接口后为实时"
    >
      <svg class="wx-icon" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <circle class="wx-star" cx="7.5" cy="6.5" r="1.3" fill="#FFE9A8" />
        <circle class="wx-star s2" cx="14.5" cy="3.6" r=".9" fill="#ffffff" />
        <path
          class="wx-moon"
          d="M24.6 3.4a8.2 8.2 0 1 0 7.9 11.9A9.6 9.6 0 0 1 24.6 3.4z"
          fill="#F6DC8A"
        />
        <g class="wx-cloud">
          <path
            d="M8.4 27.8a5.2 5.2 0 0 1-.7-10.35 7.2 7.2 0 0 1 13.9-1.55A5.6 5.6 0 0 1 26.2 21.3c.3 3.4-2.2 6.5-6 6.5H8.4z"
            fill="rgba(255,255,255,.94)"
          />
        </g></svg
      ><span class="wx-temp">19°</span><span class="wx-cond">多云</span>
    </div>
    <div class="chrome-acts">
      <BaseButton
        class="native-chrome-button"
        aria-label="最小化窗口"
        @click="controlWindow('minimize')"
        >—</BaseButton
      ><BaseButton
        class="native-chrome-button"
        aria-label="最大化窗口"
        @click="controlWindow('maximize')"
        >▢</BaseButton
      ><BaseButton
        class="native-chrome-button"
        aria-label="关闭窗口"
        @click="controlWindow('close')"
        >✕</BaseButton
      >
    </div>
  </div>
</template>
