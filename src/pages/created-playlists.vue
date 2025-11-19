<script setup lang="ts">
const created = [
  { name: '二次元神曲', count: 50, emoji: '🎌', gradient: 'from-pink-400 to-purple-500' },
  { name: '治愈系音乐', count: 30, emoji: '🌸', gradient: 'from-blue-400 to-cyan-500' },
]
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto p-6">
      <h1 class="mb-6 text-2xl font-bold text-white">创建的歌单</h1>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <div
          v-for="(playlist, index) in created"
          :key="index"
          class="playlist-card group cursor-pointer"
        >
          <div
            class="glass-card h-full p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div class="relative mb-3 overflow-hidden rounded-xl">
              <div
                class="flex aspect-square items-center justify-center bg-linear-to-br text-4xl transition-transform duration-300 group-hover:scale-110"
                :class="playlist.gradient"
              >
                {{ playlist.emoji }}
              </div>
            </div>
            <h3 class="mb-1 truncate text-sm font-medium text-white">{{ playlist.name }}</h3>
            <p class="truncate text-xs text-purple-300">{{ playlist.count }}首歌曲</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
