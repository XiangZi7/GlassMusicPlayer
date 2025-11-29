<script setup lang="ts">
import { useRoute } from 'vue-router'
import { albumDetail } from '@/api'
import SongList from '@/components/SongList.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'

const route = useRoute()
const albumId = computed(() => Number(route.params.id))

const state = reactive({ info: null as any, songs: [] as any[], loading: false })
const showDesc = ref(false)

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
  if (!albumId.value) return
  state.loading = true
  try {
    const res: any = await albumDetail({ id: albumId.value })
    const album = res?.album || res?.data?.album || null
    const songs: any[] = res?.songs || res?.data?.songs || []
    state.info = album
    state.songs = songs.map(s => ({
      id: s?.id,
      name: s?.name,
      artist: Array.isArray(s?.ar)
        ? s.ar.map((a: any) => a.name).join(' / ')
        : Array.isArray(s?.artists)
          ? s.artists.map((a: any) => a.name).join(' / ')
          : '',
      artistId: Array.isArray(s?.ar) && s.ar[0]?.id
        ? s.ar[0].id
        : Array.isArray(s?.artists) && s.artists[0]?.id
          ? s.artists[0].id
          : 0,
      album: s?.al?.name || s?.album?.name || album?.name || '',
      albumId: s?.al?.id ?? s?.album?.id ?? album?.id,
      duration: s?.dt ?? s?.duration ?? 0,
      cover: s?.al?.picUrl || s?.album?.picUrl || album?.picUrl || '',
      mvId: s?.mv,
    }))
  } finally {
    state.loading = false
  }
}

watch(albumId, () => load())
onMounted(() => load())
</script>

<template>
  <div class="flex-1 overflow-hidden text-primary">
    <div class="h-full overflow-auto">
      <div class="relative mb-6 h-56 w-full">
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
            <div class="h-24 w-24 overflow-hidden rounded-xl ring-2 ring-white/20">
              <img
                v-if="state.info?.picUrl"
                :src="state.info.picUrl + '?param=300y300'"
                class="h-full w-full object-cover"
                alt="album"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center rounded-xl bg-linear-to-br from-pink-400 to-purple-500"
              >
                <span class="icon-[mdi--album] h-8 w-8"></span>
              </div>
            </div>
            <div>
              <h1 class="text-2xl font-bold">{{ state.info?.name || '专辑' }}</h1>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-primary/80">
                <span class="glass-button px-2 py-1"
                  >发行
                  {{
                    state.info?.publishTime
                      ? new Date(state.info.publishTime).toLocaleDateString()
                      : '-'
                  }}</span
                >
                <span v-if="state.info?.artist?.name" class="glass-button px-2 py-1">{{
                  state.info.artist.name
                }}</span>
                <span class="glass-button px-2 py-1">曲目 {{ state.songs.length }}</span>
              </div>
            </div>
          </div>
          <div class="ml-auto flex items-center gap-3">
            <button class="glass-button px-4 py-2 text-sm" @click="playAll">
              <span class="icon-[mdi--play] mr-2 h-4 w-4"></span> 播放专辑
            </button>
            <button class="glass-button px-4 py-2 text-sm" @click="shufflePlay">
              <span class="icon-[mdi--shuffle] mr-2 h-4 w-4"></span> 随机播放
            </button>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div v-if="state.info?.description" class="glass-card mb-6 p-4">
          <h3 class="mb-2 text-sm font-semibold">简介</h3>
          <p v-if="!showDesc" class="line-clamp-3 text-primary/80">{{ state.info.description }}</p>
          <p v-else class="text-primary/80">{{ state.info.description }}</p>
          <button
            class="mt-2 text-xs text-purple-300 hover:text-primary"
            @click="showDesc = !showDesc"
          >
            {{ showDesc ? '收起' : '展开更多' }}
          </button>
        </div>

        <h2 class="mb-3 text-lg font-semibold">曲目列表</h2>
        <PageSkeleton v-if="state.loading" :sections="['list']" :list-count="12" />
        <SongList
          class="h-[50vh]!"
          v-else
          :songs="state.songs"
          :current-playing-index="-1"
          :show-header="true"
        />
      </div>
    </div>
  </div>
</template>
