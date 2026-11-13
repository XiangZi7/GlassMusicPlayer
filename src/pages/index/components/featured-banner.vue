<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
</script>
<template>
<!-- 首页主打区：保留封面叠层、收缩和鼠标视差。 -->
<section class="banner" data-banner aria-label="今日主打横幅">
      <div class="banner-bg" data-banner-bg></div>
      <div class="banner-shade"></div>
      <div class="banner-content">
        <span class="banner-kicker">今日主打 · FEATURED</span>
        <h4 data-banner-title>Night Drive</h4>
        <p class="banner-sub" data-banner-sub>Midnight Drift — Neon Coast</p>
        <div class="banner-actions">
          <BaseButton class="banner-play" data-banner-play
            ><svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" /></svg
            >立即播放</BaseButton
          >
          <span class="banner-meta" data-banner-meta>FLAC · 24-BIT</span>
        </div>
      </div>
      <div class="banner-stage">
        <div class="banner-halo" data-banner-halo></div>
        <div class="banner-covers">
          <img class="bc bc-back" data-bc="2" alt="专辑封面" />
          <img class="bc bc-mid" data-bc="1" alt="专辑封面" />
          <img class="bc bc-front" data-bc="0" alt="本期主打专辑封面" />
        </div>
        <div class="banner-floor"></div>
        <img
          class="banner-girl"
          src="/images/featured-singer.webp"
          alt="二次元女主唱立绘"
        />
      </div>
      <div class="banner-mini">
        <img data-banner-mini-cover alt="专辑封面" />
        <div style="min-width: 0">
          今日主打 · <span data-banner-mini-title>Night Drive</span>
        </div>
        <BaseButton class="banner-play" data-banner-play>播放</BaseButton>
      </div>
    </section>
</template>