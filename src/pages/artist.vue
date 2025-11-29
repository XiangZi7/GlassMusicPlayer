<script setup lang="ts">
import { artistDetail, artistTopSong, artistAlbum } from '@/api'
import SongList from '@/components/SongList.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'

const route = useRoute()
const router = useRouter()
const artistId = computed(() => Number(route.params.id))

type ArtistInfo = {
  id: number
  name: string
  alias: string[]
  picUrl: string
  briefDesc: string
  albumSize: number
  musicSize: number
  mvSize: number
  followed: boolean
  fansCount: number
}

type AlbumItem = {
  id: number
  name: string
  picUrl: string
  publishTime: string
  size: number
  artistName: string
}

type SongItem = {
  id: number | string
  name: string
  artist: string
  artistId: number | string
  album: string
  albumId: number | string
  duration: number
  cover: string
  mvId?: number | string
}

const state = reactive({
  info: {} as ArtistInfo,
  songs: [] as SongItem[],
  albums: [] as AlbumItem[],
  loading: true,
  followed: false,
})

const { setPlaylist, play } = useAudio()

const formatCount = (count: number) => {
  if (count >= 100000000) return (count / 100000000).toFixed(1) + '亿'
  if (count >= 10000) return (count / 10000).toFixed(1) + '万'
  return String(count)
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' })
}

const load = async (id: number) => {
  state.loading = true
  try {
    const [detailRes, songsRes, albumsRes] = await Promise.all([
      artistDetail({ id }),
      artistTopSong({ id }),
      artistAlbum({ id, limit: 12 }),
    ])

    const artist = (detailRes as any)?.data?.artist || (detailRes as any)?.artist || {}
    state.info = {
      id: artist?.id || id,
      name: artist?.name || '',
      alias: artist?.alias || [],
      picUrl: artist?.cover || artist?.picUrl || artist?.avatar || '',
      briefDesc: artist?.briefDesc || '',
      albumSize: artist?.albumSize || 0,
      musicSize: artist?.musicSize || 0,
      mvSize: artist?.mvSize || 0,
      followed: artist?.followed || false,
      fansCount: artist?.fansCnt || 0,
    }
    state.followed = state.info.followed

    const songs = (songsRes as any)?.songs || (songsRes as any)?.data?.songs || []
    state.songs = songs.slice(0, 50).map((s: any) => ({
      id: s?.id || 0,
      name: s?.name || '',
      artist: Array.isArray(s?.ar) ? s.ar.map((a: any) => a.name).join(' / ') : state.info.name,
      artistId: state.info.id,
      album: s?.al?.name || '',
      albumId: s?.al?.id || 0,
      duration: s?.dt ?? s?.duration ?? 0,
      cover: s?.al?.picUrl || '',
      mvId: s?.mv,
    }))

    const albums = (albumsRes as any)?.hotAlbums || (albumsRes as any)?.data?.hotAlbums || []
    state.albums = albums.slice(0, 12).map((a: any) => ({
      id: a?.id || 0,
      name: a?.name || '',
      picUrl: a?.picUrl || '',
      publishTime: a?.publishTime ? formatDate(a.publishTime) : '',
      size: a?.size || 0,
      artistName: a?.artist?.name || state.info.name,
    }))
  } finally {
    state.loading = false
  }
}

watch(
  artistId,
  id => {
    if (!Number.isNaN(id) && id > 0) {
      load(id)
    }
  },
  { immediate: true }
)

const playAll = () => {
  const mapped: StoreSong[] = state.songs.map(s => ({
    id: s.id,
    name: s.name,
    artist: s.artist,
    album: s.album,
    duration: s.duration,
    cover: s.cover,
  }))
  if (mapped.length) {
    setPlaylist(mapped, 0)
    play(mapped[0], 0)
  }
}

const shufflePlay = () => {
  const arr = [...state.songs]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  const mapped: StoreSong[] = arr.map(s => ({
    id: s.id,
    name: s.name,
    artist: s.artist,
    album: s.album,
    duration: s.duration,
    cover: s.cover,
  }))
  if (mapped.length) {
    setPlaylist(mapped, 0)
    play(mapped[0], 0)
  }
}

const toggleFollow = () => {
  state.followed = !state.followed
}
</script>

<template>
  <div class="flex-1 overflow-hidden text-primary">
    <div class="h-full overflow-auto">
      <div class="relative mb-6 h-56 w-full">
        <div class="absolute inset-0 overflow-hidden rounded-b-3xl">
          <img
            v-if="state.info.picUrl"
            :src="state.info.picUrl + '?param=800y800'"
            class="h-full w-full object-cover opacity-30"
          />
          <div v-else class="h-full w-full bg-linear-to-br from-pink-500/40 to-purple-600/40"></div>
        </div>
        <div class="absolute inset-0 flex items-end p-6">
          <div class="flex items-center gap-6">
            <div class="h-28 w-28 overflow-hidden rounded-full ring-4 ring-white/20">
              <img
                v-if="state.info.picUrl"
                :src="state.info.picUrl + '?param=300y300'"
                class="h-full w-full object-cover"
                alt="artist"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-pink-400 to-purple-500"
              >
                <span class="icon-[mdi--account-music] h-12 w-12"></span>
              </div>
            </div>
            <div>
              <h1 class="text-3xl font-bold">{{ state.info.name }}</h1>
              <p v-if="state.info.alias?.length" class="mt-1 text-sm text-primary/60">
                {{ state.info.alias.join(' / ') }}
              </p>
              <div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-primary/80">
                <span class="glass-button px-3 py-1">
                  <span class="icon-[mdi--music-note] mr-1 h-4 w-4"></span>
                  {{ state.info.musicSize }} 歌曲
                </span>
                <span class="glass-button px-3 py-1">
                  <span class="icon-[mdi--album] mr-1 h-4 w-4"></span>
                  {{ state.info.albumSize }} 专辑
                </span>
                <span class="glass-button px-3 py-1">
                  <span class="icon-[mdi--video] mr-1 h-4 w-4"></span>
                  {{ state.info.mvSize }} MV
                </span>
                <span v-if="state.info.fansCount" class="glass-button px-3 py-1">
                  <span class="icon-[mdi--account-group] mr-1 h-4 w-4"></span>
                  {{ formatCount(state.info.fansCount) }} 粉丝
                </span>
              </div>
            </div>
          </div>
          <div class="ml-auto flex items-center gap-3">
            <button
              class="glass-button bg-linear-to-r from-pink-500 to-purple-600 px-6 py-2.5 text-sm font-medium"
              @click="playAll"
            >
              <span class="icon-[mdi--play] mr-2 h-5 w-5"></span> 播放热门
            </button>
            <button class="glass-button px-5 py-2.5 text-sm" @click="shufflePlay">
              <span class="icon-[mdi--shuffle] mr-2 h-4 w-4"></span> 随机播放
            </button>
            <button
              class="glass-button px-5 py-2.5 text-sm"
              :class="state.followed ? 'from-pink-500/20 to-purple-600/20' : ''"
              @click="toggleFollow"
            >
              <span
                :class="state.followed ? 'icon-[mdi--account-check]' : 'icon-[mdi--account-plus]'"
                class="mr-2 h-4 w-4"
              ></span>
              {{ state.followed ? '已关注' : '关注' }}
            </button>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div v-if="state.info.briefDesc" class="glass-card mb-6 p-4">
          <h3 class="mb-2 text-sm font-semibold">艺人简介</h3>
          <p class="line-clamp-3 text-sm text-primary/80">{{ state.info.briefDesc }}</p>
        </div>

        <h2 class="mb-3 text-lg font-semibold">热门歌曲</h2>
        <PageSkeleton v-if="state.loading" :sections="['list']" :list-count="12" />
        <SongList
          v-else
          class="h-[50vh]!"
          :songs="state.songs"
          :current-playing-index="-1"
          :show-header="true"
        />

        <h2 class="mt-8 mb-3 text-lg font-semibold">专辑</h2>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <div
            v-for="al in state.albums"
            :key="al.id"
            class="glass-card group cursor-pointer p-3"
            @click="router.push(`/album/${al.id}`)"
          >
            <div class="mb-2 aspect-square w-full overflow-hidden rounded-xl">
              <img
                :src="al.picUrl + '?param=400y400'"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <p class="truncate text-sm font-medium">{{ al.name }}</p>
            <p class="truncate text-xs text-primary/60">{{ al.publishTime }} · {{ al.size }}首</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
