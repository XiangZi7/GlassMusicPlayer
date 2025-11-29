<script setup lang="ts">
const props = defineProps<{ sections?: string[]; gridCount?: number; listCount?: number }>()
const sections = computed(() => props.sections || [])
const gridCount = computed(() => props.gridCount ?? 12)
const listCount = computed(() => props.listCount ?? 8)
</script>
<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto p-6">
      <section v-if="sections.includes('hero')" class="relative mb-6 overflow-hidden rounded-2xl">
        <div class="relative h-40 w-full overflow-hidden rounded-2xl">
          <div class="absolute inset-0 bg-linear-to-br from-gray-600 to-red-600 opacity-40"></div>
          <div class="absolute inset-0 animate-shimmer bg-white/10"></div>
          <div class="absolute left-6 top-6 h-6 w-1/3 rounded bg-white/20"></div>
          <div class="absolute left-6 top-14 h-4 w-1/2 rounded bg-white/15"></div>
        </div>
      </section>

      <section v-if="sections.includes('grid')" class="mb-8">
        <div class="mb-4 h-6 w-32 rounded bg-white/15"></div>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <div v-for="i in gridCount" :key="i" class="glass-card h-full p-4">
            <div class="mb-3 h-32 w-full overflow-hidden rounded-xl bg-white/10 animate-shimmer"></div>
            <div class="mb-2 h-4 w-3/4 rounded bg-white/15"></div>
            <div class="h-3 w-1/2 rounded bg-white/10"></div>
          </div>
        </div>
      </section>

      <section v-if="sections.includes('list')" class="mb-8">
        <div class="mb-4 h-6 w-32 rounded bg-white/15"></div>
        <div class="space-y-3">
          <div v-for="i in listCount" :key="i" class="glass-card flex items-center gap-3 p-3">
            <div class="h-10 w-10 rounded bg-white/10 animate-shimmer"></div>
            <div class="flex-1">
              <div class="mb-2 h-4 w-2/3 rounded bg-white/15"></div>
              <div class="h-3 w-1/3 rounded bg-white/10"></div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="sections.includes('player')" class="px-0 pb-0">
        <div class="glass-card grid grid-cols-12 gap-6 overflow-hidden p-6">
          <div class="col-span-12 lg:col-span-9">
            <div class="aspect-video w-full rounded-lg bg-white/5">
              <div class="absolute-center flex items-center gap-2 text-primary/70">
                <span class="icon-[mdi--loading] h-6 w-6 animate-spin"></span>
                {{ $t('common.loading') }}
              </div>
            </div>
            <div class="mt-6 space-y-3">
              <div class="h-6 w-1/2 rounded bg-white/15"></div>
              <div class="h-4 w-1/3 rounded bg-white/10"></div>
              <div class="grid grid-cols-3 gap-3">
                <div class="h-4 rounded bg-white/10"></div>
                <div class="h-4 rounded bg-white/10"></div>
                <div class="h-4 rounded bg-white/10"></div>
              </div>
            </div>
          </div>
          <aside class="col-span-12 lg:col-span-3">
            <div class="mb-4 h-6 w-24 rounded bg-white/15"></div>
            <div class="space-y-3">
              <div v-for="i in 6" :key="i" class="flex items-center gap-3 p-2">
                <div class="h-12 w-20 rounded bg-white/10 animate-shimmer"></div>
                <div class="flex-1">
                  <div class="mb-2 h-4 w-2/3 rounded bg-white/15"></div>
                  <div class="h-3 w-1/3 rounded bg-white/10"></div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  </div>
</template>
