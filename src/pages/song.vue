<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useLyrics } from '@/composables/useLyrics'
import SongCommentsDialog from '@/components/Comments/SongCommentsDialog.vue'
import { songDetail, search } from '@/api'
import { useAudio } from '@/composables/useAudio'
import { formatDuration } from '@/utils/time'
import LazyImage from '@/components/Ui/LazyImage.vue'

const route = useRoute()
const router = useRouter()
const songId = computed(() => route.params.id as string | number)
const { mergedLines, fetchLyrics } = useLyrics()
const { play, setPlaylist, currentSong, isPlaying } = useAudio()
const showComments = ref(false)

const state = reactive({
  info: null as any,
  similarSongs: [] as any[],
  similarPlaylists: [] as any[],
})

onMounted(() => fetchLyrics(songId.value))
watch(
  () => route.params.id,
  id => fetchLyrics(id as any)
)

const artistName = computed(() => {
  if (!state.info) return ''
  return Array.isArray(state.info?.ar)
    ? state.info.ar.map((a: any) => a.name).join(' / ')
    : state.info?.artists?.map((a: any) => a.name).join(' / ')
})

const albumName = computed(() => state.info?.al?.name || state.info?.album?.name || '')
const albumCover = computed(() => state.info?.al?.picUrl || state.info?.album?.picUrl || '')
const duration = computed(() => state.info?.dt || state.info?.duration || 0)

const playCurrent = () => {
  if (!state.info) return
  const song = {
    id: state.info.id,
    name: state.info.name,
    artist: artistName.value,
    album: albumName.value,
    duration: duration.value,
    cover: albumCover.value,
  }
  setPlaylist([song], 0)
  play(song, 0)
}

const isCurrent = computed(() => {
  if (!currentSong.value || !state.info) return false
  return String(state.info.id) === String(currentSong.value.id)
})

const loadInfo = async () => {
  try {
    const res: any = await songDetail({ ids: String(songId.value) })
    const song = Array.isArray(res?.songs) ? res.songs[0] : res?.songs
    state.info = song
    const artistNameVal = Array.isArray(song?.ar)
      ? song.ar.map((a: any) => a.name).join(' / ')
      : song?.artists?.map((a: any) => a.name).join(' / ')
    const resSimSongs: any = await search({ keywords: artistNameVal || song?.name || '', type: 1 })
    const listSongs: any[] = resSimSongs?.result?.songs || []
    state.similarSongs = (listSongs || []).slice(0, 12).map(s => ({
      id: s?.id,
      name: s?.name,
      artist: Array.isArray(s?.artists) ? s.artists.map((a: any) => a.name).join(' / ') : '',
      album: s?.album?.name || '',
      duration: s?.duration || 0,
      cover: s?.album.artist?.img1v1Url || '',
      mvId: s?.mvid,
    }))
    const resSimPls: any = await search({ keywords: song?.name || '', type: 1000 })
    const listPls: any[] = resSimPls?.result?.playlists || []
    state.similarPlaylists = (listPls || []).slice(0, 6)
  } catch {}
}

onMounted(() => loadInfo())
watch(songId, () => loadInfo())
</script>

<template>
  <div class="text-primary flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <div class="p-6">
        <div v-if="state.info" class="mb-8 flex gap-8">
          <div class="group relative h-72 w-72 shrink-0 overflow-hidden rounded-2xl shadow-2xl">
            <LazyImage
              :src="albumCover + '?param=300y300'"
              alt="封面"
              imgClass="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              wrapperClass="h-full w-full"
            />
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            >
              <button
                class="flex h-16 w-16 items-center justify-center rounded-full bg-pink-500/90 text-white shadow-lg transition-transform hover:scale-110"
                @click="playCurrent"
              >
                <span v-if="isCurrent && isPlaying" class="icon-[mdi--pause] h-8 w-8"></span>
                <span v-else class="icon-[mdi--play] h-8 w-8"></span>
              </button>
            </div>
          </div>

          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <h1 class="mb-4 text-4xl leading-tight font-bold">{{ state.info.name }}</h1>

            <div class="mb-6 flex flex-wrap items-center gap-3">
              <button
                class="glass-button inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/20"
                @click="
                  router.push(
                    `/artist/${(Array.isArray(state.info?.ar) ? state.info.ar[0]?.id : state.info?.artists?.[0]?.id) || ''}`
                  )
                "
              >
                <span class="icon-[mdi--account-music] h-5 w-5"></span>
                {{ artistName }}
              </button>
              <button
                v-if="state.info?.al?.id || state.info?.album?.id"
                class="glass-button inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/20"
                @click="router.push(`/album/${state.info?.al?.id || state.info?.album?.id}`)"
              >
                <span class="icon-[mdi--album] h-5 w-5"></span>
                {{ albumName }}
              </button>
              <span class="text-primary/60 text-sm">{{ formatDuration(duration) }}</span>
            </div>

            <div class="flex items-center gap-3">
              <button
                class="inline-flex items-center gap-2 rounded-full bg-pink-500 px-6 py-3 font-medium text-white shadow-lg transition-all hover:bg-pink-600 hover:shadow-xl"
                @click="playCurrent"
              >
                <span v-if="isCurrent && isPlaying" class="icon-[mdi--pause] h-5 w-5"></span>
                <span v-else class="icon-[mdi--play] h-5 w-5"></span>
                {{ isCurrent && isPlaying ? '暂停' : '播放' }}
              </button>
              <button
                class="glass-button inline-flex items-center gap-2 px-5 py-3 transition-colors hover:bg-white/20"
                @click="showComments = true"
              >
                <span class="icon-[mdi--comment-outline] h-5 w-5"></span>
                评论
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <div class="glass-card overflow-hidden rounded-2xl">
              <div class="border-b border-white/10 px-6 py-4">
                <h2 class="text-lg font-semibold">歌词</h2>
              </div>
              <div class="custom-scrollbar overflow-y-auto p-6">
                <div v-if="mergedLines.length" class="space-y-3">
                  <div
                    v-for="(m, i) in mergedLines"
                    :key="i"
                    class="rounded-xl p-3 transition-colors hover:bg-white/5"
                  >
                    <p class="text-primary text-base leading-relaxed">{{ m.ori }}</p>
                    <p v-if="m.tran" class="text-primary/70 mt-1 text-sm">{{ m.tran }}</p>
                    <p v-if="m.roma" class="text-primary/50 mt-1 text-xs italic">{{ m.roma }}</p>
                  </div>
                </div>
                <div v-else class="flex flex-col items-center justify-center py-12 text-center">
                  <span
                    class="icon-[mdi--text-box-remove-outline] text-primary/30 mb-3 h-12 w-12"
                  ></span>
                  <p class="text-primary/50">暂无歌词</p>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div v-if="state.similarSongs.length" class="glass-card overflow-hidden rounded-2xl">
              <div class="border-b border-white/10 px-6 py-4">
                <h2 class="text-lg font-semibold">相似歌曲</h2>
              </div>
              <div class="custom-scrollbar max-h-[400px] overflow-y-auto">
                <div
                  v-for="(song, index) in state.similarSongs"
                  :key="song.id"
                  class="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-white/10"
                  @click="router.push(`/song/${song.id}`)"
                >
                  <span class="text-primary/40 w-6 text-center text-sm">{{ index + 1 }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="text-primary truncate text-sm font-medium group-hover:text-pink-300">
                      {{ song.name }}
                    </p>
                    <p class="text-primary/60 truncate text-xs">{{ song.artist }}</p>
                  </div>
                  <span class="text-primary/40 text-xs">{{ formatDuration(song.duration) }}</span>
                </div>
              </div>
            </div>

            <div
              v-if="state.similarPlaylists.length"
              class="glass-card overflow-hidden rounded-2xl"
            >
              <div class="border-b border-white/10 px-6 py-4">
                <h2 class="text-lg font-semibold">相关歌单</h2>
              </div>
              <div class="grid grid-cols-2 gap-3 p-4">
                <router-link
                  v-for="pl in state.similarPlaylists"
                  :key="pl.id"
                  :to="`/playlist/${pl.id}`"
                  class="group overflow-hidden rounded-xl"
                >
                  <div class="relative aspect-square overflow-hidden rounded-lg">
                    <img
                      :src="pl.coverImgUrl + '?param=200y200'"
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div
                      class="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                    ></div>
                  </div>
                  <p
                    class="text-primary mt-2 truncate text-xs font-medium group-hover:text-pink-300"
                  >
                    {{ pl.name }}
                  </p>
                  <p class="text-primary/50 truncate text-xs">{{ pl.trackCount }} 首</p>
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <SongCommentsDialog v-model:show="showComments" :song-id="songId" />
  </div>
</template>
