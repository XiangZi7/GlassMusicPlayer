<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'

const { playlist, clearPlaylist } = useAudio()

const handleClearQueue = () => {
  clearPlaylist()
}
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6">
    <section class="mb-6">
      <div class="p-3">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-primary text-sm font-semibold">正在播放列表</h2>
          <div class="flex items-center gap-2">
            <span class="text-primary/60 text-xs">共 {{ playlist.length }} 首</span>
            <button
              class="glass-button text-primary rounded-md px-3 py-1 text-xs"
              title="一键清空"
              @click="handleClearQueue"
            >
              清空
            </button>
          </div>
        </div>

        <div v-if="playlist.length === 0" class="py-8 text-center">
          <div class="text-primary/70 mb-2 text-sm">当前没有播放中的歌曲</div>
          <div class="text-primary/60 text-xs">去歌单或搜索页面添加喜欢的音乐吧</div>
        </div>
        <div v-else>
          <HotSongsMobile :songs="playlist" context="queue" />
        </div>
      </div>
    </section>
  </div>
</template>
