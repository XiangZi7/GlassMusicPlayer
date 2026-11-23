<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import LyricIsland from '@/components/player/LyricIsland.vue'
import PlayerQueueMenu from '@/components/player/PlayerQueueMenu.vue'
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <LyricIsland />
  <div
    class="win-bottom relative z-[4] grid h-[72px] flex-none grid-cols-[252px_minmax(0,1fr)_208px] items-center gap-[14px] p-[10px_18px_8px]"
  >
    <div class="mini flex min-w-[0] items-center gap-[11px]">
      <BaseButton
        class="mini-cover h-[48px] w-[48px] flex-none overflow-hidden rounded-[11px] border-none bg-none p-0"
        data-stage-toggle
        aria-label="打开全屏播放页"
        title="打开全屏播放"
        ><img
          data-cover
          alt="专辑封面"
      /></BaseButton>
      <div class="mini-txt min-w-[0]">
        <b data-title></b><span data-artist></span>
      </div>
      <BaseButton
        class="heart grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
        data-like
        aria-label="收藏"
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
    <div class="center-ctl flex min-w-[0] flex-col gap-[2px] self-center">
      <div class="controls flex items-center justify-center gap-[8px]">
        <BaseButton
          class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
          data-shuffle
          aria-label="随机播放"
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
        <BaseButton
          class="ctl grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
          data-prev
          aria-label="上一首"
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg
        ></BaseButton>
        <BaseButton
          class="playbtn relative grid h-[48px] w-[48px] flex-none place-items-center rounded-full border-none"
          data-play
          aria-label="播放或暂停"
        ></BaseButton>
        <BaseButton
          class="ctl grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
          data-next
          aria-label="下一首"
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg
        ></BaseButton>
        <BaseButton
          class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
          data-repeat
          aria-label="循环播放"
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
    </div>
    <div class="right-ctl flex flex-wrap items-center justify-end gap-[6px]">
      <!-- 底栏队列：从当前按钮上方弹出，不改变全屏或页面状态。 -->
      <PlayerQueueMenu />
      <BaseButton
        class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
        disabled
        aria-label="输出设备：系统默认"
        title="输出设备 · 系统默认"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <rect
            x="3"
            y="4"
            width="18"
            height="12"
            rx="2"
          />
          <path d="M8 20h8M12 16v4" /></svg
      ></BaseButton>
      <BaseButton
        class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
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
          <path d="M18.6 5.4a9.5 9.5 0 010 13.2" /></svg
      ></BaseButton>
      <input
        type="range"
        class="vol"
        min="0"
        max="100"
        value="70"
        aria-label="音量"
        style="--p: 70%"
      />
    </div>
    <div
      class="prow edge-prow top-[0] right-[18px] left-[18px] z-[6] flex h-[15px] items-center gap-[10px] p-0 font-mono text-[9.5px]"
    >
      <span
        class="cur"
        data-cur
        >0:00</span
      ><input
        type="range"
        data-seek
        min="0"
        max="1000"
        value="0"
        aria-label="播放进度"
      /><span
        class="dur"
        data-dur
        >0:00</span
      ><span
        class="seek-tip pointer-events-none absolute bottom-[19px] left-[50%] rounded-[8px] p-[6px_9px] font-mono text-[10.5px] leading-[1] font-bold tracking-[.02em] whitespace-nowrap text-white opacity-[0]"
        data-seek-tip
        aria-hidden="true"
        >0:00 / 0:00</span
      >
    </div>
    <canvas
      class="player-spectrum pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[14px] w-full"
      data-spectrum
      aria-hidden="true"
    />
  </div>
</template>
