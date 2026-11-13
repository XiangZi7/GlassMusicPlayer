<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <aside class="sidebar">
    <div class="side-pill" data-pill aria-hidden="true"></div>
    <div class="brand">
      <div class="logo">♪</div>
      <div><b>Aura Player</b><span>FROSTED EDITION</span></div>
    </div>
    <BaseButton class="navitem on" data-nav="home"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z" /></svg
      >首页</BaseButton
    >
    <BaseButton class="navitem" data-nav="search"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" /></svg
      >搜索</BaseButton
    >
    <BaseButton class="navitem" data-nav="library" data-hub="lib"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M4 6h16M4 12h16M4 18h10" /></svg
      >音乐库<span class="count">1,248</span></BaseButton
    >
    <BaseButton class="navitem" data-nav="connect" data-hub="src"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M10 14a5 5 0 007.1 0l2.4-2.4a5 5 0 00-7.1-7.1L11 5.9" />
        <path d="M14 10a5 5 0 00-7.1 0L4.5 12.4a5 5 0 007.1 7.1L13 18.1" /></svg
      >内容导入<span class="count" data-conn-count>0/3</span></BaseButton
    >
    <BaseButton class="navitem" data-nav="radio"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <path
          d="M8.5 15.5a5 5 0 010-7M15.5 8.5a5 5 0 010 7M5.6 18.4a9.4 9.4 0 010-12.8M18.4 5.6a9.4 9.4 0 010 12.8"
        /></svg
      >歌曲电台<span class="count" data-radio-count></span
    ></BaseButton>
    <div class="side-label side-mini-label">
      <span>我的歌单</span
      ><BaseButton class="newpl-btn" data-newpl type="button"
        >＋ 新建</BaseButton
      >
    </div>
    <div data-sidebar-lists></div>
    <div data-my-lists></div>
    <div class="side-label">桌面独有</div>
    <BaseButton class="navitem" data-util="mini"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M8 21h8" /></svg
      >迷你播放器</BaseButton
    >
    <BaseButton class="navitem" data-util="lyr"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M4 7h16M4 12h10M4 17h13" /></svg
      >悬浮歌词窗</BaseButton
    >
    <BaseButton class="navitem" data-util="media"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <rect x="3" y="5" width="18" height="13" rx="2" />
        <path d="M10 9.4v5.2l4.6-2.6z" fill="currentColor" stroke="none" /></svg
      >系统媒体控制</BaseButton
    >
    <BaseButton class="navitem" data-nav="settings"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        /></svg
      >设置</BaseButton
    >
    <div class="side-foot">
      <img src="/images/amber-season.webp" alt="用户头像" />
      <div><b>Haruto</b><span>本地音乐库 · FLAC</span></div>
    </div>
  </aside>
</template>
