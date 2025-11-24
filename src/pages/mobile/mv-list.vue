<script setup lang="ts">
import { mvAll } from '@/api'

const state = reactive({
  loading: true,
  list: [] as Array<{ id: number | string; name: string; cover: string; artist: string }>,
})

const load = async () => {
  try {
    const res = await mvAll({ order: '最新', limit: 20 })
    const list = (res as any)?.data || (res as any)?.mvs || (res as any)?.result || []
    state.list = list.map((m: any) => ({ id: m?.id || m?.vid || 0, name: m?.name || m?.title || '', cover: m?.cover || m?.imgurl || m?.pic || '', artist: m?.artistName || '' }))
  } finally {
    state.loading = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div v-if="state.loading" class="py-6"><PageSkeleton :sections="['list']" :list-count="8" /></div>
    <div v-else class="grid grid-cols-2 gap-3">
      <router-link v-for="m in state.list" :key="m.id" :to="`/mv-player/${m.id}`" class="group">
        <div class="glass-card p-3">
          <div class="relative mb-2 overflow-hidden rounded-lg">
            <img :src="m.cover" alt="cover" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
          </div>
          <h3 class="truncate text-xs font-medium text-white">{{ m.name }}</h3>
          <p class="truncate text-[11px] text-purple-300">{{ m.artist }}</p>
        </div>
      </router-link>
    </div>
  </div>
</template>
