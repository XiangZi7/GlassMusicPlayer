import { computed, reactive, toRefs, watch } from 'vue'
import { searchCatalog, type CatalogPage, type MusicPlatform } from '@/api'
import type { PlayerState } from '@/stores/player'
import { notify } from '@/services/notification'

export const searchPageSize = 10

// 在搜索页按平台和页码取结果，离开页面及更改查询时取消过期请求。
export function useCatalogSearch(player: PlayerState) {
  const state = reactive({
    /** 当前曲库筛选和输入的结果页。 */
    platform: 'netease' as MusicPlatform | 'local',
    pageNum: 1,
    /** 当前请求的结果及状态。 */
    result: null as CatalogPage | null,
    loading: false,
    failed: false,
  })
  const query = computed(() => player.query.trim())
  watch(
    [() => player.queryRevision, () => state.platform],
    () => {
      state.pageNum = 1
    },
    { flush: 'sync' }
  )

  watch(
    [
      () => player.page,
      () => state.platform,
      query,
      () => state.pageNum,
      () => player.queryRevision,
    ],
    ([page, platform, keyword, pageNum], _previous, onCleanup) => {
      state.result = null
      state.failed = false
      state.loading = page === 'search' && platform !== 'local' && !!keyword
      if (page !== 'search' || platform === 'local' || !keyword) return

      const abort = new AbortController()
      // 仅在已提交搜索词、切换平台或操作分页时请求服务端。
      async function load(platform: MusicPlatform) {
        try {
          const result = await searchCatalog(
            platform,
            keyword,
            pageNum,
            searchPageSize,
            abort.signal
          )
          if (abort.signal.aborted) return
          state.result = result
        } catch (error) {
          if (abort.signal.aborted) return
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

  return { query, ...toRefs(state) }
}
