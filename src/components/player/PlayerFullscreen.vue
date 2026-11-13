<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import QueueList from '@/components/player/QueueList.vue'
// 原稿粒子参数逐项保留：横坐标、周期、负延迟和直径。
const dust = [
  [6, 21, 3, 3],
  [14, 26, 11, 2],
  [23, 19, 6, 3.5],
  [31, 24, 15, 2],
  [42, 18, 1, 3],
  [50, 27, 19, 2],
  [58, 22, 8, 3],
  [67, 20, 13, 2.5],
  [76, 25, 4, 3],
  [85, 19, 17, 2],
]
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <div
    class="fs absolute inset-0 z-[30] hidden flex-col overflow-hidden"
    data-fs
    aria-label="全屏播放页"
  >
    <div
      class="fs-bg"
      data-fs-bg
    ></div>
    <div
      class="fs-amb"
      aria-hidden="true"
    >
      <i class="amb a1" /><i class="amb a2" /><i class="amb a3" />
    </div>
    <div class="fs-shade absolute inset-0 z-[1]"></div>
    <div
      class="fs-grain"
      aria-hidden="true"
    />
    <div
      class="fs-dust"
      aria-hidden="true"
    >
      <i
        v-for="(particle, index) in dust"
        :key="index"
        :style="{
          '--dx': particle[0] + '%',
          '--dd': particle[1] + 's',
          '--dl': '-' + particle[2] + 's',
          '--ds': particle[3] + 'px',
        }"
      />
    </div>
    <div
      class="fs-top relative z-[3] flex items-center justify-between p-[16px_20px_2px]"
    >
      <div class="fs-topleft flex min-w-[0] items-center gap-[12px]">
        <BaseButton
          class="fs-topbtn grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-white"
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
        ><span
          class="fs-specmono overflow-hidden font-mono text-[10.5px] font-bold tracking-[.1em] text-ellipsis whitespace-nowrap opacity-[.6]"
          data-fs-spec
          >FLAC · 24-BIT</span
        >
      </div>
      <span
        class="fs-toptitle text-[11px] font-extrabold tracking-[.16em] opacity-[.65]"
        >正在播放 · NOW PLAYING</span
      >
      <div class="fs-topright flex flex-none items-center gap-[8px]">
        <div
          class="fs-weather flex items-center gap-[6px] rounded-full p-[5px_11px_5px_7px] whitespace-nowrap text-white"
          role="img"
          aria-label="本地天气：夜晚多云，19度，演示数据"
          title="本地天气 · 演示数据"
        >
          <svg
            class="wx-icon wx-icon-sm h-[23px] w-[23px] flex-none overflow-visible"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
          >
            <circle
              class="wx-star"
              cx="7.5"
              cy="6.5"
              r="1.3"
              fill="#FFE9A8"
            />
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
          ><span
            class="wx-temp text-[15px] leading-[1] font-extrabold tracking-[-.01em]"
            >19°</span
          ><span class="wx-cond text-[12px] leading-[1] font-bold opacity-[.85]"
            >多云</span
          >
        </div>
        <BaseButton
          class="fs-topbtn grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-white"
          data-fsq-toggle
          aria-label="播放队列"
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
    <div
      class="fs-giant pointer-events-none absolute top-[9%] left-[-12px] z-[1] text-[clamp(96px,13.5vw,172px)] leading-[1] font-extrabold tracking-[-.02em] whitespace-nowrap text-transparent opacity-[.5]"
      data-fs-giant
      aria-hidden="true"
    >
      NEON COAST
    </div>
    <div
      class="fs-side pointer-events-none absolute top-[50%] left-[16px] z-[3] text-[10px] font-extrabold tracking-[.34em] whitespace-nowrap opacity-[.5]"
      aria-hidden="true"
    >
      NOW PLAYING — AURA PLAYER
    </div>
    <div
      class="fs-main relative z-[3] flex min-h-[0] flex-1 items-center p-[6px_46px_4px_58px]"
    >
      <div class="fs-coverwrap relative w-[min(328px,100%)]">
        <div class="fs-coverkb relative">
          <img
            class="fs-cover"
            data-cover
            alt="专辑封面"
          />
        </div>
        <img
          class="fs-reflect mt-[8px] block h-[46px] w-full rounded-[22px] object-cover opacity-[.26]"
          data-cover
          alt=""
          aria-hidden="true"
        />
        <div
          class="fs-sheen"
          aria-hidden="true"
        >
          <i />
        </div>
      </div>
      <div
        class="fs-titleblock pointer-events-none relative z-[4] ml-[-58px] max-w-[400px] min-w-[0]"
      >
        <div
          class="fs-kicker overflow-hidden font-mono text-[10.5px] font-bold tracking-[.14em] text-ellipsis whitespace-nowrap opacity-[.62]"
          data-fs-spec
        >
          FLAC · 24-BIT
        </div>
        <h4 data-title></h4>
        <p data-artist></p>
        <div
          class="fs-titleactions pointer-events-auto mt-[14px] flex items-center gap-[6px]"
        >
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
              /></svg></BaseButton
          ><span>收藏到音乐库</span>
        </div>
      </div>
      <div class="fs-lyrcol">
        <div
          class="fs-lyrhead mb-[6px] flex flex-none items-center justify-between gap-[10px] p-[0_2px_10px]"
        >
          <span>歌词 · LYRICS</span>
        </div>
        <div
          class="fs-lyrics mt-[16px] min-h-[0] flex-1 overflow-y-auto p-[4px_6px_4px_0]"
          data-fs-lyrics
        ></div>
        <BaseButton
          class="fs-lyrseek pointer-events-none absolute top-[50%] left-[12px] z-[6] flex cursor-pointer items-center gap-[9px] rounded-full p-[7px_12px_7px_11px] text-white opacity-[0]"
          data-lyrseek
          aria-label="跳到定位的这句歌词"
          ><span
            class="fs-lyrseek-t font-mono text-[12px] leading-[1] font-bold"
            data-lyrseek-t
            >0:00</span
          ><span
            class="fs-lyrseek-go text-[11.5px] leading-[1] font-extrabold whitespace-nowrap opacity-[.85]"
            >▶ 跳到这句</span
          ></BaseButton
        >
      </div>
      <div
        class="fs-index pointer-events-none absolute right-[30px] bottom-[8px] z-[2] text-[64px] leading-[1] font-extrabold tracking-[-.02em] text-transparent opacity-[.55]"
        data-fsnum
        aria-hidden="true"
      >
        01 / 04
      </div>
    </div>
    <div
      class="fs-dock relative z-[3] m-[0_auto_20px] flex w-[min(880px,calc(100%_-_48px))] flex-none flex-col gap-[9px] rounded-[28px] p-[13px_20px_12px]"
    >
      <div
        class="fs-dock-top flex items-center gap-[12px] font-mono text-[11px]"
      >
        <span
          class="dock-time w-[38px] flex-none"
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
          class="dock-time rem w-[38px] flex-none"
          data-remain
          >-0:00</span
        >
      </div>
      <div class="fs-dock-main flex items-center gap-[14px]">
        <div class="dock-left flex min-w-[0] flex-1 items-center gap-[11px]">
          <img
            class="dock-cover h-[44px] w-[44px] flex-none rounded-[10px] object-cover"
            data-cover
            alt="专辑封面"
          />
          <div class="dock-meta min-w-[0]">
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
        <div
          class="fs-controls dock-controls m-0 flex flex-none items-center justify-center gap-[10px]"
        >
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

        <div
          class="dock-right flex min-w-[0] flex-1 items-center justify-end gap-[9px]"
        >
          <div
            class="dock-nextwrap flex max-w-[134px] min-w-[0] flex-none flex-col items-start gap-[4px]"
          >
            <div
              class="dock-next flex max-w-[118px] min-w-[0] flex-col gap-[1px]"
            >
              <span>下一首</span><b data-next-title></b>
            </div>
            <span
              class="quality-badge rounded-full p-[5px_8px] font-mono text-[9.5px] leading-[1] font-bold tracking-[.05em] whitespace-nowrap"
              data-meta1
              >FLAC · 24-BIT</span
            >
          </div>
          <BaseButton
            class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
            data-fsq-toggle
            aria-label="播放队列"
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
            class="ctl small grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
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
              <rect
                x="3"
                y="4"
                width="18"
                height="12"
                rx="2"
              />
              <path d="M8 20h8M12 16v4" /></svg
          ></BaseButton>
          <div
            class="fs-vol flex flex-none items-center gap-[8px] opacity-[.9]"
          >
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
    <div
      class="fs-queue absolute top-[66px] right-[16px] z-[4] hidden max-h-[calc(100%_-_86px)] w-[302px] max-w-[calc(100%_-_32px)] overflow-y-auto rounded-[18px] p-[12px]"
    >
      <div
        class="fs-queue-head m-[2px_4px_10px] flex items-center justify-between text-[12px] font-extrabold tracking-[.1em]"
      >
        <span>播放队列 · QUEUE</span
        ><span
          class="q-radio-chip rounded-full p-[3px_8px] text-[9.5px] font-extrabold tracking-[.06em] whitespace-nowrap text-white"
          data-radio-chip
          hidden
          >电台续播中</span
        ><BaseButton
          class="fs-topbtn grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-white"
          data-fsq-toggle
          aria-label="关闭队列"
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
