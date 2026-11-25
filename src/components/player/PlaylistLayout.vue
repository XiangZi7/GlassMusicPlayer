<script setup lang="ts">
import { computed, reactive, useTemplateRef, watch } from 'vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
import { defaultCover } from '@/constants/music'
import type { SourceTrack } from '@/types/prototype'

const props = defineProps<{
  title: string
  description: string
  cover?: string
  meta: string
  listKey: string
  playable: boolean
  showListTools: boolean
  tracks: SourceTrack[]
  indices: number[]
}>()
const emit = defineEmits<{ play: [indices: number[], searching: boolean] }>()
const { state } = usePlayer()
const search = reactive({
  /** 仅用于当前歌单详情的输入，不写入全站搜索记录。 */
  query: '',
})
const input = useTemplateRef<HTMLInputElement>('filterInput')
const keyword = computed(() => search.query.normalize('NFKC').trim().toLowerCase())
// 从整份歌单过滤原始索引，交给现有列表排序、分页和点播。
const matches = computed(() => {
  if (!keyword.value) return props.indices
  const words = keyword.value.split(/\s+/)
  return props.indices.filter(index => {
    const song = props.tracks[index]
    if (!song) return false
    const text = [song.title, song.artist, song.album, song.subtitle].join(' ').normalize('NFKC').toLowerCase()
    return words.every(word => text.includes(word))
  })
})
watch(keyword, () => { state.pg[props.listKey] = 1 }, { immediate: true })

// 清空筛选并把键盘焦点交还输入框，便于继续查找下一首。
function clearSearch(): void {
  search.query = ''
  input.value?.focus({ preventScroll: true })
}

// 输入法选词时由系统处理 Escape，正常输入时用它恢复完整歌单。
function handleEscape(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) {
    event.stopPropagation()
    return
  }
  if (!search.query) return
  event.preventDefault()
  event.stopPropagation()
  clearSearch()
}
const sortOptions = computed(() => [
  { label: '默认', value: props.listKey + ':def' },
  { label: '歌名', value: props.listKey + ':title' },
  { label: '歌手', value: props.listKey + ':artist' },
  { label: '时长', value: props.listKey + ':dur' },
])

// 远端封面失效时在原位置使用曲库缺省图，保留信息区尺寸。
function useFallbackCover(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  if (image.getAttribute('src') !== defaultCover) image.src = defaultCover
}
</script>

<template>
  <div class="playlist-layout">
    <header class="pl-head flex items-center gap-4.5">
      <!-- 页头波普半调点阵：只铺在页头带，低透明从左向右渐显，不进列表区。 -->
      <span class="pl-head-dots pop-halftone" aria-hidden="true" />
      <img :src="cover || defaultCover" alt="" width="132" height="132" decoding="async"
        data-pl-cover @error="useFallbackCover" />
      <div class="pl-info min-w-0">
        <div class="pl-kicker flex items-center gap-2 font-mono text-[11px] font-bold tracking-[.08em] opacity-75">
          <slot name="kicker">歌单 · PLAYLIST</slot>
        </div>
        <h3 data-pl-name tabindex="-1" :title="title">{{ title }}</h3>
        <p v-if="description" data-pl-desc>{{ description }}</p>
        <div class="pl-actions mt-[14px] flex flex-wrap items-center gap-x-3 gap-y-2">
          <BaseButton class="banner-play inline-flex min-h-[38px] items-center gap-2 rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
            :disabled="!playable || !matches.length" @click="emit('play', matches, !!keyword)">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
            {{ keyword ? '播放搜索结果' : '播放全部' }}
          </BaseButton>
          <span data-pl-meta>{{ meta }}</span>
          <span aria-live="polite" aria-atomic="true">{{ keyword ? '找到 ' + matches.length + ' 首' : '' }}</span>
        </div>
      </div>
    </header>
    <template v-if="showListTools">
      <div class="sortbar m-[12px_2px_2px] flex flex-wrap items-center gap-[9px]">
        <span class="sort-lab text-[11px] font-extrabold tracking-[.08em] opacity-[.65]">排序</span>
        <PlayerTabs kind="segment" class="sort-seg inline-flex gap-[3px] rounded-full p-[3px]"
          role="group" aria-label="列表排序" hook="data-sort" :options="sortOptions" />
        <!-- 歌单内搜索直接筛选本页已加载的完整曲目，清空后恢复原有排序。 -->
        <div v-if="indices.length" class="search-box playlist-filter" role="search" aria-label="歌单内搜索">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
          </svg>
          <input ref="filterInput" v-model="search.query" type="search" placeholder="在歌单内搜索"
            aria-label="在歌单内搜索歌名、歌手或专辑" autocomplete="off" @keydown.esc="handleEscape" />
          <Transition name="filter-clear" :css="state.settings.motion">
            <BaseButton v-if="search.query" class="filter-clear" aria-label="清空歌单搜索" @click="clearSearch">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </BaseButton>
          </Transition>
        </div>
      </div>
      <div class="table-head mb-[4px] grid grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] px-[10px] pt-[16px] pb-[8px] text-[11px] font-extrabold tracking-[.08em] opacity-[.6]" aria-hidden="true">
        <span>#</span><span>标题</span><span>专辑</span><span class="text-right">时长</span><span></span>
      </div>
    </template>
    <div v-if="showListTools && keyword && !matches.length" class="grid min-h-40 place-content-center justify-items-center gap-3">
      <EmptyState icon="search" aria-hidden="true" />
      <p class="text-sm text-white/70">这份歌单里没有匹配的歌曲</p>
    </div>
    <slot v-else :indices="matches" />
  </div>
</template>

<style scoped>
.pl-head { position: relative; padding-block: 4px 8px; }
/* 半调点阵层：压低点阵色到 9%，只做页头氛围，不与标题文字抢对比。 */
.pl-head-dots {
  position: absolute;
  inset: -6px -12px;
  --pop-halftone-color: rgb(255 255 255 / 9%);
}
.pl-head > :not(.pl-head-dots) { position: relative; }
/* 类型 kicker 改波普平涂 chip：pop-blue 实底白字，歌单/发现/每日三处详情页头统一。 */
.pl-kicker {
  width: fit-content;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--pop-blue);
  color: #fff;
  opacity: 1;
}
.pl-info { max-width: 100%; }
.pl-info h3:focus { outline: none; }
.banner-play:disabled { opacity: .45; }
.playlist-filter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  width: min(240px, 100%);
  min-height: 34px;
  margin-inline-start: auto;
  padding: 0 30px 0 11px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.4;
}
.playlist-filter input { width: 100%; min-height: 32px; background: transparent; }
.playlist-filter input::-webkit-search-cancel-button { display: none; }
.playlist-filter:has(input:focus-visible) > svg { opacity: 1; }
.filter-clear { position: absolute; right: 3px; display: grid; place-items: center; width: 27px; height: 27px; border-radius: 50%; }
.filter-clear:hover, .filter-clear:focus-visible { background: rgb(255 255 255 / .16); }
.filter-clear svg { width: 14px; height: 14px; }
@media (prefers-reduced-motion: no-preference) {
  .filter-clear-enter-active, .filter-clear-leave-active { transition: opacity 160ms ease; }
  .filter-clear-enter-from, .filter-clear-leave-to { opacity: 0; }
}
@media (max-width: 700px) {
  .playlist-filter { width: 100%; margin-inline-start: 0; }
}
</style>
