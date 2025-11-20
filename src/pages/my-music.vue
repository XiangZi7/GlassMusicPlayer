<script setup lang="ts">
const sections = [
  { name: '我喜欢的', to: '/likes', emoji: '❤️', gradient: 'from-pink-400 to-red-500' },
  {
    name: '创建的歌单',
    to: '/created-playlists',
    emoji: '📁',
    gradient: 'from-purple-500 to-indigo-500',
  },
  { name: '最近播放', to: '/recent', emoji: '🕒', gradient: 'from-blue-400 to-cyan-500' },
]
const state = reactive({ isPageLoading: false })
</script>

<template>
  <div class="flex-1 overflow-hidden text-white">
    <div class="h-full overflow-auto p-6">
      <PageSkeleton v-if="state.isPageLoading" :sections="['grid']" :grid-count="6" />
      <template v-else>
      <h1 class="text白 mb-6 text-2xl font-bold">我的音乐</h1>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <router-link v-for="(s, i) in sections" :key="i" :to="s.to" class="group cursor-pointer">
          <div
            class="glass-card h-full p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div class="relative mb-3 overflow-hidden rounded-xl">
              <div
                class="flex aspect-square items-center justify-center bg-linear-to-br text-4xl transition-transform duration-300 group-hover:scale-110"
                :class="s.gradient"
              >
                {{ s.emoji }}
              </div>
            </div>
            <h3 class="text白 mb-1 truncate text-sm font-medium">{{ s.name }}</h3>
            <p class="text紫-300 truncate text-xs">快速入口</p>
          </div>
        </router-link>
      </div>
      </template>
    </div>
  </div>
</template>
