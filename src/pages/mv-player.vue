<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { mvDetail, mvUrl, simiMv, commentNew } from '@/api'

const router = useRouter()
const route = useRoute()

const state = reactive({
  // 是否正在播放
  isPlaying: false,
  // 控制栏是否显示
  showControls: true,
  // 当前播放秒数
  currentTime: 0,
  // 总时长（秒）
  totalTime: 245,
  // 当前 MV 信息
  currentMV: {},
  // 相关推荐 MV 列表
  relatedMVs: [],
  // 评论列表
  comments: [] as Array<{
    username: string
    avatarUrl: string
    time: string
    content: string
    likes: number
  }>,
})
const { currentMV, relatedMVs, comments } = toRefs(state)
let controlsTimer: NodeJS.Timeout | null = null

// 切换点赞状态
const toggleLike = () => {
  state.currentMV.liked = !state.currentMV.liked
  console.log(`${state.currentMV.liked ? '点赞' : '取消点赞'}: ${state.currentMV.title}`)
}

// 播放相关MV
const playRelatedMV = (mv: any) => {
  router.push(`/mv-player/${mv.id}`)
}

// 延迟隐藏控制栏
const hideControlsAfterDelay = () => {
  if (controlsTimer) {
    clearTimeout(controlsTimer)
  }
  controlsTimer = setTimeout(() => {
    if (state.isPlaying) {
      state.showControls = false
    }
  }, 3000)
}

// 鼠标移动时显示控制栏
const handleMouseMove = () => {
  if (state.isPlaying) {
    state.showControls = true
    hideControlsAfterDelay()
  }
}

const loadMV = async (id: number) => {
  try {
    const [detailRes, urlRes, simiRes] = await Promise.all([
      mvDetail({ mvid: id }),
      mvUrl({ id }),
      simiMv({ mvid: id }),
    ])
    const d: any = (detailRes as any)?.data || (detailRes as any) || {}
    const u: any = (urlRes as any)?.data || (urlRes as any) || {}
    const sList: any[] = (simiRes as any)?.mvs || (simiRes as any)?.data || []

    state.currentMV = {
      id: d?.id ?? id,
      title: d?.name || d?.title || 'MV',
      artist: d?.artistName || d?.artists?.[0]?.name || '',
      duration: Math.floor((d?.duration || 0) / 1000) + 's',
      cover: d?.cover || d?.coverImg || '',
      playCount: String(d?.playCount || d?.playCountTxt || ''),
      likes: String(d?.likedCount || ''),
      publishDate: d?.publishTime || d?.publishDate || '',
      category: d?.subed ? '已订阅' : 'MV',
      emoji: '🎬',
      gradient: 'from-indigo-500 to-purple-600',
      liked: !!d?.liked,
      isNew: false,
      description: d?.desc || d?.briefDesc || '',
      url: u?.data?.url || u?.url || '',
    } as any
    state.totalTime = Math.floor((d?.duration || 0) / 1000) || 0

    state.relatedMVs = (sList || []).slice(0, 8).map((mv: any) => ({
      id: mv?.id,
      title: mv?.name || mv?.title || '',
      artist: mv?.artistName || mv?.artists?.[0]?.name || '',
      duration: Math.floor((mv?.duration || 0) / 1000) + 's',
      playCount: String(mv?.playCount || ''),
      likes: String(mv?.likedCount || ''),
      cover: mv?.cover || mv?.coverImg || '',
      emoji: '🎵',
      gradient: 'from-pink-400 to-purple-500',
    })) as any
  } catch {}
}

const loadComments = async (id: number) => {
  try {
    const res: any = await commentNew({ id, type: 1, sortType: 1, pageNo: 1, pageSize: 10 })
    const list: any[] = res?.data?.comments || res?.comments || []
    state.comments = list.map(c => ({
      username: c?.user?.nickname || '用户',
      avatarUrl: c?.user?.avatarUrl || '',
      time: c?.time ? new Date(c.time).toLocaleString() : '',
      content: c?.content || '',
      likes: c?.likedCount || 0,
    }))
  } catch {}
}

onMounted(() => {
  const mvId = Number(route.params.id)
  if (!Number.isNaN(mvId)) {
    loadMV(mvId)
    loadComments(mvId)
  }
  document.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  if (controlsTimer) {
    clearTimeout(controlsTimer)
  }
  document.removeEventListener('mousemove', handleMouseMove)
})
</script>
<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <!-- 返回按钮 -->
      <div class="p-4">
        <router-link
          to="/mv-list"
          class="glass-button flex items-center space-x-2 bg-white/10 px-4 py-2 text-white transition-all duration-300 hover:bg-white/20"
        >
          <span class="icon-[mdi--arrow-left] h-5 w-5"></span>
          <span>返回</span>
        </router-link>
      </div>

      <!-- MV播放器区域 -->
      <section class="px-8 pb-8">
        <div class="glass-card flex gap-6 overflow-hidden">
          <div class="flex-1">
            <!-- 视频播放器 -->
            <div class="aspect-video w-full">
              <Artplayer
                v-if="currentMV.url"
                :url="currentMV.url"
                :title="currentMV.title"
                :poster="currentMV.cover"
                :autoplay="true"
                :muted="false"
                class="aspect-video !h-full"
              />
              <div
                v-else
                class="flex h-60 w-full items-center justify-center rounded-lg bg-white/5"
              >
                <span class="icon-[mdi--loading] h-8 w-8 animate-spin text-white"></span>
              </div>
            </div>
            <!-- MV信息区域 -->
            <div class="p-6">
              <div class="flex flex-col lg:flex-row lg:items-start lg:space-x-8">
                <!-- 左侧：MV信息 -->
                <div class="mb-6 flex-1 lg:mb-0">
                  <div class="mb-4 flex items-start justify-between">
                    <div>
                      <h1 class="mb-2 text-3xl font-bold text-white">{{ currentMV.title }}</h1>
                      <p class="mb-4 text-xl text-purple-300">{{ currentMV.artist }}</p>

                      <!-- 统计信息 -->
                      <div class="mb-4 flex flex-wrap items-center gap-6 text-white/70">
                        <div class="flex items-center space-x-2">
                          <span class="icon-[mdi--play] h-5 w-5"></span>
                          <span>{{ currentMV.playCount }} 次播放</span>
                        </div>
                        <div class="flex items-center space-x-2">
                          <span class="icon-[mdi--heart] h-5 w-5 text-red-400"></span>
                          <span>{{ currentMV.likes }} 点赞</span>
                        </div>
                        <div class="flex items-center space-x-2">
                          <span class="icon-[mdi--calendar] h-5 w-5"></span>
                          <span>{{ currentMV.publishDate }}</span>
                        </div>
                      </div>

                      <!-- 标签 -->
                      <div class="mb-4 flex flex-wrap gap-2">
                        <span
                          class="inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-white"
                        >
                          {{ currentMV.category }}
                        </span>
                        <span
                          v-if="currentMV.isNew"
                          class="inline-block rounded-full bg-red-500 px-3 py-1 text-sm text-white"
                        >
                          NEW
                        </span>
                        <span
                          class="inline-block rounded-full bg-purple-500/50 px-3 py-1 text-sm text-white"
                        >
                          高清
                        </span>
                      </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div class="flex flex-col space-y-3">
                      <button
                        class="glass-button bg-linear-to-r from-pink-500 to-purple-600 px-6 py-3 font-medium text-white transition-transform hover:scale-105"
                        @click="toggleLike"
                      >
                        <span
                          class="mr-2 h-5 w-5"
                          :class="
                            currentMV.liked
                              ? 'icon-[mdi--heart] text-red-400'
                              : 'icon-[mdi--heart-outline]'
                          "
                        ></span>
                        {{ currentMV.liked ? '已点赞' : '点赞' }}
                      </button>
                      <button
                        class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20"
                      >
                        <span class="icon-[mdi--share] mr-2 h-5 w-5"></span>
                        分享
                      </button>
                      <button
                        class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20"
                      >
                        <span class="icon-[mdi--download] mr-2 h-5 w-5"></span>
                        下载
                      </button>
                    </div>
                  </div>

                  <!-- MV描述 -->
                  <div class="mb-6">
                    <h3 class="mb-3 text-lg font-semibold text-white">MV简介</h3>
                    <p class="leading-relaxed text-white/80">
                      {{ currentMV.description }}
                    </p>
                  </div>

                  <!-- 评论列表 -->
                  <div class="space-y-6">
                    <h3 class="text-lg font-semibold text-white">评论</h3>
                    <div
                      v-if="comments.length === 0"
                      class="rounded-lg bg-white/5 p-4 text-purple-300"
                    >
                      暂无评论
                    </div>
                    <div v-else class="space-y-4">
                      <div
                        v-for="(c, i) in comments"
                        :key="i"
                        class="flex items-start space-x-4 rounded-lg bg-white/5 p-4"
                      >
                        <img :src="c.avatarUrl" alt="" class="h-10 w-10 rounded-full" />
                        <div class="min-w-0 flex-1">
                          <div class="mb-1 flex items-center space-x-2">
                            <h4 class="text-sm font-medium text-white">{{ c.username }}</h4>
                            <span class="text-xs text-purple-400">{{ c.time }}</span>
                          </div>
                          <p class="text-sm text-white/80">{{ c.content }}</p>
                          <div class="mt-2 flex items-center space-x-4 text-purple-300">
                            <button
                              class="flex items-center space-x-1 transition-colors hover:text-white"
                            >
                              <span class="icon-[mdi--thumb-up-outline] h-4 w-4"></span>
                              <span class="text-xs">{{ c.likes }}</span>
                            </button>
                            <button class="transition-colors hover:text-white">
                              <span class="icon-[mdi--reply] h-4 w-4"></span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <aside class="w-96 lg:sticky lg:top-6">
            <!-- 右侧：相关推荐 -->
            <div class="w-full lg:w-80">
              <h3 class="mb-4 text-lg font-semibold text-white">相关推荐</h3>
              <div class="space-y-4">
                <div
                  v-for="relatedMV in relatedMVs"
                  :key="relatedMV.id"
                  class="flex cursor-pointer items-center space-x-3 rounded-lg p-3 transition-all duration-300 hover:bg-white/10"
                  @click="playRelatedMV(relatedMV)"
                >
                  <!-- 缩略图 -->
                  <div class="relative shrink-0">
                    <img  class="h-12 w-20 rounded-lg" :src="relatedMV.cover" alt="">
                    <!-- <div
                      class="flex h-12 w-20 items-center justify-center rounded-lg bg-linear-to-br text-lg"
                      :class="relatedMV.gradient"
                    >
                      {{ relatedMV.emoji }}
                    </div> -->
                    <div
                      class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity duration-300 hover:opacity-100"
                    >
                      <span class="icon-[mdi--play] h-4 w-4 text-white"></span>
                    </div>
                    <div
                      class="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-xs text-white"
                    >
                      {{ relatedMV.duration }}
                    </div>
                  </div>

                  <!-- 信息 -->
                  <div class="min-w-0 flex-1">
                    <h4 class="mb-1 truncate text-sm font-medium text-white">
                      {{ relatedMV.title }}
                    </h4>
                    <p class="mb-1 truncate text-xs text-purple-300">{{ relatedMV.artist }}</p>
                    <p class="text-xs text-white/60">{{ relatedMV.playCount }} 播放</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* 控制栏过渡动画 */
.absolute.bottom-0 {
  transition: opacity 0.3s ease-in-out;
}
</style>
