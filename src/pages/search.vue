<script setup lang="ts">
// 搜索页脚本：关键词输入、云搜索类型切换、分页与历史记录
import SearchSongs from '@/components/Search/SearchSongs.vue'
import SearchPlaylists from '@/components/Search/SearchPlaylists.vue'
import SearchMVs from '@/components/Search/SearchMVs.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import Pagination from '@/components/Ui/Pagination.vue'
// 路由实例：读取/更新查询参数
const route = useRoute()
const router = useRouter()

// 当前搜索关键词（来自路由查询参数）
const q = computed(() => String(route.query.q || '').trim())

// 页面本地状态：关键词、当前类型、分页页码、当前页数量与总条数
const state = reactive({
  localQuery: '',
  activeType: 1 as 1 | 1000 | 1004,
  page: 1,
  lastLoadedCount: 0,
  total: 0,
  isLoading: false,
})
// 将状态转换为响应式引用，便于模板使用
const { localQuery, activeType, page, total, isLoading } = toRefs(state)
// 已移除输入历史功能

// Tab 配置：类型、标签、组件与图标
const tabs = [
  { key: 1 as const, label: '单曲', component: SearchSongs, icon: 'icon-[mdi--music-circle]' },
  {
    key: 1000 as const,
    label: '歌单',
    component: SearchPlaylists,
    icon: 'icon-[mdi--playlist-music]',
  },
  { key: 1004 as const, label: 'MV', component: SearchMVs, icon: 'icon-[mdi--movie-open-play]' },
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

// 路由关键词变化时，同步输入框
watch(
  q,
  val => {
    state.localQuery = val
  },
  { immediate: true }
)

// 提交搜索：更新路由
const submitSearch = () => {
  const term = state.localQuery.trim()
  router.replace({ path: '/search', query: { q: term } })
}

// 应用快捷关键词
const applyQuick = (term: string) => {
  state.localQuery = term
  submitSearch()
}
// 已移除输入框历史下拉交互
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
</script>

<template>
  <!-- 页面主容器 -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <div class="flex h-full flex-col overflow-x-hidden px-6">
      <!-- 英雄区：标题/说明/装饰动画 -->
      <div class="relative mb-4 flex shrink-0 flex-col overflow-hidden rounded-2xl p-1">
        <div class="glass-container rounded-2xl p-6 backdrop-blur-3xl">
          <!-- 搜索输入框与按钮 -->
          <div
            class="glass-card animate-pulse-glow relative flex items-center gap-3 px-5 py-4 shadow-xl"
          >
            <span class="icon-[mdi--magnify] h-6 w-6 text-white/80"></span>
            <input
              v-model="localQuery"
              @keyup.enter="submitSearch"
              type="text"
              placeholder="搜索音乐、歌手、专辑..."
              class="min-w-0 flex-1 bg-transparent text-base text-white placeholder-white/60 outline-none"
            />
            <button
              class="glass-button hover-scale px-5 py-2 text-sm text-white"
              @click="submitSearch"
            >
              <span class="icon-[mdi--arrow-right] mr-1 h-4 w-4"></span>
              搜索
            </button>
          </div>

          <!-- 快捷关键词按钮组 -->
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <button
                class="glass-button px-3 py-1 text-xs text-white/90"
                @click="applyQuick('流行')"
              >
                <span class="icon-[mdi--fire] mr-1 h-3 w-3 text-pink-300"></span>流行
              </button>
              <button
                class="glass-button px-3 py-1 text-xs text-white/90"
                @click="applyQuick('摇滚')"
              >
                <span class="icon-[mdi--guitar-electric] mr-1 h-3 w-3 text-yellow-300"></span>摇滚
              </button>
              <button
                class="glass-button px-3 py-1 text-xs text-white/90"
                @click="applyQuick('电子')"
              >
                <span class="icon-[mdi--lightning-bolt] mr-1 h-3 w-3 text-blue-300"></span>电子
              </button>
              <button
                class="glass-button px-3 py-1 text-xs text-white/90"
                @click="applyQuick('Hip-Hop')"
              >
                <span class="icon-[mdi--music] mr-1 h-3 w-3 text-green-300"></span>Hip-Hop
              </button>
              <button
                class="glass-button px-3 py-1 text-xs text-white/90"
                @click="applyQuick('民谣')"
              >
                <span class="icon-[mdi--leaf] mr-1 h-3 w-3 text-emerald-300"></span>民谣
              </button>
            </div>
            <p class="text-sm text-white/70">
              <span class="icon-[mdi--sparkles] h-6 w-6 text-pink-300"></span>

              关键词：{{ q || '请输入搜索内容' }}
            </p>
          </div>
        </div>
      </div>

      <!-- 主内容：Tab + 结果 + 分页 -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Tab 导航 -->
        <div class="glass-nav mb-5 flex items-center justify-between gap-2 rounded-xl p-2">
          <div class="flex items-center gap-2">
            <button
              v-for="t in tabs"
              :key="t.key"
              class="glass-button flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-all"
              :class="
                activeType === t.key
                  ? 'bg-white/25 text-pink-300 ring-1 ring-pink-300/40'
                  : 'text-white/80'
              "
              @click="activeType = t.key"
            >
              <span :class="[t.icon, 'h-5 w-5']"></span>
              {{ t.label }}
            </button>
          </div>

          <Pagination :is-car="false" v-model="page" :total="total" :page-size="pageSize" />
        </div>
        <!-- 结果区（动态组件） -->
        <div class="relative h-full overflow-hidden">
          <component
            :is="activeComp"
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
      </div>
    </div>
  </div>
</template>
