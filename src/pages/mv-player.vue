<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { mvDetail, mvUrl, simiMv, commentNew } from '@/api'
import { MVInfo, RelatedMV, MVComment } from '@/typings'
import { formatCount } from '@/utils/time'
import Button from '@/components/Ui/Button.vue'
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const formatSec = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`



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
      username: c?.user?.nickname || t('mvPlayer.comments.user'),
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
        <div class="px-4">
          <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div class="lg:col-span-2">
              <div class="glass-card overflow-hidden">
                <div class="aspect-video w-full bg-black">
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
                    <span class="icon-[mdi--loading] text-primary h-10 w-10 animate-spin"></span>
                  </div>
                </div>
              </div>

              <div class="mt-6">
                <h1 class="text-primary mb-3 text-2xl font-bold tracking-tight lg:text-3xl">
                  {{ currentMV.title }}
                </h1>

                <div class="mb-4 flex flex-wrap items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-primary/70 flex items-center gap-2 text-sm font-medium transition-colors hover:text-pink-400"
                    icon="mdi--account-music"
                    icon-class="h-5 w-5"
                    @click="router.push(`/artist/${currentMV.artistId}`)"
                  >
                    {{ currentMV.artist }}
                  </Button>
                  <span class="text-primary/40 text-sm">{{ currentMV.publishDate }}</span>
                </div>

                <div class="text-primary/60 mb-6 flex flex-wrap items-center gap-6 text-sm">
                  <span class="flex items-center gap-2">
                    <span class="icon-[mdi--play-circle-outline] h-5 w-5"></span>
                    {{ formatCount(currentMV.playCount) }} {{ t('mvPlayer.stats.plays') }}
                  </span>
                  <span class="flex items-center gap-2">
                    <span class="icon-[mdi--thumb-up-outline] h-5 w-5"></span>
                    {{ formatCount(currentMV.likes) }} {{ t('mvPlayer.stats.likes') }}
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                  <Button
                    variant="glass"
                    size="md"
                    class="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all"
                    :class="
                      state.isLiked
                        ? 'border-pink-500/30! bg-pink-500/20! text-pink-400!'
                        : 'text-primary hover:text-pink-400'
                    "
                    :icon="state.isLiked ? 'mdi--thumb-up' : 'mdi--thumb-up-outline'"
                    icon-class="h-5 w-5"
                    @click="toggleLike"
                  >
                    {{ state.isLiked ? t('mvPlayer.actions.liked') : t('mvPlayer.actions.like') }}
                  </Button>
                  <Button
                    variant="glass"
                    size="md"
                    class="text-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all hover:text-pink-400"
                    icon="mdi--share-variant-outline"
                    icon-class="h-5 w-5"
                    @click="shareMV"
                  >
                    {{ t('mvPlayer.actions.share') }}
                  </Button>
                </div>

                <div v-if="currentMV.description" class="glass-card mt-6 p-5">
                  <p class="text-primary/70 text-sm leading-relaxed">{{ currentMV.description }}</p>
                </div>
              </div>

              <section class="mt-8">
                <h2 class="text-primary mb-5 text-lg font-semibold">
                  {{ t('mvPlayer.comments.title') }}
                  <span v-if="comments.length" class="text-primary/50 ml-2 text-base font-normal">
                    ({{ comments.length }})
                  </span>
                </h2>

                <div v-if="comments.length" class="space-y-2">
                  <div
                    v-for="(c, i) in comments"
                    :key="i"
                    class="glass-card flex gap-4 p-4 transition-colors hover:bg-white/5"
                  >
                    <img
                      v-if="c.avatarUrl"
                      :src="c.avatarUrl + '?param=80y80'"
                      class="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-pink-400 to-purple-500 text-sm font-medium text-white"
                    >
                      {{ c.username.charAt(0) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="mb-2 flex items-center gap-3">
                        <span class="text-primary text-sm font-medium">{{ c.username }}</span>
                        <span class="text-primary/40 text-xs">{{ c.time }}</span>
                      </div>
                      <p class="text-primary/80 text-sm leading-relaxed">{{ c.content }}</p>
                      <div class="mt-3 flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="none"
                          class="text-primary/40 flex items-center gap-1.5 text-xs transition-colors hover:text-pink-400"
                          icon="mdi--thumb-up-outline"
                          icon-class="h-4 w-4"
                        >
                          {{ c.likes || '' }}
                        </Button>
                        <Button
                          variant="ghost"
                          size="none"
                          class="text-primary/40 hover:text-primary flex items-center gap-1.5 text-xs transition-colors"
                          icon="mdi--reply"
                          icon-class="h-4 w-4"
                        >
                          {{ t('mvPlayer.comments.reply') }}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="glass-card flex flex-col items-center justify-center py-16">
                  <span
                    class="icon-[mdi--comment-off-outline] text-primary/20 mb-3 h-12 w-12"
                  ></span>
                  <p class="text-primary/40 text-sm">{{ t('mvPlayer.comments.empty') }}</p>
                </div>
              </section>
            </div>

            <aside class="lg:col-span-1">
              <div class="sticky top-6">
                <h2 class="text-primary mb-5 text-lg font-semibold">
                  {{ t('mvPlayer.related.title') }}
                </h2>
                <div class="space-y-3">
                  <div
                    v-for="mv in relatedMVs"
                    :key="mv.id"
                    class="glass-card group flex cursor-pointer gap-4 p-3 transition-all hover:-translate-y-0.5 hover:bg-white/10"
                    @click="playRelatedMV(mv)"
                  >
                    <div class="relative shrink-0 overflow-hidden rounded-xl">
                      <LazyImage
                        :src="mv.cover + '?param=160y90'"
                        :alt="mv.title"
                        imgClass="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        wrapperClass="h-18 w-32"
                      />
                      <div
                        class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <span class="icon-[mdi--play] h-8 w-8 text-white"></span>
                      </div>
                      <span
                        class="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white backdrop-blur-sm"
                      >
                        {{ formatSec(mv.duration) }}
                      </span>
                    </div>
                    <div class="min-w-0 flex-1 py-1">
                      <h3
                        class="text-primary mb-1.5 line-clamp-2 text-sm leading-tight font-medium transition-colors group-hover:text-pink-400"
                      >
                        {{ mv.title }}
                      </h3>
                      <p class="text-primary/50 mb-1 truncate text-xs">{{ mv.artist }}</p>
                      <p class="text-primary/40 text-xs">
                        {{ formatCount(mv.playCount) }} {{ t('mvPlayer.stats.plays') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
