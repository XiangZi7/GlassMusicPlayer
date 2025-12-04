<script setup lang="ts">
import { songDetail, lyric } from '@/api'
import { useAudio } from '@/composables/useAudio'

const route = useRoute()

const state = reactive({
  id: String(route.params.id || ''),
  name: '',
  artist: '',
  album: '',
  duration: 0,
  cover: '',
  lrc: [] as Array<{ time: number; text: string }>,
  loading: true,
  liked: false,
})

const { play, togglePlay } = useAudio()

const parseLrc = (raw: string) => {
  const lines = raw.split(/\r?\n/)
  const result: Array<{ time: number; text: string }> = []
  for (const line of lines) {
    const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/)
    if (!m) continue
    const min = parseInt(m[1])
    const sec = parseInt(m[2])
    const ms = parseInt(m[3].slice(0, 2))
    const time = min * 60 + sec + ms / 100
    result.push({ time, text: m[4].trim() })
  }
  return result
}

const load = async (id: string) => {
  try {
    const [detailRes, lrcRes] = await Promise.all([songDetail({ ids: id }), lyric({ id })])
    const song =
      (detailRes as any)?.songs?.[0] ||
      (detailRes as any)?.data?.songs?.[0] ||
      (detailRes as any)?.data?.[0]
    if (song) {
      state.name = song?.name || ''
      state.artist = Array.isArray(song?.ar)
        ? song.ar.map((a: any) => a.name).join(' / ')
        : Array.isArray(song?.artists)
          ? song.artists.map((a: any) => a.name).join(' / ')
          : ''
      state.album = song?.al?.name || song?.album?.name || ''
      state.duration = song?.dt ?? song?.duration ?? 0
      state.cover = song?.al?.picUrl || song?.album?.picUrl || ''
    }
    const raw = (lrcRes as any)?.lrc?.lyric || (lrcRes as any)?.lyric || ''
    state.lrc = raw ? parseLrc(raw) : []
  } finally {
    state.loading = false
  }
}

onMounted(() => {
  if (state.id) {
    state.loading = true
    load(state.id)
  }
})

const playCurrent = () => {
  const s = {
    id: state.id,
    name: state.name,
    artist: state.artist,
    album: state.album,
    duration: Math.floor((state.duration || 0) / 1000),
    cover: state.cover,
    liked: state.liked,
  }
  play(s, 0)
}

const toggleLike = () => {
  state.liked = !state.liked
}
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div v-if="state.loading" class="py-6">
      <PageSkeleton :sections="['hero', 'list']" :list-count="6" />
    </div>
    <template v-else>
      <section class="mb-4">
        <div class="flex items-center gap-3">
          <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
            <img
              v-if="state.cover"
              :src="state.cover + '?param=300y300'"
              alt="cover"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center rounded-xl bg-white/10"
            >
              🎵
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="text-primary truncate text-lg font-bold">{{ state.name }}</h1>
            <p class="truncate text-xs text-purple-300">{{ state.artist }}</p>
            <p class="truncate text-[11px] text-purple-400">{{ state.album }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="glass-button text-primary rounded-full bg-linear-to-r from-pink-500 to-purple-600 px-3 py-2 text-sm"
              @click="playCurrent"
            >
              <span class="icon-[mdi--play] h-4 w-4"></span>
            </button>
            <button
              class="glass-button text-primary rounded-full px-3 py-2 text-sm"
              @click="toggleLike"
            >
              <span
                :class="state.liked ? 'icon-[mdi--heart]' : 'icon-[mdi--heart-outline]'"
                class="h-4 w-4"
              ></span>
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3 class="text-primary mb-2 text-sm font-semibold">{{ $t('song.lyrics') }}</h3>
        <div class="glass-card max-h-64 overflow-auto p-3">
          <p v-for="(l, i) in state.lrc" :key="i" class="text-primary/80 mb-1 text-sm">
            {{ l.text }}
          </p>
          <p v-if="!state.lrc.length" class="text-primary/60 text-sm">{{ $t('song.noLyrics') }}</p>
        </div>
      </section>
    </template>
  </div>
</template>
