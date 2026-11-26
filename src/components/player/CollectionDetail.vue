<script setup lang="ts">
import { computed, markRaw, reactive, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  getCatalogCollection, resolveCatalogCollectionId,
  type CatalogCollectionKind, type CatalogCollectionPage, type CatalogTrack, type MusicPlatform,
} from '@/api'
import LibraryTabs from '@/components/player/LibraryTabs.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import TrackList from '@/components/player/TrackList.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
import { defaultCover, platformNames, toSourceTrack } from '@/services/player/catalog'
import { creditedCollectionId, trackArtistNames } from '@/services/player/library'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/format'

const props = defineProps<{ kind: CatalogCollectionKind }>()
const route = useRoute()
const { state, tracks, controller } = usePlayer()
const { registerCatalogTracks } = usePlayerStore()
const list = useTemplateRef<InstanceType<typeof TrackList>>('list')
const scrollArea = useTemplateRef<HTMLElement>('scrollArea')
const artist = computed(() => props.kind === 'artist')
const label = computed(() => artist.value ? '歌手' : '专辑')
const listKey = computed(() => artist.value ? 'ard' : 'ad')
const hooks = computed(() => {
  const prefix = 'data-' + listKey.value + '-'
  return { cover: prefix + 'cover', name: prefix + 'name', desc: prefix + 'desc', meta: prefix + 'meta', play: prefix + 'play' }
})

// 只接受单值参数，避免数组或空值误指向其他来源。
function queryText(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value.trim() : ''
}

// 路由指定的平台必须是目录服务实际支持的来源。
function supported(platform: string): platform is MusicPlatform {
  return Object.prototype.hasOwnProperty.call(platformNames, platform)
}

const target = computed(() => {
  if (route.meta.playerPage !== props.kind) return null
  const name = queryText('name') || queryText(props.kind)
  if ('platform' in route.query || 'id' in route.query || 'track' in route.query) {
    return {
      platform: queryText('platform') || 'unknown', id: queryText('id'), name,
      trackId: queryText('track'), albumAudioId: queryText('kugouAlbumAudioId'), localArtist: '',
    }
  }
  // 旧链接的曲库索引只用于恢复原始歌曲身份，远程来源始终由该歌曲决定。
  const index = 'index' in route.query
    ? /^\d+$/.test(queryText('index')) ? Number(queryText('index')) : -1
    : state.playlistIdx
  const song = tracks[index]
  const resolvedName = name || (artist.value ? trackArtistNames(song)[0] : song?.album) || ''
  const refs = artist.value ? song?.catalog?.artistRefs : song?.catalog?.albumRef ? [song.catalog.albumRef] : []
  return {
    platform: song?.catalog?.platform || '', name: resolvedName,
    id: creditedCollectionId(refs, resolvedName) || '', trackId: song?.catalog?.id || '',
    localArtist: !song?.catalog && !artist.value ? song?.artist || '' : '',
    albumAudioId: song?.catalog?.kugouAlbumAudioId || '',
  }
})

const remote = reactive({
  // 目录首页提供平台标题、资料、封面和报告的总量。
  metadata: null as CatalogCollectionPage | null,
  // 完整读取后才供排序、分页和整列播放使用。
  songs: [] as CatalogTrack[],
  // 已经成功读取的条目数，保留酷狗同 hash 的不同专辑曲目。
  count: 0,
  // 当前详情的网络请求状态。
  loading: false,
  // 在曲目容器内展示错误和重试操作。
  error: '',
})
let retryPage: (() => Promise<void>) | undefined
const view = reactive({
  // 简介默认只展示摘要，留出曲目列表空间。
  expanded: false,
})

// 每次换详情都取消上一轮请求；重试从失败的分页继续。
watch(target, (selection, _, onCleanup) => {
  const request = new AbortController()
  onCleanup(() => { request.abort(); retryPage = undefined })
  Object.assign(remote, { metadata: null, songs: [], count: 0, loading: false, error: '' })
  view.expanded = false
  if (!selection) return
  state.pg[listKey.value] = 1
  scrollArea.value?.scrollTo({ top: 0 })
  const { platform, trackId, name, albumAudioId } = selection
  if (!platform) return
  if (!supported(platform)) {
    remote.error = '无法识别这条链接的音乐平台。'
    return
  }
  if (!selection.id && (!trackId || !name)) {
    remote.error = '这条链接缺少音乐平台的' + label.value + '或歌曲编号。'
    return
  }

  const source: MusicPlatform = platform
  const { signal } = request
  const kind = props.kind
  const songs: CatalogTrack[] = []
  let id = selection.id
  let pageNum = 1
  let pageSize = 100
  let lastPageKey = ''
  // 保存下一个未完成的页码，只有整页校验通过才追加。
  async function loadPages(): Promise<void> {
    if (remote.loading || signal.aborted) return
    remote.loading = true
    remote.error = ''
    try {
      id ||= await resolveCatalogCollectionId(source, kind, trackId, name, signal, albumAudioId || undefined)
      while (!signal.aborted) {
        const page = await getCatalogCollection(source, kind, id, pageNum, pageSize, signal)
        if (signal.aborted) return
        if (page.platform !== platform || page.kind !== kind || page.id !== id ||
          page.pageNum !== pageNum || !Number.isInteger(page.pageSize) || page.pageSize <= 0 ||
          (pageNum > 1 && page.pageSize !== pageSize) || typeof page.hasMore !== 'boolean' ||
          !Array.isArray(page.tracks) || page.tracks.some(song => song.platform !== platform || !song.id)) {
          throw new Error('音乐平台返回的目录与当前页面不一致，请重试。')
        }
        const pageKey = JSON.stringify(page.tracks.map(song => [song.id, song.kugouAlbumAudioId]))
        if ((page.hasMore && !page.tracks.length) || (pageNum > 1 && pageKey === lastPageKey)) {
          throw new Error('音乐平台未返回下一页作品，请重试。')
        }
        if (pageNum === 1) remote.metadata = markRaw(page)
        songs.push(...page.tracks)
        remote.count = songs.length
        if (!page.hasMore) {
          remote.songs = markRaw(songs)
          return
        }
        lastPageKey = pageKey
        pageSize = page.pageSize
        pageNum++
      }
    } catch (error) {
      if (!signal.aborted) remote.error = error instanceof Error ? error.message : '作品目录读取失败，请重试。'
    } finally {
      if (!signal.aborted) remote.loading = false
    }
  }
  retryPage = loadPages
  void loadPages()
}, { immediate: true })

const local = computed(() => target.value?.platform === '')
const localIndices = computed(() => {
  const name = target.value?.name
  if (!local.value || !name) return []
  return tracks.flatMap((song, index) =>
    !song.catalog && (artist.value ? trackArtistNames(song).includes(name) :
      song.album === name && song.artist === target.value?.localArtist) ? [index] : [])
})
const firstLocal = computed(() => tracks[localIndices.value[0] ?? -1])
const rows = computed(() => remote.songs.map(toSourceTrack))
const indices = computed(() => local.value ? localIndices.value : rows.value.map((_, index) => index))
const title = computed(() => remote.metadata?.name || target.value?.name || label.value + '详情')
const platformLabel = computed(() => {
  const platform = target.value?.platform || ''
  return local.value ? '本机曲库' : supported(platform) ? platformNames[platform] : ''
})
const description = computed(() => local.value
  ? artist.value ? firstLocal.value?.album : firstLocal.value?.artist
  : remote.metadata?.description)
const summary = computed(() => {
  const full = description.value?.trim() || ''
  const first = full.split(/\r?\n/).filter(Boolean).slice(0, 2).join(' ').slice(0, 108).trimEnd()
  return first.length < full.replace(/\s+/g, ' ').length ? first + '…' : full
})
const emptyLabel = computed(() => local.value ? '本机曲库里没有该' + label.value + '的曲目。' : '该平台暂无可读取的曲目。')
const meta = computed(() => {
  const total = remote.metadata?.total
  if (remote.loading || remote.error) return total != null ? '平台收录 ' + total + ' 首' : ''
  const songs = local.value ? localIndices.value.map(i => tracks[i]!) : rows.value
  const duration = songs.reduce((sum, song) => sum + song.dur, 0)
  const count = total != null && total !== songs.length
    ? '平台收录 ' + total + ' 首 · 可读取 ' + songs.length + ' 首'
    : '共 ' + songs.length + ' 首'
  const time = duration >= 3600 ? Math.floor(duration / 3600) + ' 小时 ' + Math.floor(duration % 3600 / 60) + ' 分钟' : formatTime(duration)
  return duration ? count + ' · ' + time : count
})
const sortOptions = computed(() => [
  { label: '默认', value: listKey.value + ':def' },
  { label: '歌名', value: listKey.value + ':title' },
  { label: '歌手', value: listKey.value + ':artist' },
  { label: '时长', value: listKey.value + ':dur' },
])

// 点播时将完整排序映射到播放器索引，浏览详情本身不登记曲目。
function playSource(index: number, order: number[]): void {
  const player = controller()
  if (!player || !remote.songs[index] || remote.loading || remote.error) return
  const registered = registerCatalogTracks(remote.songs)
  player.playTracks(order.map(i => registered[i]!), registered[index]!)
}

// 平台封面失效时保留原图尺寸并使用曲库默认图。
function fallbackCover(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  if (image.getAttribute('src') !== defaultCover) image.src = defaultCover
}
</script>

<template>
  <div class="page-panel hidden h-full" :data-panel="kind">
    <div class="flex h-full min-h-0 flex-col">
      <LibraryTabs flush />
      <div ref="scrollArea" class="panel-scroll mt-4 min-h-0 flex-1 overflow-y-auto">
        <header class="pl-head flex items-center gap-[18px]">
          <span class="pl-head-dots pop-halftone" aria-hidden="true" />
          <img :[hooks.cover]="''" :src="remote.metadata?.coverUrl || firstLocal?.cover || defaultCover"
            :class="{ 'artist-cover': artist }" alt="" width="132" height="132" decoding="async" @error="fallbackCover" />
          <div class="pl-info min-w-0">
            <div class="pl-kicker font-mono text-[10.5px] font-bold tracking-[.14em] opacity-70">
              {{ artist ? '歌手 · ARTIST' : '专辑 · ALBUM' }}<span v-if="platformLabel"> · {{ platformLabel }}</span>
            </div>
            <h3 :[hooks.name]="''" :title="title">{{ title }}</h3>
            <template v-if="description">
              <Transition name="collection-content" mode="out-in" :css="state.settings.motion">
                <p :id="listKey + '-description'" :key="String(view.expanded)" :[hooks.desc]="''" class="collection-description">
                  {{ view.expanded ? description : summary }}
                </p>
              </Transition>
              <BaseButton v-if="summary !== description.trim()" class="mt-1 text-xs font-bold underline underline-offset-2"
                :aria-controls="listKey + '-description'" :aria-expanded="view.expanded" @click="view.expanded = !view.expanded">
                {{ view.expanded ? '收起简介' : '展开简介' }}
              </BaseButton>
            </template>
            <div class="pl-actions mt-[14px] flex flex-wrap items-center gap-3">
              <BaseButton class="banner-play inline-flex min-h-[38px] items-center gap-2 rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
                :[hooks.play]="''" :disabled="!remote.songs.length || !list" @click="list?.playFirst()">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>播放全部
              </BaseButton>
              <span :[hooks.meta]="''">{{ meta }}</span>
            </div>
          </div>
        </header>
        <Transition name="collection-content" mode="out-in" :css="state.settings.motion">
          <div v-if="remote.loading || remote.error" :key="remote.loading ? 'pending' : 'error'"
            class="grid min-h-48 place-content-center justify-items-center gap-3 text-center text-sm text-white/75">
            <p role="status">{{ remote.error || (remote.count ? '已读取 ' + remote.count + ' 首…' : '正在读取平台作品…') }}</p>
            <BaseButton v-if="remote.error && retryPage" class="rounded-full border border-white/20 px-4 py-2" @click="retryPage()">重新获取</BaseButton>
          </div>
          <div v-else-if="!indices.length" key="empty" class="grid min-h-48 place-content-center justify-items-center gap-3 text-sm text-white/70">
            <EmptyState aria-hidden="true" />
            <p>{{ emptyLabel }}</p>
          </div>
          <div v-else key="tracks">
            <div class="sortbar m-[12px_2px_2px] flex flex-wrap items-center gap-[9px]">
              <span class="sort-lab text-[11px] font-extrabold tracking-[.08em] opacity-[.65]">排序</span>
              <PlayerTabs kind="segment" class="sort-seg inline-flex gap-[3px] rounded-full p-[3px]"
                role="group" aria-label="列表排序" hook="data-sort" :options="sortOptions" />
            </div>
            <div aria-hidden="true"
              class="table-head mb-[4px] grid grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] px-[10px] pt-[16px] pb-[8px] text-[11px] font-extrabold tracking-[.08em] opacity-[.5]">
              <span>#</span><span>标题</span><span>专辑</span><span class="text-right">时长</span><span></span>
            </div>
            <TrackList ref="list" :indices="indices" :list-key="listKey" :source-tracks="local ? undefined : rows"
              :play-as-queue="!local" @play-source="playSource" />
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pl-head { position: relative; }
.pl-head-dots { position: absolute; inset: -6px -10px; --pop-halftone-color: rgb(255 255 255 / 9%); }
.pl-head > :not(.pl-head-dots) { position: relative; }
.pl-info { max-width: 100%; }
.pl-head > .artist-cover { border-radius: 50%; border: 3px solid #fff; outline: 2.5px solid var(--pop-yellow); }
.collection-description { overflow-wrap: anywhere; white-space: pre-line; }
.banner-play:disabled { opacity: .45; }
@media (prefers-reduced-motion: no-preference) {
  .collection-content-enter-active, .collection-content-leave-active { transition: opacity 160ms ease; }
  .collection-content-enter-from, .collection-content-leave-to { opacity: 0; }
}
</style>
