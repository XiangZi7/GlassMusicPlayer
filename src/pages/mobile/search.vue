<script setup lang="ts">
import { cloudSearch, searchSuggest, searchDefault } from '@/api'
import LazyImage from '@/components/Ui/LazyImage.vue'
import Pagination from '@/components/Ui/Pagination.vue'
import { Song } from '@/stores/interface'
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectCreative } from 'swiper/modules'
import Button from '@/components/Ui/Button.vue'
import 'swiper/css'
import 'swiper/css/effect-creative'

const creativeEffect = {
  prev: {
    shadow: false,
    translate: ['-20px', 0, 0],
    opacity: 0,
  },
  next: {
    translate: ['20px', 0, 0],
    opacity: 0,
  },
}

type SearchTab = 'song' | 'playlist' | 'mv'
type PlaylistItem = {
  id: number | string
  name: string
  coverImgUrl: string
  trackCount: number
}
type MVItem = { id: number | string; name: string; cover: string; artist: string }

const { t } = useI18n()
const { setPlaylist, play, currentSong } = useAudio()

interface MobileSearchState {
  q: string
  placeholder: string
  tab: SearchTab
  suggest: string[]
  loading: boolean
  suggestVisible: boolean
  songs: Song[]
  songPage: number
  songPageSize: number
  songTotal: number
  playlists: PlaylistItem[]
  playlistPage: number
  playlistPageSize: number
  playlistTotal: number
  mvs: MVItem[]
  mvPage: number
  mvPageSize: number
  mvTotal: number
}
const state = reactive<MobileSearchState>({
  q: '',
  placeholder: '',
  tab: 'song',
  suggest: [],
  loading: false,
  suggestVisible: false,
  songs: [],
  songPage: 1,
  songPageSize: 20,
  songTotal: 0,
  playlists: [],
  playlistPage: 1,
  playlistPageSize: 12,
  playlistTotal: 0,
  mvs: [],
  mvPage: 1,
  mvPageSize: 12,
  mvTotal: 0,
})
const {
  q,
  placeholder,
  tab,
  suggest,
  loading,
  suggestVisible,
  songs,
  songPage,
  songPageSize,
  songTotal,
  playlists,
  playlistPage,
  playlistPageSize,
  playlistTotal,
  mvs,
  mvPage,
  mvPageSize,
  mvTotal,
} = toRefs(state)

const fetchDefault = async () => {
  const res = await searchDefault()
  const def = (res as any)?.data?.realkeyword || (res as any)?.data?.showKeyword || ''
  state.placeholder = def || ''
}

const fetchSuggest = async () => {
  if (!state.q.trim()) return (state.suggest = [])
  const res = await searchSuggest({ keywords: state.q, type: 'mobile' })
  const list = (res as any)?.result?.allMatch || []
  state.suggest = list.map((i: any) => i.keyword).slice(0, 8)
}

const fetchSongs = async () => {
  if (!state.q.trim()) return
  const res: any = await cloudSearch({
    keywords: state.q,
    type: 1,
    limit: state.songPageSize,
    offset: (state.songPage - 1) * state.songPageSize,
  })
  const songs = res?.result?.songs || []
  state.songs = songs.map((s: any) => ({
    id: s?.id || 0,
    name: s?.name || '',
    artist: Array.isArray(s?.ar)
      ? s.ar.map((a: any) => a.name).join(' / ')
      : Array.isArray(s?.artists)
        ? s.artists.map((a: any) => a.name).join(' / ')
        : '',
    album: s?.al?.name || s?.album?.name || '',
    duration: s?.dt ?? s?.duration ?? 0,
    cover: s?.al?.picUrl || s?.album?.picUrl || '',
  }))
  state.songTotal = Number(res?.result?.songCount ?? state.songs.length)
}

const fetchPlaylists = async () => {
  if (!state.q.trim()) return
  const res: any = await cloudSearch({
    keywords: state.q,
    type: 1000,
    limit: state.playlistPageSize,
    offset: (state.playlistPage - 1) * state.playlistPageSize,
  })
  const playlists = res?.result?.playlists || []
  state.playlists = playlists.map((p: any) => ({
    id: p?.id || 0,
    name: p?.name || '',
    coverImgUrl: p?.coverImgUrl || '',
    trackCount: p?.trackCount || 0,
  }))
  state.playlistTotal = Number(res?.result?.playlistCount ?? state.playlists.length)
}

const fetchMVs = async () => {
  if (!state.q.trim()) return
  const res: any = await cloudSearch({
    keywords: state.q,
    type: 1004,
    limit: state.mvPageSize,
    offset: (state.mvPage - 1) * state.mvPageSize,
  })
  const mvs = res?.result?.mvs || []
  state.mvs = mvs.map((m: any) => ({
    id: m?.id || 0,
    name: m?.name || '',
    cover: m?.cover || m?.imgurl || '',
    artist: m?.artistName || '',
  }))
  state.mvTotal = Number(res?.result?.mvCount ?? res?.result?.songCount ?? state.mvs.length)
}

const searchAll = async () => {
  if (!state.q.trim()) return
  state.loading = true
  try {
    await Promise.all([fetchSongs(), fetchPlaylists(), fetchMVs()])
  } finally {
    state.loading = false
  }
}

onMounted(async () => {
  await fetchDefault()
  await searchAll()
  document.addEventListener('click', handleDocClick)
})

watch(() => state.q, fetchSuggest)
watch(
  () => state.songPage,
  () => {
    fetchSongs()
  }
)
watch(
  () => state.playlistPage,
  () => {
    fetchPlaylists()
  }
)
watch(
  () => state.mvPage,
  () => {
    fetchMVs()
  }
)

const handleSuggestClick = (s: string) => {
  state.q = s
  state.songPage = 1
  state.playlistPage = 1
  state.mvPage = 1
  state.suggestVisible = false
  searchAll()
}

const clearQuery = () => {
  state.q = ''
  state.suggest = []
  state.suggestVisible = false
}

const inputRef = useTemplateRef('inputRef')
const handleSearchClick = () => {
  if (!state.q.trim()) state.q = state.placeholder || ''
  state.songPage = 1
  state.playlistPage = 1
  state.mvPage = 1
  searchAll()
  state.suggestVisible = false
  inputRef.value?.blur()
}

const searchBoxRef = ref<HTMLElement | null>(null)
const handleInputFocus = () => {
  state.suggestVisible = true
}
const handleDocClick = (e: MouseEvent) => {
  const el = searchBoxRef.value
  const target = e.target as Node | null
  if (el && target && !el.contains(target)) state.suggestVisible = false
}
onUnmounted(() => {
  document.removeEventListener('click', handleDocClick)
})

const mapToStoreSong = (s: Song): Song => ({
  id: s.id,
  name: s.name,
  artist: s.artist,
  album: s.album,
  duration: s.duration,
  cover: s.cover,
})

const playSong = (s: Song, index: number) => {
  const list: Song[] = state.songs.map(mapToStoreSong)
  setPlaylist(list, index)
  play(list[index], index)
}

const isCurrent = (s: Song) => {
  const cur = currentSong.value
  if (!cur) return false
  return String(s.id) === String(cur.id)
}

const playAllSongs = () => {
  if (!state.songs.length) return
  const list: Song[] = state.songs.map(mapToStoreSong)
  setPlaylist(list, 0)
  play(list[0], 0)
}

const tabs = computed(() => [
  { key: 'song' as const, icon: 'icon-[mdi--music-circle]', label: t('search.tabs.song') },
  {
    key: 'playlist' as const,
    icon: 'icon-[mdi--playlist-music]',
    label: t('search.tabs.playlist'),
  },
  { key: 'mv' as const, icon: 'icon-[mdi--video]', label: 'MV' },
])

const swiperInstance = ref<any>(null)
const onSwiper = (swiper: any) => {
  swiperInstance.value = swiper
}
const onSlideChange = (swiper: any) => {
  const tabKey = tabs.value[swiper.activeIndex]?.key
  if (tabKey) state.tab = tabKey
}
watch(
  () => state.tab,
  val => {
    const index = tabs.value.findIndex(t => t.key === val)
    if (index >= 0 && swiperInstance.value) {
      swiperInstance.value.slideTo(index)
    }
  }
)
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <div class="shrink-0 px-4 pb-3">
      <div ref="searchBoxRef" class="relative">
        <div class="glass-card flex items-center gap-2 px-3 py-2.5">
          <span class="icon-[mdi--magnify] search-icon h-5 w-5 shrink-0"></span>
          <input
            ref="inputRef"
            v-model="q"
            @keyup.enter="handleSearchClick"
            @focus="handleInputFocus"
            type="text"
            :placeholder="placeholder || $t('common.search.placeholder')"
            class="search-input min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <Button
            v-if="q"
            variant="ghost"
            size="none"
            class="clear-btn flex h-7 w-7 items-center justify-center rounded-full transition-all"
            icon="mdi--close-circle"
            icon-class="h-4 w-4"
            :title="$t('common.clear')"
            @click="clearQuery"
          />
          <Button
            variant="gradient"
            size="none"
            class="search-btn text-white flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-all active:scale-95"
            icon="mdi--magnify"
            icon-class="h-4 w-4"
            @click="handleSearchClick"
          >
            {{ $t('common.search.label') }}
          </Button>
        </div>

        <Transition name="dropdown">
          <div
            v-if="suggestVisible && suggest.length"
            class="suggest-dropdown absolute top-full right-0 left-0 z-20 mt-2 rounded-2xl p-3"
          >
            <p class="suggest-title mb-2 px-1 text-[10px] font-medium tracking-wider uppercase">
              {{ $t('common.search.suggest') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="s in suggest"
                :key="s"
                variant="ghost"
                size="none"
                class="suggest-tag rounded-full px-3 py-1.5 text-xs transition-all active:scale-95"
                @click="handleSuggestClick(s)"
              >
                {{ s }}
              </Button>
            </div>
          </div>
        </Transition>
      </div>

      <div class="glass-card mt-3 inline-flex w-full gap-1.5 p-1.5">
        <Button
          v-for="tabItem in tabs"
          :key="tabItem.key"
          variant="ghost"
          size="none"
          class="tab-button flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-300"
          :class="tab === tabItem.key ? 'tab-button-active' : ''"
          :icon="tabItem.icon"
          icon-class="h-4 w-4"
          @click="state.tab = tabItem.key"
        >
          <span>{{ tabItem.label }}</span>
        </Button>
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <div v-if="loading" class="h-full overflow-auto px-4 py-6">
        <PageSkeleton :sections="['list']" :list-count="10" />
      </div>

      <swiper
        v-else
        class="h-full w-full"
        :initial-slide="0"
        :modules="[EffectCreative]"
        effect="creative"
        :creative-effect="creativeEffect"
        :speed="500"
        @swiper="onSwiper"
        @slideChange="onSlideChange"
      >
        <!-- Songs Slide -->
        <swiper-slide>
          <div class="h-full w-full space-y-3 overflow-auto px-4 pb-6">
            <div v-if="songs.length > 0" class="flex items-center justify-between py-2">
              <p class="info-text text-xs">
                {{ t('search.result', { count: songTotal }) }}
              </p>
              <Button
                variant="gradient"
                size="none"
                class="play-all-button text-white flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium shadow-lg transition-all duration-200 active:scale-95"
                icon="mdi--play"
                icon-class="h-4 w-4"
                @click="playAllSongs"
              >
                {{ t('actions.playAll') }}
              </Button>
            </div>

            <div v-if="songs.length === 0" class="empty-state flex flex-col items-center py-16">
              <div class="empty-icon mb-4 flex h-20 w-20 items-center justify-center rounded-full">
                <span class="icon-[mdi--music-note-off] h-10 w-10 opacity-40" />
              </div>
              <p class="empty-title text-sm font-medium">{{ t('search.empty') }}</p>
            </div>

            <MobileSongList v-else :songs="songs" variant="compact" :show-index="true" />

            <Pagination
              v-if="songTotal > songPageSize"
              v-model="songPage"
              :total="songTotal"
              :page-size="songPageSize"
            />
          </div>
        </swiper-slide>

        <!-- Playlists Slide -->
        <swiper-slide>
          <div class="h-full w-full space-y-3 overflow-auto px-4 pb-6">
            <div v-if="playlists.length > 0" class="py-2">
              <p class="info-text text-xs">
                {{ t('search.result', { count: playlistTotal }) }}
              </p>
            </div>

            <div v-if="playlists.length === 0" class="empty-state flex flex-col items-center py-16">
              <div class="empty-icon mb-4 flex h-20 w-20 items-center justify-center rounded-full">
                <span class="icon-[mdi--playlist-remove] h-10 w-10 opacity-40" />
              </div>
              <p class="empty-title text-sm font-medium">{{ t('search.empty') }}</p>
            </div>

            <div v-else class="grid grid-cols-2 gap-4">
              <router-link
                v-for="p in playlists"
                :key="p.id"
                :to="`/playlist/${p.id}`"
                class="playlist-card group"
              >
                <div class="playlist-cover relative mb-3 aspect-square overflow-hidden rounded-2xl">
                  <LazyImage
                    :src="p.coverImgUrl + '?param=300y300'"
                    :alt="p.name"
                    imgClass="h-full w-full object-cover transition-all duration-500 group-active:scale-110"
                  />
                  <div class="playlist-cover-overlay absolute inset-0"></div>
                  <div
                    class="bg-overlay/50 text-primary/90 absolute top-2 right-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium backdrop-blur-md"
                  >
                    <span class="icon-[mdi--music-note] h-3 w-3"></span>
                    {{ p.trackCount }}
                  </div>
                  <div
                    class="playlist-play-btn absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all duration-300"
                  >
                    <span class="icon-[mdi--play] text-primary h-5 w-5"></span>
                  </div>
                </div>
                <p class="playlist-name line-clamp-2 px-1 text-[13px] leading-snug font-medium">
                  {{ p.name }}
                </p>
              </router-link>
            </div>

            <Pagination
              v-if="playlistTotal > playlistPageSize"
              v-model="playlistPage"
              :total="playlistTotal"
              :page-size="playlistPageSize"
            />
          </div>
        </swiper-slide>

        <!-- MVs Slide -->
        <swiper-slide>
          <div class="h-full w-full space-y-3 overflow-auto px-4 pb-6">
            <div v-if="mvs.length > 0" class="py-2">
              <p class="info-text text-xs">
                {{ t('search.result', { count: mvTotal }) }}
              </p>
            </div>

            <div v-if="mvs.length === 0" class="empty-state flex flex-col items-center py-16">
              <div class="empty-icon mb-4 flex h-20 w-20 items-center justify-center rounded-full">
                <span class="icon-[mdi--video-off] h-10 w-10 opacity-40" />
              </div>
              <p class="empty-title text-sm font-medium">{{ t('search.empty') }}</p>
            </div>

            <div v-else class="grid grid-cols-1 gap-4">
              <router-link
                v-for="m in mvs"
                :key="m.id"
                :to="`/mv-player/${m.id}`"
                class="mv-card group"
              >
                <div class="mv-cover relative aspect-video overflow-hidden rounded-2xl">
                  <LazyImage
                    :src="m.cover + '?param=480y270'"
                    :alt="m.name"
                    imgClass="h-full w-full object-cover transition-all duration-500 group-active:scale-105"
                  />
                  <div class="mv-cover-overlay absolute inset-0"></div>
                  <div
                    class="mv-play-btn absolute top-1/2 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-xl transition-all duration-300"
                  >
                    <span class="icon-[mdi--play] text-primary h-7 w-7"></span>
                  </div>
                  <div class="absolute right-0 bottom-0 left-0 p-3">
                    <p class="mv-title text-primary truncate text-sm font-semibold">{{ m.name }}</p>
                    <p class="mv-artist text-primary/70 mt-0.5 truncate text-xs">{{ m.artist }}</p>
                  </div>
                  <div
                    class="bg-overlay/50 text-primary/90 absolute top-2 left-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium backdrop-blur-md"
                  >
                    <span class="icon-[mdi--video] h-3 w-3"></span>
                    MV
                  </div>
                </div>
              </router-link>
            </div>

            <Pagination
              v-if="mvTotal > mvPageSize"
              v-model="mvPage"
              :total="mvTotal"
              :page-size="mvPageSize"
            />
          </div>
        </swiper-slide>
      </swiper>
    </div>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.search-icon {
  color: var(--glass-text);
  opacity: 0.5;
}

.search-input {
  color: var(--glass-text);
}

.search-input::placeholder {
  color: var(--glass-text);
  opacity: 0.4;
}

.clear-btn {
  color: var(--glass-text);
  opacity: 0.4;
}

.clear-btn:active {
  opacity: 0.7;
  background: var(--glass-hover-item-bg);
}

.search-btn {
  background: linear-gradient(to right, #ec4899, #8b5cf6);
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
}

.suggest-dropdown {
  background: var(--glass-dropdown-bg);
  border: 1px solid var(--glass-dropdown-border);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.suggest-title {
  color: var(--glass-text);
  opacity: 0.4;
}

.suggest-tag {
  background: var(--glass-hover-item-bg);
  color: var(--glass-text);
  opacity: 0.8;
}

.suggest-tag:active {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
  opacity: 1;
}

.tab-button {
  color: var(--glass-text);
  opacity: 0.6;
}

.tab-button-active {
  background: linear-gradient(to right, #ec4899, #8b5cf6);
  color: white;
  opacity: 1;
  box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);
}

.info-text {
  color: var(--glass-text);
  opacity: 0.5;
}

.play-all-button {
  background: linear-gradient(to right, #ec4899, #8b5cf6);
  box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);
}

.play-all-button:active {
  box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3);
}

.empty-icon {
  background: linear-gradient(to bottom right, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15));
}

:root.dark .empty-icon,
html.dark .empty-icon {
  background: linear-gradient(to bottom right, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
}

.empty-title {
  color: var(--glass-text);
  opacity: 0.6;
}

.song-item:not(.song-item-active):active {
  background: var(--glass-hover-item-bg);
}

.song-item-active {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
}

:root.dark .song-item-active,
html.dark .song-item-active {
  background: linear-gradient(to right, rgba(236, 72, 153, 0.25), rgba(139, 92, 246, 0.25));
}

.song-index {
  color: var(--glass-text);
  opacity: 0.3;
}

.song-cover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:root.dark .song-cover,
html.dark .song-cover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.song-name {
  color: var(--glass-text);
}

.song-artist {
  color: var(--glass-text);
  opacity: 0.5;
}

.song-duration {
  color: var(--glass-text);
  opacity: 0.3;
}

.playlist-card {
  transition: transform 0.3s ease;
}

.playlist-card:active {
  transform: scale(0.97);
}

.playlist-cover {
  box-shadow:
    0 8px 24px -4px rgba(0, 0, 0, 0.15),
    0 4px 8px -2px rgba(0, 0, 0, 0.08);
}

:root.dark .playlist-cover,
html.dark .playlist-cover {
  box-shadow:
    0 8px 24px -4px rgba(0, 0, 0, 0.4),
    0 4px 8px -2px rgba(0, 0, 0, 0.25);
}

.playlist-cover-overlay {
  background: linear-gradient(to top, rgba(0, 0, 0, 0.4) 0%, transparent 40%, transparent 100%);
}

.playlist-play-btn {
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  opacity: 0;
  transform: scale(0.8);
}

.playlist-card:active .playlist-play-btn {
  opacity: 1;
  transform: scale(1);
}

.playlist-name {
  color: var(--glass-text);
  opacity: 0.9;
}

.mv-card {
  transition: transform 0.3s ease;
}

.mv-card:active {
  transform: scale(0.98);
}

.mv-cover {
  box-shadow:
    0 12px 32px -4px rgba(0, 0, 0, 0.2),
    0 4px 12px -2px rgba(0, 0, 0, 0.1);
}

:root.dark .mv-cover,
html.dark .mv-cover {
  box-shadow:
    0 12px 32px -4px rgba(0, 0, 0, 0.5),
    0 4px 12px -2px rgba(0, 0, 0, 0.3);
}

.mv-cover-overlay {
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0.2) 30%,
    transparent 60%,
    transparent 100%
  );
}

.mv-play-btn {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.9), rgba(139, 92, 246, 0.9));
  backdrop-filter: blur(8px);
}

.mv-card:active .mv-play-btn {
  transform: translate(-50%, -50%) scale(1.1);
}

.mv-title {
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.mv-artist {
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
</style>
