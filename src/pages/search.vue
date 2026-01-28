<script setup lang="ts">
// 搜索页脚本：关键词输入、云搜索类型切换、分页与历史记录
import SearchSongs from '@/components/Search/SearchSongs.vue'
import SearchPlaylists from '@/components/Search/SearchPlaylists.vue'
import SearchMVs from '@/components/Search/SearchMVs.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import TabGroup from '@/components/Ui/TabGroup.vue'
import Button from '@/components/Ui/Button.vue'
import { searchHotDetail } from '@/api'
import { useGlobalStore } from '@/stores/modules/global'
import { storeToRefs } from 'pinia'

// 路由实例：读取/更新查询参数
const route = useRoute()
const router = useRouter()
const globalStore = useGlobalStore()
const { searchHistory } = storeToRefs(globalStore)

// 当前搜索关键词（来自路由查询参数）
const q = computed(() => String(route.query.q || '').trim())

// 页面本地状态
const state = reactive({
  activeType: 1 as 1 | 1000 | 1004,
  page: 1,
  lastLoadedCount: 0,
  total: 0,
  isLoading: false,
  hotSearches: [] as { searchWord: string; score: number; iconType?: number }[],
  loadingHot: false,
})
const { activeType, page, total, isLoading } = toRefs(state)

const songsRef = ref<InstanceType<typeof SearchSongs> | null>(null)

const playAllSongs = () => {
  songsRef.value?.playAll()
}

const tabs = [
  {
    key: 1 as const,
    labelKey: 'search.tabs.song',
    component: SearchSongs,
    icon: 'icon-[mdi--music-circle]',
  },
  {
    key: 1000 as const,
    labelKey: 'search.tabs.playlist',
    component: SearchPlaylists,
    icon: 'icon-[mdi--playlist-music]',
  },
  {
    key: 1004 as const,
    labelKey: 'search.tabs.mv',
    component: SearchMVs,
    icon: 'icon-[mdi--movie-open-play]',
  },
]

// 当前激活类型对应的组件（动态组件）
const activeComp = computed(() => tabs.find(t => t.key === activeType.value)?.component)

// 每页数量按类型自适应
const pageSize = computed(() => (activeType.value === 1 ? 40 : activeType.value === 1000 ? 30 : 24))

// 子组件回调：记录当前页加载数量
const onLoaded = (count: number) => {
  state.lastLoadedCount = count
  state.isLoading = false
}
// 子组件回调：记录总条数
const onTotal = (n: number) => {
  state.total = n
}

// 切换类型或关键词时重置分页与总数
watch([activeType, q], () => {
  state.page = 1
  state.lastLoadedCount = 0
  state.total = 0
  state.isLoading = activeType.value !== 1 && !!q.value
})

watch(page, () => {
  state.isLoading = activeType.value !== 1 && !!q.value
})

// 搜索关键词
const doSearch = (keyword: string) => {
  if (!keyword.trim()) return
  globalStore.addSearchHistory(keyword.trim())
  router.push({ path: '/search', query: { q: keyword.trim() } })
}

// 清除搜索历史
const clearHistory = () => {
  globalStore.clearSearchHistory()
}

// 获取热门搜索
const fetchHotSearch = async () => {
  state.loadingHot = true
  try {
    const res: any = await searchHotDetail()
    state.hotSearches = res?.data || []
  } catch {
    state.hotSearches = []
  } finally {
    state.loadingHot = false
  }
}

onMounted(() => {
  if (!q.value) {
    fetchHotSearch()
  }
})

watch(q, (val) => {
  if (!val && state.hotSearches.length === 0) {
    fetchHotSearch()
  }
})
</script>

<template>
  <div class="flex h-full flex-1 flex-col overflow-hidden px-4">
    <!-- 有搜索结果时的布局 -->
    <template v-if="q">
      <!-- 顶部操作栏 -->
      <div class="mb-5 shrink-0">
        <!-- 搜索结果标题 -->
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/20">
            <span class="icon-[mdi--magnify] h-5 w-5 text-white"></span>
          </div>
          <div>
            <h1 class="text-primary text-xl font-bold">
              {{ $t('search.resultsFor') }}
              <span class="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">"{{ q }}"</span>
            </h1>
            <p v-if="total > 0" class="text-primary/50 text-sm">
              {{ $t('search.foundResults', { count: total }) }}
            </p>
          </div>
        </div>

        <!-- Tab + 控制栏 -->
        <div class="glass-card flex flex-wrap items-center justify-between gap-4 p-3">
          <!-- Tab 导航 -->
          <TabGroup
            v-model="activeType"
            :tabs="tabs"
            variant="gradient"
            size="sm"
            :show-count="false"
            @click="(val) => activeType = val"
          />

          <!-- 右侧控制 -->
          <div class="flex items-center gap-3">
            <!-- 播放全部按钮（仅歌曲 Tab 显示） -->
            <Button
              v-if="activeType === 1 && total > 0"
              variant="gradient"
              size="sm"
              @click="playAllSongs"
            >
              <span class="icon-[mdi--play] mr-1.5 h-4 w-4" />
              {{ $t('actions.playAll') }}
            </Button>

            <!-- 分页 -->
            <div v-if="total > 0" class="flex items-center gap-2">
              <div class="flex items-center gap-1 rounded-xl bg-white/5 p-1">
                <button
                  class="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
                  :class="
                    page > 1 ? 'text-primary hover:bg-white/10' : 'text-primary/30 cursor-not-allowed'
                  "
                  :disabled="page <= 1"
                  @click="page > 1 && page--"
                >
                  <span class="icon-[mdi--chevron-left] h-5 w-5" />
                </button>
                <span class="text-primary/80 min-w-[60px] text-center text-sm font-medium">
                  {{ page }} / {{ Math.ceil(total / pageSize) || 1 }}
                </span>
                <button
                  class="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
                  :class="
                    page < Math.ceil(total / pageSize)
                      ? 'text-primary hover:bg-white/10'
                      : 'text-primary/30 cursor-not-allowed'
                  "
                  :disabled="page >= Math.ceil(total / pageSize)"
                  @click="page < Math.ceil(total / pageSize) && page++"
                >
                  <span class="icon-[mdi--chevron-right] h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 结果区 -->
      <div class="relative min-h-0 flex-1 overflow-hidden">
        <component
          :is="activeComp"
          :ref="
            (el: any) => {
              if (activeType === 1) songsRef = el
            }
          "
          :keywords="q"
          :limit="pageSize"
          :offset="(page - 1) * pageSize"
          @loaded="onLoaded"
          @total="onTotal"
        />
        <div v-if="isLoading && activeType !== 1" class="absolute inset-0 z-10">
          <PageSkeleton
            :sections="activeType === 1000 ? ['grid'] : ['list']"
            :grid-count="12"
            :list-count="8"
          />
        </div>
      </div>
    </template>

    <!-- 空状态：没有搜索关键词时 -->
    <template v-else>
      <div class="custom-scrollbar flex h-full flex-col overflow-y-auto">
        <!-- 搜索引导区 -->
        <div class="flex flex-col items-center py-12">
          <!-- 动画搜索图标 -->
          <div class="search-icon-wrapper relative mb-8">
            <div class="absolute inset-0 animate-ping rounded-full bg-pink-500/20"></div>
            <div class="absolute inset-2 animate-pulse rounded-full bg-purple-500/20"></div>
            <div class="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-600/20 backdrop-blur-sm">
              <span class="icon-[mdi--magnify] text-primary/40 h-12 w-12 transition-transform duration-300 hover:scale-110"></span>
            </div>
          </div>

          <h2 class="text-primary mb-2 text-2xl font-bold">{{ $t('search.title') }}</h2>
          <p class="text-primary/50 mb-8 text-center text-sm">{{ $t('search.hint') }}</p>
        </div>

        <!-- 搜索历史 -->
        <div v-if="searchHistory.length > 0" class="mb-8 px-4">
          <div class="glass-card overflow-hidden p-4">
            <div class="mb-4 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="icon-[mdi--history] text-primary/60 h-5 w-5"></span>
                <h3 class="text-primary font-semibold">{{ $t('search.recentSearches') }}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="text-primary/50 hover:text-primary"
                @click="clearHistory"
              >
                <span class="icon-[mdi--delete-outline] mr-1 h-4 w-4"></span>
                {{ $t('common.clear') }}
              </Button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="keyword in searchHistory"
                :key="keyword"
                class="group relative flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm transition-all hover:bg-white/10 hover:shadow-md"
                @click="doSearch(keyword)"
              >
                <span class="text-primary/80 group-hover:text-primary">{{ keyword }}</span>
                <span
                  class="icon-[mdi--close] text-primary/40 hover:text-primary h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                  @click.stop="globalStore.removeSearchHistory(keyword)"
                ></span>
              </button>
            </div>
          </div>
        </div>

        <!-- 热门搜索 -->
        <div class="px-4 pb-8">
          <div class="glass-card overflow-hidden p-4">
            <div class="mb-4 flex items-center gap-2">
              <span class="icon-[mdi--fire] h-5 w-5 text-orange-400"></span>
              <h3 class="text-primary font-semibold">{{ $t('search.hotSearches') }}</h3>
            </div>

            <!-- 热搜骨架屏 -->
            <div v-if="state.loadingHot" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div v-for="i in 10" :key="i" class="flex items-center gap-3 rounded-lg p-2">
                <div class="h-6 w-6 animate-pulse rounded bg-white/10"></div>
                <div class="h-4 flex-1 animate-pulse rounded bg-white/10"></div>
              </div>
            </div>

            <!-- 热搜列表 -->
            <div v-else class="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <button
                v-for="(item, index) in state.hotSearches.slice(0, 20)"
                :key="item.searchWord"
                class="group flex items-center gap-3 rounded-lg p-2.5 text-left transition-all hover:bg-white/5"
                @click="doSearch(item.searchWord)"
              >
                <!-- 排名 -->
                <span
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                  :class="[
                    index < 3
                      ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-md'
                      : 'bg-white/10 text-primary/60'
                  ]"
                >
                  {{ index + 1 }}
                </span>

                <!-- 关键词 -->
                <span class="text-primary/80 group-hover:text-primary flex-1 truncate text-sm font-medium transition-colors">
                  {{ item.searchWord }}
                </span>

                <!-- 热度标签 -->
                <span
                  v-if="item.iconType === 1"
                  class="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400"
                >
                  HOT
                </span>
                <span
                  v-else-if="item.iconType === 5"
                  class="shrink-0 rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400"
                >
                  NEW
                </span>

                <!-- 热度分数 -->
                <span class="text-primary/30 shrink-0 text-xs">
                  {{ Math.round(item.score / 10000) }}w
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 搜索图标动画 */
.search-icon-wrapper {
  perspective: 1000px;
}

.search-icon-wrapper:hover .icon-\[mdi--magnify\] {
  animation: search-bounce 0.5s ease;
}

@keyframes search-bounce {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  25% {
    transform: scale(1.1) rotate(-10deg);
  }
  50% {
    transform: scale(0.95) rotate(5deg);
  }
  75% {
    transform: scale(1.05) rotate(-5deg);
  }
}
</style>
