<script setup lang="ts">
import { computed, nextTick, reactive, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { CatalogPlaylist, MusicPlatform } from '@/api'
import PlaylistLayout from '@/components/player/PlaylistLayout.vue'
import TrackList from '@/components/player/TrackList.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import { discoveryPreview, loadDiscoveryPlaylist } from '@/pages/index/public-playlists'
import { platformNames, toSourceTrack } from '@/services/player/catalog'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{ platform: MusicPlatform; id: string }>()
const route = useRoute()
const { state, controller } = usePlayer()
const { registerCatalogTracks, observeFavoritePlaylist } = usePlayerStore()
const root = useTemplateRef<HTMLElement>('root')
const list = useTemplateRef<InstanceType<typeof TrackList>>('list')
const detail = reactive({
  // 所有分页完成后才展示曲目或允许点播。
  playlist: null as CatalogPlaylist | null,
  // 切换歌单及重试时显示读取进度。
  loading: false,
  // 已经读取的曲目数。
  count: 0,
  // 加载失败时提供原位重试。
  error: '',
  // 手动重试启动独立请求。
  retry: 0,
})
const metadata = computed(() => detail.playlist ?? discoveryPreview(props.platform, props.id))
const rows = computed(() => detail.playlist?.tracks.map(toSourceTrack) ?? [])
const indices = computed(() => rows.value.map((_, index) => index))
const total = computed(() => detail.playlist?.tracks.length ?? metadata.value?.total)

// 路由离开时终止所有后续分页，快速换单时只接收最后一次结果。
watch([() => route.name, () => props.platform, () => props.id, () => detail.retry], async ([name, platform, id], _, onCleanup) => {
  if (name !== 'discovery') return
  const request = new AbortController()
  onCleanup(() => request.abort())
  detail.playlist = null
  detail.count = 0
  detail.error = ''
  detail.loading = true
  state.sorts.discovery = 'def'
  state.pg.discovery = 1
  await nextTick()
  if (request.signal.aborted) return
  root.value?.querySelector<HTMLElement>('[data-pl-name]')?.focus({ preventScroll: true })
  try {
    const result = await loadDiscoveryPlaylist(platform, id, request.signal, count => { detail.count = count })
    if (!request.signal.aborted) detail.playlist = result
  } catch (error) {
    if (!request.signal.aborted) detail.error = error instanceof Error ? error.message : '歌单加载失败，请重试。'
  } finally {
    if (!request.signal.aborted) detail.loading = false
  }
}, { immediate: true })

// 浏览不登记曲目，用户点播时才按当前排序组装整份播放队列。
function play(index: number, order: number[]): void {
  if (!detail.playlist) return
  observeFavoritePlaylist(detail.playlist)
  const registered = registerCatalogTracks(detail.playlist.tracks)
  controller()?.playTracks(order.map(position => registered[position]!), registered[index]!)
}
</script>

<template>
  <div ref="root" class="page-panel active discovery-detail" data-panel="discovery">
    <PlaylistLayout :key="platform + ':' + id" v-slot="{ indices: matching }" list-key="discovery"
      :tracks="rows" :indices="indices" :title="metadata?.title || '公开歌单'"
      :description="platformNames[platform]" :cover="metadata?.coverUrl || metadata?.tracks[0]?.coverUrl || undefined"
      :meta="total != null ? '共 ' + total + ' 首' : ''" :playable="!!rows.length && !!list" :show-list-tools="!!rows.length" @play="list?.playFirst()" @shuffle="list?.playShuffled()">
      <Transition name="playlist-content" mode="out-in" :css="state.settings.motion">
        <div v-if="detail.loading || detail.error" :key="detail.loading ? 'pending' : 'error'" class="grid min-h-40 place-content-center justify-items-center gap-3 text-sm text-white/75">
          <p role="status">{{ detail.error || (detail.count ? '已读取 ' + detail.count + ' 首…' : '正在读取完整歌单…') }}</p>
          <BaseButton v-if="detail.error" class="rounded-full border border-white/20 px-4 py-2" @click="detail.retry++">重新获取</BaseButton>
        </div>
        <TrackList v-else ref="list" :source-tracks="rows" :indices="matching" list-key="discovery" play-as-queue
          empty="歌单里没有可读取的曲目。" @play-source="play" />
      </Transition>
    </PlaylistLayout>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .playlist-content-enter-active, .playlist-content-leave-active { transition: opacity 160ms ease; }
  .playlist-content-enter-from, .playlist-content-leave-to { opacity: 0; }
}
</style>
