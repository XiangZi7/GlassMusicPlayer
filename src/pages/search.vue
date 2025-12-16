<script setup lang="ts">
// 搜索页脚本：关键词输入、云搜索类型切换、分页与历史记录
import SearchSongs from '@/components/Search/SearchSongs.vue'
import SearchPlaylists from '@/components/Search/SearchPlaylists.vue'
import SearchMVs from '@/components/Search/SearchMVs.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import TabGroup from '@/components/Ui/TabGroup.vue'
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
  <div class="flex h-full flex-1 flex-col overflow-hidden px-4">
    <!-- 顶部操作栏：搜索标题 + Tab + 分页 -->
    <div v-if="q" class="mb-5 shrink-0">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <!-- 左侧：搜索关键词 + Tab -->
        <div class="flex flex-wrap items-center gap-4">
          <!-- Tab 导航 -->
          <TabGroup
            v-model="activeType"
            :tabs="tabs"
            variant="gradient"
            size="sm"
            :show-count="false"
            @click="(val) => activeType = val"
          />
        </div>

        <!-- 右侧：播放全部 + 分页 -->
        <div class="flex items-center gap-6">
          <!-- 播放全部按钮（仅歌曲 Tab 显示） -->
          <button
            v-if="activeType === 1 && total > 0"
            @click="playAllSongs"
            class="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-pink-500 to-rose-500 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-pink-500/20 transition-all hover:shadow-lg hover:shadow-pink-500/30"
          >
            <span class="icon-[mdi--play] h-4 w-4" />
            {{ $t('actions.playAll') }}
          </button>
          <h1 class="text-primary text-xl font-bold">
            <span class="text-primary/60">{{ $t('search.resultsFor') }}</span>
            <span class="ml-1 text-pink-400">"{{ q }}"</span>
          </h1>
          <!-- 分页 -->
          <div v-if="total > 0" class="flex items-center gap-2">
            <span class="text-primary/40 hidden text-xs sm:inline">
              {{ total }} {{ $t('search.results') }}
            </span>
            <div class="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5">
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md transition-all"
                :class="
                  page > 1 ? 'text-primary hover:bg-white/10' : 'text-primary/30 cursor-not-allowed'
                "
                :disabled="page <= 1"
                @click="page > 1 && page--"
              >
                <span class="icon-[mdi--chevron-left] h-4 w-4" />
              </button>
              <span class="text-primary/80 min-w-[50px] text-center text-xs font-medium">
                {{ page }} / {{ Math.ceil(total / pageSize) || 1 }}
              </span>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md transition-all"
                :class="
                  page < Math.ceil(total / pageSize)
                    ? 'text-primary hover:bg-white/10'
                    : 'text-primary/30 cursor-not-allowed'
                "
                :disabled="page >= Math.ceil(total / pageSize)"
                @click="page < Math.ceil(total / pageSize) && page++"
              >
                <span class="icon-[mdi--chevron-right] h-4 w-4" />
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

      <!-- 空状态 -->
      <div v-if="!q" class="flex h-96 flex-col items-center justify-center">
        <div class="mb-6 rounded-full bg-white/5 p-8">
          <span class="icon-[mdi--magnify] text-primary/20 h-16 w-16" />
        </div>
        <p class="text-primary/60 text-lg font-medium">{{ $t('search.enterKeyword') }}</p>
        <p class="text-primary/40 mt-2 text-sm">{{ $t('search.hint') }}</p>
      </div>
    </div>
  </div>
</template>
