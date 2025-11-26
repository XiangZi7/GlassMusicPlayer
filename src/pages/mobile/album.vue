<script setup lang="ts">
import { albumDetail } from '@/api'
import { useAudio } from '@/composables/useAudio'
import LazyImage from '@/components/Ui/LazyImage.vue'

const route = useRoute()
const albumId = computed(() => Number(route.params.id))

const state = reactive({
  name: '',
  artist: '',
  publish: '',
  cover: '',
  songs: [] as Array<{
    id: number | string
    name: string
    artist: string
    album: string
    duration: number
    cover: string
    emoji: string
    gradient: string
    liked: boolean
  }>,
  loading: true,
})

const { setPlaylist, play } = useAudio()

const gradients = ['from-purple-500 to-pink-500']
const emojis = ['🎵', '🎶', '♪', '♫', '🎼']

const load = async (id: number) => {
  try {
    const res = await albumDetail({ id })
    const data = (res as any)?.album || (res as any)?.data?.album || (res as any)?.data
    const songs = (res as any)?.songs || (res as any)?.data?.songs || []
    if (data) {
      state.name = data?.name || ''
      state.artist = data?.artist?.name || ''
      state.publish = data?.publishTime ? new Date(data.publishTime).toLocaleDateString() : ''
      state.cover = data?.picUrl || ''
    }
    if (Array.isArray(songs)) {
      state.songs = songs.map((t: any, i: number) => ({
        id: t?.id || 0,
        name: t?.name || '',
        artist: Array.isArray(t?.ar) ? t.ar.map((a: any) => a.name).join(' / ') : Array.isArray(t?.artists) ? t.artists.map((a: any) => a.name).join(' / ') : '',
        album: state.name,
        duration: t?.dt ?? t?.duration ?? 0,
        cover: state.cover,
        emoji: emojis[i % emojis.length],
        gradient: gradients[i % gradients.length],
        liked: false,
      }))
    }
  } finally {
    state.loading = false
  }
}

onMounted(() => {
  const idNum = albumId.value
  if (!Number.isNaN(idNum) && idNum > 0) {
    state.loading = true
    load(idNum)
  }
})

const playAll = () => {
  if (!state.songs.length) return
  const list = state.songs.map(s => ({
    id: s.id,
    name: s.name,
    artist: s.artist,
    album: s.album,
    duration: Math.floor((s.duration || 0) / 1000),
    cover: s.cover,
    liked: s.liked,
  }))
  setPlaylist(list, 0)
  play(list[0], 0)
}
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div v-if="state.loading" class="py-6">
      <PageSkeleton :sections="['hero','list']" :list-count="8" />
    </div>
    <template v-else>
      <section class="mb-4">
        <div class="relative overflow-hidden rounded-2xl">
          <LazyImage v-if="state.cover" :src="state.cover" alt="cover" imgClass="h-36 w-full object-cover" />
          <div class="absolute inset-0 bg-linear-to-br opacity-40 from-purple-500 to-pink-500"></div>
          <div class="relative z-10 p-4">
            <h1 class="mb-1 truncate text-xl font-bold text-primary">{{ state.name }}</h1>
            <p class="truncate text-xs text-primary/70">{{ state.artist }}</p>
            <p class="truncate text-[11px] text-primary/70">{{ state.publish }}</p>
            <div class="mt-3 flex items-center gap-2">
              <button class="glass-button px-4 py-2 text-sm text-primary" @click="playAll">
                <span class="icon-[mdi--play] mr-1 h-4 w-4"></span>播放全部
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <HotSongsMobile :songs="state.songs" />
      </section>
    </template>
  </div>
</template>
