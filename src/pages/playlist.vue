<script setup lang="ts">
import { playlistDetail, playlistTrackAll, commentNew, search } from '@/api'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import { PlaylistInfo, PlaylistSong, CommentItem } from '@/typings'
import LazyImage from '@/components/Ui/LazyImage.vue'
import Button from '@/components/Ui/Button.vue'
import TabGroup from '@/components/Ui/TabGroup.vue'
import { formatCount } from '@/utils/time'
import { useI18n } from 'vue-i18n'
const route = useRoute()
const playlistId = route.params.id

interface SimilarPlaylist {
  id: number
  name: string
  coverImgUrl: string
  trackCount: number
  playCount?: number
  creator?: { nickname: string }
}

interface PlaylistState {
  activeTab: 'songs' | 'comments' | 'similar'
  playlistInfo: PlaylistInfo
  isCollected: boolean
  songs: PlaylistSong[]
  newComment: string
  comments: CommentItem[]
  isPageLoading: boolean
  similarPlaylists: SimilarPlaylist[]
}

const state = reactive<PlaylistState>({
  activeTab: 'songs',
  playlistInfo: {} as PlaylistInfo,
  isCollected: false,
  songs: [],
  newComment: '',
  comments: [],
  isPageLoading: true,
  similarPlaylists: [],
})
const { activeTab, playlistInfo, songs, newComment, comments, isPageLoading, similarPlaylists } =
  toRefs(state)
const { setPlaylist, play } = useAudio()
const { t } = useI18n()

const gradients: string[] = ['from-purple-500 to-pink-500']
const emojis: string[] = ['🎵', '🎶', '♪', '♫', '🎼']

const pickGradient = (): string => gradients[Math.floor(Math.random() * gradients.length)]

const loadPlaylist = async (id: number) => {
  try {
    const [detailRes, tracksRes] = await Promise.all([
      playlistDetail({ id }),
      playlistTrackAll({ id, limit: 100 }),
    ])
    const detail =
      (detailRes as any)?.playlist || (detailRes as any)?.data?.playlist || (detailRes as any)?.data
    if (detail) {
      state.playlistInfo = {
        name: detail?.name || state.playlistInfo.name,
        description: detail?.description || '',
        creator: detail?.creator?.nickname || '',
        creatorAvatar: detail?.creator?.avatarUrl || '',
        createTime: detail?.createTime ? new Date(detail.createTime).toLocaleDateString() : '',
        songCount: detail?.trackCount || 0,
        playCount: detail?.playCount || 0,
        likes: String(detail?.subscribedCount || detail?.bookedCount || 0),
        category: detail?.tags?.[0] || t('home.playlistFallback'),
        emoji: state.playlistInfo.emoji,
        gradient: pickGradient(),
        coverImgUrl: detail?.coverImgUrl || '',
      }
    }

    const tracks =
      (tracksRes as any)?.songs || (tracksRes as any)?.data?.songs || (tracksRes as any)?.data || []
    if (Array.isArray(tracks) && tracks.length) {
      state.songs = tracks.map((t: any, i: number) => ({
        id: t?.id || 0,
        mvId: t?.mv,
        name: t?.name || '',
        artist: Array.isArray(t?.ar)
          ? t.ar.map((a: any) => a.name).join(' / ')
          : Array.isArray(t?.artists)
            ? t.artists.map((a: any) => a.name).join(' / ')
            : '',
        artists: Array.isArray(t?.ar)
          ? t.ar.map((a: any) => ({ id: a.id, name: a.name }))
          : Array.isArray(t?.artists)
            ? t.artists.map((a: any) => ({ id: a.id, name: a.name }))
            : [],
        album: t?.al?.name || t?.album?.name || '',
        albumId: t?.al?.id || t?.album?.id || 0,
        duration: t?.dt ?? t?.duration ?? 0,
        emoji: emojis[i % emojis.length],
        gradient: gradients[i % gradients.length],
        liked: false,
        cover: t?.al?.picUrl || t?.album?.picUrl || '',
      }))
    }
  } catch {
  } finally {
    state.isPageLoading = false
  }
}

const loadComments = async (id: number) => {
  try {
    const res = await commentNew({ id, type: 2, sortType: 1, pageNo: 1, pageSize: 10 })
    const list = (res as any)?.data?.comments || (res as any)?.comments || []
    if (Array.isArray(list)) {
      state.comments = list.map((c: any, i: number) => ({
        username: c?.user?.nickname || t('comments.user'),
        avatarGradient: gradients[i % gradients.length],
        time: c?.time ? new Date(c.time).toLocaleString() : '',
        content: c?.content || '',
        likes: c?.likedCount || 0,
        avatarUrl: c?.user?.avatarUrl || '',
        replies: (c?.beReplied || []).map((r: any) => ({
          username: r?.user?.nickname || t('comments.user'),
          avatarUrl: r?.user?.avatarUrl || '',
          avatarGradient: gradients[(i + 1) % gradients.length],
          time: '',
          content: r?.content || '',
        })),
      }))
    }
  } catch {}
}

const loadSimilarPlaylists = async (name: string) => {
  try {
    const res: any = await search({ keywords: name, type: 1000 })
    const list = res?.result?.playlists || []
    state.similarPlaylists = list.slice(0, 12).map((pl: any) => ({
      id: pl.id,
      name: pl.name,
      coverImgUrl: pl.coverImgUrl,
      trackCount: pl.trackCount,
      playCount: pl.playCount,
      creator: pl.creator,
    }))
  } catch {}
}

// 初始化加载播放列表
onMounted(() => {
  const idNum = Number(playlistId)
  if (!Number.isNaN(idNum) && idNum > 0) {
    state.isPageLoading = true
    loadPlaylist(idNum)
    loadComments(idNum)
  }
})

// 监听路由参数变化，加载新的播放列表
watch(
  () => Number(route.params.id),
  idNum => {
    if (!Number.isNaN(idNum) && idNum > 0) {
      state.isPageLoading = true
      loadPlaylist(idNum)
      loadComments(idNum)
    }
  }
)

watch(
  () => state.playlistInfo.name,
  name => {
    if (name) loadSimilarPlaylists(name)
  }
)

const submitComment = () => {
  if (!state.newComment.trim()) return
  const comment = {
    username: t('common.me'),
    avatar: t('common.me'),
    avatarGradient: 'from-pink-400 to-purple-500',
    time: t('common.justNow'),
    content: state.newComment,
    likes: 0,
    avatarUrl: '',
    replies: [],
  }
  state.comments.unshift(comment)
  state.newComment = ''
}

const mapToStoreSong = (s: PlaylistSong): StoreSong => ({
  id: s.id,
  name: s.name,
  artist: s.artist,
  album: s.album,
  duration: s.duration,
  cover: s.cover,
  emoji: s.emoji,
  gradient: s.gradient,
  liked: s.liked,
})

const playAll = async () => {
  try {
    if (!Array.isArray(state.songs) || state.songs.length === 0) return
    const list: StoreSong[] = state.songs.map(mapToStoreSong)
    setPlaylist(list, 0)
    play(list[0], 0)
  } catch {}
}

const shufflePlay = async () => {
  try {
    if (!Array.isArray(state.songs) || state.songs.length === 0) return
    const shuffled = [...state.songs].sort(() => Math.random() - 0.5)
    const list: StoreSong[] = shuffled.map(mapToStoreSong)
    setPlaylist(list, 0)
    play(list[0], 0)
  } catch {}
}

const toggleCollect = () => {
  state.isCollected = !state.isCollected
}

const sharePlaylist = async () => {
  const url = location.origin + location.pathname + `#/playlist/${playlistId}`
  const title = String((state.playlistInfo as any)?.name || t('home.playlistFallback'))
  const text = String((state.playlistInfo as any)?.description || '')
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
    } else {
      await navigator.clipboard.writeText(url)
    }
  } catch {}
}

const tabs = [
  { key: 'songs', labelKey: 'playlist.tabs.songs', icon: 'icon-[mdi--music-note]' },
  { key: 'comments', labelKey: 'playlist.tabs.comments', icon: 'icon-[mdi--comment-text]' },
  { key: 'similar', labelKey: 'playlist.tabs.similar', icon: 'icon-[mdi--playlist-music]' },
] as const

const tabsWithCount = computed(() =>
  tabs.map(tab => ({
    ...tab,
    count:
      tab.key === 'songs'
        ? songs.value.length
        : tab.key === 'comments'
          ? comments.value.length
          : similarPlaylists.value.length,
  }))
)
</script>

<template>
  <div class="w-full p-4 overflow-x-hidden">
    <PageSkeleton v-if="isPageLoading" :sections="['hero', 'list']" :list-count="12" />
    <template v-else>
      <div class="flex flex-col gap-3">
        <!-- 头部区域 -->
        <div class="relative">
          <!-- 背景模糊图片 -->
          <div class="absolute inset-0 overflow-hidden rounded-3xl">
            <img
              :src="playlistInfo.coverImgUrl + '?param=100y100'"
              class="h-full w-full scale-150 object-cover opacity-30 blur-3xl"
            />
            <div
              class="to-overlay absolute inset-0 bg-linear-to-b from-transparent via-transparent"
            ></div>
          </div>

          <!-- 内容区域 -->
          <div class="relative z-10 overflow-hidden rounded-3xl">
            <div class="glass-container">
              <div class="flex flex-col gap-6 p-6 lg:flex-row lg:gap-10">
                <!-- 封面 -->
                <div class="group relative mx-auto w-56 shrink-0 lg:mx-0 lg:w-72">
                  <div
                    class="aspect-square overflow-hidden rounded-3xl shadow-2xl ring-1 ring-(--glass-border)"
                  >
                    <LazyImage
                      :src="playlistInfo.coverImgUrl + '?param=400y400'"
                      :alt="$t('components.songList.coverAlt')"
                      imgClass="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      wrapperClass="h-full w-full"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="none"
                    class="absolute inset-0 rounded-3xl opacity-0 transition-all duration-300 group-hover:opacity-100"
                    @click="playAll"
                  >
                    <div
                      class="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-r from-pink-500 to-purple-600 text-white shadow-2xl transition-transform hover:scale-110"
                    >
                      <span class="icon-[mdi--play] h-10 w-10"></span>
                    </div>
                  </Button>
                </div>

                <!-- 信息区域 -->
                <div class="flex min-w-0 flex-1 flex-col justify-center text-center lg:text-left">
                  <!-- 标题 -->
                  <h1
                    class="text-primary mb-4 line-clamp-2 text-xl leading-tight font-bold lg:text-4xl xl:text-5xl"
                  >
                    {{ playlistInfo.name }}
                  </h1>

                  <!-- 创建者信息 -->
                  <div class="mb-5 flex items-center justify-center gap-3 lg:justify-start">
                    <img
                      v-if="playlistInfo.creatorAvatar"
                      :src="playlistInfo.creatorAvatar + '?param=80y80'"
                      class="h-8 w-8 rounded-full ring-2 ring-(--glass-border)"
                    />
                    <span class="text-primary font-medium">{{ playlistInfo.creator }}</span>
                    <span class="text-primary/40">•</span>
                    <span class="text-primary/60 text-sm">{{ playlistInfo.createTime }}</span>
                    <span class="text-primary/40">•</span>
                    <!-- 分类标签 -->
                    <span
                      class="glass-button accent-gradient px-4 py-1.5 text-xs font-medium text-white"
                    >
                      {{ playlistInfo.category }}
                    </span>
                  </div>

                  <!-- 描述 -->
                  <p
                    v-if="playlistInfo.description"
                    class="text-primary/70 mb-6 line-clamp-2 text-sm leading-relaxed lg:text-base"
                    :title="playlistInfo.description"
                  >
                    {{ playlistInfo.description }}
                  </p>

                  <!-- 统计信息 -->
                  <div
                    class="mb-6 flex flex-wrap items-center justify-center gap-6 lg:justify-start"
                  >
                    <div class="flex items-center gap-2">
                      <span class="icon-[mdi--music-note] text-primary/60 h-5 w-5"></span>
                      <span class="text-primary font-medium">
                        {{ $t('commonUnits.songsShort', playlistInfo.songCount) }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="icon-[mdi--play-circle-outline] text-primary/60 h-5 w-5"></span>
                      <span class="text-primary font-medium">
                        {{ formatCount(playlistInfo.playCount || 0) }}
                        {{ $t('common.stats.plays') }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="icon-[mdi--heart] h-5 w-5 text-red-400"></span>
                      <span class="text-primary font-medium">
                        {{ formatCount(Number(playlistInfo.likes) || 0) }}
                        {{ $t('common.stats.favorites') }}
                      </span>
                    </div>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <Button
                      variant="solid"
                      size="md"
                      rounded="full"
                      class="px-8 py-3 shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40"
                      @click="playAll"
                    >
                      <span class="icon-[mdi--play] mr-2 h-5 w-5"></span>
                      {{ $t('actions.playAll') }}
                    </Button>
                    <Button
                      variant="soft"
                      size="md"
                      rounded="full"
                      class="px-6 py-3"
                      @click="shufflePlay"
                    >
                      <span class="icon-[mdi--shuffle] mr-2 h-5 w-5"></span>
                      {{ $t('actions.shufflePlay') }}
                    </Button>
                    <div class="flex items-center gap-3">
                      <Button
                        variant="soft"
                        size="icon-md"
                        rounded="full"
                        class="h-11 w-11"
                        :class="{
                          'bg-red-500/20 text-red-400 hover:bg-red-500/30': state.isCollected,
                        }"
                        @click="toggleCollect"
                        :title="state.isCollected ? $t('common.uncollect') : $t('common.collect')"
                      >
                        <span
                          :class="
                            state.isCollected ? 'icon-[mdi--heart]' : 'icon-[mdi--heart-outline]'
                          "
                          class="h-5 w-5"
                        ></span>
                      </Button>
                      <Button
                        variant="soft"
                        size="icon-md"
                        rounded="full"
                        class="h-11 w-11"
                        @click="sharePlaylist"
                        :title="$t('common.share')"
                      >
                        <span class="icon-[mdi--share-variant] h-5 w-5"></span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 主内容区域 -->
        <!-- Tabs 工具栏 -->
        <div class="flex items-center justify-between">
          <TabGroup v-model="activeTab" :tabs="tabsWithCount" class="w-full" size="md" />
        </div>

        <!-- 歌曲列表 -->
        <section v-show="activeTab === 'songs'" class="h-full overflow-hidden">
          <SongList :songs="songs" :show-header="true" />
        </section>

        <!-- 评论区 -->
        <section v-show="activeTab === 'comments'" class="animate-fade-in">
          <div class="glass-card overflow-hidden">
            <!-- 发表评论 -->
            <div class="border-b border-(--glass-border) p-6">
              <div class="flex gap-4">
                <div
                  class="accent-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-md"
                >
                  {{ $t('common.me') }}
                </div>
                <div class="flex-1">
                  <textarea
                    v-model="newComment"
                    :placeholder="$t('comments.placeholder')"
                    class="text-primary glass-card placeholder-glass-50 w-full resize-none rounded-xl border border-(--glass-border) p-4 text-sm transition-all focus:border-pink-400/50 focus:ring-2 focus:ring-pink-400/20 focus:outline-none"
                    rows="3"
                  ></textarea>
                  <div class="mt-3 flex items-center justify-end">
                    <Button
                      variant="gradient"
                      size="md"
                      rounded="full"
                      class="px-6 py-2.5 shadow-lg transition-all hover:shadow-xl"
                      :disabled="!newComment.trim()"
                      @click="submitComment"
                    >
                      {{ $t('comments.publish') }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 评论列表 -->
            <div v-if="comments.length" class="divide-y divide-(--glass-border)">
              <div
                v-for="(comment, index) in comments"
                :key="index"
                class="hover:bg-hover-glass p-6 transition-colors"
              >
                <div class="flex gap-4">
                  <img
                    v-if="comment.avatarUrl"
                    :src="comment.avatarUrl + '?param=100y100'"
                    class="h-11 w-11 shrink-0 rounded-full ring-2 ring-(--glass-border)"
                  />
                  <div
                    v-else
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-semibold text-white"
                    :class="comment.avatarGradient"
                  >
                    {{ comment.username.charAt(0) }}
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="mb-2 flex items-center gap-3">
                      <span class="text-primary text-sm font-semibold">{{ comment.username }}</span>
                      <span class="text-primary/50 text-xs">{{ comment.time }}</span>
                    </div>

                    <p class="text-primary/80 mb-4 text-sm leading-relaxed">
                      {{ comment.content }}
                    </p>

                    <div class="flex items-center gap-5 text-xs">
                      <Button
                        variant="ghost"
                        size="none"
                        class="text-primary/60 hover:text-primary flex items-center gap-1.5 transition-colors"
                        icon="mdi--thumb-up-outline"
                        icon-class="h-4 w-4"
                      >
                        <span class="font-medium">{{ comment.likes || '' }}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="none"
                        class="text-primary/60 hover:text-primary flex items-center gap-1.5 transition-colors"
                        icon="mdi--reply"
                        icon-class="h-4 w-4"
                      >
                        <span class="font-medium">{{ $t('comments.reply') }}</span>
                      </Button>
                    </div>

                    <!-- 回复列表 -->
                    <div
                      v-if="comment.replies?.length"
                      class="glass-card mt-4 space-y-3 rounded-xl p-4"
                    >
                      <div v-for="(reply, ri) in comment.replies" :key="ri" class="flex gap-3">
                        <img
                          v-if="reply.avatarUrl"
                          :src="reply.avatarUrl + '?param=80y80'"
                          class="h-8 w-8 shrink-0 rounded-full ring-1 ring-(--glass-border)"
                        />
                        <div class="min-w-0 flex-1">
                          <span class="text-primary text-xs font-semibold">{{
                            reply.username
                          }}</span>
                          <p class="text-primary/70 mt-1 text-xs leading-relaxed">
                            {{ reply.content }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else class="flex flex-col items-center justify-center py-20">
              <span class="icon-[mdi--comment-off-outline] text-primary/20 mb-4 h-16 w-16"></span>
              <p class="text-primary/50 text-sm font-medium">{{ $t('comments.empty') }}</p>
            </div>

            <!-- 加载更多 -->
            <div
              v-if="comments.length >= 10"
              class="border-t border-(--glass-border) p-5 text-center"
            >
              <Button
                variant="ghost"
                size="sm"
                class="text-primary/60 hover:text-primary text-sm font-medium transition-colors"
              >
                {{ $t('comments.loadMore') }}
              </Button>
            </div>
          </div>
        </section>

        <!-- 相似歌单 -->
        <section v-show="activeTab === 'similar'" class="animate-fade-in">
          <div
            v-if="similarPlaylists.length"
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            <router-link
              v-for="pl in similarPlaylists"
              :key="pl.id"
              :to="`/playlist/${pl.id}`"
              class="group"
            >
              <div
                class="glass-card overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl"
              >
                <div class="relative aspect-square overflow-hidden">
                  <LazyImage
                    :src="pl.coverImgUrl + '?param=300y300'"
                    :alt="pl.name"
                    imgClass="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    wrapperClass="h-full w-full"
                  />
                  <div
                    class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100"
                  >
                    <div
                      class="accent-gradient flex h-14 w-14 items-center justify-center rounded-full shadow-2xl"
                    >
                      <span class="icon-[mdi--play] h-7 w-7 text-white"></span>
                    </div>
                  </div>
                  <div
                    v-if="pl.playCount"
                    class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md"
                  >
                    <span class="icon-[mdi--play] h-3.5 w-3.5"></span>
                    {{ formatCount(pl.playCount) }}
                  </div>
                </div>
                <div class="p-3">
                  <p
                    class="text-primary mb-1.5 line-clamp-2 text-sm leading-snug font-semibold transition-colors group-hover:text-pink-400"
                  >
                    {{ pl.name }}
                  </p>
                  <p class="text-primary/60 text-xs">
                    {{ $t('commonUnits.songsShort', pl.trackCount) }}
                    <span v-if="pl.creator"> • {{ pl.creator.nickname }}</span>
                  </p>
                </div>
              </div>
            </router-link>
          </div>
          <div
            v-else
            class="glass-card flex flex-col items-center justify-center py-20 text-center"
          >
            <span class="icon-[mdi--playlist-remove] text-primary/20 mb-5 h-20 w-20"></span>
            <p class="text-primary/50 text-base font-medium">{{ $t('playlist.similarEmpty') }}</p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
