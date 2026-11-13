<template>
  <!-- 顶栏天气装饰：保留原稿月云动画，并明确演示数据来源。 -->
  <div
    class="glass flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/15 px-2.5 text-[11px] font-bold"
    title="天气为原稿演示数据，尚未接入实时天气"
    aria-label="演示天气：19 度，多云"
  >
    <svg class="size-6" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle class="weather-star" cx="7" cy="6" r="1" fill="#ffe9a8" />
      <circle class="weather-star" cx="14" cy="3" r=".8" fill="white" />
      <path
        d="M24.6 3.4a8.2 8.2 0 1 0 7.9 11.9A9.6 9.6 0 0 1 24.6 3.4Z"
        fill="#f6dc8a"
      />
      <path
        class="weather-cloud"
        d="M8.4 27.8a5.2 5.2 0 0 1-.7-10.35 7.2 7.2 0 0 1 13.9-1.55A5.6 5.6 0 0 1 26.2 21.3c.3 3.4-2.2 6.5-6 6.5Z"
        fill="white"
      /></svg
    ><span>19°</span><span class="hidden xl:inline">多云</span>
  </div>
</template>
