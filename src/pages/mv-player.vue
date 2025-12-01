<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import Artplayer from '@/components/Artplayer.vue'
import { mvDetail, mvUrl, simiMv, commentNew } from '@/api'
import { MVInfo, RelatedMV, MVComment } from '@/typings'

const router = useRouter()
const route = useRoute()
const formatSec = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

const state = reactive({
  currentMV: {} as MVInfo,
  relatedMVs: [] as RelatedMV[],
  comments: [] as MVComment[],
  isPageLoading: true,
})
const { currentMV, relatedMVs, comments, isPageLoading } = toRefs(state)

// 播放相关MV
const playRelatedMV = (mv: any) => {
  router.push(`/mv-player/${mv.id}`)
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
      id: Number(d?.id ?? id),
      title: d?.name || d?.title || 'MV',
      artist: d?.artistName || d?.artists?.[0]?.name || '',
      duration: Math.floor((d?.duration || 0) / 1000),
      cover: d?.cover || d?.coverImg || '',
      playCount: String(d?.playCount || d?.playCountTxt || ''),
      likes: String(d?.likedCount || ''),
      publishDate: d?.publishTime || d?.publishDate || '',
      category: d?.subed ? '已订阅' : 'MV',
      emoji: '🎬',
      gradient: 'from-indigo-500 to-primary-600',
      liked: !!d?.liked,
      isNew: false,
      description: d?.desc || d?.briefDesc || '',
      url: u?.data?.url || u?.url || '',
    }

    state.relatedMVs = (sList || []).slice(0, 8).map(
      (mv: any): RelatedMV => ({
        id: Number(mv?.id),
        title: mv?.name || mv?.title || '',
        artist: mv?.artistName || mv?.artists?.[0]?.name || '',
        duration: Math.floor((mv?.duration || 0) / 1000),
        playCount: String(mv?.playCount || ''),
        cover: mv?.cover || mv?.coverImg || mv?.picUrl || '',
        emoji: '🎵',
        gradient: 'from-pink-400 to-primary-500',
      })
    )
  } catch {
  } finally {
    state.isPageLoading = false
  }
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

watch(
  () => route.params.id,
  id => {
    const mvId = Number(id)
    if (!Number.isNaN(mvId)) {
      state.isPageLoading = true
      loadMV(mvId)
      loadComments(mvId)
    }
  },
  {
    immediate: true,
  }
)
</script>
<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <PageSkeleton v-if="isPageLoading" :sections="['player']" />
      <template v-else>
        <!-- MV播放器区域 -->
        <section class="px-4 pb-8">
          <div class="glass-card grid grid-cols-12 gap-6 overflow-hidden p-6">
            <div class="col-span-12 lg:col-span-9">
              <!-- 视频播放器 -->
              <div class="aspect-video w-full">
                <Artplayer
                  v-if="currentMV.url"
                  :src="currentMV.url"
                  :title="currentMV.title"
                  :poster="currentMV.cover"
                  :autoplay="true"
                  :muted="false"
                  class="aspect-video h-full!"
                />
                <div
                  v-else
                  class="flex h-60 w-full items-center justify-center rounded-lg bg-white/5"
                >
                  <span class="icon-[mdi--loading] text-primary h-8 w-8 animate-spin"></span>
                </div>
              </div>
              <!-- MV信息区域 -->
              <div class="mt-6">
                <div class="flex flex-col lg:flex-row lg:items-start lg:space-x-8">
                  <!-- 左侧：MV信息 -->
                  <div class="mb-6 flex-1 lg:mb-0">
                    <div class="mb-4 flex items-start justify-between">
                      <div>
                        <h1 class="text-primary mb-2 text-3xl font-bold">{{ currentMV.title }}</h1>
                        <p class="text-primary-300 mb-4 text-xl">{{ currentMV.artist }}</p>

                        <!-- 统计信息 -->
                        <div class="text-primary/70 mb-4 flex flex-wrap items-center gap-6">
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
                            class="text-primary inline-block rounded-full bg-white/10 px-3 py-1 text-sm"
                          >
                            {{ currentMV.category }}
                          </span>
                          <span
                            v-if="currentMV.isNew"
                            class="text-primary inline-block rounded-full bg-red-500 px-3 py-1 text-sm"
                          >
                            NEW
                          </span>
                          <span
                            class="bg-primary-500/50 text-primary inline-block rounded-full px-3 py-1 text-sm"
                          >
                            高清
                          </span>
                        </div>
                      </div>

                      <!-- 操作按钮 -->
                      <div class="flex flex-col space-y-3">
                        <button
                          class="glass-button text-primary bg-white/10 px-6 py-3 hover:bg-white/20"
                        >
                          <span class="icon-[mdi--share] mr-2 h-5 w-5"></span>
                          分享
                        </button>
                        <button
                          class="glass-button text-primary bg-white/10 px-6 py-3 hover:bg-white/20"
                        >
                          <span class="icon-[mdi--download] mr-2 h-5 w-5"></span>
                          下载
                        </button>
                      </div>
                    </div>

                    <!-- MV描述 -->
                    <div class="mb-6">
                      <h3 class="text-primary mb-3 text-lg font-semibold">MV简介</h3>
                      <p class="text-primary/80 leading-relaxed">
                        {{ currentMV.description }}
                      </p>
                    </div>

                    <!-- 评论列表 -->
                    <div class="space-y-6">
                      <h3 class="text-primary text-lg font-semibold">评论</h3>
                      <div
                        v-if="comments.length === 0"
                        class="text-primary-300 rounded-lg bg-white/5 p-4"
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
                              <h4 class="text-primary text-sm font-medium">{{ c.username }}</h4>
                              <span class="text-primary-400 text-xs">{{ c.time }}</span>
                            </div>
                            <p class="text-primary/80 text-sm">{{ c.content }}</p>
                            <div class="text-primary-300 mt-2 flex items-center space-x-4">
                              <button
                                class="hover:text-primary flex items-center space-x-1 transition-colors"
                              >
                                <span class="icon-[mdi--thumb-up-outline] h-4 w-4"></span>
                                <span class="text-xs">{{ c.likes }}</span>
                              </button>
                              <button class="hover:text-primary transition-colors">
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
            <aside class="col-span-12 lg:sticky lg:top-6 lg:col-span-3">
              <!-- 右侧：相关推荐 -->
              <div class="w-full lg:w-80">
                <h3 class="text-primary mb-4 text-lg font-semibold">相关推荐</h3>
                <div class="space-y-4">
                  <div
                    v-for="relatedMV in relatedMVs"
                    :key="relatedMV.id"
                    class="flex cursor-pointer items-center space-x-3 rounded-lg p-3 transition-all duration-300 hover:bg-white/10"
                    @click="playRelatedMV(relatedMV)"
                  >
                    <!-- 缩略图 -->
                    <div class="relative shrink-0">
                      <img class="h-12 w-20 rounded-lg" :src="relatedMV.cover" alt="" />
                      <!-- <div
                      class="flex h-12 w-20 items-center justify-center rounded-lg bg-linear-to-br text-lg"
                      :class="relatedMV.gradient"
                    >
                      {{ relatedMV.emoji }}
                    </div> -->
                      <div
                        class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity duration-300 hover:opacity-100"
                      >
                        <span class="icon-[mdi--play] text-primary h-4 w-4"></span>
                      </div>
                      <div
                        class="text-primary absolute right-1 bottom-1 rounded bg-black/60 px-1 text-xs"
                      >
                        {{ formatSec(relatedMV.duration) }}
                      </div>
                    </div>

                    <!-- 信息 -->
                    <div class="min-w-0 flex-1">
                      <h4 class="text-primary mb-1 truncate text-sm font-medium">
                        {{ relatedMV.title }}
                      </h4>
                      <p class="text-primary-300 mb-1 truncate text-xs">{{ relatedMV.artist }}</p>
                      <p class="text-primary/60 text-xs">{{ relatedMV.playCount }} 播放</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 控制栏过渡动画 */
.absolute.bottom-0 {
  transition: opacity 0.3s ease-in-out;
}
</style>
