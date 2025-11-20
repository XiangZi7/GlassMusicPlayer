<script setup lang="ts">
const created = [
  { name: '二次元神曲', count: 50, emoji: '🎌', gradient: 'from-pink-400 to-purple-500' },
  { name: '治愈系音乐', count: 30, emoji: '🌸', gradient: 'from-blue-400 to-cyan-500' },
]
const state = reactive({ isPageLoading: false })
</script>

<template>
  <div class="flex-1 overflow-hidden text-white">
    <div class="h-full overflow-auto p-6">
      <PageSkeleton v-if="state.isPageLoading" :sections="['grid']" :grid-count="6" />
      <template v-else>
        <h1 class="mb-6 text-2xl font-bold text-white">创建的歌单</h1>
      </template>
    </div>
  </div>
</template>
