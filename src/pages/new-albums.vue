<script setup lang="ts">
import { albumNew } from '@/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const state = reactive({
  albums: [] as any[],
  isLoading: false,
  area: 'ALL' as 'ALL' | 'ZH' | 'EA' | 'KR' | 'JP',
  offset: 0,
  limit: 30,
  hasMore: true,
})

const { area } = toRefs(state)

const areaOptions = [
  { key: 'ALL', labelKey: 'newAlbums.areas.all' },
  { key: 'ZH', labelKey: 'newAlbums.areas.zh' },
  { key: 'EA', labelKey: 'newAlbums.areas.ea' },
  { key: 'JP', labelKey: 'newAlbums.areas.jp' },
  { key: 'KR', labelKey: 'newAlbums.areas.kr' },
]

const loadAlbums = async (reset = false) => {
  if (reset) {
    state.offset = 0
    state.albums = []
    state.hasMore = true
  }
  if (!state.hasMore) return

  try {
    state.isLoading = true
    const res: any = await albumNew({
      area: state.area,
      limit: state.limit,
      offset: state.offset,
    })
    const list: any[] = res?.albums || res?.data?.albums || []

    const mapped = list.map((it: any) => ({
      id: it?.id,
      name: it?.name,
      artist: it?.artist?.name || it?.artists?.map((a: any) => a.name).join(' / ') || '',
      artistId: it?.artist?.id || it?.artists?.[0]?.id || 0,
      cover: it?.picUrl || it?.blurPicUrl || '',
      publishTime: it?.publishTime || 0,
      size: it?.size || 0,
    }))

    state.albums = reset ? mapped : [...state.albums, ...mapped]
    state.hasMore = list.length === state.limit
    state.offset += state.limit
  } finally {
    state.isLoading = false
  }
}

const formatDate = (timestamp: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

watch(area, () => loadAlbums(true))

onMounted(() => loadAlbums(true))
</script>

<template>
  <div class="flex h-full flex-1 flex-col overflow-hidden">
    <div class="glass-card mx-4 mb-0 shrink-0 p-4">
      <div class="flex items-center gap-4">
        <h2 class="text-primary text-lg font-bold">{{ t('newAlbums.title') }}</h2>
        <div class="flex gap-1">
          <button
            v-for="opt in areaOptions"
            :key="opt.key"
            class="rounded-lg px-3 py-1.5 text-xs transition-all"
            :class="area === opt.key ? 'bg-pink-500/20 text-pink-400' : 'text-primary/60 hover:bg-white/5'"
            @click="area = opt.key as any"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <PageSkeleton v-if="state.isLoading && !state.albums.length" :sections="['grid']" />
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <router-link
          v-for="album in state.albums"
          :key="album.id"
          :to="`/album/${album.id}`"
          class="glass-card group cursor-pointer overflow-hidden p-3 transition-all hover:bg-white/10"
        >
          <div class="relative mb-3 aspect-square overflow-hidden rounded-lg">
            <LazyImage
              :src="album.cover + '?param=300y300'"
              :alt="album.name"
              class="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <div class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
              <span class="icon-[mdi--play-circle] h-12 w-12 text-white" />
            </div>
          </div>
          <div>
            <p class="text-primary truncate text-sm font-medium">{{ album.name }}</p>
            <router-link
              :to="`/artist/${album.artistId}`"
              class="text-primary/60 hover:text-primary truncate text-xs"
              @click.stop
            >
              {{ album.artist }}
            </router-link>
            <p class="text-primary/40 mt-1 text-xs">{{ formatDate(album.publishTime) }}</p>
          </div>
        </router-link>
      </div>

      <div v-if="state.hasMore && state.albums.length" class="mt-6 text-center">
        <button
          :disabled="state.isLoading"
          class="glass-button px-6 py-2 text-sm"
          @click="loadAlbums(false)"
        >
          <span v-if="state.isLoading" class="icon-[mdi--loading] mr-2 h-4 w-4 animate-spin" />
          {{ state.isLoading ? t('common.loading') : t('newAlbums.loadMore') }}
        </button>
      </div>
    </div>
  </div>
</template>
