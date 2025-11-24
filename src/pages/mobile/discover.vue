<script setup lang="ts">
import { topPlaylist, topSong } from '@/api'

const state = reactive({ loading: true, playlists: [] as any[], songs: [] as any[] })

const load = async () => {
  state.loading = true
  try {
    const [plRes, sRes] = await Promise.all([
      topPlaylist({ order: 'hot', limit: 6 }),
      topSong({ type: 0 }),
    ])
    const playlists = (plRes as any)?.data?.playlists || (plRes as any)?.playlists || []
    state.playlists = playlists.map((pl: any) => ({ id: pl?.id || 0, name: pl?.name || '歌单', coverImgUrl: pl?.coverImgUrl || '', trackCount: pl?.trackCount || 0 }))
    const songData = (sRes as any)?.data?.data || (sRes as any)?.data?.songs || (sRes as any)?.songs || []
    state.songs = songData.slice(0, 6).map((it: any, i: number) => ({ id: it?.id || 0, name: it?.name || '', artist: Array.isArray(it?.artists) ? it.artists.map((a: any) => a.name).join(' / ') : '', album: it?.album?.name || '', duration: it?.duration || 0, emoji: ['🎵','🎶','♪','♫','🎼'][i%5], gradient: ['from-pink-400 to-purple-500'][0], liked: false, cover: it?.album?.picUrl || '' }))
  } finally {
    state.loading = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <div v-if="state.loading" class="py-6"><PageSkeleton :sections="['list']" :list-count="8" /></div>
    <template v-else>
      <section class="mb-6">
        <h2 class="mb-2 text-sm font-semibold text-white">热门歌单</h2>
        <div class="grid grid-cols-2 gap-3">
          <router-link v-for="p in state.playlists" :key="p.id" :to="`/playlist/${p.id}`" class="group">
            <div class="glass-card p-3">
              <div class="relative mb-2 overflow-hidden rounded-lg">
                <img :src="p.coverImgUrl+'?param=300y300'" alt="cover" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
              </div>
              <h3 class="truncate text-xs font-medium text-white">{{ p.name }}</h3>
              <p class="truncate text-[11px] text-purple-300">{{ p.trackCount }}首</p>
            </div>
          </router-link>
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-sm font-semibold text-white">热门歌曲</h2>
        <HotSongsMobile :songs="state.songs" />
      </section>
    </template>
  </div>
</template>
