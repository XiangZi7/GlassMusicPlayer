<script setup lang="ts">
import PlayerTabs from '@/components/player/PlayerTabs.vue'

const options = [
  { label: '全部歌曲', value: 'library' },
  { label: '专辑', value: 'albums' },
  { label: '歌手', value: 'artists' },
  { label: '我喜欢的', value: 'liked' },
  { label: '最近播放', value: 'recent' },
  { label: '智能歌单', value: 'smart' },
]
</script>

<template>
  <PlayerTabs
    class="pg-tabs mt-4 inline-flex max-w-full flex-none flex-wrap gap-1 self-start rounded-full p-1"
    role="tablist"
    aria-label="音乐库分类"
    hook="data-lib-tab"
    :options="options"
  />
</template>
