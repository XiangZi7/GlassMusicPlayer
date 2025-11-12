<script setup lang="ts">
// 用户歌单
const userPlaylists = ref([
  { id: 1, name: '我喜欢的音乐' },
  { id: 2, name: '华语流行' },
  { id: 3, name: '二次元音乐' },
  { id: 4, name: '轻音乐' },
])
</script>
<template>
  <aside class="hidden w-64 p-4 lg:block">
    <div class="glass-card h-full p-4">
      <h3 class="mb-4 font-semibold text-white">我的音乐</h3>
      <nav class="space-y-2">
        <router-link
          to="/"
          class="flex items-center space-x-3 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          :class="{ 'bg-white/10 text-white': $route.path === '/' }"
        >
          <span class="icon-[mdi--home] h-5 w-5"></span>
          <span>首页</span>
        </router-link>
        <router-link
          to="/mv-list"
          class="flex items-center space-x-3 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          :class="{ 'bg-white/10 text-white': $route.path === '/mv-list' }"
        >
          <span class="icon-[mdi--video] h-5 w-5"></span>
          <span>MV</span>
        </router-link>
        <a
          href="#"
          class="flex items-center space-x-3 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span class="icon-[mdi--clock-outline] h-5 w-5"></span>
          <span>最近播放</span>
        </a>
        <a
          href="#"
          class="flex items-center space-x-3 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span class="icon-[mdi--heart-outline] h-5 w-5"></span>
          <span>我喜欢的</span>
        </a>
        <a
          href="#"
          class="flex items-center space-x-3 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span class="icon-[mdi--playlist-music] h-5 w-5"></span>
          <span>创建的歌单</span>
        </a>
        <router-link
          to="/settings"
          class="flex items-center space-x-3 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          :class="{ 'bg-white/10 text-white': $route.path === '/settings' }"
        >
          <span class="icon-[mdi--cog] h-5 w-5"></span>
          <span>设置</span>
        </router-link>
      </nav>

      <div class="mt-6">
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
