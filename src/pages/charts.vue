<script setup lang="ts">
import SongList from '@/components/SongList.vue'
import { topSong, toplist, playlistTrackAll } from '@/api'
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { setPlaylist, play } = useAudio()

const state = reactive({
  activeTab: 'newSong' as 'newSong' | 'official',
  activeType: 0 as 0 | 7 | 96 | 8 | 16,
  songs: [] as any[],
  isLoading: false,
  officialLists: [] as any[],
  selectedList: null as any,
  listSongs: [] as any[],
  listLoading: false,
})

const { activeTab, activeType } = toRefs(state)

const newSongTypes = [
  { key: 0, labelKey: 'charts.types.all', icon: 'icon-[mdi--fire]' },
  { key: 7, labelKey: 'charts.types.mandarin', icon: 'icon-[mdi--music-note]' },
  { key: 96, labelKey: 'charts.types.west', icon: 'icon-[mdi--earth]' },
  { key: 8, labelKey: 'charts.types.japan', icon: 'icon-[mdi--flower-tulip]' },
  { key: 16, labelKey: 'charts.types.korea', icon: 'icon-[mdi--star-four-points]' },
]

const loadNewSongs = async () => {
  try {
    state.isLoading = true
    const res: any = await topSong({ type: activeType.value })
    const list: any[] = res?.data?.data || res?.data?.songs || res?.songs || res?.data || []
    state.songs = list.map((it: any) => ({
      id: it?.id,
      name: it?.name,
      artist: Array.isArray(it?.artists) ? it.artists.map((a: any) => a.name).join(' / ') : '',
      artistId: Array.isArray(it?.artists) && it.artists[0]?.id ? it.artists[0].id : 0,
      album: it?.album?.name || '',
      albumId: it?.album?.id,
      duration: it?.duration || 0,
      cover: it?.album?.picUrl || '',
    }))
  } finally {
    state.isLoading = false
  }
}

const loadOfficialLists = async () => {
  try {
    state.isLoading = true
    const res: any = await toplist()
    const list: any[] = res?.list || res?.data?.list || []
    state.officialLists = list.map((it: any) => ({
      id: it?.id,
      name: it?.name,
      cover: it?.coverImgUrl || '',
      updateFrequency: it?.updateFrequency || '',
      trackCount: it?.trackCount || 0,
      playCount: it?.playCount || 0,
      description: it?.description || '',
    }))
    if (state.officialLists.length && !state.selectedList) {
      selectList(state.officialLists[0])
    }
  } finally {
    state.isLoading = false
  }
}

const selectList = async (item: any) => {
  state.selectedList = item
  state.listLoading = true
  try {
    const res: any = await playlistTrackAll({ id: item.id, limit: 100 })
    const songs: any[] = res?.songs || res?.data?.songs || []
    state.listSongs = songs.map((it: any) => ({
      id: it?.id,
      name: it?.name,
      artist: Array.isArray(it?.ar) ? it.ar.map((a: any) => a.name).join(' / ') : '',
      artistId: Array.isArray(it?.ar) && it.ar[0]?.id ? it.ar[0].id : 0,
      album: it?.al?.name || '',
      albumId: it?.al?.id,
      duration: it?.dt || 0,
      cover: it?.al?.picUrl || '',
    }))
  } finally {
    state.listLoading = false
  }
}

const playAll = () => {
  const songs = activeTab.value === 'newSong' ? state.songs : state.listSongs
  if (!songs.length) return
  setPlaylist(songs, 0)
  play(songs[0], 0)
}

const currentSongs = computed(() => (activeTab.value === 'newSong' ? state.songs : state.listSongs))
const currentLoading = computed(() =>
  activeTab.value === 'newSong' ? state.isLoading : state.listLoading
)

watch(activeType, () => {
  if (activeTab.value === 'newSong') loadNewSongs()
})

watch(activeTab, val => {
  if (val === 'newSong' && !state.songs.length) {
    loadNewSongs()
  } else if (val === 'official' && !state.officialLists.length) {
    loadOfficialLists()
  }
})

onMounted(() => {
  loadNewSongs()
  loadOfficialLists()
})
</script>

<template>
  <div class="flex h-full flex-1 overflow-hidden">
    <div class="glass-card mx-4 mr-0 flex w-56 shrink-0 flex-col overflow-hidden">
      <div class="flex shrink-0 gap-1 border-b border-white/10 p-3">
        <button
          class="glass-button flex-1 justify-center px-3 py-2 text-xs font-medium"
          :class="activeTab === 'newSong' ? 'bg-pink-500/20 text-pink-400' : 'text-primary/60'"
          @click="activeTab = 'newSong'"
        >
          <span class="icon-[mdi--music-note-plus] mr-1 h-4 w-4" />
          {{ t('charts.newSongs') }}
        </button>
        <button
          class="glass-button flex-1 justify-center px-3 py-2 text-xs font-medium"
          :class="activeTab === 'official' ? 'bg-pink-500/20 text-pink-400' : 'text-primary/60'"
          @click="activeTab = 'official'"
        >
          <span class="icon-[mdi--trophy] mr-1 h-4 w-4" />
          {{ t('charts.official') }}
        </button>
      </div>

      <div v-if="activeTab === 'newSong'" class="space-y-1 p-3">
        <button
          v-for="type in newSongTypes"
          :key="type.key"
          class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all"
          :class="
            activeType === type.key
              ? 'bg-linear-to-r from-pink-500/20 to-rose-500/20 text-pink-400'
              : 'text-primary/60 hover:bg-white/5'
          "
          @click="activeType = type.key as any"
        >
          <span :class="[type.icon, 'h-4 w-4']"></span>
          {{ t(type.labelKey) }}
        </button>
      </div>

      <div v-else class="flex-1 space-y-1 overflow-auto p-3">
        <div
          v-for="item in state.officialLists"
          :key="item.id"
          class="group flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-all"
          :class="
            state.selectedList?.id === item.id
              ? 'bg-linear-to-r from-pink-500/15 to-rose-500/15'
              : 'hover:bg-white/5'
          "
          @click="selectList(item)"
        >
          <div class="relative">
            <LazyImage
              :src="item.cover + '?param=80y80'"
              :alt="item.name"
              class="h-10 w-10 shrink-0 rounded-lg object-cover shadow-md transition-transform group-hover:scale-105"
            />
            <div
              v-if="state.selectedList?.id === item.id"
              class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30"
            >
              <span class="icon-[mdi--play] h-5 w-5 text-white" />
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <p
              class="truncate text-xs font-medium transition-colors"
              :class="state.selectedList?.id === item.id ? 'text-pink-400' : 'text-primary'"
            >
              {{ item.name }}
            </p>
            <p class="text-primary/40 truncate text-xs">{{ item.updateFrequency }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-1 flex-col overflow-hidden px-4">
      <div class="mb-4 flex shrink-0 items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-primary text-lg font-bold">
            {{ activeTab === 'newSong' ? t('charts.newSongs') : state.selectedList?.name }}
          </h2>
          <span class="text-primary/40 rounded-full bg-white/5 px-2 py-0.5 text-xs">
            {{ currentSongs.length }} {{ t('charts.songs') }}
          </span>
        </div>
        <button
          v-if="currentSongs.length > 0"
          @click="playAll"
          class="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-pink-500/25 transition-all hover:shadow-xl hover:shadow-pink-500/30"
        >
          <span class="icon-[mdi--play] h-4 w-4" />
          {{ t('actions.playAll') }}
        </button>
      </div>

      <div class="relative min-h-0 flex-1 overflow-hidden">
        <PageSkeleton v-if="currentLoading" :sections="['list']" :list-count="12" />
        <SongList v-else :songs="currentSongs" :show-header="true" :show-controls="true" />
      </div>
    </div>
  </div>
</template>
