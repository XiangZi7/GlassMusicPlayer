<script setup lang="ts">
// 搜索页脚本：关键词输入、云搜索类型切换、分页与历史记录
import SearchSongs from '@/components/Search/SearchSongs.vue'
import SearchPlaylists from '@/components/Search/SearchPlaylists.vue'
import SearchMVs from '@/components/Search/SearchMVs.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import Pagination from '@/components/Ui/Pagination.vue'
// 路由实例：读取/更新查询参数
const route = useRoute()

// 当前搜索关键词（来自路由查询参数）
const q = computed(() => String(route.query.q || '').trim())

// 页面本地状态：关键词、当前类型、分页页码、当前页数量与总条数
const state = reactive({
  activeType: 1 as 1 | 1000 | 1004,
  page: 1,
  lastLoadedCount: 0,
  total: 0,
  isLoading: false,
})
// 将状态转换为响应式引用，便于模板使用
const { activeType, page, total, isLoading } = toRefs(state)
// 已移除输入历史功能

// Tab 配置：类型、标签、组件与图标

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
    <div class="flex h-full flex-col overflow-x-hidden px-4">
      <!-- 主内容：Tab + 结果 + 分页 -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Tab 导航 -->
        <div class="glass-nav mb-5 flex items-center justify-between gap-2 rounded-xl p-2">
          <div class="flex items-center gap-2">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="glass-button flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-all"
              :class="
                activeType === tab.key
                  ? 'bg-white/25 text-pink-300 ring-1 ring-pink-300/40'
                  : 'text-white/80'
              "
              @click="activeType = tab.key"
            >
              <span :class="[tab.icon, 'h-5 w-5']"></span>
              {{ $t(tab.labelKey) }}
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
