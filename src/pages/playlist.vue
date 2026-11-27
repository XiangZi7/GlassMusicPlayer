<script setup lang="ts">
import { computed } from 'vue'
import PlaylistLayout from '@/components/player/PlaylistLayout.vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'

const { state, tracks, controller } = usePlayer()
const imported = computed(() => state.customPl?.trackIndices)
const first = computed(() => tracks[state.playlistIdx])
const playlistIndices = computed(() =>
  imported.value ?? tracks.map((_, index) => (state.playlistIdx + index) % tracks.length)
    .filter(index => !tracks[index]?.catalog)
)
const description = computed(() => {
  if (state.customPl) return '来自 ' + state.customPl.source
  return first.value?.album ? first.value.artist + ' 的专辑歌单 · ' + first.value.q : ''
})
const meta = computed(() => {
  if (state.customPl) return '共 ' + state.customPl.count + ' 首'
  const duration = playlistIndices.value.reduce((sum, index) => sum + tracks[index]!.dur, 0)
  return '共 ' + playlistIndices.value.length + ' 首' + (duration ? ' · ' + formatTime(duration) : '')
})

// 导入歌单按保存的顺序建立播放队列。
function playAll(): void {
  if (imported.value?.length) controller()?.playTracks(imported.value, imported.value[0]!)
}

// 随机播放导入歌单：打乱保存顺序后整表入队，从打乱后的第一首开始。
function playShuffled(): void {
  if (!imported.value?.length) return
  const order = [...imported.value]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  controller()?.playTracks(order, order[0]!)
}
</script>

<template>
  <div class="page-panel hidden" data-panel="playlist">
    <PlaylistLayout list-key="pl" :title="state.customPl?.name || first?.album || '暂无歌单'"
      :cover="state.customPl?.cover || first?.cover" :description="description" :meta="meta"
      :playable="!!imported?.length" show-list-tools @play="playAll" @shuffle="playShuffled">
      <TrackList :indices="playlistIndices" :play-as-queue="!!imported"
        :empty="imported ? '歌单里没有可读取的曲目。' : undefined" list-key="pl" />
    </PlaylistLayout>
  </div>
</template>
