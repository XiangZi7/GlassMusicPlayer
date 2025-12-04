<script setup lang="ts">
import { artistDetail, artistTopSong, artistAlbum } from '@/api'
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'
import { formatCount } from '@/utils/time'
const { t } = useI18n()
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
}

type SongItem = {
  id: number | string
  name: string
  artist: string
  album: string
  albumId: number | string
  duration: number
  liked: boolean
  cover: string
}

const state = reactive({
  info: {} as ArtistInfo,
  songs: [] as SongItem[],
  albums: [] as AlbumItem[],
  loading: true,
  activeTab: 0,
  followed: false,
})

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
      artistAlbum({ id, limit: 10 }),
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
      album: s?.al?.name || '',
      albumId: s?.al?.id || 0,
      duration: s?.dt ?? s?.duration ?? 0,
      liked: false,
      cover: s?.al?.picUrl || '',
    }))

    const albums = (albumsRes as any)?.hotAlbums || (albumsRes as any)?.data?.hotAlbums || []
    state.albums = albums.slice(0, 10).map((a: any) => ({
      id: a?.id || 0,
      name: a?.name || '',
      picUrl: a?.picUrl || '',
      publishTime: a?.publishTime ? formatDate(a.publishTime) : '',
      size: a?.size || 0,
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
  if (!state.songs.length) return
  setPlaylist(state.songs, 0)
  play(state.songs[0], 0)
}

const shufflePlay = () => {
  if (!state.songs.length) return
  const shuffled = [...state.songs].sort(() => Math.random() - 0.5)
  setPlaylist(shuffled, 0)
  play(shuffled[0], 0)
}

const toggleFollow = () => {
  state.followed = !state.followed
}

const goToAlbum = (id: number) => {
  router.push(`/album/${id}`)
}

const tabs = ['artistPage.tabs.hotSongs', 'artistPage.tabs.albums']
</script>

<template>
  <div class="artist-page flex flex-1 flex-col overflow-hidden">
    <div v-if="state.loading" class="flex-1 overflow-auto px-4 py-6">
      <PageSkeleton :sections="['hero', 'list']" :list-count="8" />
    </div>
    <template v-else>
      <div class="header-section relative">
        <div class="header-bg absolute inset-0 overflow-hidden">
          <LazyImage
            v-if="state.info.picUrl"
            :src="state.info.picUrl + '?param=400y400'"
            :alt="$t('components.songList.coverAlt')"
            imgClass="h-full w-full object-cover scale-110"
          />
          <div class="header-overlay absolute inset-0"></div>
        </div>

        <div class="header-content relative z-10 px-4 pt-6 pb-6">
          <div class="flex flex-col items-center">
            <div class="avatar-wrapper relative mb-4">
              <LazyImage
                v-if="state.info.picUrl"
                :src="state.info.picUrl + '?param=300y300'"
                :alt="$t('layout.aside.menu.artists')"
                imgClass="artist-avatar h-28 w-28 rounded-full object-cover"
              />
            </div>

            <h1 class="text-primary mb-1 text-xl font-bold">{{ state.info.name }}</h1>
            <p v-if="state.info.alias?.length" class="text-primary/50 mb-3 text-xs">
              {{ state.info.alias.join(' / ') }}
            </p>

            <div class="text-primary/70 mb-4 flex items-center gap-6 text-center text-xs">
              <div class="flex flex-col items-center">
                <span class="text-primary text-base font-semibold">{{ state.info.musicSize }}</span>
                <span>{{ $t('artistPage.stats.songs') }}</span>
              </div>
              <div class="flex flex-col items-center">
                <span class="text-primary text-base font-semibold">{{ state.info.albumSize }}</span>
                <span>{{ $t('artistPage.stats.albums') }}</span>
              </div>
              <div class="flex flex-col items-center">
                <span class="text-primary text-base font-semibold">{{ state.info.mvSize }}</span>
                <span>{{ $t('artistPage.stats.mvs') }}</span>
              </div>
              <div v-if="state.info.fansCount" class="flex flex-col items-center">
                <span class="text-primary text-base font-semibold">{{
                  formatCount(state.info.fansCount)
                }}</span>
                <span>{{ $t('artistPage.stats.fans') }}</span>
              </div>
            </div>

            <p
              v-if="state.info.briefDesc"
              class="text-primary/60 mb-4 line-clamp-2 max-w-xs text-center text-xs leading-relaxed"
            >
              {{ state.info.briefDesc }}
            </p>
          </div>
        </div>
      </div>

      <div class="action-bar flex items-center gap-3 px-4 py-3">
        <button
          class="play-all-btn text-primary flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium"
          @click="playAll"
        >
          <span class="icon-[mdi--play-circle] h-5 w-5"></span>
          {{ t('actions.playAll') }}
        </button>
        <button
          class="shuffle-btn flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium"
          @click="shufflePlay"
        >
          <span class="icon-[mdi--shuffle-variant] h-5 w-5"></span>
          {{ t('actions.shufflePlay') }}
        </button>
        <button
          class="follow-btn flex h-10 w-10 items-center justify-center rounded-full"
          :class="state.followed ? 'followed' : ''"
          @click="toggleFollow"
        >
          <span
            :class="state.followed ? 'icon-[mdi--account-check]' : 'icon-[mdi--account-plus]'"
            class="h-5 w-5"
          ></span>
        </button>
      </div>

      <div class="tabs-bar flex gap-1 px-4 pb-2">
        <button
          v-for="(tab, i) in tabs"
          :key="i"
          class="tab-btn rounded-full px-4 py-1.5 text-xs font-medium transition-all"
          :class="state.activeTab === i ? 'active' : ''"
          @click="state.activeTab = i"
        >
          {{ $t(tab) }}
        </button>
      </div>

      <div class="flex-1 overflow-auto px-4 pb-6">
        <section v-if="state.activeTab === 0">
          <MobileSongList :songs="state.songs" :show-index="true" />
        </section>

        <section v-else-if="state.activeTab === 1" class="albums-section">
          <div class="grid grid-cols-2 gap-3">
            <div
              v-for="album in state.albums"
              :key="album.id"
              class="album-card overflow-hidden rounded-2xl"
              @click="goToAlbum(album.id)"
            >
              <div class="relative aspect-square">
                <LazyImage
                  :src="album.picUrl + '?param=200y200'"
                  :alt="album.name"
                  imgClass="h-full w-full object-cover"
                />
                <div class="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
                <div class="absolute right-2 bottom-2 left-2">
                  <p class="text-primary truncate text-xs font-medium">{{ album.name }}</p>
                  <p class="text-primary/60 text-[10px]">
                    {{ album.publishTime }} · {{ $t('commonUnits.songsShort', album.size) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!state.albums.length" class="empty-text py-12 text-center">{{ $t('artistPage.albumsEmpty') }}</div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.header-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  backdrop-filter: blur(40px) saturate(1.5);
  -webkit-backdrop-filter: blur(40px) saturate(1.5);
}

.header-overlay {
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.3) 0%,
    rgba(0, 0, 0, 0.5) 50%,
    var(--glass-bg-base) 100%
  );
}

.avatar-wrapper {
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4));
}

.artist-avatar {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 3px solid rgba(255, 255, 255, 0.2);
}

.play-all-btn {
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  box-shadow: 0 4px 16px rgba(236, 72, 153, 0.35);
  transition: all 0.3s ease;
}

.play-all-btn:active {
  transform: scale(0.97);
  box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3);
}

.shuffle-btn {
  background: var(--glass-bg-card);
  color: var(--glass-text);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
}

.shuffle-btn:active {
  transform: scale(0.97);
  background: var(--glass-hover-item-bg);
}

.follow-btn {
  background: var(--glass-bg-card);
  color: var(--glass-text);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
}

.follow-btn:active {
  transform: scale(0.95);
}

.follow-btn.followed {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
  border-color: rgba(236, 72, 153, 0.3);
  color: #ec4899;
}

.tabs-bar {
  border-bottom: 1px solid var(--glass-border);
}

.tab-btn {
  color: var(--glass-text);
  opacity: 0.6;
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
  color: #ec4899;
  opacity: 1;
}

.album-card {
  background: var(--glass-bg-card);
  border: 1px solid var(--glass-border);
  transition: all 0.2s ease;
}

.album-card:active {
  transform: scale(0.98);
  background: var(--glass-hover-item-bg);
}

.empty-text {
  color: var(--glass-text);
  opacity: 0.4;
}
</style>
