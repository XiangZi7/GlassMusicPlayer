<script setup lang="ts">
import { defaultCover } from '@/constants/music'

defineProps<{ src?: string; motion: boolean; large?: boolean }>()

// 只显现已加载的这张封面，切歌后的新图片会从本地音符占位开始。
function revealCover(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  image.dataset.loaded = ''
}
</script>

<template>
  <span
    aria-hidden="true"
    class="pointer-events-none block shrink-0 overflow-hidden bg-cover bg-center ring-1 ring-white/20"
    :class="large ? 'size-12 rounded-[12px]' : 'size-[26px] rounded-full'"
    :style="{ backgroundImage: 'url(' + defaultCover + ')' }"
  >
    <img
      v-if="src && src !== defaultCover"
      :key="src"
      :src="src"
      alt=""
      draggable="false"
      decoding="async"
      loading="lazy"
      referrerpolicy="no-referrer"
      class="block size-full object-cover opacity-0 data-[loaded]:opacity-100"
      :class="{ 'motion-safe:transition-opacity motion-safe:duration-150': motion }"
      @load="revealCover"
    />
  </span>
</template>
