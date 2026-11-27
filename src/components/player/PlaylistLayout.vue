<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { defaultCover } from '@/constants/music'
import { artworkColor } from '@/services/player/artwork-color'
import { usePlayer } from '@/composables/usePlayer'

const { state } = usePlayer()

const props = defineProps<{
  title: string
  description: string
  cover?: string
  meta: string
  listKey: string
  playable: boolean
  showListTools: boolean
}>()
const emit = defineEmits<{ play: []; shuffle: [] }>()
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

// 页头氛围状态：封面主色三元组（"r,g,b"），供页头氛围光取用，取不到时为空串回退无光。
const head = reactive({
  /** 当前封面的主色，供氛围光按透明度取用。 */
  accent: '',
})

// 换封面时重新取主色，氛围光随之更新；取色失败或结果已过期时回退无光。
watch(
  () => props.cover,
  async (cover, _previous, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    if (!cover) {
      head.accent = ''
      return
    }
    const rgb = await artworkColor(cover, document)
    if (current) head.accent = rgb ? rgb.join(',') : ''
  },
  { immediate: true }
)
</script>

<template>
  <div class="playlist-layout">
    <header
      :key="title + '|' + (cover || '')"
      class="pl-head flex items-center gap-4.5"
      :class="{ 'pl-head-in': state.settings.motion }"
    >
      <!-- 页头氛围光：只取封面主色在页头带晕开一层柔光，换单时随封面交叉淡变，不进列表区。 -->
      <span
        v-if="head.accent"
        class="pl-head-glow"
        :style="{ '--pl-accent': head.accent }"
        aria-hidden="true"
      />
      <!-- 页头波普半调点阵：只铺在页头带，低透明从左向右渐显，不进列表区。 -->
      <span class="pl-head-dots pop-halftone" aria-hidden="true" />
      <!-- 页头半调第二层：更大间距的蓝点错位叠在第一层右侧，形成点田层次，仍不进文案区。 -->
      <span class="pl-head-dots pl-head-dots-accent pop-halftone" aria-hidden="true" />
      <img :src="cover || defaultCover" alt="" width="148" height="148" decoding="async"
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
          <!-- 随机播放：幽灵小圆钮，排在歌曲数之后，打乱顺序后从第一首开始播。 -->
          <BaseButton
            class="pl-shuffle grid h-[38px] w-[38px] flex-none place-items-center rounded-full p-0"
            :disabled="!playable"
            aria-label="随机播放"
            title="随机播放"
            @click="emit('shuffle')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="m4 4 5 5" /></svg>
          </BaseButton>
        </div>
      </div>
    </header>
    <template v-if="showListTools">
      <div class="sortbar m-[16px_2px_2px] flex flex-wrap items-center gap-[9px]">
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
/* 页头氛围光：封面主色径向晕开，只铺页头带左侧封面周围，向右向下渐隐，不进列表区。 */
.pl-head-glow {
  position: absolute;
  inset: -18px -24px;
  background: radial-gradient(
    ellipse 680px 280px at 110px 50%,
    rgba(var(--pl-accent, 255, 255, 255), 0.32),
    rgba(var(--pl-accent, 255, 255, 255), 0.12) 52%,
    transparent 76%
  );
  pointer-events: none;
}
/* 换歌单时页头整组淡入：新封面与文案 200ms 淡入上浮，只动 opacity/transform；关动效时不加此类。 */
@media (prefers-reduced-motion: no-preference) {
  .pl-head-in { animation: pl-head-in 200ms ease-out both; }
  .pl-head-glow { animation: pl-glow-in 260ms ease-out both; }
}
@keyframes pl-head-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pl-glow-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* 半调点阵层：点色提到 20%，遮罩推迟到 36% 后才渐显——左侧文案区保持干净，右侧空区点田可感知。 */
.pl-head-dots {
  position: absolute;
  inset: -6px -12px;
  --pop-halftone-color: rgb(255 255 255 / 20%);
  mask-image: linear-gradient(90deg, transparent 36%, #000 76%);
  -webkit-mask-image: linear-gradient(90deg, transparent 36%, #000 76%);
}
/* 歌单封面：与效果图一致的干净圆角大封面，不带贴纸白边与硬阴影，颜色交给封面本身。 */
.pl-head > img {
  flex: none;
  width: 148px;
  height: 148px;
  border-radius: 18px;
  object-fit: cover;
  box-shadow: 0 18px 36px rgb(0 0 0 / 35%);
}
.pl-head > :not(.pl-head-dots):not(.pl-head-glow) { position: relative; }
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
/* 歌曲数文案：与播放按钮同行，字重与透明度压低一档，主次分明。 */
.pl-actions [data-pl-meta] { font-size: 12.5px; font-weight: 600; opacity: .68; }
.banner-play:disabled { opacity: .45; }
/* 随机播放幽灵圆钮：透明底细边，与实心播放全部拉开主次；悬停提亮、按下轻缩，150ms。 */
.pl-shuffle {
  border: 1px solid rgb(255 255 255 / 22%);
  background: rgb(255 255 255 / 6%);
  color: inherit;
}
.pl-shuffle svg { width: 17px; height: 17px; }
.pl-shuffle:disabled { opacity: .45; }
@media (prefers-reduced-motion: no-preference) {
  .pl-shuffle { transition: filter 150ms ease, transform 150ms ease; }
}
.pl-shuffle:hover:not(:disabled) { filter: brightness(1.25); }
.pl-shuffle:active:not(:disabled) { transform: scale(0.94); }
/* 半调第二层：22px 蓝点与第一层错位，只在最右 40% 出现，给点田加一层色彩深度。 */
.pl-head-dots-accent {
  position: absolute;
  inset: -6px -12px;
  --pop-halftone-color: rgb(126 172 255 / 15%);
  --pop-halftone-size: 22px;
  background-position: 7px 9px;
  mask-image: linear-gradient(90deg, transparent 60%, #000 92%);
  -webkit-mask-image: linear-gradient(90deg, transparent 60%, #000 92%);
}
@media (max-width: 880px) {
  .pl-head > img { width: 118px; height: 118px; }
}
</style>
