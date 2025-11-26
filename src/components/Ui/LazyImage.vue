<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
const props = withDefaults(
  defineProps<{ src?: string; alt?: string; imgClass?: string; wrapperClass?: string }>(),
  {
    src: '',
    alt: '',
    imgClass: '',
    wrapperClass: '',
  }
)
const el = ref<HTMLElement | null>(null)
const realSrc = ref<string>('')
const isLoading = ref(false)
const hasError = ref(false)
useIntersectionObserver(
  el,
  ([entry]) => {
    if (entry.isIntersecting && !realSrc.value && props.src) {
      realSrc.value = props.src
      isLoading.value = true
      hasError.value = false
    }
  },
  { rootMargin: '300px' }
)
const handleLoad = () => {
  isLoading.value = false
  hasError.value = false
}
const handleError = () => {
  isLoading.value = false
  hasError.value = true
}
</script>

<template>
  <div ref="el" :class="['relative h-full w-full', wrapperClass]">
    <img
      v-if="realSrc && !hasError"
      :src="realSrc"
      :alt="alt"
      :class="imgClass"
      loading="lazy"
      @load="handleLoad"
      @error="handleError"
    />
    <div v-else class="glass-button flex h-full w-full items-center justify-center">
      <span class="icon-[mdi--image-off] text-glass-70 h-6 w-6"></span>
    </div>
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
      <span class="icon-[mdi--loading] text-glass-70 h-6 w-6 animate-spin"></span>
    </div>
  </div>
</template>
