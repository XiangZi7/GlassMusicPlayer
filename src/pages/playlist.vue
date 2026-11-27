<script setup lang="ts">
import { computed, reactive, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlaylistLayout from '@/components/player/PlaylistLayout.vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'
import { usePlayerStore } from '@/stores/player'

const { state, tracks, controller } = usePlayer()
const route = useRoute()
const store = usePlayerStore()
const sync = reactive({
  /** 只显示当前打开歌单的同步进度。 */
  pending: false,
  /** 保留可播放的上次完整内容时说明原因。 */
  error: '',
})
const openId = computed(() => route.path === '/playlist' && typeof route.query.playlist === 'string' ? route.query.playlist : '')
// 切换、返回、重选及重试都回源，离开时取消旧请求的所有后续分页。
watch([openId, () => state.playlistReload], async ([id], _, onCleanup) => {
  sync.pending = false
  sync.error = ''
  if (!id) return
  const request = new AbortController()
  onCleanup(() => request.abort())
  sync.pending = true
  try {
    await store.refreshImportedPlaylist(id, request.signal)
  } catch (error) {
    if (!request.signal.aborted) sync.error = error instanceof Error ? error.message : '歌单同步失败。'
  } finally {
    if (!request.signal.aborted) sync.pending = false
  }
}, { immediate: true, flush: 'sync' })
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
    <PlaylistLayout :key="state.customPl?.id ?? state.playlistIdx" list-key="pl"
      :tracks="tracks" :indices="playlistIndices" :title="state.customPl?.name || first?.album || '暂无歌单'"
      :cover="state.customPl?.cover || first?.cover" :description="description" :meta="meta"
      :playable="!!imported?.length" show-list-tools @play="playAll" @shuffle="playShuffled">
      <template #sync-status>
        <span v-if="sync.pending || sync.error" role="status">{{ sync.pending ? '正在同步…' : '显示上次保存的歌单。' + sync.error }}</span>
        <BaseButton v-if="sync.error" class="rounded-full border border-white/20 px-3 py-1" @click="state.playlistReload++">重新同步</BaseButton>
      </template>
      <template #default="{ indices }">
        <TrackList ref="list" :indices="indices" :play-as-queue="!!imported"
          :empty="sync.pending ? '正在读取歌单…' : imported ? '歌单里没有可读取的曲目。' : undefined" list-key="pl" />
      </template>
    </PlaylistLayout>
  </div>
</template>
