<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  useTemplateRef,
  watch,
} from 'vue'
import LibraryTabs from '@/components/player/LibraryTabs.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChoiceMenu from '@/components/ui/BaseChoiceMenu.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import SlidingTabs from '@/components/ui/SlidingTabs.vue'
import { usePlayer } from '@/composables/usePlayer'
import PlaylistGrid from '@/pages/library/components/playlist-grid.vue'
import { usePlatformPlaylists } from '@/pages/library/platform-playlists'
import { platformNames } from '@/services/player/catalog'

const { state, controller } = usePlayer()
const {
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
} = usePlatformPlaylists()
const searchInput = useTemplateRef<HTMLInputElement>('searchInput')
const list = useTemplateRef<HTMLElement>('list')
const filterContext = computed(() => [
  platform.value,
  query.value.trim(),
  category.value,
  order.value,
  page.value,
])
const resultView = computed(() =>
  [
    platform.value,
    searchMode.value ? 'search' : category.value,
    order.value,
    page.value,
  ].join(':')
)
const showPagination = computed(() =>
  total.value === null
    ? page.value > 1 || hasMore.value
    : total.value > pageSize
)
let cardToRestore:
  | {
      id: string
      context: typeof filterContext.value
      currentFocus?: Element | null
    }
  | undefined
const platformOptions = Object.entries(platformNames).map(([value, label]) => ({
  value,
  label,
}))
const emptyMessage = computed(() =>
  searchMode.value || category.value ? '没有匹配的歌单' : '此平台暂无歌单'
)

// 改变筛选或翻页后，从新结果的顶部开始阅读。
function resetScroll(): void {
  list.value?.scrollTo({ top: 0 })
}

watch(filterContext, resetScroll, { flush: 'post' })

// 清除关键词并把焦点交回筛选输入框。
function clearQuery(): void {
  query.value = ''
  searchInput.value?.focus({ preventScroll: true })
}

// 重置后将焦点交给关键词输入框，便于立即输入新条件。
function clearFilters(): void {
  resetFilters()
  searchInput.value?.focus({ preventScroll: true })
}

// 输入法选词时保留原生 Escape，其他情况下先清除筛选。
function handleSearchEscape(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229 || !query.value) return
  event.preventDefault()
  event.stopPropagation()
  clearQuery()
}

// 使用所选平台和歌单 ID 打开详情，返回时恢复原卡片焦点。
function openPlaylist(id: string): void {
  const player = controller()
  if (!player) return
  cardToRestore = { id, context: filterContext.value }
  const path = `/discovery/${platform.value}/${encodeURIComponent(id)}`
  player.navigate('discovery', undefined, false, path)
}

// 从详情返回后等待原卡片就绪，筛选或当前焦点变化时放弃恢复。
function restoreCardFocus(): void {
  const previous = cardToRestore
  const scrollport = list.value
  if (previous?.currentFocus === undefined || !scrollport || loading.value)
    return
  if (
    previous.context !== filterContext.value ||
    previous.currentFocus !== document.activeElement ||
    !rows.value.some(row => row.id === previous.id)
  ) {
    cardToRestore = undefined
    return
  }
  const card = scrollport.querySelector<HTMLButtonElement>(
    `[data-library-playlist="${CSS.escape(previous.id)}"]`
  )
  if (!card?.getClientRects().length || card.closest('[inert]')) return
  cardToRestore = undefined
  card.focus({ preventScroll: true })
  const bounds = card.getBoundingClientRect()
  const region = scrollport.getBoundingClientRect()
  const above = bounds.top - region.top - 4
  const below = bounds.bottom - region.bottom + 4
  scrollport.scrollTop += above < 0 ? above : Math.max(0, below)
}

// 保留离开时选中的卡片，返回时记录用户当前的焦点以识别后续操作。
onActivated(() => {
  if (!cardToRestore) return
  cardToRestore.currentFocus = document.activeElement
  void nextTick(restoreCardFocus)
})
onDeactivated(() => {
  if (cardToRestore?.currentFocus !== undefined) cardToRestore = undefined
})
watch([rows, loading], restoreCardFocus, { flush: 'post' })

// 旧结果淡出期间退出导航与辅助技术焦点，阻止按键打开已经切换来源的卡片。
function disableLeavingResults(element: Element): void {
  element.setAttribute('inert', '')
}

// 同一组结果重新进入时恢复交互。
function enableEnteringResults(element: Element): void {
  element.removeAttribute('inert')
}
</script>

<template>
  <div
    class="page-panel hidden h-full"
    :class="{ 'playlist-calm': !state.settings.motion }"
    data-panel="playlists"
  >
    <div class="flex h-full min-h-0 flex-col">
      <!-- 音乐库分类：与其他曲库页共用选中胶囊和路由。 -->
      <LibraryTabs flush />

      <!-- 歌单页头：标题和平台切换定义当前浏览范围。 -->
      <div
        class="playlist-heading flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-2"
      >
        <h2>{{ searchMode ? '歌单搜索' : '发现歌单' }}</h2>
        <!-- 平台选择沿用双材质分段控件。 -->
        <SlidingTabs
          :model-value="platform"
          :options="platformOptions"
          kind="segment"
          class="sort-seg inline-flex w-fit max-w-full flex-wrap gap-[3px] rounded-full p-[3px]"
          role="group"
          aria-label="歌单平台"
          @update:model-value="setPlatform"
        />
      </div>

      <!-- 查询栏：关键词搜索独立于平台热门目录的分类和排序。 -->
      <div
        class="playlist-toolbar flex flex-none flex-wrap items-end gap-x-3 gap-y-2"
        role="group"
        aria-label="歌单查询条件"
      >
        <div class="min-w-0 flex-1 basis-56">
          <label
            class="playlist-field-label"
            for="playlist-query"
            >关键词</label
          >
          <!-- 歌单搜索和清除入口保持同一行。 -->
          <div
            class="playlist-search flex min-h-9 min-w-0 items-center gap-2 rounded-[9px] px-2.5"
            role="search"
          >
            <svg
              class="size-4 shrink-0 text-white/50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <circle
                cx="11"
                cy="11"
                r="6.5"
              />
              <path
                d="m16 16 4 4"
                stroke-linecap="round"
              />
            </svg>
            <input
              id="playlist-query"
              ref="searchInput"
              v-model="query"
              class="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/45"
              type="search"
              autocomplete="off"
              maxlength="100"
              placeholder="搜索平台公开歌单"
              aria-label="筛选歌单"
              @keydown.esc="handleSearchEscape"
            />
            <!-- 清除关键词后回到当前平台的热门歌单。 -->
            <BaseButton
              v-if="query"
              class="playlist-clear grid size-6 shrink-0 place-items-center rounded-full"
              aria-label="清除歌单搜索"
              @click="clearQuery"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <path
                  d="m4 4 8 8M12 4l-8 8"
                  stroke-linecap="round"
                />
              </svg>
            </BaseButton>
          </div>
        </div>

        <!-- 分类和排序使用服务端公布的真实可选值。 -->
        <div v-if="categoryOptions.length > 1">
          <span
            class="playlist-field-label"
            aria-hidden="true"
            >分类</span
          >
          <BaseChoiceMenu
            variant="field"
            label="歌单分类"
            :value="category"
            :options="categoryOptions"
            :display-value="searchMode ? '全部分类' : undefined"
            :enabled="!searchMode"
            :motion="state.settings.motion"
            @select="setCategory"
          />
        </div>
        <div v-if="orderOptions.length > 1 || filterPhase === 'loading'">
          <span
            class="playlist-field-label"
            aria-hidden="true"
            >排序</span
          >
          <BaseChoiceMenu
            variant="field"
            label="歌单排序"
            :value="order"
            :options="orderOptions"
            :display-value="
              searchMode
                ? '平台搜索顺序'
                : categoryOrderLocked
                  ? '分类默认顺序'
                  : undefined
            "
            :enabled="
              orderOptions.length > 1 && !searchMode && !categoryOrderLocked
            "
            :motion="state.settings.motion"
            @select="setOrder"
          />
        </div>
        <!-- 重置回当前平台的默认热门列表。 -->
        <BaseButton
          class="playlist-reset flex min-h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold disabled:opacity-40"
          :disabled="!hasActiveFilters"
          aria-label="重置筛选"
          @click="clearFilters"
        >
          <svg
            class="size-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            aria-hidden="true"
          >
            <path
              d="M3 4v4h4M3.3 7.8a4.7 4.7 0 1 1 .9 3.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          重置
        </BaseButton>
        <!-- 筛选项读取失败时可单独重试，当前结果仍可浏览。 -->
        <BaseButton
          v-if="filterPhase === 'failed'"
          class="playlist-action imp-pick min-h-9 rounded-[9px] px-3 text-xs"
          @click="retryFilters"
          >重试筛选项</BaseButton
        >
      </div>

      <!-- 歌单结果占用剩余高度，筛选、状态与分页仍可操作。 -->
      <div
        ref="list"
        class="panel-scroll min-h-0 flex-1 overflow-y-auto"
        role="region"
        aria-label="歌单列表"
        :aria-busy="loading"
      >
        <Transition
          name="playlist-filter"
          mode="out-in"
          :css="state.settings.motion"
          @before-enter="enableEnteringResults"
          @before-leave="disableLeavingResults"
          @leave-cancelled="enableEnteringResults"
        >
          <div
            :key="resultView"
            class="flex min-h-full flex-col"
          >
            <div
              v-if="loading"
              class="grid min-h-40 flex-1 place-content-center text-xs text-white/70"
              role="status"
            >
              <span class="flex items-center gap-2">
                <span
                  class="playlist-spinner size-4 rounded-full border-2 border-white/25 border-t-white/80"
                />
                正在读取歌单
              </span>
            </div>
            <template v-else>
              <div
                v-if="failed"
                class="grid min-h-40 flex-1 place-content-center"
              >
                <!-- 重试仅读取当前平台的当前页。 -->
                <BaseButton
                  class="playlist-action imp-pick rounded-full px-3 py-2 text-xs"
                  @click="retry"
                  >重试加载歌单</BaseButton
                >
              </div>

              <!-- 歌单画廊：大封面与两行标题，共用详情入口。 -->
              <PlaylistGrid
                v-else-if="rows.length"
                :rows="rows"
                :motion="state.settings.motion"
                @open="openPlaylist"
              />

              <div
                v-else
                class="grid min-h-40 flex-1 place-content-center justify-items-center gap-3 px-3 text-center text-xs text-white/75"
              >
                <!-- 空列表说明热门歌单或搜索的结果。 -->
                <EmptyState
                  icon="playlist"
                  aria-hidden="true"
                />
                <p
                  class="m-0"
                  role="status"
                >
                  {{ emptyMessage }}
                </p>
                <!-- 没有结果时可直接清除名称筛选。 -->
                <BaseButton
                  v-if="hasActiveFilters"
                  class="playlist-action imp-pick rounded-full px-3 py-1 text-xs"
                  @click="clearFilters"
                  >清除筛选</BaseButton
                >
              </div>
            </template>
          </div>
        </Transition>
      </div>

      <!-- 结果总数已知时复用完整页码，未知时按平台返回的下一页状态导航。 -->
      <div
        v-if="showPagination"
        class="playlist-pagination panel-actions flex items-center justify-center"
      >
        <PaginationBar
          v-if="total !== null"
          v-model:current="page"
          page-key="library-playlists"
          :page-size="pageSize"
          :total="total"
          unit="个歌单"
        />
        <nav
          v-else
          class="flex flex-none flex-wrap items-center justify-center gap-2"
          aria-label="歌单分页"
        >
          <!-- 总数未知仍允许返回上一页。 -->
          <BaseButton
            class="playlist-action imp-pick rounded-full px-3 py-1 text-xs"
            :disabled="page <= 1 || loading"
            @click="page--"
            >上一页</BaseButton
          >
          <span
            class="text-xs text-white/70"
            aria-current="page"
            >第 {{ page }} 页</span
          >
          <!-- 仅在上游报告还有结果时进入下一页。 -->
          <BaseButton
            class="playlist-action imp-pick rounded-full px-3 py-1 text-xs"
            :disabled="!hasMore || loading"
            @click="page++"
            >下一页</BaseButton
          >
        </nav>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playlist-heading {
  margin-block: 17px 11px;
}
.playlist-heading h2 {
  margin: 0;
  font-size: 25px;
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.25;
}
.playlist-toolbar {
  margin-bottom: 14px;
  padding: 10px 12px 11px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 15px;
  background: rgb(255 255 255 / 4%);
}
.liquid-win .playlist-toolbar {
  border-color: rgb(255 255 255 / 23%);
  background: linear-gradient(
    155deg,
    rgb(255 255 255 / 13%),
    rgb(255 255 255 / 4%)
  );
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 22%);
}
.playlist-field-label {
  display: block;
  margin-bottom: 4px;
  padding-inline: 2px;
  color: rgb(255 255 255 / 70%);
  font-size: 11px;
  font-weight: 650;
  line-height: 16px;
}
.playlist-search {
  border: 1px solid rgb(255 255 255 / 14%);
  background: rgb(0 0 0 / 20%);
}
.playlist-search input {
  font-size: 12px;
  line-height: 18px;
}
.playlist-search input::-webkit-search-cancel-button {
  appearance: none;
}
.playlist-search:has(input:focus-visible),
.sort-seg :deep(button:focus-visible),
.playlist-clear:focus-visible,
.playlist-reset:focus-visible,
.playlist-action:focus-visible {
  outline: 2px solid rgb(255 255 255 / 75%);
  outline-offset: 2px;
}
.playlist-clear svg {
  width: 14px;
  height: 14px;
}
.playlist-clear:hover,
.playlist-reset:enabled:hover {
  background: rgb(255 255 255 / 12%);
}
.playlist-pagination {
  padding: 6px 4px 0;
  min-height: 50px;
}
.playlist-pagination :deep(.pager) {
  margin: 0;
}
.playlist-filter-leave-active {
  pointer-events: none;
}
@media (prefers-reduced-motion: no-preference) {
  .playlist-filter-enter-active,
  .playlist-filter-leave-active {
    transition: opacity 160ms ease;
  }
  .playlist-filter-enter-from,
  .playlist-filter-leave-to {
    opacity: 0;
  }
  .playlist-clear,
  .playlist-reset {
    transition:
      border-color 150ms ease,
      background-color 150ms ease;
  }
  .playlist-spinner {
    animation: playlist-spin 850ms linear infinite;
  }
  .playlist-calm .playlist-clear,
  .playlist-calm .playlist-reset {
    transition: none;
  }
  .playlist-calm .playlist-spinner {
    animation: none;
  }
}
@keyframes playlist-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
