<script setup lang="ts"></script>
<template>
  <!-- 顶部区域骨架 -->
  <div class="grid grid-cols-12 gap-5 p-6">
    <!-- 主轮播图骨架 -->
    <section class="col-span-12 lg:col-span-8">
      <div class="relative h-72 overflow-hidden rounded-2xl xl:h-80">
        <div class="absolute inset-0 animate-shimmer bg-white/10"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-6">
          <div class="mb-2 h-6 w-20 rounded-full bg-white/20"></div>
          <div class="mb-3 h-7 w-64 rounded bg-white/20 lg:w-80"></div>
          <div class="h-9 w-24 rounded-full bg-white/20"></div>
        </div>
      </div>
    </section>

    <!-- 快捷入口骨架 -->
    <section class="col-span-12 grid grid-cols-2 gap-3 lg:col-span-4 lg:grid-cols-1">
      <div v-for="i in 4" :key="i" class="glass-card flex h-full items-center gap-4 p-4">
        <div class="h-12 w-12 shrink-0 rounded-xl bg-white/10 animate-shimmer"></div>
        <div class="flex-1">
          <div class="mb-2 h-4 w-20 rounded bg-white/15"></div>
          <div class="h-3 w-16 rounded bg-white/10"></div>
        </div>
      </div>
    </section>
  </div>

  <!-- 推荐歌单骨架 -->
  <section class="px-6 pb-6">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3 text-lg font-bold text-primary">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20">
          <span class="icon-[mdi--playlist-music] h-5 w-5 text-pink-400"></span>
        </span>
        {{ $t('home.recommendPlaylists') }}
      </div>
      <div class="h-4 w-16 rounded bg-white/10"></div>
    </div>
    <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      <div v-for="i in 7" :key="i" class="group">
        <div class="relative mb-2 aspect-square overflow-hidden rounded-xl bg-white/10 animate-shimmer shadow-lg"></div>
        <div class="mb-1.5 h-4 w-full rounded bg-white/15"></div>
        <div class="h-4 w-2/3 rounded bg-white/10"></div>
      </div>
    </div>
  </section>

  <!-- 热门歌曲 + 更多歌单 双栏骨架 -->
  <div class="grid grid-cols-12 gap-5 px-6 pb-8">
    <!-- 热门歌曲骨架 -->
    <section class="col-span-12 lg:col-span-7">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-3 text-lg font-bold text-primary">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20">
            <span class="icon-[mdi--fire] h-5 w-5 text-orange-400"></span>
          </span>
          {{ $t('home.hotSongs') }}
        </div>
        <div class="h-4 w-16 rounded bg-white/10"></div>
      </div>
      <div class="glass-card overflow-hidden">
        <div class="space-y-1 p-2">
          <div v-for="i in 8" :key="i" class="flex items-center gap-4 rounded-xl p-2">
            <div class="h-5 w-8 rounded bg-white/10"></div>
            <div class="h-12 w-12 rounded-lg bg-white/10 animate-shimmer"></div>
            <div class="flex-1">
              <div class="mb-2 h-4 w-1/3 rounded bg-white/15"></div>
              <div class="h-3 w-1/4 rounded bg-white/10"></div>
            </div>
            <div class="hidden h-3 w-20 rounded bg-white/10 md:block"></div>
            <div class="hidden h-3 w-16 rounded bg-white/10 md:block"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- 更多歌单骨架 -->
    <section class="col-span-12 lg:col-span-5">
      <div class="mb-4 flex items-center gap-3 text-lg font-bold text-primary">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
          <span class="icon-[mdi--music-box-multiple] h-5 w-5 text-violet-400"></span>
        </span>
        {{ $t('home.morePlaylists') || '更多歌单' }}
      </div>
      <div class="space-y-3">
        <div v-for="i in 5" :key="i" class="glass-card flex items-center gap-4 p-3">
          <div class="h-14 w-14 shrink-0 rounded-lg bg-white/10 animate-shimmer"></div>
          <div class="flex-1">
            <div class="mb-2 h-4 w-3/4 rounded bg-white/15"></div>
            <div class="h-3 w-16 rounded bg-white/10"></div>
          </div>
          <div class="h-8 w-8 rounded-full bg-white/10"></div>
        </div>
      </div>
    </section>
  </div>
</template>
