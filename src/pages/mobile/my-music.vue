<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { userPlaylist } from '@/api'

const { playlist } = useAudio()

const state = reactive({
  loading: false,
  userPlaylists: [] as Array<{ id: number | string; name: string; coverImgUrl: string; trackCount: number }>,
})

const loadUserPlaylists = async (uid?: number) => {
  if (!uid) return
  state.loading = true
  try {
    const res = await userPlaylist({ uid })
    const list = (res as any)?.playlist || (res as any)?.data?.playlist || []
    state.userPlaylists = list.map((p: any) => ({ id: p?.id || 0, name: p?.name || '', coverImgUrl: p?.coverImgUrl || '', trackCount: p?.trackCount || 0 }))
  } finally {
    state.loading = false
  }
}
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <section class="mb-6">
      <h2 class="mb-2 text-sm font-semibold text-white">正在播放列表</h2>
      <HotSongsMobile :songs="playlist as any" />
    </section>

    <section>
      <h2 class="mb-2 text-sm font-semibold text-white">我的歌单</h2>
      <div v-if="state.loading" class="py-6"><PageSkeleton :sections="['list']" :list-count="6" /></div>
      <div v-else class="grid grid-cols-2 gap-3">
        <router-link v-for="p in state.userPlaylists" :key="p.id" :to="`/playlist/${p.id}`" class="group">
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
  </div>
</template>
