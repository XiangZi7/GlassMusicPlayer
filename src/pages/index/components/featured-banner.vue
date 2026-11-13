<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
</script>
<template>
  <!-- 首页主打区：保留封面叠层、收缩和鼠标视差。 -->
  <section
    class="banner relative z-[3] m-[2px_0_8px] h-[208px] flex-none overflow-hidden rounded-[20px]"
    data-banner
    aria-label="今日主打横幅"
  >
    <div
      class="banner-bg absolute inset-[-28px] z-[0]"
      data-banner-bg
    ></div>
    <div class="banner-shade absolute inset-0 z-[1]"></div>
    <div
      class="banner-content pointer-events-none absolute top-[0] bottom-[0] left-[22px] z-[4] flex w-[52%] flex-col justify-center"
    >
      <span
        class="banner-kicker text-[10.5px] font-extrabold tracking-[.16em] opacity-[.78]"
        >今日主打 · FEATURED</span
      >
      <h4 data-banner-title>Night Drive</h4>
      <p
        class="banner-sub m-[7px_0_0] overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap opacity-[.78]"
        data-banner-sub
      >
        Midnight Drift — Neon Coast
      </p>
      <div
        class="banner-actions pointer-events-auto mt-[15px] flex items-center gap-[12px]"
      >
        <!-- 页面操作按钮：立即播放。 -->
        <BaseButton
          class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
          data-banner-play
          ><svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5.5v13l11-6.5z" /></svg
          >立即播放</BaseButton
        >
        <span
          class="banner-meta font-mono text-[10.5px] whitespace-nowrap opacity-[.72]"
          data-banner-meta
          >FLAC · 24-BIT</span
        >
      </div>
    </div>
    <div
      class="banner-stage pointer-events-none absolute top-[0] right-[0] bottom-[0] z-[3] w-[50%]"
    >
      <div
        class="banner-halo absolute rounded-full opacity-[.5]"
        data-banner-halo
      ></div>
      <div class="banner-covers absolute inset-0">
        <img
          class="bc bc-back absolute rounded-[12px] object-cover"
          data-bc="2"
          alt="专辑封面"
        />
        <img
          class="bc bc-mid absolute rounded-[12px] object-cover"
          data-bc="1"
          alt="专辑封面"
        />
        <img
          class="bc bc-front absolute rounded-[12px] object-cover"
          data-bc="0"
          alt="本期主打专辑封面"
        />
      </div>
      <div
        class="banner-floor absolute right-[2%] bottom-[4px] left-[6%] z-[2] h-[22px] rounded-full"
      ></div>
      <img
        class="banner-girl absolute top-[auto] right-[12px] bottom-[0] z-[5] h-[198px] w-[auto] max-w-none"
        src="/images/featured-singer.webp"
        alt="二次元女主唱立绘"
      />
    </div>
    <div
      class="banner-mini absolute top-[0] right-[16px] bottom-[0] left-[16px] z-[5] hidden items-center gap-[10px] text-[13.5px] font-extrabold"
    >
      <img
        data-banner-mini-cover
        alt="专辑封面"
      />
      <div style="min-width: 0">
        今日主打 · <span data-banner-mini-title>Night Drive</span>
      </div>
      <!-- 页面操作按钮：播放。 -->
      <BaseButton
        class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
        data-banner-play
        >播放</BaseButton
      >
    </div>
  </section>
</template>
