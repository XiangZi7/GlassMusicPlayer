<template>
  <!-- 粒子背景 -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      v-for="i in 60"
      :key="i"
      class="particle"
      :style="{
        left: Math.random() * 100 + '%',
        top: Math.random() * 100 + '%',
        width: Math.random() * 4 + 2 + 'px',
        height: Math.random() * 4 + 2 + 'px',
        animationDelay: Math.random() * 6 + 's',
        animationDuration: Math.random() * 4 + 4 + 's',
      }"
    ></div>
  </div>

  <!-- 装饰性光晕 -->
  <div
    class="absolute top-20 left-20 h-32 w-32 animate-pulse rounded-full bg-purple-500/20 blur-3xl"
  ></div>
  <div
    class="absolute right-32 bottom-32 h-40 w-40 animate-pulse rounded-full bg-pink-500/20 blur-3xl"
    style="animation-delay: 2s"
  ></div>
  <div
    class="absolute top-1/2 left-10 h-24 w-24 animate-pulse rounded-full bg-blue-500/20 blur-2xl"
    style="animation-delay: 4s"
  ></div>
</template>
