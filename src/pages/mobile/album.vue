<script setup lang="ts">
import { albumDetail } from '@/api'
import { useAudio } from '@/composables/useAudio'
import LazyImage from '@/components/Ui/LazyImage.vue'
import MobileSongList from '@/components/Mobile/MobileSongList.vue'
import Button from '@/components/Ui/Button.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const albumId = computed(() => Number(route.params.id))

type AlbumInfo = {
  name: string
  artist: string
  artistId: number
  publishTime: string
  description: string
  company: string
  songCount: number
  coverImgUrl: string
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
  info: {} as AlbumInfo,
  songs: [] as SongItem[],
  loading: true,
  collected: false,
  showFullDesc: false,
})

const { setPlaylist, play } = useAudio()

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const load = async (id: number) => {
  state.loading = true
  try {
    const res = await albumDetail({ id })
    const album = (res as any)?.album || (res as any)?.data?.album || {}
    const songs = (res as any)?.songs || (res as any)?.data?.songs || []

    state.info = {
      name: album?.name || '',
      artist: album?.artist?.name || '',
      artistId: album?.artist?.id || 0,
      publishTime: album?.publishTime ? formatDate(album.publishTime) : '',
      description: album?.description || '',
      company: album?.company || '',
      songCount: album?.size || songs.length || 0,
      coverImgUrl: album?.picUrl || '',
    }

    if (Array.isArray(songs)) {
      state.songs = songs.map((s: any) => ({
        id: s?.id || 0,
        name: s?.name || '',
        artist: Array.isArray(s?.ar)
          ? s.ar.map((a: any) => a.name).join(' / ')
          : Array.isArray(s?.artists)
            ? s.artists.map((a: any) => a.name).join(' / ')
            : state.info.artist,
        album: state.info.name,
        albumId: id,
        duration: s?.dt ?? s?.duration ?? 0,
        liked: false,
        cover: state.info.coverImgUrl,
      }))
    }
  } finally {
    state.loading = false
  }
}

watch(
  albumId,
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

const toggleCollect = () => {
  state.collected = !state.collected
}

const goToArtist = () => {
  if (state.info.artistId) {
    router.push(`/artist/${state.info.artistId}`)
  }
}
</script>

<template>
  <div class="album-page flex flex-1 flex-col overflow-hidden">
    <div v-if="state.loading" class="flex-1 overflow-auto px-4 py-6">
      <PageSkeleton :sections="['hero', 'list']" :list-count="8" />
    </div>
    <template v-else>
      <div class="header-section relative">
        <div class="header-bg absolute inset-0 overflow-hidden">
          <LazyImage
            v-if="state.info.coverImgUrl"
            :src="state.info.coverImgUrl + '?param=400y400'"
            :alt="$t('components.songList.coverAlt')"
            imgClass="h-full w-full object-cover scale-110"
          />
          <div class="header-overlay absolute inset-0"></div>
        </div>

        <div class="header-content relative z-10 px-4 pt-4 pb-6">
          <div class="flex gap-4">
            <div class="cover-wrapper relative shrink-0">
              <LazyImage
                v-if="state.info.coverImgUrl"
                :src="state.info.coverImgUrl + '?param=300y300'"
                :alt="$t('components.songList.coverAlt')"
                imgClass="cover-image h-32 w-32 rounded-2xl object-cover"
              />
            </div>

            <div class="flex min-w-0 flex-1 flex-col justify-between py-1">
              <div>
                <h1 class="mb-2 line-clamp-2 text-lg leading-tight font-bold text-accent">
                  {{ state.info.name || t('albumPage.fallbackTitle') }}
                </h1>
                <div class="artist-info flex items-center gap-2" @click="goToArtist">
                  <span class="text-xs text-accent/70">{{ state.info.artist }}</span>
                  <span class="icon-[mdi--chevron-right] h-4 w-4 text-accent/60"></span>
                </div>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-accent/60">
                <span class="flex items-center gap-1">
                  <span class="icon-[mdi--music-note] h-3.5 w-3.5"></span>
                  {{ $t('commonUnits.songsShort', state.info.songCount) }}
                </span>
                <span v-if="state.info.publishTime" class="flex items-center gap-1">
                  <span class="icon-[mdi--calendar] h-3.5 w-3.5"></span>
                  {{ state.info.publishTime }}
                </span>
                <span v-if="state.info.company" class="flex items-center gap-1">
                  <span class="icon-[mdi--domain] h-3.5 w-3.5"></span>
                  {{ state.info.company }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="state.info.description"
            class="desc-section mt-4"
            @click="state.showFullDesc = !state.showFullDesc"
          >
            <p
              class="text-xs leading-relaxed text-accent/60"
              :class="state.showFullDesc ? '' : 'line-clamp-2'"
            >
              {{ state.info.description }}
            </p>
            <span class="mt-1 inline-flex items-center text-[10px] text-accent/60">
              {{ state.showFullDesc ? t('common.collapse') : t('common.expand') }}
              <span
                :class="state.showFullDesc ? 'icon-[mdi--chevron-up]' : 'icon-[mdi--chevron-down]'"
                class="h-3 w-3"
              ></span>
            </span>
          </div>
        </div>
      </div>

      <div class="action-bar flex items-center gap-3 px-4 py-3">
        <Button
          variant="gradient"
          size="md"
          rounded="full"
          class="play-all-btn flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium"
          icon="icon-[mdi--play-circle]"
          icon-class="h-5 w-5"
          @click="playAll"
        >
          {{ t('actions.playAll') }}
        </Button>
        <Button
          variant="glass"
          size="md"
          rounded="full"
          class="shuffle-btn flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium"
          icon="icon-[mdi--shuffle-variant]"
          icon-class="h-5 w-5"
          @click="shufflePlay"
        >
          {{ t('actions.shufflePlay') }}
        </Button>
        <Button
          variant="glass"
          size="icon-lg"
          rounded="full"
          class="collect-btn"
          :class="state.collected ? 'collected' : ''"
          :icon="state.collected ? 'icon-[mdi--heart]' : 'icon-[mdi--heart-outline]'"
          icon-class="h-5 w-5"
          @click="toggleCollect"
        />
      </div>

      <div class="flex-1 overflow-auto px-4 pb-6">
        <section>
          <MobileSongList :songs="state.songs" :show-index="true" />
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

.cover-wrapper {
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4));
}

.cover-image {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.artist-info {
  cursor: pointer;
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

.collect-btn {
  background: var(--glass-bg-card);
  color: var(--glass-text);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
}

.collect-btn:active {
  transform: scale(0.95);
}

.collect-btn.collected {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
  border-color: rgba(236, 72, 153, 0.3);
  color: #ec4899;
}

.desc-section {
  cursor: pointer;
}
</style>
