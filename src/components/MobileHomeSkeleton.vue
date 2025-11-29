<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="pb-4">
    <section class="mb-6 px-4 pt-2">
      <div class="relative h-44 w-full overflow-hidden rounded-2xl">
        <div class="skeleton-bg absolute inset-0"></div>
        <div class="animate-shimmer absolute inset-0"></div>
        <div class="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          <div v-for="i in 4" :key="i" class="skeleton-bar h-1.5 w-6 rounded-full"></div>
        </div>
      </div>
    </section>

    <section class="mb-6 px-4">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="section-title">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-pink-500 to-purple-600"
          >
            <span class="icon-[mdi--playlist-star] h-4 w-4 text-primary" />
          </span>
          {{ t('home.recommendPlaylists') }}
        </h2>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div v-for="i in 6" :key="i" class="group">
          <div class="relative mb-2 aspect-square overflow-hidden rounded-xl">
            <div class="skeleton-bg absolute inset-0"></div>
            <div class="animate-shimmer absolute inset-0"></div>
            <div class="skeleton-bar absolute top-1.5 right-1.5 h-3 w-10 rounded-full"></div>
            <div class="skeleton-strong absolute bottom-1.5 left-1.5 h-6 w-6 rounded-full"></div>
          </div>
          <div class="skeleton-bar mb-1 h-3 w-4/5 rounded"></div>
          <div class="skeleton-bg h-3 w-3/5 rounded"></div>
        </div>
      </div>
    </section>

    <section class="mb-6">
      <div class="mb-3 flex items-center justify-between px-4">
        <h2 class="section-title">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600"
          >
            <span class="icon-[mdi--account-music] h-4 w-4 text-primary" />
          </span>
          {{ t('components.discover.hotArtists') }}
        </h2>
      </div>
      <div class="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-2">
        <div v-for="i in 8" :key="i" class="flex shrink-0 flex-col items-center">
          <div class="relative mb-1.5 h-16 w-16 overflow-hidden rounded-full">
            <div class="skeleton-bg absolute inset-0"></div>
            <div class="animate-shimmer absolute inset-0"></div>
          </div>
          <div class="skeleton-bar h-2.5 w-12 rounded"></div>
        </div>
      </div>
    </section>

    <section class="mb-6 px-4">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="section-title">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-blue-600"
          >
            <span class="icon-[mdi--music-note-plus] h-4 w-4 text-primary" />
          </span>
          {{ t('components.discover.newSongs') }}
        </h2>
      </div>
      <div class="glass-card overflow-hidden p-2">
        <div v-for="i in 6" :key="i" class="flex items-center gap-3 rounded-xl p-2">
          <div class="w-5 shrink-0 text-center">
            <div class="skeleton-bar mx-auto h-3 w-3 rounded"></div>
          </div>
          <div class="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
            <div class="skeleton-bg absolute inset-0"></div>
            <div class="animate-shimmer absolute inset-0"></div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="skeleton-strong mb-1.5 h-3.5 w-3/4 rounded"></div>
            <div class="skeleton-bar h-2.5 w-1/2 rounded"></div>
          </div>
          <div class="skeleton-bar h-3 w-8 shrink-0 rounded"></div>
        </div>
      </div>
    </section>

    <section class="px-4 pb-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="section-title">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-rose-500 to-red-600"
          >
            <span class="icon-[mdi--video] h-4 w-4 text-primary" />
          </span>
          {{ t('components.discover.recommendMv') }}
        </h2>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="i in 4" :key="i" class="flex flex-col">
          <div class="relative aspect-video overflow-hidden rounded-xl">
            <div class="skeleton-bg absolute inset-0"></div>
            <div class="animate-shimmer absolute inset-0"></div>
            <div class="skeleton-bar absolute top-2 right-2 h-3 w-12 rounded"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="skeleton-strong h-10 w-10 rounded-full"></div>
            </div>
            <div class="absolute right-0 bottom-0 left-0 p-2">
              <div class="skeleton-strong mb-1 h-3 w-3/4 rounded"></div>
              <div class="skeleton-bar h-2.5 w-1/2 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--glass-text);
}

.skeleton-bg {
  background: var(--skeleton-bg);
}

.skeleton-bar {
  background: var(--skeleton-bg);
}

.skeleton-strong {
  background: var(--glass-container-strong-bg);
}
</style>
