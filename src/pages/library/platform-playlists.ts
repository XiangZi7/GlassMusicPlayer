import { computed, reactive, toRefs, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useRoute } from 'vue-router'
import {
  getPlaylistBrowseFilters,
  getPopularPlaylists,
  searchCatalogPlaylists,
  type MusicPlatform,
  type PlaylistBrowseFilters,
  type PublicPlaylistSummary,
} from '@/api'
import { useActiveMusicPlatform } from '@/composables/useActiveMusicPlatform'
import { notify } from '@/services/notification'
import { platformNames } from '@/services/player/catalog'

type PlaylistRow = Pick<
  PublicPlaylistSummary,
  'id' | 'title' | 'coverUrl' | 'trackCount'
>

const pageSize = 20
const maxPage = 1000
const playlistId = /^[1-9]\d{0,19}$/
const allCategories = { value: '', label: '全部分类' }
const defaultOrder = { value: 'hot', label: '最热' }

// 验证详情页可读取的歌单 ID，按平台原有顺序展示并去重。
function normalizeRows(items: PublicPlaylistSummary[]): PlaylistRow[] {
  const rows = new Map<string, PlaylistRow>()
  for (const item of items) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !playlistId.test(item.id) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      rows.has(item.id)
    )
      continue
    const count = item.trackCount
    rows.set(item.id, {
      id: item.id,
      title: item.title,
      coverUrl: typeof item.coverUrl === 'string' ? item.coverUrl : null,
      trackCount:
        count !== null && Number.isSafeInteger(count) && count >= 0
          ? count
          : null,
    })
  }
  return [...rows.values()]
}

// 按平台读取热门歌单，输入关键词时切换到同一平台的公开歌单搜索。
export function usePlatformPlaylists() {
  const route = useRoute()
  const preferredPlatform = useActiveMusicPlatform()
  const state = reactive({
    // 用户手动选择的平台，初次进入和登录平台变化时采用默认平台。
    platformOverride: null as MusicPlatform | null,
    // 歌单名称搜索词，留空时读取热门榜单。
    query: '',
    // 当前平台的分类，空值表示全部。
    category: allCategories.value,
    // 平台提供的排序或频道，默认为最热。
    order: defaultOrder.value,
    // 本次页面会话已读取的平台筛选选项。
    browseFilters: {} as Partial<Record<MusicPlatform, PlaylistBrowseFilters>>,
    // 当前平台的筛选项读取状态。
    filterPhase: 'idle' as 'idle' | 'loading' | 'failed',
    // 独立重试筛选项，避免重新发送已有结果请求。
    filterRetryCount: 0,
    // 当前结果页，从 1 开始。
    page: 1,
    // 当前页通过验证的歌单摘要，始终保留平台返回顺序。
    rows: [] as PlaylistRow[],
    // 平台返回的总量，未知时使用前后页。
    total: null as number | null,
    // 平台是否还有后续结果，供无总量时翻页。
    hasMore: false,
    // 空闲、加载和失败状态由当前请求更新。
    phase: 'idle' as 'idle' | 'loading' | 'failed',
    // 保留当前筛选和页码并重新请求的次数。
    retryCount: 0,
  })
  const { query, category, order, filterPhase, page, rows, total, hasMore } =
    toRefs(state)
  const active = computed(() => route.name === 'library-playlists')
  const platform = computed(
    () => state.platformOverride ?? preferredPlatform.value
  )
  const keyword = computed(() => state.query.trim().slice(0, 100))
  const searchMode = computed(() => !!keyword.value)
  const filters = computed(() => state.browseFilters[platform.value])
  const categoryOptions = computed(() => [
    allCategories,
    ...(filters.value?.categories ?? []),
  ])
  const orderOptions = computed(() => filters.value?.orders ?? [defaultOrder])
  const categoryOrderLocked = computed(
    () => !!state.category && filters.value?.categoryOrders === false
  )
  const appliedCategory = computed(() =>
    searchMode.value ? '' : state.category
  )
  const appliedOrder = computed(() =>
    searchMode.value ? defaultOrder.value : state.order
  )
  const hasActiveFilters = computed(() =>
    Boolean(state.query || state.category || state.order !== defaultOrder.value)
  )
  const settledKeyword = refDebounced(keyword, 250)
  const keywordReady = computed(
    () => !keyword.value || keyword.value === settledKeyword.value
  )
  const loading = computed(() => state.phase === 'loading')
  const failed = computed(() => state.phase === 'failed')

  // 登录平台变化时采用新的默认平台，歌单请求依然只读取公开内容。
  watch(
    preferredPlatform,
    () => {
      state.platformOverride = null
    },
    { flush: 'sync' }
  )

  // 平台切换时清除旧平台的分类和排序，保留名称搜索词。
  watch(
    platform,
    () => {
      state.category = allCategories.value
      state.order = defaultOrder.value
    },
    { flush: 'sync' }
  )

  // 切换条件后从第一页开始，返回详情页时则保留当前页。
  watch(
    [platform, keyword, appliedCategory, appliedOrder],
    () => {
      state.page = 1
    },
    { flush: 'sync' }
  )

  // 读取服务端支持的筛选项，切平台或离开时取消旧请求。
  watch(
    [active, platform, () => state.filterRetryCount],
    async ([visible, selected], _, onCleanup) => {
      state.filterPhase = 'idle'
      if (!visible || state.browseFilters[selected]) return
      const request = new AbortController()
      onCleanup(() => request.abort())
      state.filterPhase = 'loading'
      try {
        const result = await getPlaylistBrowseFilters(selected, request.signal)
        if (request.signal.aborted) return
        if (
          result.platform !== selected ||
          !Array.isArray(result.categories) ||
          !Array.isArray(result.orders)
        )
          throw new Error('音乐服务返回的筛选项不一致。')
        state.browseFilters[selected] = result
        state.filterPhase = 'idle'
      } catch {
        if (!request.signal.aborted) state.filterPhase = 'failed'
      }
    },
    { immediate: true }
  )

  // 离开页面或条件变化时中止旧请求，防止上一平台和搜索条件覆盖当前结果。
  watch(
    [
      active,
      platform,
      keyword,
      appliedCategory,
      appliedOrder,
      keywordReady,
      page,
      () => state.retryCount,
    ],
    async (
      [visible, selected, term, pickedCategory, pickedOrder, ready, pageNum],
      previous,
      onCleanup
    ) => {
      state.rows = []
      if (
        !visible ||
        selected !== previous[1] ||
        term !== previous[2] ||
        pickedCategory !== previous[3] ||
        pickedOrder !== previous[4]
      ) {
        state.total = null
        state.hasMore = false
      }
      state.phase = visible ? 'loading' : 'idle'
      if (!visible || !ready) return

      const request = new AbortController()
      const { signal } = request
      onCleanup(() => request.abort())
      try {
        const result = term
          ? await searchCatalogPlaylists(
              selected,
              term,
              pageNum,
              pageSize,
              signal
            )
          : await getPopularPlaylists(selected, pageNum, pageSize, signal, {
              category: pickedCategory || undefined,
              order:
                pickedOrder === defaultOrder.value ? undefined : pickedOrder,
            })
        if (signal.aborted) return
        if (
          result.platform !== selected ||
          result.pageNum !== pageNum ||
          result.pageSize !== pageSize ||
          !Array.isArray(result.playlists) ||
          result.playlists.length > pageSize ||
          (!term &&
            (!('hasMore' in result) || typeof result.hasMore !== 'boolean'))
        )
          throw new Error('音乐服务返回的歌单列表不一致，请重试。')

        const count = result.total
        const knownTotal =
          count !== null && Number.isSafeInteger(count) && count >= 0
            ? Math.min(count, pageSize * maxPage)
            : null
        state.total = knownTotal
        if (knownTotal !== null) {
          const lastPage = Math.max(1, Math.ceil(knownTotal / pageSize))
          if (pageNum > lastPage) {
            state.page = lastPage
            return
          }
        }
        state.rows = normalizeRows(result.playlists)
        state.hasMore =
          pageNum < maxPage &&
          ('hasMore' in result
            ? result.hasMore === true
            : result.playlists.length === pageSize)
      } catch (error) {
        if (signal.aborted) return
        state.phase = 'failed'
        state.hasMore = false
        notify(
          error instanceof Error ? error.message : '读取歌单失败，请重试。',
          'error'
        )
      } finally {
        if (!signal.aborted && state.phase === 'loading') state.phase = 'idle'
      }
    },
    { immediate: true }
  )

  // 手动切换到所选平台，保留输入的关键词。
  function setPlatform(value: string): void {
    if (
      value === platform.value ||
      !Object.prototype.hasOwnProperty.call(platformNames, value)
    )
      return
    state.platformOverride = value as MusicPlatform
  }

  // 只提交该平台公开支持的分类，固定排序的分类自动使用默认顺序。
  function setCategory(value: string): void {
    if (
      searchMode.value ||
      !categoryOptions.value.some(option => option.value === value)
    )
      return
    state.category = value
    if (categoryOrderLocked.value) state.order = defaultOrder.value
  }

  // 搜索和固定排序分类不发送额外排序参数。
  function setOrder(value: string): void {
    if (
      searchMode.value ||
      categoryOrderLocked.value ||
      !orderOptions.value.some(option => option.value === value)
    )
      return
    state.order = value
  }

  // 回到当前平台默认热门页，一次清除关键词、分类和排序。
  function resetFilters(): void {
    state.query = ''
    state.category = allCategories.value
    state.order = defaultOrder.value
  }

  // 筛选项失败时重新读取，已有歌单结果仍可使用。
  function retryFilters(): void {
    state.filterRetryCount++
  }

  // 重试当前页的热门歌单或搜索请求。
  function retry(): void {
    state.retryCount++
  }

  return {
    platform,
    setPlatform,
    query,
    searchMode,
    category,
    setCategory,
    categoryOptions,
    order,
    setOrder,
    orderOptions,
    categoryOrderLocked,
    filterPhase,
    hasActiveFilters,
    resetFilters,
    retryFilters,
    page,
    pageSize,
    rows,
    total,
    hasMore,
    loading,
    failed,
    retry,
  }
}
