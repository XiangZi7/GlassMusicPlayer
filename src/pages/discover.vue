<script setup lang="ts">
const categories = [
  { name: '新歌速递', emoji: '🆕', gradient: 'from-pink-400 to-purple-500' },
  { name: '热门榜单', emoji: '🔥', gradient: 'from-orange-400 to-red-500' },
  { name: '电音专区', emoji: '⚡', gradient: 'from-purple-500 to-pink-500' },
  { name: '治愈旋律', emoji: '🌸', gradient: 'from-blue-400 to-cyan-500' },
]
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">发现音乐</h1>
      </div>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <div v-for="(c, i) in categories" :key="i" class="group cursor-pointer">
          <div
            class="glass-card h-full p-4 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div class="relative mb-3 overflow-hidden rounded-xl">
              <div
                class="flex aspect-square items-center justify-center bg-linear-to-br text-4xl transition-transform duration-300 group-hover:scale-110"
                :class="c.gradient"
              >
                {{ c.emoji }}
              </div>
            </div>
            <h3 class="mb-1 truncate text-sm font-medium text-white">{{ c.name }}</h3>
            <p class="truncate text-xs text-purple-300">精选推荐</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
