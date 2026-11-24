<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useIntervalFn, useNow } from '@vueuse/core'
import BaseButton from '@/components/ui/BaseButton.vue'
import FeaturedBanner from '@/pages/index/components/featured-banner.vue'
import DailyPlaylist from '@/pages/index/components/daily-playlist.vue'
import RecommendedAlbums from '@/pages/index/components/recommended-albums.vue'
import TrackRow from '@/components/player/TrackRow.vue'
import { usePlayer } from '@/composables/usePlayer'
import { usePlayerStore } from '@/stores/player'
import { getAccountDailyTracks, type CatalogPlaylist, type CatalogTrack, type MusicPlatform } from '@/api'
import { catalogKey, platformNames, toSourceTrack } from '@/services/player/catalog'
import { playbackAccount } from '@/services/player/playback-session'
import { loadPublicPlaylists, neteaseRecommendationDate, pickDailyTracks, pickProfileTracks } from '@/pages/index/public-playlists'
defineProps<{ detail?: boolean }>()
const { state, tracks, controller } = usePlayer()
const { registerCatalogTracks, profileTracks } = usePlayerStore()
const discovery = reactive({
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
const now = useNow({ scheduler: tick => useIntervalFn(tick, 60_000) })
const day = computed(() => now.value.toDateString())
// 北京时间 06:00 开始新一期网易云日推，按固定时区计算，不受设备时区影响。
const neteaseDay = computed(() => neteaseRecommendationDate(now.value))
const playlistDate = computed(() => playbackAccount.value ? neteaseDay.value :
  [now.value.getFullYear(), String(now.value.getMonth() + 1).padStart(2, '0'), String(now.value.getDate()).padStart(2, '0')].join('-'))
const dateFormat = new Intl.DateTimeFormat('zh-CN', {
  month: 'long', day: 'numeric', weekday: 'long',
})
const dateLabel = computed(() => dateFormat.format(now.value))
// 按本地时间更新问候语，长时间打开播放器也会跨时段切换。
const greeting = computed(() => {
  const hour = now.value.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
// 日期或重试次数变化后更新公开资料，离开首页时取消在途请求。
watch([day, () => discovery.retry], async ([today], _, onCleanup) => {
  const request = new AbortController()
  onCleanup(() => request.abort())
  discovery.loading = true
  const result = await loadPublicPlaylists(today, request.signal)
  if (request.signal.aborted) return
  discovery.playlists = result.playlists
  discovery.incomplete = result.incomplete
  discovery.loading = false
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
const sourceLabel = computed(() => {
  if (discovery.accountLoading) return '正在读取网易云账号推荐'
  if (discovery.accountFailed) return '网易云账号推荐暂不可用'
  if (playbackAccount.value) return discovery.accountSongs.length ? '网易云音乐 · 账号推荐' : '网易云今天暂无推荐曲目'
  if (!dailyPicks.value.length) return '本机曲库选曲'
  return profile.value ? platformNames[profile.value.platform] + ' · 本机选曲' : '公开歌单精选'
})
const currentTrack = computed(() => tracks[state.idx]?.catalog)

// 点播时才把公开曲目登记到播放队列，浏览首页不会创建或导入个人歌单。
function playPublic(songs: CatalogTrack[], position = 0): void {
  const indices = registerCatalogTracks(songs)
  if (indices[position] !== undefined) controller()?.playTracks(indices, indices[position])
}

// 海报和歌曲行使用相同的顺序和音源；公开来源全部不可用时沿用本机曲库。
function playDaily(position = 0): void {
  if (!dailySongs.value[position]) return
  if (dailyPicks.value.length) return playPublic(dailyPicks.value, position)
  const index = localIndices.value[position]
  if (index !== undefined) controller()?.playTracks(localIndices.value, index)
}

// 开合详情后把键盘焦点交给新标题或返回的首页入口。
function focusDailyView(element: Element): void {
  element.querySelector<HTMLElement>('[data-daily-title], [data-open-daily]')?.focus({ preventScroll: true })
}
</script>
<template>
  <div :class="{ 'page-panel active': detail }" :data-panel="detail ? 'daily' : undefined">
  <Transition name="daily-view" mode="out-in" :css="state.settings.motion" @after-enter="focusDailyView">
  <DailyPlaylist v-if="detail" :songs="dailySongs" :date="playlistDate" :source="sourceLabel"
    :official="!!playbackAccount" :loading="discovery.accountLoading || (!playbackAccount && discovery.loading && !dailySongs.length)"
    :failed="discovery.accountFailed || (!playbackAccount && discovery.incomplete && !dailySongs.length)"
    :current="currentTrack" @play="playDaily" @home="controller()?.navigate('home')"
    @retry="playbackAccount ? discovery.accountRetry++ : discovery.retry++" />
  <!-- 首页发现区：日期、每日曲单与曲库专辑。 -->
  <div v-else class="home-content">
    <div
      class="main-top mb-[14px] flex items-center justify-between gap-[12px]"
    >
      <div class="min-w-0">
        <h3>{{ greeting }}</h3>
        <p>{{ dateLabel }}</p>
      </div>
      <div
        v-if="tracks.length"
        class="main-top-right flex flex-wrap items-center justify-end gap-[8px]"
      >
        <div class="main-chips flex gap-[7px]">
          <!-- 曲库导航：直接浏览专辑或歌手。 -->
          <BaseButton @click="controller()?.navigate('albums')">专辑</BaseButton>
          <BaseButton @click="controller()?.navigate('artists')">歌手</BaseButton>
        </div>
      </div>
    </div>
    <!-- 每日推荐与下方歌曲行共用当前账号、选曲来源和播放顺序。 -->
    <FeaturedBanner v-if="dailySongs.length || playbackAccount"
      :songs="dailySongs" :source-label="sourceLabel" :loading="discovery.accountLoading"
      :retry-account="discovery.accountFailed" @retry="discovery.accountRetry++" @play="playDaily()" @open="controller()?.navigate('daily')" />
    <!-- 发现区优先展示三平台公开歌单，离线时显示曲库专辑。 -->
    <RecommendedAlbums :playlists="discovery.playlists" :loading="discovery.loading" :incomplete="discovery.incomplete"
      @retry="discovery.retry++" @play-public="playPublic" />
    <!-- 今日曲目：从任一行开始，按海报展示的同一份曲单续播。 -->
    <section v-if="dailySongs.length" class="home-picks" aria-labelledby="home-picks-title">
      <div class="feat-head m-[22px_2px_8px] flex items-center justify-between gap-2">
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
@media (min-width: 1021px) {
  .np-collapsed .main-top-right { margin-inline-end: 28px; }
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
</style>
