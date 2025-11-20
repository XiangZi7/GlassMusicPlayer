<script setup lang="ts">
import { useUserStore } from '@/stores/modules/user'
const menuItems = [
  { to: '/', label: '首页', icon: 'ic--round-home' },
  { to: '/mv-list', label: 'MV', icon: 'ic--round-videocam' },
  { to: '/recent', label: '最近播放', icon: 'ic--round-schedule' },
  { to: '/search', label: '搜索', icon: 'ic--round-search' },
  { to: '/likes', label: '我喜欢的', icon: 'ic--round-favorite-border' },
  { to: '/created-playlists', label: '创建的歌单', icon: 'ic--round-queue-music' },
  { to: '/settings', label: '设置', icon: 'ic--round-settings' },
]

const state = reactive({
  // 用户创建的歌单列表
  userPlaylists: [
    { id: 1, name: '我喜欢的音乐' },
    { id: 2, name: '华语流行' },
    { id: 3, name: '二次元音乐' },
    { id: 4, name: '轻音乐' },
  ],
})
const { userPlaylists } = toRefs(state)
const userStore = useUserStore()
</script>
<template>
  <aside class="hidden w-64 shrink-0 px-4 py-0 lg:block">
    <div class="glass-card h-full p-4">
      <h3 class="mb-4 font-semibold text-white">我的音乐</h3>
      <nav class="space-y-2">
        <router-link
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center space-x-3 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          :class="{ 'bg-white/10 text-white': $route.path === item.to }"
        >
          <span class="h-5 w-5" :class="`icon-[${item.icon}]`"></span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="hidden">
        <span class="icon-[ic--round-search] h-5 w-5"></span>
      </div>

      <div class="mt-6" v-if="userStore.isLoggedIn">
        <h4 class="mb-3 text-sm font-medium text-white/60">创建的歌单</h4>
        <div class="space-y-2">
          <div
            v-for="playlist in userPlaylists"
            :key="playlist.id"
            class="flex cursor-pointer items-center space-x-3 rounded-lg p-2 transition-colors hover:bg-white/10"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-pink-400 to-purple-500 text-xs"
            >
              {{ playlist.name.charAt(0) }}
            </div>
            <span class="truncate text-sm text-white/80">{{ playlist.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
