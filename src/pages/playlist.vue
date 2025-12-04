<script setup lang="ts">
import { playlistDetail, playlistTrackAll, commentNew, search } from '@/api'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import { PlaylistInfo, PlaylistSong, CommentItem } from '@/typings'
import LazyImage from '@/components/Ui/LazyImage.vue'
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

onMounted(() => {
  const idNum = Number(playlistId)
  if (!Number.isNaN(idNum) && idNum > 0) {
    state.isPageLoading = true
    loadPlaylist(idNum)
    loadComments(idNum)
  }
})

watch(
  () => state.playlistInfo.name,
  name => {
    if (name) loadSimilarPlaylists(name)
  }
)

const handleSort = () => {
  console.log('排序歌曲')
}

const handleFilter = () => {
  console.log('筛选歌曲')
}

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
</script>

<template>
  <div class="w-full overflow-x-hidden">
    <PageSkeleton v-if="isPageLoading" :sections="['hero', 'list']" :list-count="12" />
    <template v-else>
      <div class="relative">
        <div class="absolute inset-0 overflow-hidden">
          <img
            :src="playlistInfo.coverImgUrl + '?param=100y100'"
            class="h-full w-full scale-150 object-cover opacity-30 blur-3xl"
          />
          <div
            class="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-(--color-background)"
          ></div>
        </div>

        <div class="relative z-10 px-6 pt-6 pb-4 lg:px-8">
          <div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
            <div class="group relative mx-auto w-56 shrink-0 lg:mx-0 lg:w-64">
              <div
                class="aspect-square overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
              >
              <LazyImage
                :src="playlistInfo.coverImgUrl + '?param=300y300'"
                :alt="$t('components.songList.coverAlt')"
                imgClass="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                wrapperClass="h-full w-full"
              />
              </div>
              <button
                class="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-all duration-300 group-hover:opacity-100"
                @click="playAll"
              >
                <div
                  class="flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition-transform hover:scale-110"
                >
                  <span class="icon-[mdi--play] h-8 w-8"></span>
                </div>
              </button>
            </div>

            <div class="flex min-w-0 flex-1 flex-col justify-center text-center lg:text-left">
              <div class="mb-3 flex items-center justify-center gap-2 lg:justify-start">
                <span
                  class="rounded-full bg-pink-500/20 px-3 py-1 text-xs font-medium text-pink-400"
                >
                  {{ playlistInfo.category }}
                </span>
              </div>

              <h1 class="text-primary mb-3 line-clamp-2 text-2xl font-bold lg:text-3xl">
                {{ playlistInfo.name }}
              </h1>

              <div class="mb-4 flex items-center justify-center gap-2 lg:justify-start">
                <img
                  v-if="playlistInfo.creatorAvatar"
                  :src="playlistInfo.creatorAvatar + '?param=60y60'"
                  class="h-6 w-6 rounded-full ring-2 ring-white/20"
                />
                <span class="text-primary/70 text-sm">{{ playlistInfo.creator }}</span>
                <span class="text-primary/40">·</span>
                <span class="text-primary/50 text-sm">{{ playlistInfo.createTime }}</span>
              </div>

              <p
                v-if="playlistInfo.description"
                class="text-primary/60 mb-5 line-clamp-2 text-sm leading-relaxed"
                :title="playlistInfo.description"
              >
                {{ playlistInfo.description }}
              </p>

              <div class="mb-5 flex flex-wrap items-center justify-center gap-6 lg:justify-start">
                <div class="flex items-center gap-1.5">
                  <span class="icon-[mdi--music-note] text-primary/50 h-4 w-4"></span>
                <span class="text-primary/70 text-sm"
                  >{{ $t('commonUnits.songsShort', playlistInfo.songCount) }}
                  </span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="icon-[mdi--play-circle-outline] text-primary/50 h-4 w-4"></span>
                <span class="text-primary/70 text-sm"
                  >{{ formatCount(playlistInfo.playCount || 0) }} {{ $t('common.stats.plays') }}</span
                  >
              </div>
              <div class="flex items-center gap-1.5">
                <span class="icon-[mdi--heart] h-4 w-4 text-red-400/70"></span>
                <span class="text-primary/70 text-sm"
                  >{{ formatCount(Number(playlistInfo.likes) || 0) }} {{ $t('common.stats.favorites') }}</span
                  >
              </div>
              </div>

              <div class="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <button
                  class="inline-flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 font-medium text-white shadow-lg shadow-pink-500/25 transition-all hover:bg-pink-600 hover:shadow-xl hover:shadow-pink-500/30"
                  @click="playAll"
                >
                  <span class="icon-[mdi--play] h-5 w-5"></span>
                  {{ $t('actions.playAll') }}
                </button>
                <button
                  class="text-primary inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 font-medium backdrop-blur-sm transition-all hover:bg-white/20"
                  @click="shufflePlay"
                >
                  <span class="icon-[mdi--shuffle] h-5 w-5"></span>
                  {{ $t('actions.shufflePlay') }}
                </button>
                <div class="flex items-center gap-1">
                  <button
                    class="text-primary flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20"
                    :class="{ 'bg-red-500/20 text-red-400 hover:bg-red-500/30': state.isCollected }"
                    @click="toggleCollect"
                    :title="state.isCollected ? $t('common.uncollect') : $t('common.collect')"
                  >
                    <span
                      :class="state.isCollected ? 'icon-[mdi--heart]' : 'icon-[mdi--heart-outline]'"
                      class="h-5 w-5"
                    ></span>
                  </button>
                  <button
                    class="text-primary flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20"
                    @click="sharePlaylist"
                    :title="$t('common.share')"
                  >
                    <span class="icon-[mdi--share-variant] h-5 w-5"></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-1 flex-col overflow-hidden pb-8">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-1">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="group relative px-4 py-2 text-sm font-medium transition-all"
              :class="
                activeTab === tab.key ? 'text-primary' : 'text-primary/50 hover:text-primary/80'
              "
              @click="activeTab = tab.key"
            >
              <span class="relative z-10 flex items-center gap-1.5">
                <span :class="tab.icon" class="h-4 w-4"></span>
                {{ $t(tab.labelKey) }}
                <span class="text-xs opacity-60">
                  {{
                    tab.key === 'songs'
                      ? songs.length
                      : tab.key === 'comments'
                        ? comments.length
                        : similarPlaylists.length
                  }}
                </span>
              </span>
              <span
                v-if="activeTab === tab.key"
                class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-pink-500"
              ></span>
            </button>
          </div>
          <div v-if="activeTab === 'songs'" class="flex items-center gap-2">
            <button
              class="text-primary/50 hover:text-primary flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
            >
              <span class="icon-[mdi--sort] h-4 w-4"></span>
              {{ $t('common.sort') }}
            </button>
          </div>
        </div>
        <section v-show="activeTab === 'songs'" class="h-full overflow-hidden">
          <SongList
            :songs="songs"
            :show-header="true"
            :show-controls="true"
            @sort="handleSort"
            @filter="handleFilter"
          />
        </section>

        <section v-show="activeTab === 'comments'" class="animate-fade-in">
          <div class="glass-card overflow-hidden rounded-2xl">
            <div class="border-b border-white/5 p-5">
              <div class="flex gap-4">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-pink-400 to-purple-500 font-bold text-white"
                >
                  {{ $t('common.me') }}
                </div>
                <div class="flex-1">
                  <textarea
                    v-model="newComment"
                    :placeholder="$t('comments.placeholder')"
                    class="text-primary w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm placeholder-white/30 transition-colors focus:border-pink-400/50 focus:bg-white/10 focus:outline-none"
                    rows="2"
                  ></textarea>
                  <div class="mt-2 flex items-center justify-end">
                    <button
                      class="rounded-full bg-pink-500 px-5 py-1.5 text-sm font-medium text-white transition-all hover:bg-pink-600 disabled:opacity-40"
                      :disabled="!newComment.trim()"
                      @click="submitComment"
                    >
                      {{ $t('comments.publish') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="comments.length" class="divide-y divide-white/5">
              <div
                v-for="(comment, index) in comments"
                :key="index"
                class="p-5 transition-colors hover:bg-white/5"
              >
                <div class="flex gap-4">
                  <img
                    v-if="comment.avatarUrl"
                    :src="comment.avatarUrl + '?param=80y80'"
                    class="h-10 w-10 shrink-0 rounded-full ring-2 ring-white/10"
                  />
                  <div
                    v-else
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-medium text-white"
                    :class="comment.avatarGradient"
                  >
                    {{ comment.username.charAt(0) }}
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="mb-1.5 flex items-center gap-2">
                      <span class="text-primary text-sm font-medium">{{ comment.username }}</span>
                      <span class="text-primary/40 text-xs">{{ comment.time }}</span>
                    </div>

                    <p class="text-primary/80 mb-3 text-sm leading-relaxed">
                      {{ comment.content }}
                    </p>

                    <div class="flex items-center gap-4 text-xs">
                      <button
                        class="text-primary/50 hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        <span class="icon-[mdi--thumb-up-outline] h-4 w-4"></span>
                        <span>{{ comment.likes || '' }}</span>
                      </button>
                      <button
                        class="text-primary/50 hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        <span class="icon-[mdi--reply] h-4 w-4"></span>
                        <span>{{ $t('comments.reply') }}</span>
                      </button>
                    </div>

                    <div
                      v-if="comment.replies?.length"
                      class="mt-3 space-y-3 rounded-xl bg-white/5 p-3"
                    >
                      <div v-for="(reply, ri) in comment.replies" :key="ri" class="flex gap-3">
                        <img
                          v-if="reply.avatarUrl"
                          :src="reply.avatarUrl + '?param=60y60'"
                          class="h-7 w-7 shrink-0 rounded-full"
                        />
                        <div class="min-w-0 flex-1">
                          <span class="text-primary text-xs font-medium">{{ reply.username }}</span>
                          <p class="text-primary/70 mt-0.5 text-xs leading-relaxed">
                            {{ reply.content }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="flex flex-col items-center justify-center py-16">
              <span class="icon-[mdi--comment-off-outline] text-primary/20 mb-3 h-12 w-12"></span>
              <p class="text-primary/40 text-sm">{{ $t('comments.empty') }}</p>
            </div>

            <div v-if="comments.length >= 10" class="border-t border-white/5 p-4 text-center">
              <button class="text-primary/60 hover:text-primary text-sm transition-colors">
                {{ $t('comments.loadMore') }}
              </button>
            </div>
          </div>
        </section>

        <section v-show="activeTab === 'similar'" class="animate-fade-in">
          <div
            v-if="similarPlaylists.length"
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          >
            <router-link
              v-for="pl in similarPlaylists"
              :key="pl.id"
              :to="`/playlist/${pl.id}`"
              class="group"
            >
              <div
                class="relative mb-3 aspect-square overflow-hidden rounded-xl ring-1 ring-white/10 transition-all group-hover:ring-white/20"
              >
                <LazyImage
                  :src="pl.coverImgUrl + '?param=200y200'"
                  :alt="pl.name"
                  imgClass="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  wrapperClass="h-full w-full"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <div
                    class="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/90 text-white"
                  >
                    <span class="icon-[mdi--play] h-6 w-6"></span>
                  </div>
                </div>
                <div
                  v-if="pl.playCount"
                  class="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur-sm"
                >
                  <span class="icon-[mdi--play] h-3 w-3"></span>
                  {{ formatCount(pl.playCount) }}
                </div>
              </div>
              <p
                class="text-primary mb-1 line-clamp-2 text-sm font-medium transition-colors group-hover:text-pink-400"
              >
                {{ pl.name }}
              </p>
              <p class="text-primary/50 text-xs">
                {{ $t('commonUnits.songsShort', pl.trackCount) }}
                <span v-if="pl.creator">· {{ pl.creator.nickname }}</span>
              </p>
            </router-link>
          </div>
          <div v-else class="flex flex-col items-center justify-center py-16 text-center">
            <span class="icon-[mdi--playlist-remove] text-primary/20 mb-4 h-16 w-16"></span>
            <p class="text-primary/40">{{ $t('playlist.similarEmpty') }}</p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
