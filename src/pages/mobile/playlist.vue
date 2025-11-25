<script setup lang="ts">
import { playlistDetail, playlistTrackAll, commentNew } from '@/api'
import { useAudio } from '@/composables/useAudio'

type PlaylistInfo = {
  name: string
  description: string
  creator: string
  createTime: string
  songCount: number
  likes: string
  category: string
  coverImgUrl: string
  gradient: string
}

type PlaylistSong = {
  id: number | string
  name: string
  artist: string
  album: string
  albumId: number | string
  duration: number
  emoji: string
  gradient: string
  liked: boolean
  cover: string
}

type CommentItem = {
  username: string
  avatarUrl: string
  time: string
  content: string
  likes: number
}

const route = useRoute()
const playlistId = computed(() => Number(route.params.id))

const state = reactive({
  info: {} as PlaylistInfo,
  songs: [] as PlaylistSong[],
  comments: [] as CommentItem[],
  loading: true,
  collected: false,
})

const { setPlaylist, play } = useAudio()

const gradients = ['from-purple-500 to-pink-500']
const emojis = ['🎵', '🎶', '♪', '♫', '🎼']

const pickGradient = () => gradients[Math.floor(Math.random() * gradients.length)]

const load = async (id: number) => {
  try {
    const [detailRes, tracksRes, commentsRes] = await Promise.all([
      playlistDetail({ id }),
      playlistTrackAll({ id, limit: 100 }),
      commentNew({ id, type: 2, sortType: 1, pageNo: 1, pageSize: 5 }),
    ])
    const detail =
      (detailRes as any)?.playlist || (detailRes as any)?.data?.playlist || (detailRes as any)?.data
    if (detail) {
      state.info = {
        name: detail?.name || '',
        description: detail?.description || '',
        creator: detail?.creator?.nickname || '',
        createTime: detail?.createTime ? new Date(detail.createTime).toLocaleDateString() : '',
        songCount: detail?.trackCount || 0,
        likes: String(detail?.subscribedCount || detail?.bookedCount || 0),
        category: detail?.tags?.[0] || '歌单',
        coverImgUrl: detail?.coverImgUrl || '',
        gradient: pickGradient(),
      }
    }
    const tracks =
      (tracksRes as any)?.songs || (tracksRes as any)?.data?.songs || (tracksRes as any)?.data || []
    if (Array.isArray(tracks)) {
      state.songs = tracks.map((t: any, i: number) => ({
        id: t?.id || 0,
        name: t?.name || '',
        artist: Array.isArray(t?.ar)
          ? t.ar.map((a: any) => a.name).join(' / ')
          : Array.isArray(t?.artists)
            ? t.artists.map((a: any) => a.name).join(' / ')
            : '',
        album: t?.al?.name || t?.album?.name || '',
        albumId: t?.al?.id || t?.album?.id || 0,
        duration: t?.dt ?? t?.duration ?? 0,
        emoji: emojis[i % emojis.length],
        gradient: gradients[i % gradients.length],
        liked: false,
        cover: t?.al?.picUrl || t?.album?.picUrl || '',
      }))
    }
    const list = (commentsRes as any)?.data?.comments || (commentsRes as any)?.comments || []
    if (Array.isArray(list)) {
      state.comments = list.slice(0, 5).map((c: any) => ({
        username: c?.user?.nickname || '用户',
        avatarUrl: c?.user?.avatarUrl || '',
        time: c?.time ? new Date(c.time).toLocaleString() : '',
        content: c?.content || '',
        likes: c?.likedCount || 0,
      }))
    }
  } finally {
    state.loading = false
  }
}

onMounted(() => {
  const idNum = playlistId.value
  if (!Number.isNaN(idNum) && idNum > 0) {
    state.loading = true
    load(idNum)
  }
})

const playAll = () => {
  if (!state.songs.length) return
  setPlaylist(state.songs, 0)
  play(state.songs[0], 0)
}

const toggleCollect = () => {
  state.collected = !state.collected
}
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div v-if="state.loading" class="py-6">
      <PageSkeleton :sections="['hero', 'list']" :list-count="8" />
    </div>
    <template v-else>
      <section class="mb-4">
        <div class="relative overflow-hidden rounded-2xl">
          <img
            v-if="state.info.coverImgUrl"
            :src="state.info.coverImgUrl"
            alt="cover"
            class="h-36 w-full object-cover"
          />
          <div
            class="absolute inset-0 bg-linear-to-br opacity-40"
            :class="state.info.gradient"
          ></div>
          <div class="relative z-10 p-4">
            <div class="mb-2">
              <span
                class="inline-block rounded-full bg-white/20 px-2 py-1 text-[11px] text-white backdrop-blur-sm"
                >{{ state.info.category }}</span
              >
            </div>
            <h1 class="mb-1 truncate text-xl font-bold text-white">{{ state.info.name }}</h1>
            <p class="line-clamp-2 text-xs text-white/80">{{ state.info.description }}</p>
            <div class="mt-3 flex items-center gap-3 text-[12px] text-white/70">
              <span class="flex items-center gap-1"
                ><span class="icon-[mdi--account-circle] h-4 w-4"></span
                >{{ state.info.creator }}</span
              >
              <span class="flex items-center gap-1"
                ><span class="icon-[mdi--music-note] h-4 w-4"></span
                >{{ state.info.songCount }}首</span
              >
              <span class="flex items-center gap-1"
                ><span class="icon-[mdi--heart] h-4 w-4 text-red-400"></span
                >{{ state.info.likes }}</span
              >
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button
                class="glass-button bg-linear-to-r from-pink-500 to-purple-600 px-4 py-2 text-sm text-white"
                @click="playAll"
              >
                <span class="icon-[mdi--play] mr-1 h-4 w-4"></span>播放全部
              </button>
              <button
                class="glass-button bg-white/10 px-3 py-2 text-sm text-white"
                @click="toggleCollect"
              >
                <span class="icon-[mdi--heart-outline] mr-1 h-4 w-4"></span
                >{{ state.collected ? '已收藏' : '收藏' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <HotSongsMobile :songs="state.songs" />
      </section>

      <section v-if="state.comments.length" class="mt-6">
        <h3 class="mb-3 text-sm font-semibold text-white">精选评论</h3>
        <div class="space-y-3">
          <div v-for="(c, i) in state.comments" :key="i" class="glass-card p-3">
            <div class="flex items-start gap-3">
              <img :src="c.avatarUrl" alt="" class="h-8 w-8 rounded-full" />
              <div class="min-w-0 flex-1">
                <div class="mb-1 flex items-center gap-2">
                  <span class="text-sm font-medium text-white">{{ c.username }}</span>
                  <span class="text-[11px] text-white/60">{{ c.time }}</span>
                </div>
                <p class="text-sm text-white/80">{{ c.content }}</p>
              </div>
              <div class="flex items-center gap-1 text-[11px] text-white/70">
                <span class="icon-[mdi--thumb-up-outline] h-4 w-4"></span>{{ c.likes }}
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
