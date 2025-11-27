<script setup lang="ts">
import { mvDetail, mvUrl, simiMv } from '@/api'
import LazyImage from '@/components/Ui/LazyImage.vue'

const route = useRoute()
const mvId = computed(() => String(route.params.id || ''))

const state = reactive({
  name: '',
  artist: '',
  cover: '',
  url: '',
  loading: true,
  simis: [] as Array<{ id: number | string; name: string; cover: string; artist: string }>,
})

const load = async (id: string) => {
  try {
    const [detailRes, urlRes, simiRes] = await Promise.all([
      mvDetail({ mvid: id }),
      mvUrl({ id }),
      simiMv({ mvid: id }),
    ])
    const d = (detailRes as any)?.data || (detailRes as any)?.mv || {}
    state.name = d?.name || d?.title || ''
    state.artist = d?.artistName || ''
    state.cover = d?.cover || d?.imgurl || ''
    const u = (urlRes as any)?.data || (urlRes as any)?.url || {}
    state.url = u?.url || ''
    const simis = (simiRes as any)?.mvs || (simiRes as any)?.data || []
    state.simis = simis.map((m: any) => ({ id: m?.id || m?.vid || 0, name: m?.name || m?.title || '', cover: m?.cover || m?.imgurl || '', artist: m?.artistName || '' }))
  } finally {
    state.loading = false
  }
}

onMounted(() => { if (mvId.value) load(mvId.value) })
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div v-if="state.loading" class="py-6"><PageSkeleton :sections="['hero','list']" :list-count="6" /></div>
    <template v-else>
      <section class="mb-4">
        <div class="relative overflow-hidden rounded-2xl">
          <Artplayer v-if="state.url" :src="state.url" class="h-48 w-full" />
          <div v-else class="flex h-48 w-full items-center justify-center rounded-2xl glass-button">{{ $t('mv.noSource') }}</div>
        </div>
        <div class="mt-2">
          <h1 class="truncate text-lg font-bold text-primary">{{ state.name }}</h1>
          <p class="truncate text-xs text-primary/70">{{ state.artist }}</p>
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-sm font-semibold text-primary">{{ $t('mv.related') }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <router-link v-for="m in state.simis" :key="m.id" :to="`/mv-player/${m.id}`" class="group">
            <div class="glass-card p-3">
              <div class="relative mb-2 overflow-hidden rounded-lg">
            <LazyImage :src="m.cover" alt="cover" imgClass="h-full w-full object-cover" />
              </div>
              <h3 class="truncate text-xs font-medium text-primary">{{ m.name }}</h3>
              <p class="truncate text-[11px] text-primary/70">{{ m.artist }}</p>
            </div>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>
