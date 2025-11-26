<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { search } from '@/api'
import SongList from '@/components/SongList.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'

const route = useRoute()
const router = useRouter()
const name = computed(() => String(route.params.name || ''))

const state = reactive({
  info: null as any,
  albums: [] as any[],
  songs: [] as any[],
  loading: false,
})

const { setPlaylist, play } = useAudio()
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

const load = async () => {
  if (!name.value) return
  state.loading = true
  try {
    const resArtist: any = await search({ keywords: name.value, type: 100 })
    const artists: any[] = resArtist?.result?.artists || []
    state.info = artists[0] || null

    const resAlbums: any = await search({ keywords: name.value, type: 10 })
    const albums: any[] = resAlbums?.result?.albums || []
    state.albums = albums.slice(0, 12)

    const resSongs: any = await search({ keywords: name.value, type: 1 })
    const songs: any[] = resSongs?.result?.songs || []
    state.songs = songs.slice(0, 30).map(s => ({
      id: s?.id,
      name: s?.name,
      cover: s?.album.artist?.img1v1Url || '',
      artist: Array.isArray(s?.artists) ? s.artists.map((a: any) => a.name).join(' / ') : '',
      album: s?.album?.name || '',
      albumId: s?.album?.id,
      duration: s?.duration || 0,
      mvId: s?.mvid,
    }))
  } finally {
    state.loading = false
  }
}

watch(name, () => load())
onMounted(() => load())
</script>

<template>
  <div class="flex-1 overflow-hidden text-white">
    <div class="h-full overflow-auto">
      <div class="relative mb-6 h-48 w-full">
        <div class="absolute inset-0 overflow-hidden rounded-b-3xl">
          <img
            v-if="state.info?.picUrl"
            :src="state.info.picUrl + '?param=800y800'"
            class="h-full w-full object-cover opacity-30"
          />
          <div v-else class="h-full w-full bg-linear-to-br from-pink-500/40 to-purple-600/40"></div>
        </div>
        <div class="absolute inset-0 flex items-end p-6">
          <div class="flex items-center gap-4">
            <div class="h-20 w-20 overflow-hidden rounded-full ring-2 ring-white/20">
              <img
                v-if="state.info?.picUrl"
                :src="state.info.picUrl + '?param=200y200'"
                class="h-full w-full object-cover"
                alt="artist"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-pink-400 to-purple-500"
              >
                <span class="icon-[mdi--account-music] h-8 w-8"></span>
              </div>
            </div>
            <div>
              <h1 class="text-2xl font-bold">{{ state.info?.name || name }}</h1>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
                <span class="glass-button px-2 py-1">专辑 {{ state.info?.albumSize ?? '-' }}</span>
                <span class="glass-button px-2 py-1">MV {{ state.info?.mvSize ?? '-' }}</span>
                <span v-if="state.info?.alias?.length" class="glass-button px-2 py-1">{{
                  state.info.alias[0]
                }}</span>
              </div>
            </div>
          </div>
          <div class="ml-auto flex items-center gap-3">
            <button class="glass-button px-4 py-2 text-sm" @click="playAll">
              <span class="icon-[mdi--play] mr-2 h-4 w-4"></span> 播放热门
            </button>
            <button class="glass-button px-4 py-2 text-sm" @click="shufflePlay">
              <span class="icon-[mdi--shuffle] mr-2 h-4 w-4"></span> 随机播放
            </button>
          </div>
        </div>
      </div>

      <div class="p-6">
        <h2 class="mb-3 text-lg font-semibold">热门歌曲</h2>
        <PageSkeleton v-if="state.loading" :sections="['list']" :list-count="12" />
        <SongList
          class="h-[50vh]!"
          v-else
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
            <div class="mb-2 h-40 w-full overflow-hidden rounded-xl">
              <img
                :src="al.picUrl + '?param=400y400'"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <p class="truncate text-sm">{{ al.name }}</p>
            <p class="truncate text-xs text-white/70">{{ al.artist?.name }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
