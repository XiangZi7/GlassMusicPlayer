<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { mvAll } from '@/api'
import LazyImage from '@/components/Ui/LazyImage.vue'

const router = useRouter()
const { t } = useI18n()

const state = reactive({
  categories: [
    { key: 'all', emoji: '🎬', type: undefined },
    { key: 'official', emoji: '🏛️', type: '官方版' },
    { key: 'live', emoji: '🎤', type: '现场版' },
    { key: 'netease', emoji: '🅽', type: '网易出品' },
  ],
  selectedCategoryKey: 'all',
  mvList: [] as Array<{
    id: number
    title: string
    artist: string
    duration: number
    playCount: string
    cover: string
    categoryKey: string
    liked: boolean
    isNew: boolean
  }>,
  hasMore: true,
  page: 0,
  isPageLoading: true,
})
const { categories, selectedCategoryKey, mvList, hasMore, isPageLoading } = toRefs(state)

const filteredMVs = computed(() => state.mvList)

const selectCategory = (key: string) => {
  state.selectedCategoryKey = key
  state.page = 0
  state.mvList = []
  fetchList(true)
}

const toggleLike = (mv: any) => {
  mv.liked = !mv.liked
}

const shareMV = (mv: any) => {
  console.log(`${t('mvList.log.sharePrefix')}${mv.title}`)
}

const formatSec = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

const formatCount = (count: number | string) => {
  const num = typeof count === 'string' ? parseInt(count) : count
  if (isNaN(num)) return count
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿'
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  return num
}

const fetchList = async (reset = false) => {
  try {
    const type = state.categories.find(c => c.key === state.selectedCategoryKey)?.type
    const limit = 24
    const offset = state.page * limit
    const res: any = await mvAll({ type, order: '最新', limit, offset })
    const list: any[] = res?.data || res?.mvs || res?.result || []
    const mapped = list.map(it => ({
      id: Number(it?.id),
      title: it?.name || it?.title || '',
      artist: it?.artistName || it?.artists?.[0]?.name || '',
      duration: Math.floor((it?.duration || 0) / 1000),
      playCount: String(it?.playCount || ''),
      cover: it?.cover || it?.coverImg || it?.picUrl || '',
      categoryKey: state.selectedCategoryKey,
      liked: false,
      isNew: !!it?.new || false,
    }))
    state.mvList = reset ? mapped : state.mvList.concat(mapped)
    state.hasMore = mapped.length === limit
    if (mapped.length) state.page += 1
    if (reset) state.isPageLoading = false
  } catch {
    state.hasMore = false
  }
}

const loadMore = () => {
  fetchList()
}

onMounted(() => {
  state.isPageLoading = true
  fetchList(true)
})
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <PageSkeleton v-if="isPageLoading" :sections="['hero', 'grid']" :grid-count="24" />
      <template v-else>
        <div class="px-6 py-6 lg:px-8">
          <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 class="text-primary text-2xl font-bold">{{ t('mvList.title') }}</h1>
              <p class="text-primary/60 mt-1 text-sm">{{ t('mvList.subtitle') }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="category in categories"
                :key="category.key"
                class="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                :class="
                  selectedCategoryKey === category.key
                    ? 'bg-pink-500 text-white'
                    : 'bg-white/10 text-primary hover:bg-white/15'
                "
                @click="selectCategory(category.key)"
              >
                {{ category.emoji }} {{ t('mvList.categories.' + category.key) }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <router-link
              v-for="mv in filteredMVs"
              :key="mv.id"
              :to="`/mv-player/${mv.id}`"
              class="group overflow-hidden rounded-xl transition-all hover:bg-white/5"
            >
              <div class="relative aspect-video overflow-hidden rounded-xl">
                <LazyImage
                  :src="mv.cover + '?param=480y270'"
                  :alt="t('mvList.alt.cover')"
                  imgClass="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  wrapperClass="h-full w-full"
                />
                <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <div class="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500/90 text-white shadow-lg">
                    <span class="icon-[mdi--play] h-7 w-7"></span>
                  </div>
                </div>
                <span class="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white backdrop-blur-sm">
                  {{ formatSec(mv.duration) }}
                </span>
                <div class="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white backdrop-blur-sm">
                  <span class="icon-[mdi--play] h-3 w-3"></span>
                  {{ formatCount(mv.playCount) }}
                </div>
              </div>

              <div class="p-3">
                <h3 class="text-primary mb-1 truncate text-sm font-medium group-hover:text-pink-400">
                  {{ mv.title }}
                </h3>
                <p class="text-primary/50 truncate text-xs">{{ mv.artist }}</p>
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-primary/40 rounded-full bg-white/5 px-2 py-0.5 text-xs">
                    {{ t('mvList.categories.' + mv.categoryKey) }}
                  </span>
                  <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      class="text-primary/50 hover:text-primary p-1 transition-colors"
                      @click.prevent.stop="toggleLike(mv)"
                    >
                      <span
                        class="h-4 w-4"
                        :class="mv.liked ? 'icon-[mdi--heart] text-red-400' : 'icon-[mdi--heart-outline]'"
                      ></span>
                    </button>
                    <button
                      class="text-primary/50 hover:text-primary p-1 transition-colors"
                      @click.prevent.stop="shareMV(mv)"
                    >
                      <span class="icon-[mdi--share-variant] h-4 w-4"></span>
                    </button>
                  </div>
                </div>
              </div>
            </router-link>
          </div>

          <div v-if="hasMore" class="mt-8 text-center">
            <button
              class="text-primary inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-2.5 text-sm font-medium transition-all hover:bg-white/15"
              @click="loadMore"
            >
              <span class="icon-[mdi--refresh] h-4 w-4"></span>
              {{ t('mvList.actions.loadMore') }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
