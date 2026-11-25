<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import PlaylistLayout from '@/components/player/PlaylistLayout.vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'

const { state, tracks, controller } = usePlayer()
const list = useTemplateRef<InstanceType<typeof TrackList>>('list')
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

// 搜索结果按当前排序播放，整份导入歌单仍按保存的顺序入队。
function playAll(indices: number[], searching: boolean): void {
  if (searching) list.value?.playFirst()
  else if (indices.length) controller()?.playTracks(indices, indices[0]!)
}
</script>

<template>
  <div class="page-panel hidden" data-panel="playlist">
    <PlaylistLayout :key="state.customPl?.id ?? state.playlistIdx" v-slot="{ indices }" list-key="pl"
      :tracks="tracks" :indices="playlistIndices" :title="state.customPl?.name || first?.album || '暂无歌单'"
      :cover="state.customPl?.cover || first?.cover" :description="description" :meta="meta"
      :playable="!!imported?.length" show-list-tools @play="playAll">
      <TrackList ref="list" :indices="indices" :play-as-queue="!!imported"
        :empty="imported ? '歌单里没有可读取的曲目。' : undefined" list-key="pl" />
    </PlaylistLayout>
  </div>
</template>
