<script setup lang="ts">
import SongList from '@/components/SongList.vue'
import { topSong, toplist, playlistTrackAll } from '@/api'
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'
import LazyImage from '@/components/Ui/LazyImage.vue'
import TabGroup from '@/components/Ui/TabGroup.vue'
import Button from '@/components/Ui/Button.vue'

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

const mainTabs = computed(() => [
  { key: 'newSong', labelKey: 'charts.newSongs', icon: 'icon-[mdi--music-note-plus]' },
  { key: 'official', labelKey: 'charts.official', icon: 'icon-[mdi--trophy]' },
])

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
      artists: Array.isArray(it?.artists) ? it.artists.map((a: any) => ({ id: a.id, name: a.name })) : [],
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
      artists: Array.isArray(it?.ar) ? it.ar.map((a: any) => ({ id: a.id, name: a.name })) : [],
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
  <div class="flex h-full flex-1 gap-6 overflow-hidden p-4 lg:p-6">
    <!-- 侧边栏 -->
    <aside class="glass-card flex w-64 shrink-0 flex-col overflow-hidden rounded-3xl">
      <!-- Tab 切换 -->
      <div class="shrink-0 border-b border-(--glass-border) p-4">
        <TabGroup v-model="state.activeTab" :tabs="mainTabs" variant="gradient" size="sm" :show-count="false" />
      </div>

      <!-- 新歌榜类型 -->
      <div v-if="activeTab === 'newSong'" class="flex-1 space-y-1.5 overflow-auto p-4">
        <Button
          v-for="type in newSongTypes"
          :key="type.key"
          variant="ghost"
          size="sm"
          rounded="xl"
          class="w-full justify-start gap-3"
          :class="activeType === type.key ? 'bg-hover-glass text-pink-400! shadow-sm' : ''"
          @click="activeType = type.key as any"
        >
          <span
            :class="[type.icon, 'h-5 w-5']"
            :style="activeType === type.key ? 'filter: drop-shadow(0 0 4px rgb(236 72 153 / 0.5))' : ''"
          ></span>
          {{ t(type.labelKey) }}
        </Button>
      </div>

      <!-- 官方榜单列表 -->
      <div v-else class="flex-1 space-y-2 overflow-auto p-4">
        <div
          v-for="item in state.officialLists"
          :key="item.id"
          class="group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all"
          :class="
            state.selectedList?.id === item.id
              ? 'bg-hover-glass shadow-sm'
              : 'hover:bg-hover-glass/50'
          "
          @click="selectList(item)"
        >
          <div class="relative shrink-0">
            <LazyImage
              :src="item.cover + '?param=100y100'"
              :alt="item.name"
              imgClass="h-12 w-12 rounded-lg object-cover shadow-md transition-transform duration-300 group-hover:scale-105"
              wrapperClass="h-12 w-12"
            />
            <div
              v-if="state.selectedList?.id === item.id"
              class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40"
            >
              <span class="icon-[mdi--equalizer] h-5 w-5 text-pink-400" />
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <p
              class="truncate text-sm font-medium transition-colors"
              :class="state.selectedList?.id === item.id ? 'text-pink-400' : 'text-primary'"
            >
              {{ item.name }}
            </p>
            <p class="text-primary/40 mt-0.5 truncate text-xs">{{ item.updateFrequency }}</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <!-- 头部 -->
      <header class="mb-6 flex shrink-0 items-center justify-between">
        <div class="flex items-center gap-4">
          <h1 class="text-primary text-2xl font-bold tracking-tight lg:text-3xl">
            {{ activeTab === 'newSong' ? t('charts.newSongs') : state.selectedList?.name }}
          </h1>
          <span class="text-primary/50 glass-card rounded-full px-3 py-1.5 text-sm font-medium">
            {{ currentSongs.length }} {{ t('charts.songs') }}
          </span>
        </div>
        <Button
          v-if="currentSongs.length > 0"
          variant="solid"
          size="md"
          rounded="lg"
          class="gap-2 shadow-md shadow-pink-500/20"
          @click="playAll"
        >
          <span class="icon-[mdi--play] h-5 w-5" />
          {{ t('actions.playAll') }}
        </Button>
      </header>

      <!-- 歌曲列表 -->
      <div class="glass-card relative min-h-0 flex-1 overflow-hidden rounded-3xl p-4">
        <PageSkeleton v-if="currentLoading" :sections="['list']" :list-count="12" />
        <SongList v-else :songs="currentSongs" :show-header="true" :show-controls="true" />
      </div>
    </main>
  </div>
</template>
