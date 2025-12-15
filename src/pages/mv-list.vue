<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { mvAll } from '@/api'
import { formatCount } from '@/utils/time'
import TabGroup from '@/components/Ui/TabGroup.vue'
import Button from '@/components/Ui/Button.vue'
const { t } = useI18n()

const state = reactive({
  categories: [
    {
      key: 'all',
      labelKey: 'mvList.categories.all',
      icon: 'icon-[mdi--movie-open]',
      type: undefined,
    },
    {
      key: 'official',
      labelKey: 'mvList.categories.official',
      icon: 'icon-[mdi--crown]',
      type: '官方版',
    },
    {
      key: 'live',
      labelKey: 'mvList.categories.live',
      icon: 'icon-[mdi--microphone-variant]',
      type: '现场版',
    },
    {
      key: 'netease',
      labelKey: 'mvList.categories.netease',
      icon: 'icon-[mdi--music-note]',
      type: '网易出品',
    },
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
  <div class="flex h-full flex-1 flex-col overflow-hidden p-4 lg:p-6">
    <PageSkeleton v-if="isPageLoading" :sections="['hero', 'grid']" :grid-count="24" />
    <template v-else>
      <!-- 头部 -->
      <header class="mb-6 flex shrink-0 items-center justify-between">
        <div>
          <h1 class="text-primary text-2xl font-bold tracking-tight lg:text-3xl">
            {{ t('mvList.title') }}
          </h1>
          <p class="text-primary/60 mt-1.5 text-sm">{{ t('mvList.subtitle') }}</p>
        </div>
        <TabGroup
          v-model="selectedCategoryKey"
          :tabs="categories"
          variant="gradient"
          size="sm"
          :show-count="false"
          @click="selectCategory"
        />
      </header>

      <!-- MV 网格 -->
      <div class="min-h-0 flex-1 overflow-auto">
        <section class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <router-link
            v-for="mv in mvList"
            :key="mv.id"
            :to="`/mv-player/${mv.id}`"
            class="glass-card group block overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div class="relative aspect-video overflow-hidden">
              <LazyImage
                :src="mv.cover + '?param=480y270'"
                :alt="t('mvList.alt.cover')"
                imgClass="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                wrapperClass="h-full w-full"
              />
              <div
                class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"
              />
              <div
                class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              >
                <div
                  class="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500/90 text-white shadow-2xl backdrop-blur-sm"
                >
                  <span class="icon-[mdi--play] h-8 w-8"></span>
                </div>
              </div>
              <span
                class="absolute right-3 bottom-3 rounded-lg bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm"
              >
                {{ formatSec(mv.duration) }}
              </span>
              <div
                class="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur-sm"
              >
                <span class="icon-[mdi--play-circle-outline] h-3.5 w-3.5"></span>
                {{ formatCount(mv.playCount) }}
              </div>
            </div>

            <div class="p-4">
              <h3
                class="text-primary mb-2 truncate text-base font-semibold transition-colors group-hover:text-pink-400"
              >
                {{ mv.title }}
              </h3>
              <p class="text-primary/50 mb-3 truncate text-sm">{{ mv.artist }}</p>
              <div class="flex items-center justify-between">
                <span class="glass-card text-primary/60 rounded-full px-3 py-1 text-xs font-medium">
                  {{ t('mvList.categories.' + mv.categoryKey) }}
                </span>
                <div
                  class="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  <button
                    class="text-primary/50 hover:bg-hover-glass rounded-full p-1.5 transition-all hover:text-pink-400"
                    :title="t('mvList.actions.like')"
                    @click.prevent.stop="toggleLike(mv)"
                  >
                    <span
                      class="h-5 w-5"
                      :class="
                        mv.liked ? 'icon-[mdi--heart] text-pink-400' : 'icon-[mdi--heart-outline]'
                      "
                    ></span>
                  </button>
                  <button
                    class="text-primary/50 hover:text-primary hover:bg-hover-glass rounded-full p-1.5 transition-all"
                    :title="t('mvList.actions.share')"
                    @click.prevent.stop="shareMV(mv)"
                  >
                    <span class="icon-[mdi--share-variant-outline] h-5 w-5"></span>
                  </button>
                </div>
              </div>
            </div>
          </router-link>
        </section>

        <div v-if="hasMore" class="mt-8 flex justify-center pb-4">
          <Button variant="soft" size="md" rounded="lg" class="gap-2" @click="loadMore">
            <span class="icon-[mdi--refresh] h-5 w-5"></span>
            {{ t('mvList.actions.loadMore') }}
          </Button>
        </div>
      </div>
    </template>
  </div>
</template>
