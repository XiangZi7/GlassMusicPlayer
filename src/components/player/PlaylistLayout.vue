<script setup lang="ts">
import { computed } from 'vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { defaultCover } from '@/constants/music'

const props = defineProps<{
  title: string
  description: string
  cover?: string
  meta: string
  listKey: string
  playable: boolean
  showListTools: boolean
}>()
const emit = defineEmits<{ play: [] }>()
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
            :disabled="!playable" @click="emit('play')">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
            播放全部
          </BaseButton>
          <span data-pl-meta>{{ meta }}</span>
        </div>
      </div>
    </header>
    <template v-if="showListTools">
      <div class="sortbar m-[12px_2px_2px] flex flex-wrap items-center gap-[9px]">
        <span class="sort-lab text-[11px] font-extrabold tracking-[.08em] opacity-[.65]">排序</span>
        <PlayerTabs kind="segment" class="sort-seg inline-flex gap-[3px] rounded-full p-[3px]"
          role="group" aria-label="列表排序" hook="data-sort" :options="sortOptions" />
      </div>
      <div class="table-head mb-[4px] grid grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] px-[10px] pt-[16px] pb-[8px] text-[11px] font-extrabold tracking-[.08em] opacity-[.6]" aria-hidden="true">
        <span>#</span><span>标题</span><span>专辑</span><span class="text-right">时长</span><span></span>
      </div>
    </template>
    <slot />
  </div>
</template>

<style scoped>
.pl-head { padding-block: 4px 8px; }
.pl-info { max-width: 100%; }
.pl-info h3:focus { outline: none; }
.banner-play:disabled { opacity: .45; }
</style>
