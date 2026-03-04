<script setup lang="ts">
// 搜索页脚本：关键词输入、云搜索类型切换、分页与历史记录
import SearchSongs from '@/components/Search/SearchSongs.vue'
import SearchPlaylists from '@/components/Search/SearchPlaylists.vue'
import SearchMVs from '@/components/Search/SearchMVs.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import TabGroup from '@/components/Ui/TabGroup.vue'
import Button from '@/components/Ui/Button.vue'
import { searchHotDetail, searchDefault } from '@/api'
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

// 搜索输入框相关
const searchInput = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const inputFocused = ref(false)
const placeholder = ref('')

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
  searchInput.value = ''
  inputRef.value?.blur()
  router.push({ path: '/search', query: { q: keyword.trim() } })
}

// 提交搜索（从输入框回车或点击按钮）
const handleSubmit = () => {
  const keyword = searchInput.value.trim() || placeholder.value
  if (keyword) doSearch(keyword)
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

// 获取默认搜索词作为 placeholder
const fetchPlaceholder = async () => {
  try {
    const res: any = await searchDefault()
    placeholder.value = res?.data?.showKeyword || res?.data?.realkeyword || ''
  } catch {
    // 忽略
  }
}

onMounted(() => {
  if (!q.value) {
    fetchHotSearch()
    fetchPlaceholder()
  }
})

watch(q, (val) => {
  if (!val && state.hotSearches.length === 0) {
    fetchHotSearch()
  }
})

// 热搜最大分数，用于计算热度条宽度
const maxScore = computed(() => {
  if (!state.hotSearches.length) return 1
  return Math.max(...state.hotSearches.map(h => h.score))
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

    <!-- ═══════════════════════════════════════════════ -->
    <!-- 空状态：没有搜索关键词时                         -->
    <!-- ═══════════════════════════════════════════════ -->
    <template v-else>
      <div class="custom-scrollbar relative flex h-full flex-col overflow-y-auto">

        <!-- 背景氛围光 -->
        <div class="pointer-events-none absolute inset-0 overflow-hidden">
          <div class="ambient-a absolute -top-20 left-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full" />
          <div class="ambient-b absolute -bottom-32 right-1/4 h-[350px] w-[350px] rounded-full" />
        </div>

        <!-- 顶部搜索区 -->
        <div class="relative z-10 shrink-0 pt-8 pb-6">
          <!-- 搜索输入框 -->
          <div
            class="search-box mx-auto w-full max-w-xl transition-all duration-500"
            :class="inputFocused ? 'scale-[1.02]' : ''"
          >
            <div
              class="flex items-center gap-3 rounded-2xl border px-5 py-3.5 backdrop-blur-xl transition-all duration-300"
              :class="[
                inputFocused
                  ? 'border-pink-500/30 bg-white/[0.07] shadow-[0_0_30px_rgba(236,72,153,0.08),0_8px_32px_rgba(0,0,0,0.12)]'
                  : 'border-white/[0.06] bg-white/[0.035] shadow-[0_2px_12px_rgba(0,0,0,0.08)]'
              ]"
            >
              <span
                class="icon-[mdi--magnify] h-5 w-5 shrink-0 transition-all duration-300"
                :class="inputFocused ? 'text-pink-400' : 'text-primary/30'"
              />
              <input
                ref="inputRef"
                v-model="searchInput"
                type="text"
                :placeholder="placeholder || $t('common.search.placeholder')"
                class="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-primary/30"
                @focus="inputFocused = true"
                @blur="inputFocused = false"
                @keyup.enter="handleSubmit"
              />
              <!-- 清除按钮 -->
              <Transition name="fade-scale">
                <button
                  v-if="searchInput"
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-primary/30 transition-colors hover:bg-white/10 hover:text-primary/60"
                  @click="searchInput = ''"
                >
                  <span class="icon-[mdi--close] h-3.5 w-3.5" />
                </button>
              </Transition>
              <!-- 搜索按钮 -->
              <button
                class="search-btn flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-medium text-white transition-all duration-300 active:scale-95"
                @click="handleSubmit"
              >
                <span class="icon-[mdi--magnify] h-3.5 w-3.5" />
                {{ $t('common.search.label') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 搜索历史 -->
        <div v-if="searchHistory.length > 0" class="relative z-10 mb-6 shrink-0">
          <div class="mb-2.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="icon-[mdi--history] h-4 w-4 text-primary/25" />
              <span class="text-primary/40 text-xs font-medium">{{ $t('search.recentSearches') }}</span>
            </div>
            <button
              class="text-primary/25 hover:text-primary/50 text-xs transition-colors"
              @click="clearHistory"
            >
              {{ $t('common.clear') }}
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(keyword, ki) in searchHistory"
              :key="keyword"
              class="history-chip group flex items-center gap-1.5 rounded-full border border-white/[0.05] bg-white/[0.025] px-3 py-1.5 text-[13px] transition-all duration-200 hover:border-pink-500/15 hover:bg-white/[0.055]"
              :style="{ animationDelay: `${ki * 35}ms` }"
              @click="doSearch(keyword)"
            >
              <span class="text-primary/55 group-hover:text-primary/85 transition-colors">{{ keyword }}</span>
              <span
                class="icon-[mdi--close] h-3 w-3 shrink-0 text-transparent transition-all group-hover:text-primary/30 hover:text-pink-400!"
                @click.stop="globalStore.removeSearchHistory(keyword)"
              />
            </button>
          </div>
        </div>

        <!-- 热门搜索 -->
        <div class="relative z-10 min-h-0 flex-1 pb-6">
          <div class="mb-3 flex items-center gap-2">
            <span class="icon-[mdi--fire] h-4 w-4 text-orange-500/60" />
            <span class="text-primary/40 text-xs font-medium">{{ $t('search.hotSearches') }}</span>
          </div>

          <!-- 骨架屏 -->
          <div v-if="state.loadingHot" class="space-y-1.5">
            <div v-for="i in 12" :key="i" class="flex items-center gap-4 rounded-xl px-3 py-3">
              <div class="h-5 w-5 animate-pulse rounded bg-white/[0.05]" />
              <div class="h-3 animate-pulse rounded bg-white/[0.05]" :style="{ width: `${30 + Math.random() * 35}%` }" />
            </div>
          </div>

          <!-- 热搜双栏列表 -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
            <button
              v-for="(item, index) in state.hotSearches.slice(0, 20)"
              :key="item.searchWord"
              class="hot-item group flex items-center gap-3 rounded-xl px-3 py-[10px] text-left transition-all duration-200 hover:bg-white/[0.04]"
              :style="{ animationDelay: `${index * 25}ms` }"
              @click="doSearch(item.searchWord)"
            >
              <!-- 排名 -->
              <span
                class="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold leading-none"
                :class="[
                  index === 0
                    ? 'bg-gradient-to-br from-rose-500 to-orange-500 text-white'
                    : index === 1
                      ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white'
                      : index === 2
                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-900'
                        : 'text-primary/25'
                ]"
              >
                {{ index + 1 }}
              </span>

              <!-- 关键词 + 热度条 -->
              <div class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm transition-colors duration-200"
                  :class="index < 3 ? 'text-primary/90 font-semibold' : 'text-primary/60 group-hover:text-primary/85'"
                >
                  {{ item.searchWord }}
                </span>
                <!-- 热度渐变条 -->
                <div class="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="index < 3 ? 'bg-gradient-to-r from-pink-500/60 to-purple-500/40' : 'bg-white/[0.08]'"
                    :style="{ width: `${Math.max(8, (item.score / maxScore) * 100)}%` }"
                  />
                </div>
              </div>

              <!-- 标签 -->
              <span
                v-if="item.iconType === 1"
                class="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-rose-400"
              >HOT</span>
              <span
                v-else-if="item.iconType === 5"
                class="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-emerald-400"
              >NEW</span>

              <!-- 热度值 -->
              <span class="text-primary/15 w-10 shrink-0 text-right text-[10px] tabular-nums">
                {{ Math.round(item.score / 10000) }}w
              </span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ═══ 背景氛围光 ═══ */
.ambient-a {
  background: radial-gradient(circle, rgba(236, 72, 153, 0.07) 0%, transparent 65%);
  animation: ambient-float 12s ease-in-out infinite;
}
.ambient-b {
  background: radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 65%);
  animation: ambient-float 15s ease-in-out infinite reverse;
}
@keyframes ambient-float {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
  33% { transform: translate(20px, -15px) scale(1.05); opacity: 0.8; }
  66% { transform: translate(-15px, 10px) scale(0.97); opacity: 0.5; }
}

/* ═══ 搜索按钮渐变 ═══ */
.search-btn {
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  box-shadow: 0 4px 16px rgba(236, 72, 153, 0.25);
}
.search-btn:hover {
  box-shadow: 0 6px 24px rgba(236, 72, 153, 0.35);
  filter: brightness(1.1);
}

/* ═══ 搜索历史标签入场 ═══ */
.history-chip {
  animation: chip-in 0.35s var(--glass-ease-out) both;
}
@keyframes chip-in {
  from { opacity: 0; transform: translateY(4px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ═══ 热搜入场 ═══ */
.hot-item {
  animation: item-in 0.3s var(--glass-ease-out) both;
}
@keyframes item-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ═══ 淡入缩放过渡（清除按钮） ═══ */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.2s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
