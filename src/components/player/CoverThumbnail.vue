<script setup lang="ts">
import { computed, reactive } from 'vue'
import { defaultCover } from '@/constants/music'
import { coverThumbnail } from '@/services/player/cover-thumbnail'

const props = defineProps<{ src: string; size: number }>()
const emit = defineEmits<{ error: [event: Event] }>()
const failed = reactive({
  // 此封面的缩略图加载失败时只重试平台原图。
  thumbnail: '',
  // 原图也失效时沿用播放器占位图。
  original: '',
})
const source = computed(() => {
  if (!props.src || failed.original === props.src) return defaultCover
  return failed.thumbnail === props.src ? props.src : coverThumbnail(props.src, props.size)
})
const candidates = computed(() => {
  if (source.value === props.src || source.value === defaultCover) return undefined
  const large = coverThumbnail(props.src, props.size * 2)
  return source.value + ' 1x, ' + large + ' 2x'
})

// 原生图片选中的尺寸失效时回退原图，只有原图也失败才触发所属卡片的缺图状态。
function retryOriginal(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  if (image.getAttribute('src') !== source.value || source.value === defaultCover) return
  if (candidates.value) {
    failed.thumbnail = props.src
    return
  }
  emit('error', event)
  failed.original = props.src
}
</script>

<template>
  <img :key="src" :srcset="candidates" :src="source" decoding="async" @error="retryOriginal" />
</template>
