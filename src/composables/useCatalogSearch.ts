import { computed, reactive, toRef, toRefs, watch } from 'vue'
import {
  getPlaylistSearchPlatforms,
  searchCatalog,
  searchCatalogPlaylists,
  type CatalogPage,
  type MusicPlatform,
  type PlaylistSearchPage,
} from '@/api'
import type { PlayerState } from '@/stores/player'
import { notify } from '@/services/notification'

export const searchPageSize = 10

// 在搜索页按平台和页码取结果，离开页面及更改查询时取消过期请求。
export function useCatalogSearch(player: PlayerState) {
  const platform = toRef(player, 'searchPlatform')
  const kind = toRef(player, 'searchKind')
  const state = reactive({
    /** 服务端声明支持歌单搜索的平台。 */
    playlistPlatforms: null as MusicPlatform[] | null,
    /** 当前搜索页码。 */
    pageNum: 1,
    /** 仅保存最新请求对应的结果页。 */
    result: null as CatalogPage | PlaylistSearchPage | null,
    /** 等待当前结果页。 */
    loading: false,
    /** 请求失败时允许原位重试。 */
    failed: false,
    /** 重新请求同一页的次数。 */
    retry: 0,
  })
  const query = computed(() => player.query.trim())
  const supportsPlaylists = computed(
    () =>
      platform.value !== 'local' &&
      !!state.playlistPlatforms?.includes(platform.value)
  )
  const activeKind = computed(() =>
    supportsPlaylists.value ? kind.value : 'tracks'
  )
  // 旧版服务端没有能力接口，继续提供歌曲搜索；网络故障可在下次进入时重试。
  watch(
    () => player.page,
    async (page, _, onCleanup) => {
      if (page !== 'search' || state.playlistPlatforms !== null) return
      const abort = new AbortController()
      onCleanup(() => abort.abort())
      try {
        const platforms = await getPlaylistSearchPlatforms(abort.signal)
        if (!abort.signal.aborted && Array.isArray(platforms))
          state.playlistPlatforms = platforms
      } catch {
        // 无法确认能力时隐藏歌单入口。
      }
    },
    { immediate: true }
  )
  watch(
    [() => player.queryRevision, platform, activeKind],
    () => {
      state.pageNum = 1
    },
    { flush: 'sync' }
  )

  watch(
    [
      () => player.page,
      platform,
      query,
      () => state.pageNum,
      activeKind,
      () => player.queryRevision,
      () => state.retry,
    ],
    ([page, platform, keyword, pageNum, kind], _previous, onCleanup) => {
      state.result = null
      state.failed = false
      state.loading = page === 'search' && platform !== 'local' && !!keyword
      if (page !== 'search' || platform === 'local' || !keyword) return

      const abort = new AbortController()
      // 仅在已提交搜索词、切换平台或操作分页时请求服务端。
      async function load(platform: MusicPlatform) {
        try {
          const search =
            kind === 'playlists' ? searchCatalogPlaylists : searchCatalog
          const result = await search(
            platform,
            keyword,
            pageNum,
            searchPageSize,
            abort.signal
          )
          if (abort.signal.aborted) return
          if (
            result.platform !== platform ||
            result.pageNum !== pageNum ||
            (kind === 'playlists'
              ? !('playlists' in result)
              : !('tracks' in result))
          )
            throw new Error('音乐服务返回的搜索结果不一致，请重试。')
          state.result = result
        } catch (error) {
          if (abort.signal.aborted) return
          if (
            kind === 'playlists' &&
            error instanceof Error &&
            error.name === 'playlist_search_unsupported'
          ) {
            state.playlistPlatforms =
              state.playlistPlatforms?.filter(source => source !== platform) ??
              []
            return
          }
          state.failed = true
          notify(
            error instanceof Error ? error.message : '搜索失败，请重试。',
            'error'
          )
        } finally {
          if (!abort.signal.aborted) state.loading = false
        }
      }
      onCleanup(() => abort.abort())
      void load(platform)
    },
    { immediate: true }
  )

  return { query, platform, kind, supportsPlaylists, activeKind, ...toRefs(state) }
}
