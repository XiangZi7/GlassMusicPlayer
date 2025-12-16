<script setup lang="ts">
import { artistDetail, artistTopSong, artistAlbum } from '@/api'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import { formatCount } from '@/utils/time'
import { useI18n } from 'vue-i18n'
import TabGroup from '@/components/Ui/TabGroup.vue'
import Button from '@/components/Ui/Button.vue'
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
  activeTab: 'songs' as 'songs' | 'albums',
})

const { activeTab } = toRefs(state)

const { setPlaylist, play } = useAudio()

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
      artists: Array.isArray(s?.ar)
        ? s.ar.map((a: any) => ({ id: a.id, name: a.name }))
        : [{ id: state.info.id, name: state.info.name }],
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

const tabs = computed(() => [
  {
    key: 'songs',
    labelKey: 'artistPage.tabs.hotSongs',
    icon: 'icon-[mdi--music-note]',
    count: state.songs.length,
  },
  {
    key: 'albums',
    labelKey: 'artistPage.tabs.albums',
    icon: 'icon-[mdi--album]',
    count: state.albums.length,
  },
])
</script>

<template>
  <div class="text-primary flex-1 overflow-hidden px-4">
    <div class="h-full overflow-auto">
      <PageSkeleton v-if="state.loading" :sections="['hero', 'list']" :list-count="12" />
      <template v-else>
        <section class="relative mb-8 flex shrink-0">
          <div class="absolute inset-0 overflow-hidden">
            <img
              v-if="state.info.picUrl"
              :src="state.info.picUrl + '?param=800y800'"
              class="h-full w-full scale-110 object-cover opacity-20 blur-2xl"
            />
            <div
              v-else
              class="h-full w-full bg-linear-to-br from-pink-500/30 to-purple-600/30"
            ></div>
          </div>

          <div class="absolute inset-0">
            <div class="floating-notes">
              <div v-for="i in 6" :key="i" class="note" :style="{ animationDelay: i * 1.2 + 's' }">
                {{ ['🎵', '🎶', '♪', '♫', '🎼', '🎤'][i - 1] }}
              </div>
            </div>
          </div>

          <div class="relative z-10 w-full p-8">
            <div class="flex flex-col items-start gap-8 lg:flex-row lg:items-center">
              <div class="shrink-0">
                <div class="group relative">
                  <div
                    class="h-48 w-48 overflow-hidden rounded-full ring-4 ring-white/20 transition-all group-hover:ring-pink-500/40"
                  >
                    <img
                      v-if="state.info.picUrl"
                      :src="state.info.picUrl + '?param=400y400'"
                      class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      :alt="$t('layout.aside.menu.artists')"
                    />
                    <div
                      v-else
                      class="flex h-full w-full items-center justify-center bg-linear-to-br from-pink-400 to-purple-500"
                    >
                      <span class="icon-[mdi--account-music] h-20 w-20"></span>
                    </div>
                  </div>
                  <div
                    class="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100"
                  >
                    <Button
                      variant="ghost"
                      size="icon-md"
                      rounded="full"
                      icon="icon-[mdi--play]"
                      icon-class="h-8 w-8 text-white"
                      @click="playAll"
                      class="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform hover:scale-110"
                    >
                    </Button>
                  </div>
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <h1 class="animate-fade-in-up mb-2 text-4xl font-bold lg:text-5xl">
                  {{ state.info.name }}
                </h1>
                <p
                  v-if="state.info.alias?.length"
                  class="animate-fade-in-up text-primary/60 mb-4 text-lg"
                  style="animation-delay: 0.1s"
                >
                  {{ state.info.alias.join(' / ') }}
                </p>

                <div
                  class="animate-fade-in-up mb-6 flex flex-wrap items-center gap-4"
                  style="animation-delay: 0.2s"
                >
                  <div
                    class="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm"
                  >
                    <span class="icon-[mdi--music-note] h-5 w-5 text-pink-400"></span>
                    <span class="text-sm"
                      >{{ state.info.musicSize }} {{ $t('artistPage.stats.songs') }}</span
                    >
                  </div>
                  <div
                    class="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm"
                  >
                    <span class="icon-[mdi--album] h-5 w-5 text-purple-400"></span>
                    <span class="text-sm"
                      >{{ state.info.albumSize }} {{ $t('artistPage.stats.albums') }}</span
                    >
                  </div>
                  <div
                    class="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm"
                  >
                    <span class="icon-[mdi--video] h-5 w-5 text-blue-400"></span>
                    <span class="text-sm"
                      >{{ state.info.mvSize }} {{ $t('artistPage.stats.mvs') }}</span
                    >
                  </div>
                  <div
                    v-if="state.info.fansCount"
                    class="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm"
                  >
                    <span class="icon-[mdi--account-group] h-5 w-5 text-rose-400"></span>
                    <span class="text-sm"
                      >{{ formatCount(state.info.fansCount) }}
                      {{ $t('artistPage.stats.fans') }}</span
                    >
                  </div>
                </div>

                <div
                  class="animate-fade-in-up flex flex-wrap items-center gap-3"
                  style="animation-delay: 0.3s"
                >
                  <Button
                    variant="solid"
                    size="md"
                    rounded="full"
                    class="gap-2 px-6 shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/30"
                    @click="playAll"
                  >
                    <span class="icon-[mdi--play] h-5 w-5"></span>
                    {{ $t('artistPage.playTop') }}
                  </Button>
                  <Button
                    variant="soft"
                    size="md"
                    rounded="full"
                    class="gap-2"
                    @click="shufflePlay"
                  >
                    <span class="icon-[mdi--shuffle] h-4 w-4"></span>
                    {{ $t('actions.shufflePlay') }}
                  </Button>
                  <Button
                    variant="soft"
                    size="md"
                    rounded="full"
                    class="gap-2"
                    :class="state.followed ? 'bg-pink-500/20! text-pink-400!' : ''"
                    @click="toggleFollow"
                  >
                    <span
                      :class="state.followed ? 'icon-[mdi--heart]' : 'icon-[mdi--heart-outline]'"
                      class="h-4 w-4"
                    ></span>
                    {{ state.followed ? $t('common.followed') : $t('common.follow') }}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="pb-8">
          <div v-if="state.info.briefDesc" class="glass-card mb-6 p-5">
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span class="icon-[mdi--information-outline] h-4 w-4 text-pink-400"></span>
              {{ $t('artistPage.bioTitle') }}
            </h3>
            <p class="text-primary/70 line-clamp-3 text-sm leading-relaxed">
              {{ state.info.briefDesc }}
            </p>
          </div>

          <div class="mb-6">
            <TabGroup
              v-model="state.activeTab"
              :tabs="tabs"
              size="md"
              @click="val => (activeTab = val as 'songs' | 'albums')"
            />
          </div>

          <div v-show="state.activeTab === 'songs'" class="animate-fade-in">
            <SongList :songs="state.songs" :current-playing-index="-1" :show-header="true" />
          </div>

          <div v-show="state.activeTab === 'albums'" class="animate-fade-in">
            <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              <div
                v-for="al in state.albums"
                :key="al.id"
                class="glass-card group cursor-pointer overflow-hidden p-3 transition-all hover:bg-white/10"
                @click="router.push(`/album/${al.id}`)"
              >
                <div class="relative mb-3 aspect-square w-full overflow-hidden rounded-xl">
                  <img
                    :src="al.picUrl + '?param=400y400'"
                    class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div
                    class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
                  >
                    <span class="icon-[mdi--play-circle] h-12 w-12 text-white"></span>
                  </div>
                </div>
                <p class="truncate text-sm font-medium">{{ al.name }}</p>
                <p class="text-primary/50 mt-1 truncate text-xs">
                  {{ al.publishTime }} · {{ $t('commonUnits.songsShort', al.size) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes noteFloat {
  0% {
    transform: translateY(100%) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-100px) rotate(360deg);
    opacity: 0;
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out forwards;
}

.animate-fade-in {
  animation: fadeInUp 0.3s ease-out;
}

.floating-notes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.note {
  position: absolute;
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.15);
  animation: noteFloat 15s linear infinite;
}

.note:nth-child(1) {
  left: 5%;
  animation-duration: 14s;
}
.note:nth-child(2) {
  left: 20%;
  animation-duration: 16s;
}
.note:nth-child(3) {
  left: 40%;
  animation-duration: 12s;
}
.note:nth-child(4) {
  left: 60%;
  animation-duration: 18s;
}
.note:nth-child(5) {
  left: 75%;
  animation-duration: 13s;
}
.note:nth-child(6) {
  left: 90%;
  animation-duration: 15s;
}
</style>
