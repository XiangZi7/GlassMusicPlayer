<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <PageSkeleton v-if="isPageLoading" :sections="['hero','grid']" :grid-count="24" />
      <template v-else>
      <!-- 页面头部 -->
      <section class="relative mb-8 overflow-hidden">
        <!-- 背景模糊效果 -->
        <div class="absolute inset-0">
          <div
            class="h-full w-full scale-110 bg-linear-to-br from-purple-500 via-pink-500 to-indigo-600 opacity-30 blur-3xl"
          ></div>
        </div>

        <!-- 浮动音符背景 -->
        <div class="absolute inset-0 overflow-hidden">
          <div class="floating-notes">
            <div v-for="i in 8" :key="i" class="note" :style="{ animationDelay: i * 0.8 + 's' }">
              {{ ['🎬', '🎥', '📹', '🎞️', '🎪', '🌟', '✨', '💫'][i - 1] }}
            </div>
          </div>
        </div>

        <div class="relative z-10 p-8">
          <div class="text-center">
            <h1 class="animate-fade-in-up mb-4 text-5xl font-bold text-white">{{ t('mvList.title') }}</h1>
            <p class="animate-fade-in-up mb-6 text-xl text-white/80" style="animation-delay: 0.2s">
              {{ t('mvList.subtitle') }}
            </p>

            <!-- 筛选标签 -->
            <div
              class="animate-fade-in-up flex flex-wrap justify-center gap-3"
              style="animation-delay: 0.4s"
            >
              <button
                v-for="category in categories"
                :key="category.key"
                class="glass-button px-6 py-2 text-white transition-all duration-300"
                :class="
                  selectedCategoryKey === category.key
                    ? 'bg-white/30'
                    : 'bg-white/10 hover:bg-white/20'
                "
                @click="selectCategory(category.key)"
              >
                {{ category.emoji }} {{ t('mvList.categories.' + category.key) }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- MV网格列表 -->
      <section class="px-8 pb-8">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <router-link
            v-for="mv in filteredMVs"
            :key="mv.id"
            :to="`/mv-player/${mv.id}`"
            class="mv-card glass-card group cursor-pointer transition-all duration-500 hover:scale-105 hover:shadow-2xl"
          >
            <!-- MV封面 -->
            <div class="relative overflow-hidden rounded-t-2xl">
              <div class="relative aspect-video">
                <img :src="mv.cover + '?param=480y270'" :alt="t('mvList.alt.cover')" class="h-full w-full rounded-t-2xl object-cover" />

                <!-- 播放按钮覆盖层 -->
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                >
                  <button
                    class="glass-button flex h-16 w-16 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
                  >
                    <span class="icon-[mdi--play] h-8 w-8 text-white"></span>
                  </button>
                </div>

                <!-- 时长标签 -->
                <div
                  class="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-sm text-white backdrop-blur-sm"
                >
                  {{ formatSec(mv.duration) }}
                </div>

                <!-- 播放次数 -->
                <div
                  class="absolute top-2 left-2 flex items-center rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm"
                >
                  <span class="icon-[mdi--play] mr-1 h-3 w-3"></span>
                  {{ mv.playCount }}
                </div>
              </div>
            </div>

            <!-- MV信息 -->
            <div class="p-4">
              <h3
                class="mb-2 truncate text-lg font-semibold text-white transition-colors group-hover:text-pink-300"
              >
                {{ mv.title }}
              </h3>
              <p class="mb-3 truncate text-sm text-purple-300">
                {{ mv.artist }}
              </p>

              <!-- 标签和操作 -->
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="inline-block rounded-full bg-white/10 px-2 py-1 text-xs text-white">
                    {{ t('mvList.categories.' + mv.categoryKey) }}
                  </span>
                  <span
                    v-if="mv.isNew"
                    class="inline-block rounded-full bg-red-500 px-2 py-1 text-xs text-white"
                  >
                    {{ t('mvList.tags.new') }}
                  </span>
                </div>

                <div
                  class="flex items-center space-x-2 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <button
                    class="text-purple-300 transition-colors hover:text-white"
                    @click.stop="toggleLike(mv)"
                  >
                    <span
                      class="h-4 w-4"
                      :class="
                        mv.liked ? 'icon-[mdi--heart] text-red-400' : 'icon-[mdi--heart-outline]'
                      "
                    ></span>
                  </button>
                  <button
                    class="text-purple-300 transition-colors hover:text-white"
                    @click.stop="shareMV(mv)"
                  >
                    <span class="icon-[mdi--share] h-4 w-4"></span>
                  </button>
                </div>
              </div>
            </div>
          </router-link>
        </div>

        <!-- 加载更多 -->
        <div class="mt-12 text-center">
          <button
            v-if="hasMore"
            class="glass-button bg-linear-to-r from-purple-500 to-pink-500 px-8 py-3 font-medium text-white transition-transform hover:scale-105"
            @click="loadMore"
          >
            <span class="icon-[mdi--refresh] mr-2 h-5 w-5"></span>
            {{ t('mvList.actions.loadMore') }}
          </button>
        </div>
      </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { mvAll } from '@/api'

const router = useRouter()

// 分类与数据状态
const state = reactive({
  // 分类列表（显示名通过 i18n 渲染，type 为 API 固定参数）
  categories: [
    { key: 'all', emoji: '🎬', type: undefined },
    { key: 'official', emoji: '🏛️', type: '官方版' },
    { key: 'live', emoji: '🎤', type: '现场版' },
    { key: 'netease', emoji: '🅽', type: '网易出品' },
  ],
  // 当前选中的分类 key
  selectedCategoryKey: 'all',
  // MV 数据列表
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
  // 是否有更多可加载
  hasMore: true,
  page: 0,
  isPageLoading: true,
})
const { categories, selectedCategoryKey, mvList, hasMore, isPageLoading } = toRefs(state)

// 筛选后的MV列表
const filteredMVs = computed(() => {
  return state.mvList
})

// 选择分类
const selectCategory = (key: string) => {
  state.selectedCategoryKey = key
  state.page = 0
  state.mvList = []
  fetchList(true)
}

// 播放MV
const playMV = (mv: any) => {
  router.push(`/mv-player/${mv.id}`)
}

// 切换喜欢状态
const toggleLike = (mv: any) => {
  mv.liked = !mv.liked
  console.log(`${mv.liked ? t('mvList.log.liked') : t('mvList.log.unliked')}: ${mv.title}`)
}

// 分享MV
const shareMV = (mv: any) => {
  console.log(`${t('mvList.log.sharePrefix')}${mv.title}`)
  // 这里可以实现分享功能
}

// 加载更多
const formatSec = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

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

const { t } = useI18n()
</script>

<style scoped>
/* 浮动音符动画 */
.floating-notes {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.note {
  position: absolute;
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.1);
  animation: float-note 15s linear infinite;
}

.note:nth-child(1) {
  left: 10%;
  animation-delay: 0s;
}
.note:nth-child(2) {
  left: 20%;
  animation-delay: 2s;
}
.note:nth-child(3) {
  left: 30%;
  animation-delay: 4s;
}
.note:nth-child(4) {
  left: 40%;
  animation-delay: 6s;
}
.note:nth-child(5) {
  left: 50%;
  animation-delay: 8s;
}
.note:nth-child(6) {
  left: 60%;
  animation-delay: 10s;
}
.note:nth-child(7) {
  left: 70%;
  animation-delay: 12s;
}
.note:nth-child(8) {
  left: 80%;
  animation-delay: 14s;
}

@keyframes float-note {
  0% {
    transform: translateY(100vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) rotate(360deg);
    opacity: 0;
  }
}

/* 淡入动画 */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.8s ease-out forwards;
}

/* MV卡片悬停效果 */
.mv-card:hover {
  transform: translateY(-8px) scale(1.02);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .floating-notes .note {
    font-size: 1.5rem;
  }
}
</style>
