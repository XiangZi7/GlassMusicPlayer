<script setup lang="ts"></script>
<template>
  <section class="relative mb-8 h-96 overflow-hidden rounded-2xl px-4">
    <div class="relative h-full w-full overflow-hidden rounded-2xl">
      <div class="absolute inset-0 bg-linear-to-br from-gray-600 to-red-600 opacity-40"></div>
      <div class="absolute inset-0 animate-shimmer bg-white/10"></div>
      <div class="absolute left-8 top-1/3 h-8 w-2/5 rounded bg-white/20"></div>
      <div class="absolute left-8 top-1/2 h-5 w-3/5 rounded bg-white/15"></div>
    </div>
  </section>
  <div class="px-4 pb-8">
    <section class="mb-12">
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center text-2xl font-bold text白">
          <span class="icon-[mdi--playlist-music] mr-3 h-6 w-6 text-pink-400"></span>
          {{ $t('home.recommendPlaylists') }}
        </div>
        <span class="icon-[mdi--chevron-right] h-5 w-5 text-purple-300"></span>
      </div>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <div v-for="i in 6" :key="i" class="glass-card h-full p-4">
          <div class="mb-3 h-32 w-full overflow-hidden rounded-xl bg-white/10 animate-shimmer"></div>
          <div class="mb-2 h-4 w-3/4 rounded bg-white/15"></div>
          <div class="h-3 w-1/2 rounded bg-white/10"></div>
        </div>
      </div>
    </section>
    <section class="mb-12">
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items中心 text-2xl font-bold text白">
          <span class="icon-[mdi--fire] mr-3 h-6 w-6 text-orange-400"></span>
          {{ $t('home.hotSongs') }}
        </div>
      </div>
      <div class="h-[40vh] w-full overflow-hidden">
        <div class="space-y-3">
          <div v-for="i in 8" :key="i" class="glass-card flex items-center gap-3 p-3">
            <div class="h-10 w-10 rounded bg-white/10 animate-shimmer"></div>
            <div class="flex-1">
              <div class="mb-2 h-4 w-2/3 rounded bg-white/15"></div>
              <div class="h-3 w-1/3 rounded bg-white/10"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section>
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items中心 text-2xl font-bold text白">
          <span class="icon-[mdi--clock-outline] mr-3 h-6 w-6 text-blue-400"></span>
          {{ $t('home.recentPlayed') }}
        </div>
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 3" :key="i" class="glass-card p-4">
          <div class="flex items-center space-x-3">
            <div class="h-16 w-16 rounded-xl bg-white/10 animate-shimmer"></div>
            <div class="min-w-0 flex-1">
              <div class="mb-2 h-4 w-2/3 rounded bg-white/15"></div>
              <div class="mb-2 h-3 w-1/2 rounded bg-white/10"></div>
              <div class="h-3 w-1/3 rounded bg-white/10"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
