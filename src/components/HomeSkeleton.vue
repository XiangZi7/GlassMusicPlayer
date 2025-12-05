<script setup lang="ts"></script>
<template>
  <div class="space-y-8 p-6 lg:p-8">
    <section>
      <div class="overflow-hidden rounded-3xl bg-white/5">
        <div class="aspect-[2.1/0.5] relative">
          <div class="absolute inset-0 animate-shimmer"></div>
          <div class="absolute right-0 bottom-0 left-0 p-6">
            <div class="mb-3 h-6 w-24 rounded-full bg-white/10"></div>
            <div class="h-8 w-80 rounded-lg bg-white/15"></div>
          </div>
        </div>
      </div>
      <div class="mt-5 flex justify-center gap-2">
        <span class="h-2.5 w-6 rounded-full bg-white/20"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-white/20"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-white/30"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-white/20"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-white/20"></span>
      </div>
    </section>

    <section>
      <div class="mb-5 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-[10px] bg-white/10"></div>
          <div class="h-6 w-32 rounded bg-white/15"></div>
        </div>
        <div class="h-4 w-16 rounded bg-white/10"></div>
      </div>
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        <div v-for="i in 10" :key="i" class="group">
          <div class="relative aspect-square overflow-hidden rounded-2xl shadow-lg bg-white/10">
            <div class="absolute inset-0 animate-shimmer"></div>
            <div class="absolute right-0 bottom-0 left-0 p-2.5">
              <div class="mb-2 h-3.5 w-3/4 rounded bg-white/15"></div>
              <div class="flex items-center gap-1.5">
                <div class="h-3 w-12 rounded bg-white/10"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-5 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-[10px] bg-white/10"></div>
          <div class="h-6 w-32 rounded bg-white/15"></div>
        </div>
        <div class="h-4 w-16 rounded bg-white/10"></div>
      </div>
      <div class="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
        <div v-for="i in 12" :key="i" class="flex flex-col items-center">
          <div class="relative mb-2.5 aspect-square w-full overflow-hidden rounded-full border-2 border-(--glass-border) bg-white/10">
            <div class="absolute inset-0 animate-shimmer"></div>
          </div>
          <div class="h-3.5 w-2/3 rounded bg-white/15"></div>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-5 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-[10px] bg-white/10"></div>
          <div class="h-6 w-32 rounded bg-white/15"></div>
        </div>
        <div class="h-4 w-16 rounded bg-white/10"></div>
      </div>
      <div class="glass-card overflow-hidden">
        <div class="grid md:grid-cols-2">
          <div v-for="i in 12" :key="i" class="flex items-center gap-4 border-b border-white/10 p-4">
            <div class="h-7 w-7 rounded-lg bg-white/10"></div>
            <div class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
              <div class="absolute inset-0 animate-shimmer"></div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="mb-1.5 h-4 w-2/3 rounded bg-white/15"></div>
              <div class="h-3 w-1/3 rounded bg-white/10"></div>
            </div>
            <div class="h-3 w-10 rounded bg-white/10"></div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-5 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-[10px] bg-white/10"></div>
          <div class="h-6 w-32 rounded bg-white/15"></div>
        </div>
        <div class="h-4 w-16 rounded bg-white/10"></div>
      </div>
      <div class="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <div v-for="i in 6" :key="i" class="relative aspect-video overflow-hidden rounded-2xl bg-white/10">
          <div class="absolute inset-0 animate-shimmer"></div>
          <div class="absolute top-2 right-2 h-5 w-16 rounded-full bg-black/30"></div>
          <div class="absolute right-0 bottom-0 left-0 p-3">
            <div class="mb-1 h-4 w-1/2 rounded bg-white/15"></div>
            <div class="h-3 w-1/3 rounded bg-white/10"></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
