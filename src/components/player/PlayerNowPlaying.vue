<script setup lang="ts">
import { computed } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import BaseButton from '@/components/ui/BaseButton.vue'
import QueueList from '@/components/player/QueueList.vue'
import { usePlayer } from '@/composables/usePlayer'
import { notify } from '@/services/notification'

const { state, tracks } = usePlayer()
const source = computed(() => tracks[state.idx]?.catalog)
const playbackLabel = computed(() => {
  if (state.catalogStatus === 'loading') return '正在获取音频…'
  if (state.catalogStatus === 'preview') return '试听'
  if (state.catalogStatus === 'unavailable') return '当前曲目暂不可播'
  if (state.catalogStatus === 'error') return '音频加载失败'
  return ''
})

// Windows 客户端通过系统浏览器打开曲目原站，浏览器预览使用普通链接。
async function openSource(event: MouseEvent): Promise<void> {
  if (!isTauri() || !source.value) return
  event.preventDefault()
  try {
    await openUrl(source.value.sourceUrl)
  } catch {
    notify('无法打开原平台，请重试。', 'error')
  }
}
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <aside class="right min-h-[0] overflow-y-auto p-[16px_16px_18px]">
    <div
      class="right-head mb-[12px] flex items-center justify-between text-[11px] font-extrabold tracking-[.11em] opacity-[.9]"
    >
      <span>正在播放</span><span data-meta2></span>
    </div>
    <div class="r-coverwrap relative w-full">
      <div
        class="r-glow absolute inset-[14%_8%_-6%] z-[-1] rounded-full opacity-[.55]"
        data-glow
      ></div>
      <img decoding="async" loading="lazy"
        class="r-cover aspect-square w-full rounded-[20px] object-cover"
        data-cover
        alt="专辑封面"
      />
    </div>
    <div class="r-ttl mt-[14px] flex items-start justify-between gap-[10px]">
      <div>
        <h4 data-title></h4>
        <p data-artist></p>
        <small class="track-subtitle" data-track-subtitle hidden></small>
      </div>
      <BaseButton
        class="heart grid h-[36px] w-[36px] flex-none place-items-center rounded-full border-none bg-transparent text-inherit"
        data-like
        aria-label="收藏"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5 5 7.6 5c1.7 0 3.4 1 4.4 2.6C13 6 14.7 5 16.4 5 19 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8z"
          /></svg
      ></BaseButton>
    </div>
    <div class="subrow mt-[12px] flex gap-[7px]">
      <BaseButton data-lyricbtn>歌词</BaseButton
      ><BaseButton disabled>输出 · 系统默认</BaseButton>
    </div>
    <!-- 在线曲目状态及原平台入口。 -->
    <div
      v-if="source"
      class="mt-[10px] flex flex-wrap gap-[8px] text-[12px]"
    >
      <span
        v-if="playbackLabel"
        role="status"
        >{{ playbackLabel }}</span
      >
      <a
        :href="source.sourceUrl"
        target="_blank"
        rel="noreferrer"
        class="underline"
        @click="openSource"
        >打开原平台</a
      >
    </div>
    <div
      class="lyricbox mt-[12px] hidden p-[13px_14px] text-[13px] leading-[1.95] font-semibold"
      data-lyric
    ></div>
    <div
      class="secttl q-secttl m-[18px_2px_8px] flex items-center gap-[8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      <span>接下来播放 · QUEUE</span
      ><span
        class="q-radio-chip rounded-full p-[3px_8px] text-[9.5px] font-extrabold tracking-[.06em] whitespace-nowrap text-white"
        data-radio-chip
        hidden
        >电台续播中</span
      ><BaseButton
        class="q-radio-btn ml-auto flex-none rounded-full p-[4px_10px] text-[10.5px] font-extrabold whitespace-nowrap text-inherit"
        data-radio-quick
        type="button"
        >开启电台</BaseButton
      >
    </div>
    <QueueList />
  </aside>
</template>

<style scoped>
/* 侧栏与队列共用滚动容器，长歌词让浏览器跳过屏外文本并记住实测行高。 */
.long-lyrics :deep(.dim) {
  content-visibility: auto;
  contain-intrinsic-block-size: auto 1lh;
}
</style>
