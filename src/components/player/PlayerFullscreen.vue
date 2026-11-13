<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import QueueList from '@/components/player/QueueList.vue';
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <div class="fs" data-fs aria-label="全屏播放页">
    <div class="fs-bg" data-fs-bg></div>
    <div class="fs-shade"></div>
    <div class="fs-top">
      <div class="fs-topleft">
        <BaseButton
          class="fs-topbtn"
          data-stage-toggle
          aria-label="关闭全屏播放"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          >
            <path d="M6 9l6 6 6-6" /></svg></BaseButton
        ><span class="fs-specmono" data-fs-spec>FLAC · 24-BIT</span>
      </div>
      <span class="fs-toptitle">正在播放 · NOW PLAYING</span>
      <div class="fs-topright">
        <div
          class="fs-weather"
          role="img"
          aria-label="本地天气：夜晚多云，19度，演示数据"
          title="本地天气 · 演示数据"
        >
          <svg
            class="wx-icon wx-icon-sm"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
          >
            <circle class="wx-star" cx="7.5" cy="6.5" r="1.3" fill="#FFE9A8" />
            <circle
              class="wx-star s2"
              cx="14.5"
              cy="3.6"
              r=".9"
              fill="#ffffff"
            />
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
        <BaseButton class="fs-topbtn" data-fsq-toggle aria-label="播放队列"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M4 7h13M4 12h13M4 17h9" />
            <circle
              cx="20"
              cy="17"
              r="2.2"
              fill="currentColor"
              stroke="none"
            /></svg
        ></BaseButton>
      </div>
    </div>
    <div class="fs-giant" data-fs-giant aria-hidden="true">NEON COAST</div>
    <div class="fs-side" aria-hidden="true">NOW PLAYING — AURA PLAYER</div>
    <div class="fs-main">
      <div class="fs-coverwrap">
        <div class="fs-coverkb">
          <img class="fs-cover" data-cover alt="专辑封面" />
        </div>
        <img class="fs-reflect" data-cover alt="" aria-hidden="true" />
      </div>
      <div class="fs-titleblock">
        <div class="fs-kicker" data-fs-spec>FLAC · 24-BIT</div>
        <h4 data-title></h4>
        <p data-artist></p>
        <div class="fs-titleactions">
          <BaseButton class="heart" data-like aria-label="收藏"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5 5 7.6 5c1.7 0 3.4 1 4.4 2.6C13 6 14.7 5 16.4 5 19 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8z"
              /></svg></BaseButton
          ><span>收藏到音乐库</span>
        </div>
      </div>
      <div class="fs-lyrcol">
        <div class="fs-lyrhead"><span>歌词 · LYRICS</span></div>
        <div class="fs-lyrics" data-fs-lyrics></div>
        <BaseButton
          class="fs-lyrseek"
          data-lyrseek
          aria-label="跳到定位的这句歌词"
          ><span class="fs-lyrseek-t" data-lyrseek-t>0:00</span
          ><span class="fs-lyrseek-go">▶ 跳到这句</span></BaseButton
        >
      </div>
      <div class="fs-index" data-fsnum aria-hidden="true">01 / 04</div>
    </div>
    <div class="fs-dock">
      <div class="fs-dock-top">
        <span class="dock-time" data-cur>0:00</span
        ><input
          type="range"
          data-seek
          min="0"
          max="1000"
          value="0"
          aria-label="播放进度"
        /><span class="dock-time rem" data-remain>-0:00</span>
      </div>
      <div class="fs-dock-main">
        <div class="dock-left">
          <img class="dock-cover" data-cover alt="专辑封面" />
          <div class="dock-meta">
            <b data-title></b><span data-artist></span>
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
        <div class="fs-controls dock-controls">
          <BaseButton class="ctl small" data-shuffle aria-label="随机播放"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg
          ></BaseButton>
          <BaseButton class="ctl" data-prev aria-label="上一首"
            ><svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg
          ></BaseButton>
          <BaseButton
            class="playbtn"
            data-play
            aria-label="播放或暂停"
          ></BaseButton>
          <BaseButton class="ctl" data-next aria-label="下一首"
            ><svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
          ></BaseButton>
          <BaseButton class="ctl small" data-repeat aria-label="循环播放"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 01-4 4H3" /></svg
          ></BaseButton>
        </div>

        <div class="dock-right">
          <div class="dock-nextwrap">
            <div class="dock-next">
              <span>下一首</span><b data-next-title></b>
            </div>
            <span class="quality-badge" data-meta1>FLAC · 24-BIT</span>
          </div>
          <BaseButton class="ctl small" data-fsq-toggle aria-label="播放队列"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M4 7h13M4 12h13M4 17h9" />
              <circle
                cx="20"
                cy="17"
                r="2.2"
                fill="currentColor"
                stroke="none"
              /></svg></BaseButton
          ><BaseButton
            class="ctl small"
            data-device
            aria-label="输出设备：桌面音箱"
            title="输出设备 · 桌面音箱"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8M12 16v4" /></svg
          ></BaseButton>
          <div class="fs-vol">
            <BaseButton
              class="volbtn"
              data-volbtn
              aria-label="音量 70% — 点击静音"
              title="音量 70% — 点击静音"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M11 5L6 9H3v6h3l5 4z" />
                <path d="M15.5 8.5a5 5 0 010 7" />
                <path d="M18.6 5.4a9.5 9.5 0 010 13.2" /></svg></BaseButton
            ><input
              type="range"
              class="vol"
              min="0"
              max="100"
              value="70"
              aria-label="音量"
              style="--p: 70%"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="fs-queue">
      <div class="fs-queue-head">
        <span>播放队列 · QUEUE</span
        ><span class="q-radio-chip" data-radio-chip hidden>电台续播中</span
        ><BaseButton class="fs-topbtn" data-fsq-toggle aria-label="关闭队列"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" /></svg
        ></BaseButton>
      </div>
      <QueueList fullscreen />
    </div>
  </div>
</template>
