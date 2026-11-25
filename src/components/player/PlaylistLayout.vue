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
            :disabled="!playable" @click="emit('play')">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
            播放全部
          </BaseButton>
          <span data-pl-meta>{{ meta }}</span>
        </div>
      </div>
      <!-- 页头右侧波普填充：黑胶少女方框贴纸压住原空区，星与加号小贴纸在左侧两角点缀，整组不拦截交互。 -->
      <div class="pl-pop" aria-hidden="true">
        <img class="pl-pop-art pop-sticker pop-sticker--framed" style="--pop-sticker-angle: -3deg"
          src="/images/pop-radio.webp" width="1600" height="1600" alt="" decoding="async" />
        <span class="pl-pop-star pop-sticker" style="--pop-sticker-angle: 8deg">
          <svg viewBox="0 0 24 24">
            <path class="sticker-halo" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
            <path class="sticker-star" d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z" />
          </svg>
        </span>
        <span class="pl-pop-plus pop-sticker" style="--pop-sticker-angle: -10deg">
          <svg viewBox="0 0 24 24">
            <path class="sticker-halo" d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" />
            <path class="sticker-plus" d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" />
          </svg>
        </span>
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
.pl-head { position: relative; padding-block: 4px 8px; }
/* 半调点阵层：点色回到半调缺省的 16%，遮罩推迟到 40% 后才渐显——左侧文案区保持干净，右侧空区点田可感知。 */
.pl-head-dots {
  position: absolute;
  inset: -6px -12px;
  --pop-halftone-color: rgb(255 255 255 / 16%);
  mask-image: linear-gradient(90deg, transparent 40%, #000 78%);
  -webkit-mask-image: linear-gradient(90deg, transparent 40%, #000 78%);
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
/* 右侧波普填充组：靠右与封面近同高，高度收在页头内不撑高；窄窗先缩小再整体隐藏，不挤压左侧文案与按钮。 */
.pl-pop {
  flex: none;
  margin-left: auto;
  margin-right: 8px;
  width: 124px;
  height: 124px;
}
.pl-pop-art {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  object-fit: cover;
}
/* 小贴纸与榜单 tile 同配方：白晕作白边、内形平涂加墨描边；倾斜与投影走共享 .pop-sticker。 */
.pl-pop-star {
  position: absolute;
  top: -12px;
  left: -15px;
  z-index: 2;
  width: 34px;
  height: 34px;
}
.pl-pop-plus {
  position: absolute;
  bottom: -9px;
  left: -16px;
  z-index: 2;
  width: 24px;
  height: 24px;
}
.pl-pop-star svg,
.pl-pop-plus svg {
  display: block;
  width: 100%;
  height: 100%;
}
.pl-pop .sticker-halo { fill: #fff; }
.pl-pop .sticker-star {
  fill: var(--pop-yellow);
  stroke: var(--pop-ink);
  stroke-width: 1.4;
  transform: scale(0.76);
  transform-origin: center;
}
.pl-pop .sticker-plus {
  fill: var(--pop-pink);
  stroke: var(--pop-ink);
  stroke-width: 1.4;
  transform: scale(0.7);
  transform-origin: center;
}
@media (max-width: 1120px) {
  .pl-pop { width: 100px; height: 100px; }
}
@media (max-width: 880px) {
  .pl-pop { display: none; }
}
</style>
