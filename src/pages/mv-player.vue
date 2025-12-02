<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import Artplayer from '@/components/Artplayer.vue'
import { mvDetail, mvUrl, simiMv, commentNew } from '@/api'
import { MVInfo, RelatedMV, MVComment } from '@/typings'
import LazyImage from '@/components/Ui/LazyImage.vue'

const router = useRouter()
const route = useRoute()
const formatSec = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

const formatCount = (count: number | string) => {
  const num = typeof count === 'string' ? parseInt(count) : count
  if (isNaN(num)) return count
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿'
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  return num
}

const state = reactive({
  currentMV: {} as MVInfo,
  relatedMVs: [] as RelatedMV[],
  comments: [] as MVComment[],
  isPageLoading: true,
  isLiked: false,
})
const { currentMV, relatedMVs, comments, isPageLoading } = toRefs(state)

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
      artistId: d?.artistId || d?.artists?.[0]?.id || 0,
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

    state.relatedMVs = (sList || []).slice(0, 10).map(
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
    const res: any = await commentNew({ id, type: 1, sortType: 1, pageNo: 1, pageSize: 20 })
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

const toggleLike = () => {
  state.isLiked = !state.isLiked
}

const shareMV = async () => {
  const url = location.origin + location.pathname + `#/mv-player/${state.currentMV.id}`
  try {
    if (navigator.share) {
      await navigator.share({ title: state.currentMV.title, url })
    } else {
      await navigator.clipboard.writeText(url)
    }
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
  { immediate: true }
)
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <PageSkeleton v-if="isPageLoading" :sections="['player']" />
      <template v-else>
        <div class="px-6 py-6">
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="lg:col-span-2">
              <div class="overflow-hidden rounded-2xl bg-black">
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
                  <div v-else class="flex h-full w-full items-center justify-center bg-white/5">
                    <span class="icon-[mdi--loading] text-primary h-8 w-8 animate-spin"></span>
                  </div>
                </div>
              </div>

              <div class="mt-4">
                <h1 class="text-primary mb-2 text-xl font-bold lg:text-2xl">
                  {{ currentMV.title }}
                </h1>

                <div class="mb-4 flex flex-wrap items-center gap-4">
                  <button
                    class="text-primary/70 hover:text-primary flex items-center gap-1.5 text-sm transition-colors"
                    @click="router.push(`/artist/${currentMV.artistId}`)"
                  >
                    <span class="icon-[mdi--account-music] h-4 w-4"></span>
                    {{ currentMV.artist }}
                  </button>
                  <span class="text-primary/40 text-sm">{{ currentMV.publishDate }}</span>
                </div>

                <div class="text-primary/60 mb-4 flex flex-wrap items-center gap-4 text-sm">
                  <span class="flex items-center gap-1">
                    <span class="icon-[mdi--play] h-4 w-4"></span>
                    {{ formatCount(currentMV.playCount) }} 次播放
                  </span>
                  <span class="flex items-center gap-1">
                    <span class="icon-[mdi--thumb-up] h-4 w-4"></span>
                    {{ formatCount(currentMV.likes) }} 赞
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    class="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-all"
                    :class="
                      state.isLiked
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-primary bg-white/10 hover:bg-white/15'
                    "
                    @click="toggleLike"
                  >
                    <span
                      :class="
                        state.isLiked ? 'icon-[mdi--thumb-up]' : 'icon-[mdi--thumb-up-outline]'
                      "
                      class="h-4 w-4"
                    ></span>
                    {{ state.isLiked ? '已赞' : '点赞' }}
                  </button>
                  <button
                    class="text-primary flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm transition-all hover:bg-white/15"
                    @click="shareMV"
                  >
                    <span class="icon-[mdi--share-variant] h-4 w-4"></span>
                    分���
                  </button>
                </div>

                <div v-if="currentMV.description" class="mt-4 rounded-xl bg-white/5 p-4">
                  <p class="text-primary/70 text-sm leading-relaxed">{{ currentMV.description }}</p>
                </div>
              </div>

              <div class="mt-6">
                <h2 class="text-primary mb-4 font-semibold">
                  评论 {{ comments.length ? `(${comments.length})` : '' }}
                </h2>

                <div v-if="comments.length" class="space-y-1">
                  <div
                    v-for="(c, i) in comments"
                    :key="i"
                    class="flex gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
                  >
                    <img
                      v-if="c.avatarUrl"
                      :src="c.avatarUrl + '?param=80y80'"
                      class="h-9 w-9 shrink-0 rounded-full"
                    />
                    <div
                      v-else
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-xs font-medium text-white"
                    >
                      {{ c.username.charAt(0) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="mb-1 flex items-center gap-2">
                        <span class="text-primary text-sm font-medium">{{ c.username }}</span>
                        <span class="text-primary/40 text-xs">{{ c.time }}</span>
                      </div>
                      <p class="text-primary/80 text-sm leading-relaxed">{{ c.content }}</p>
                      <div class="mt-2 flex items-center gap-3">
                        <button
                          class="text-primary/40 hover:text-primary flex items-center gap-1 text-xs transition-colors"
                        >
                          <span class="icon-[mdi--thumb-up-outline] h-3.5 w-3.5"></span>
                          {{ c.likes || '' }}
                        </button>
                        <button
                          class="text-primary/40 hover:text-primary flex items-center gap-1 text-xs transition-colors"
                        >
                          <span class="icon-[mdi--reply] h-3.5 w-3.5"></span>
                          回复
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="flex flex-col items-center justify-center py-12">
                  <span
                    class="icon-[mdi--comment-off-outline] text-primary/20 mb-2 h-10 w-10"
                  ></span>
                  <p class="text-primary/40 text-sm">暂无评论</p>
                </div>
              </div>
            </div>

            <div class="lg:col-span-1">
              <div class="sticky top-4">
                <h2 class="text-primary mb-4 font-semibold">相关推荐</h2>
                <div class="space-y-2">
                  <div
                    v-for="mv in relatedMVs"
                    :key="mv.id"
                    class="group flex cursor-pointer gap-3 rounded-xl p-2 transition-colors hover:bg-white/10"
                    @click="playRelatedMV(mv)"
                  >
                    <div class="relative shrink-0 overflow-hidden rounded-lg">
                      <LazyImage
                        :src="mv.cover + '?param=160y90'"
                        :alt="mv.title"
                        imgClass="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        wrapperClass="h-16 w-28"
                      />
                      <div
                        class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <span class="icon-[mdi--play] h-6 w-6 text-white"></span>
                      </div>
                      <span
                        class="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-xs text-white"
                      >
                        {{ formatSec(mv.duration) }}
                      </span>
                    </div>
                    <div class="min-w-0 flex-1 py-0.5">
                      <h3
                        class="text-primary mb-1 line-clamp-2 text-sm leading-tight font-medium group-hover:text-pink-400"
                      >
                        {{ mv.title }}
                      </h3>
                      <p class="text-primary/50 truncate text-xs">{{ mv.artist }}</p>
                      <p class="text-primary/40 mt-1 text-xs">
                        {{ formatCount(mv.playCount) }} 次播放
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
