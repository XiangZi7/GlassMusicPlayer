<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useIntervalFn, useNow } from '@vueuse/core'
import { useRoute } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import FeaturedBanner from '@/pages/index/components/featured-banner.vue'
import DailyPlaylist from '@/pages/index/components/daily-playlist.vue'
import DailyTile from '@/pages/index/components/daily-tile.vue'
import ChartTile from '@/pages/index/components/chart-tile.vue'
import ArtistTile from '@/pages/index/components/artist-tile.vue'
import RadioTile from '@/pages/index/components/radio-tile.vue'
import ListeningShelves from '@/pages/index/components/listening-shelves.vue'
import RecommendedAlbums from '@/pages/index/components/recommended-albums.vue'
import TrackRow from '@/components/player/TrackRow.vue'
import { usePlayer } from '@/composables/usePlayer'
import { useActiveMusicPlatform } from '@/composables/useActiveMusicPlatform'
import { usePlayerStore } from '@/stores/player'
import { getAccountDailyTracks, getPopularPlaylists, type CatalogPlaylist, type CatalogTrack, type MusicPlatform, type PublicPlaylistSummary } from '@/api'
import { catalogKey, platformNames, toSourceTrack } from '@/services/player/catalog'
import { playbackAccount } from '@/services/player/playback-session'
import { loadPublicPlaylists, neteaseRecommendationDate, pickDailyTracks, pickProfileTracks } from '@/pages/index/public-playlists'
const props = defineProps<{ detail?: boolean }>()
const { state, tracks, controller } = usePlayer()
const { registerCatalogTracks, profileTracks } = usePlayerStore()
const activePlatform = useActiveMusicPlatform()
const route = useRoute()
const discovery = reactive({
  // 榜单和发现卡片逐个显示，已展示的日推选曲保留到本轮全部完成。
  previews: [] as CatalogPlaylist[],
  // 公开内容按来源保存，浏览时独立于本机曲库。
  playlists: [] as CatalogPlaylist[],
  // 首次加载或重试的状态。
  loading: true,
  // 至少一个来源未取得，显示重试入口。
  incomplete: false,
  // 当前网易云设备授权下的每日推荐，切换身份时同步清空。
  accountSongs: [] as CatalogTrack[],
  // 等待平台结果时不允许误播游客曲单。
  accountLoading: false,
  // 平台推荐暂时不可用时，允许重试并显示实际选曲来源。
  accountFailed: false,
  // 账号推荐和公共歌单分别重试，某个来源失败不影响另一个区域。
  accountRetry: 0,
  // 用户手动重试时重新读取失败来源。
  retry: 0,
})
const popular = reactive({
  // 当前热门歌单的所属平台，切换后立即隐藏旧列表。
  platform: null as MusicPlatform | null,
  // 只预览平台推荐顺序的前八份公开热门歌单。
  playlists: [] as PublicPlaylistSummary[],
  // 发现区首次读取或重试中的状态。
  loading: true,
  // 当前平台未能返回热门歌单，允许原位重试。
  failed: false,
  // 发现区重试与首页其它公开内容请求独立。
  retry: 0,
})
const now = useNow({ scheduler: tick => useIntervalFn(tick, 60_000) })
const day = computed(() => now.value.toDateString())
// 北京时间 06:00 开始新一期网易云日推，按固定时区计算，不受设备时区影响。
const neteaseDay = computed(() => neteaseRecommendationDate(now.value))
const playlistDate = computed(() => playbackAccount.value ? neteaseDay.value :
  [now.value.getFullYear(), String(now.value.getMonth() + 1).padStart(2, '0'), String(now.value.getDate()).padStart(2, '0')].join('-'))
// 日期或重试次数变化后更新公开资料，离开首页时取消在途请求。
watch([day, () => discovery.retry], async ([today], _, onCleanup) => {
  const request = new AbortController()
  onCleanup(() => request.abort())
  discovery.loading = true
  const result = await loadPublicPlaylists(today, request.signal, lists => { discovery.previews = lists })
  if (request.signal.aborted) return
  discovery.playlists = result.playlists
  discovery.incomplete = result.incomplete
  discovery.loading = false
}, { immediate: true })

// 发现区按当前平台读取真正的热门歌单，离开首页或切换身份时取消旧请求。
watch([activePlatform, () => route.name, () => popular.retry], async ([platform, page], _, onCleanup) => {
  if (page !== 'home') return
  const request = new AbortController()
  onCleanup(() => request.abort())
  if (popular.platform !== platform) popular.playlists = []
  popular.platform = platform
  popular.loading = true
  popular.failed = false
  try {
    const result = await getPopularPlaylists(platform, 1, 8, request.signal)
    if (request.signal.aborted) return
    if (result.platform !== platform || result.pageNum !== 1 || result.pageSize !== 8)
      throw new Error('音乐服务返回的热门歌单不一致。')
    popular.playlists = result.playlists
  } catch {
    if (!request.signal.aborted) popular.failed = true
  } finally {
    if (!request.signal.aborted) popular.loading = false
  }
}, { immediate: true })
// 与顶栏头像采用同一身份优先级，先使用已登录账号，再使用最近关联的公开资料。
const profile = computed(() => {
  if (playbackAccount.value) return { platform: 'netease' as const, userId: playbackAccount.value.userId }
  const platforms = Object.keys(state.linkedProfiles) as MusicPlatform[]
  const platform = platforms.sort((a, b) => state.linkedProfiles[b]!.syncedAt - state.linkedProfiles[a]!.syncedAt)[0]
  if (platform) return { platform, userId: state.linkedProfiles[platform]!.userId }
})

// 账号、日期或授权更换后丢弃旧推荐，即使旧请求较晚完成也不能重新显示。
watch([() => playbackAccount.value?.userId, neteaseDay, () => discovery.accountRetry], async ([userId], _, onCleanup) => {
  discovery.accountSongs = []
  discovery.accountFailed = false
  discovery.accountLoading = !!userId
  if (!userId) return
  const request = new AbortController()
  onCleanup(() => request.abort())
  try {
    const songs = await getAccountDailyTracks(request.signal)
    if (!request.signal.aborted) discovery.accountSongs = songs
  } catch {
    if (!request.signal.aborted) discovery.accountFailed = true
  } finally {
    if (!request.signal.aborted) discovery.accountLoading = false
  }
}, { immediate: true, flush: 'sync' })
const dailyPicks = computed(() => {
  if (playbackAccount.value) return discovery.accountSongs
  const account = profile.value
  if (account) return pickProfileTracks(discovery.playlists, profileTracks(account.platform, account.userId), account.platform, account.userId, day.value)
  return pickDailyTracks(discovery.playlists, new Date(day.value))
})
const localIndices = computed(() => controller()?.smartList(profile.value
  ? day.value + '|' + profile.value.platform + ':' + profile.value.userId : day.value) ?? [])
const dailySongs = computed(() => {
  return playbackAccount.value || dailyPicks.value.length
    ? dailyPicks.value.map(toSourceTrack)
    : localIndices.value.map(index => tracks[index]!)
})
const publicPreview = computed(() => dailyPicks.value.slice(0, 8))
const dailyLoading = computed(() => playbackAccount.value ? discovery.accountLoading : discovery.loading && !dailySongs.value.length)
const sourceLabel = computed(() => {
  if (discovery.accountLoading) return '正在读取网易云账号推荐'
  if (discovery.accountFailed) return '网易云账号推荐暂不可用'
  if (playbackAccount.value) return discovery.accountSongs.length ? '网易云音乐 · 账号推荐' : '网易云今天暂无推荐曲目'
  if (dailyLoading.value) return '正在读取公开推荐'
  if (!dailySongs.value.length) return '暂无可播放的推荐曲目'
  if (!dailyPicks.value.length) return '本机曲库选曲'
  return profile.value ? platformNames[profile.value.platform] + ' · 本机选曲' : '公开歌单精选'
})
const currentTrack = computed(() => tracks[state.idx]?.catalog)
// 当前曲目的目录键，供主打 tile 标出正在播放的那一首。
const currentKey = computed(() => (currentTrack.value ? catalogKey(currentTrack.value) : ''))
// 顶部问候按本地时段切换，凌晨时段单独致意。
const greeting = computed(() => {
  const hour = now.value.getHours()
  return hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
})
// 日期行按本地日历组装：月日、星期与一句推荐语。
const dateline = computed(() => {
  const date = now.value
  return `${date.getMonth() + 1}月${date.getDate()}日 · 星期${'日一二三四五六'[date.getDay()]} · 今日推荐已为你备好`
})
// 打开歌单、切换账号或进入新一期推荐时，从平台默认顺序开始。
watch([() => props.detail, playlistDate, () => profile.value?.platform, () => profile.value?.userId], () => {
  state.sorts.daily = 'def'
}, { immediate: true, flush: 'sync' })

// 点播时才把公开曲目登记到播放队列，浏览首页不会创建或导入个人歌单。
function playPublic(songs: CatalogTrack[], position = 0): void {
  const indices = registerCatalogTracks(songs)
  if (indices[position] !== undefined) controller()?.playTracks(indices, indices[position])
}

// 海报使用平台原序，详情点播沿用用户当前看到的排序建立完整队列。
function playDaily(position = 0, order?: number[]): void {
  if (!dailySongs.value.length) return
  const indices = dailyPicks.value.length ? registerCatalogTracks(dailyPicks.value) : localIndices.value
  const queue = order ? order.map(index => indices[index]!) : indices
  if (queue[position] !== undefined) controller()?.playTracks(queue, queue[position])
}

// 开合详情后把键盘焦点交给新标题或返回的首页入口。
function focusDailyView(element: Element): void {
  element.querySelector<HTMLElement>('[data-pl-name], [data-open-daily]')?.focus({ preventScroll: true })
}
</script>
<template>
  <div :class="{ 'page-panel active': detail }" :data-panel="detail ? 'daily' : undefined">
  <Transition name="daily-view" mode="out-in" :css="state.settings.motion" @after-enter="focusDailyView">
  <DailyPlaylist v-if="detail" :songs="dailySongs" :date="playlistDate" :source="sourceLabel"
    :official="!!playbackAccount" :loading="dailyLoading"
    :failed="discovery.accountFailed || (!playbackAccount && discovery.incomplete && !dailySongs.length)"
    :current="currentTrack" @play="playDaily"
    @retry="playbackAccount ? discovery.accountRetry++ : discovery.retry++" />
  <!-- 顶部条始终排在首位，加载、离线和切换账号都保留同一个入口与折叠迷你条。 -->
  <div v-else class="home-content">
    <FeaturedBanner :songs="dailySongs" :source-label="sourceLabel" :loading="dailyLoading"
      :retry-account="discovery.accountFailed" :greeting="greeting" :dateline="dateline"
      @retry="discovery.accountRetry++" @play="playDaily()" @open="controller()?.navigate('daily')" />
    <!-- bento 主区：主打、榜单、电台、歌手与发现 rail 以不对称网格排布。 -->
    <div class="home-bento">
      <DailyTile class="bento-daily" :songs="dailySongs" :source-label="sourceLabel" :loading="dailyLoading"
        :retry-account="discovery.accountFailed" :current-key="currentKey" @retry="discovery.accountRetry++" @play="playDaily()"
        @play-track="playDaily" @open="controller()?.navigate('daily')" />
      <ChartTile class="bento-chart" :playlists="discovery.previews" :loading="discovery.loading" @play="playPublic" />
      <RadioTile class="bento-radio" />
      <ArtistTile class="bento-artists" :playlists="discovery.playlists" :preview="publicPreview"
        :loading="discovery.loading" @play="playPublic" />
      <!-- 发现歌单横滑区：只展示当前平台，更多入口进入音乐库歌单。 -->
      <div class="tile bento-rail">
        <RecommendedAlbums :platform="activePlatform" :playlists="popular.platform === activePlatform ? popular.playlists : []" :loading="popular.loading"
          :failed="popular.failed" @retry="popular.retry++" @play-public="playPublic" />
      </div>
    </div>
    <!-- 今日曲目完整列表保留日推顺序，位于 bento 下方。 -->
    <section v-if="dailySongs.length" class="home-picks" aria-labelledby="home-picks-title">
      <div class="feat-head m-[24px_2px_12px] flex items-center justify-between gap-2">
        <h5 id="home-picks-title">今日曲目</h5>
        <BaseButton v-if="dailySongs.length > 8" class="rounded-md px-2 py-1 text-xs text-white/75 hover:bg-white/10 focus-visible:outline-2"
          @click="controller()?.navigate('daily')">查看全部 {{ dailySongs.length }} 首 ›</BaseButton>
      </div>
      <div class="home-pick-list">
        <TrackRow
          v-for="(song, position) in dailySongs.slice(0, 8)"
          :key="catalogKey(song.catalog!) + '-' + position"
          :track="song"
          :number="position + 1"
          :active="!!currentTrack && catalogKey(currentTrack) === catalogKey(song.catalog!)"
          :title="song.title + ' · ' + song.artist"
          @play="playDaily(position)"
        />
      </div>
    </section>
    <ListeningShelves :playlists="discovery.playlists" :preview="publicPreview" @play="playPublic" />
  </div>
  </Transition>
  </div>
</template>

<style scoped>
.daily-view-enter-active, .daily-view-leave-active { transition: opacity 170ms ease; }
.daily-view-enter-from, .daily-view-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .daily-view-enter-active, .daily-view-leave-active { transition: none; }
}
/* 首页底部补足留白，滚到底时最后一块与底栏之间留出呼吸距离。 */
.home-content {
  padding-bottom: 28px;
}
/* bento 主区：12 列不对称网格，主打占左列两行，榜单与电台叠在右列，歌手与 rail 整行。 */
.home-bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.home-bento > * {
  grid-column: span 12;
  min-width: 0;
}
@container (min-width: 800px) {
  .bento-daily {
    grid-column: span 7;
    grid-row: span 2;
  }
  .bento-chart {
    grid-column: span 5;
  }
  .bento-radio {
    grid-column: span 5;
  }
}
/* tile 统一语言：20px 圆角、发丝边、顶部内高光与暗玻璃底，液态下换渐变并加强高光。 */
.tile {
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 20px;
  background: rgb(255 255 255 / 4%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 6%);
  padding: 20px;
}
.liquid-win .tile {
  border-color: rgb(255 255 255 / 26%);
  background: linear-gradient(155deg, rgb(255 255 255 / 14%), rgb(255 255 255 / 5%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 30%);
}
/* 宽 tile 内的发现区去掉自带上边距，与 tile 内边距对齐。 */
.bento-rail :deep(.feat-head) {
  margin: 0 2px 16px;
}
.home-pick-list {
  display: grid;
  gap: 2px 20px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
}
.home-pick-list :deep(.trow) {
  grid-template-columns: minmax(0, 1fr) 40px 16px;
}
.home-pick-list :deep(.num),
.home-pick-list :deep(.alb) {
  display: none;
}
.home-pick-list :deep(.tt span span) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home-pick-list :deep(.tt > span) { opacity: 1; }
.home-pick-list :deep(.tt > span > span) { opacity: .7; }
</style>
