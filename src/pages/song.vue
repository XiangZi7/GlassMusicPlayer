<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useLyrics } from '@/composables/useLyrics'
import SongCommentsDialog from '@/components/Comments/SongCommentsDialog.vue'
import { songDetail, search } from '@/api'

const route = useRoute()
const router = useRouter()
const songId = computed(() => route.params.id as string | number)
const { mergedLines, fetchLyrics } = useLyrics()
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

const loadInfo = async () => {
  try {
    const res: any = await songDetail({ ids: String(songId.value) })
    const song = Array.isArray(res?.songs) ? res.songs[0] : res?.songs
    state.info = song
    const artistName = Array.isArray(song?.ar)
      ? song.ar.map((a: any) => a.name).join(' / ')
      : song?.artists?.map((a: any) => a.name).join(' / ')
    const resSimSongs: any = await search({ keywords: artistName || song?.name || '', type: 1 })
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
    state.similarPlaylists = (listPls || []).slice(0, 8)
  } catch {}
}

onMounted(() => loadInfo())
watch(songId, () => loadInfo())
</script>

<template>
  <div class="flex-1 overflow-hidden text-primary">
    <div class="h-full overflow-auto p-6">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-bold">歌曲详情</h1>
        <button class="glass-button px-3 py-2 text-sm" @click="showComments = true">
          <span class="icon-[mdi--comment-outline] mr-2 h-5 w-5"></span> 查看评论
        </button>
      </div>
      <div v-if="state.info" class="mb-4 flex items-center gap-3">
        <button
          class="glass-button px-3 py-2 text-sm"
          @click="
            router.push(
              `/artist/${(Array.isArray(state.info?.ar) ? state.info.ar[0]?.name : state.info?.artists?.[0]?.name) || ''}`
            )
          "
        >
          <span class="icon-[mdi--account-music] mr-2 h-5 w-5"></span>
          {{
            Array.isArray(state.info?.ar)
              ? state.info.ar.map((a: any) => a.name).join(' / ')
              : state.info?.artists?.map((a: any) => a.name).join(' / ')
          }}
        </button>
        <button
          v-if="state.info?.al?.id || state.info?.album?.id"
          class="glass-button px-3 py-2 text-sm"
          @click="router.push(`/album/${state.info?.al?.id || state.info?.album?.id}`)"
        >
          <span class="icon-[mdi--album] mr-2 h-5 w-5"></span>
          {{ state.info?.al?.name || state.info?.album?.name }}
        </button>
      </div>
      <div class="glass-card p-6">
        <div class="space-y-4">
          <div v-for="(m, i) in mergedLines" :key="i" class="rounded-xl bg-white/5 p-3">
            <p class="text-primary">{{ m.ori }}</p>
            <p v-if="m.tran" class="text-primary/80">{{ m.tran }}</p>
            <p v-if="m.roma" class="text-primary/70">{{ m.roma }}</p>
          </div>
        </div>
      </div>
      <div class="mt-8" v-if="state.similarSongs.length">
        <h2 class="mb-3 text-lg font-semibold">相似歌曲</h2>
        <div class="grid grid-cols-1 gap-2">
          <SongList :songs="state.similarSongs" :current-playing-index="-1" />
        </div>
      </div>
      <div class="mt-8" v-if="state.similarPlaylists.length">
        <h2 class="mb-3 text-lg font-semibold">相似歌单</h2>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <router-link
            v-for="pl in state.similarPlaylists"
            :key="pl.id"
            :to="`/playlist/${pl.id}`"
            class="glass-card group p-3"
          >
            <div class="mb-2 h-64 w-full overflow-hidden rounded-lg">
              <img
                :src="pl.coverImgUrl + '?param=300y300'"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <p class="truncate text-sm">{{ pl.name }}</p>
            <p class="truncate text-xs text-primary/70">{{ pl.trackCount }} 首</p>
          </router-link>
        </div>
      </div>
    </div>
    <SongCommentsDialog v-model:show="showComments" :song-id="songId" />
  </div>
</template>
