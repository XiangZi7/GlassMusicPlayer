<script setup lang="ts"></script>
<template>
  <div class="space-y-10 p-5 pb-8">
    <!-- Banner skeleton -->
    <section>
      <div class="overflow-hidden rounded-2xl bg-white/5">
        <div class="aspect-[2.2/0.6] relative">
          <div class="absolute inset-0 animate-shimmer"></div>
          <div class="absolute right-0 bottom-0 left-0 p-5 lg:p-7">
            <div class="mb-2.5 h-5 w-20 rounded-full bg-white/8"></div>
            <div class="h-6 w-64 rounded-lg bg-white/10"></div>
          </div>
        </div>
      </div>
      <div class="mt-4 flex justify-center gap-1.5">
        <span class="h-1.5 w-5 rounded-full bg-white/15"></span>
        <span class="h-1.5 w-1.5 rounded-full bg-white/10"></span>
        <span class="h-1.5 w-1.5 rounded-full bg-white/10"></span>
        <span class="h-1.5 w-1.5 rounded-full bg-white/10"></span>
      </div>
    </section>

    <!-- 推荐歌单 skeleton -->
    <section>
      <div class="mb-6">
        <div class="h-7 w-36 rounded-lg bg-white/10"></div>
      </div>
      <div class="grid grid-cols-3 gap-3.5 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-10">
        <div v-for="i in 10" :key="i">
          <div class="relative aspect-square overflow-hidden rounded-2xl bg-white/5">
            <div class="absolute inset-0 animate-shimmer"></div>
            <div class="absolute right-0 bottom-0 left-0 p-2.5">
              <div class="mb-1.5 h-3 w-3/4 rounded bg-white/10"></div>
              <div class="h-2.5 w-10 rounded bg-white/8"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 热门歌手 skeleton -->
    <section>
      <div class="mb-6 flex items-baseline justify-between">
        <div class="h-7 w-28 rounded-lg bg-white/10"></div>
        <div class="h-4 w-14 rounded bg-white/8"></div>
      </div>
      <div class="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
        <div v-for="i in 12" :key="i" class="flex flex-col items-center">
          <div class="relative mb-2.5 aspect-square w-full overflow-hidden rounded-full bg-white/5">
            <div class="absolute inset-0 animate-shimmer"></div>
          </div>
          <div class="h-3 w-2/3 rounded bg-white/10"></div>
        </div>
      </div>
    </section>

    <!-- 热门歌曲 skeleton -->
    <section>
      <div class="mb-6 flex items-baseline justify-between">
        <div class="h-7 w-28 rounded-lg bg-white/10"></div>
        <div class="h-4 w-14 rounded bg-white/8"></div>
      </div>
      <div class="overflow-hidden rounded-2xl border border-white/4 bg-white/4">
        <div class="grid md:grid-cols-2">
          <div v-for="i in 12" :key="i" class="flex items-center gap-4 border-b border-white/5 p-4">
            <div class="h-7 w-7 rounded-lg bg-white/8"></div>
            <div class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
              <div class="absolute inset-0 animate-shimmer"></div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="mb-1.5 h-3.5 w-2/3 rounded bg-white/10"></div>
              <div class="h-3 w-1/3 rounded bg-white/8"></div>
            </div>
            <div class="h-3 w-10 rounded bg-white/8"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- MV skeleton -->
    <section>
      <div class="mb-6 flex items-baseline justify-between">
        <div class="h-7 w-24 rounded-lg bg-white/10"></div>
        <div class="h-4 w-14 rounded bg-white/8"></div>
      </div>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <div v-for="i in 6" :key="i" class="relative aspect-video overflow-hidden rounded-2xl bg-white/5">
          <div class="absolute inset-0 animate-shimmer"></div>
          <div class="absolute top-2 right-2 h-4 w-14 rounded-full bg-black/20"></div>
          <div class="absolute right-0 bottom-0 left-0 p-3">
            <div class="mb-1 h-3.5 w-1/2 rounded bg-white/10"></div>
            <div class="h-3 w-1/3 rounded bg-white/8"></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
