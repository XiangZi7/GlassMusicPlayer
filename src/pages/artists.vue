<script setup lang="ts">
import { artistList } from '@/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const state = reactive({
  artists: [] as any[],
  isLoading: false,
  type: -1,
  area: -1,
  initial: '',
  offset: 0,
  limit: 30,
  hasMore: true,
})

const { type, area, initial } = toRefs(state)

const typeOptions = [
  { key: -1, labelKey: 'artists.types.all' },
  { key: 1, labelKey: 'artists.types.male' },
  { key: 2, labelKey: 'artists.types.female' },
  { key: 3, labelKey: 'artists.types.band' },
]

const areaOptions = [
  { key: -1, labelKey: 'artists.areas.all' },
  { key: 7, labelKey: 'artists.areas.zh' },
  { key: 96, labelKey: 'artists.areas.ea' },
  { key: 8, labelKey: 'artists.areas.jp' },
  { key: 16, labelKey: 'artists.areas.kr' },
  { key: 0, labelKey: 'artists.areas.other' },
]

const initialOptions = [
  { key: '', labelKey: 'artists.initials.hot' },
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => ({ key: c, labelKey: c })),
]

const loadArtists = async (reset = false) => {
  if (reset) {
    state.offset = 0
    state.artists = []
    state.hasMore = true
  }
  if (!state.hasMore) return
  
  try {
    state.isLoading = true
    const params: any = {
      limit: state.limit,
      offset: state.offset,
    }
    if (state.type !== -1) params.type = state.type
    if (state.area !== -1) params.area = state.area
    if (state.initial) params.initial = state.initial

    const res: any = await artistList(params)
    const list: any[] = res?.artists || res?.data?.artists || []
    
    const mapped = list.map((it: any) => ({
      id: it?.id,
      name: it?.name,
      alias: it?.alias?.join(' / ') || '',
      cover: it?.picUrl || it?.img1v1Url || '',
      albumSize: it?.albumSize || 0,
      mvSize: it?.mvSize || 0,
    }))
    
    state.artists = reset ? mapped : [...state.artists, ...mapped]
    state.hasMore = list.length === state.limit
    state.offset += state.limit
  } finally {
    state.isLoading = false
  }
}

watch([type, area, initial], () => loadArtists(true))

onMounted(() => loadArtists(true))
</script>

<template>
  <div class="flex h-full flex-1 flex-col overflow-hidden">
    <div class="glass-card mx-4 mb-0 shrink-0 p-4">
      <div class="flex flex-wrap items-center gap-6">
        <div class="flex items-center gap-2">
          <span class="text-primary/60 text-sm">{{ t('artists.type') }}:</span>
          <div class="flex gap-1">
            <button
              v-for="opt in typeOptions"
              :key="opt.key"
              class="rounded-lg px-3 py-1.5 text-xs transition-all"
              :class="type === opt.key ? 'bg-pink-500/20 text-pink-400' : 'text-primary/60 hover:bg-white/5'"
              @click="type = opt.key"
            >
              {{ t(opt.labelKey) }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-primary/60 text-sm">{{ t('artists.area') }}:</span>
          <div class="flex gap-1">
            <button
              v-for="opt in areaOptions"
              :key="opt.key"
              class="rounded-lg px-3 py-1.5 text-xs transition-all"
              :class="area === opt.key ? 'bg-pink-500/20 text-pink-400' : 'text-primary/60 hover:bg-white/5'"
              @click="area = opt.key"
            >
              {{ t(opt.labelKey) }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1">
          <span class="text-primary/60 mr-1 text-sm">{{ t('artists.initial') }}:</span>
          <button
            v-for="opt in initialOptions"
            :key="opt.key"
            class="rounded px-2 py-1 text-xs transition-all"
            :class="initial === opt.key ? 'bg-pink-500/20 text-pink-400' : 'text-primary/60 hover:bg-white/5'"
            @click="initial = opt.key"
          >
            {{ opt.key || t(opt.labelKey) }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <PageSkeleton v-if="state.isLoading && !state.artists.length" :sections="['grid']" />
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <router-link
          v-for="artist in state.artists"
          :key="artist.id"
          :to="`/artist/${artist.id}`"
          class="glass-card group cursor-pointer overflow-hidden p-3 transition-all hover:bg-white/10"
        >
          <div class="relative mb-3 aspect-square overflow-hidden rounded-full">
            <LazyImage
              :src="artist.cover + '?param=300y300'"
              :alt="artist.name"
              class="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <div class="text-center">
            <p class="text-primary truncate text-sm font-medium">{{ artist.name }}</p>
            <p v-if="artist.alias" class="text-primary/40 truncate text-xs">{{ artist.alias }}</p>
            <p class="text-primary/40 mt-1 text-xs">
              {{ artist.albumSize }} {{ t('artists.albums') }} · {{ artist.mvSize }} MV
            </p>
          </div>
        </router-link>
      </div>

      <div v-if="state.hasMore && state.artists.length" class="mt-6 text-center">
        <button
          :disabled="state.isLoading"
          class="glass-button px-6 py-2 text-sm"
          @click="loadArtists(false)"
        >
          <span v-if="state.isLoading" class="icon-[mdi--loading] mr-2 h-4 w-4 animate-spin" />
          {{ state.isLoading ? t('common.loading') : t('artists.loadMore') }}
        </button>
      </div>
    </div>
  </div>
</template>
