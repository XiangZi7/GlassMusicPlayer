<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { usePlayer } from '@/composables/usePlayer'

const { state, tracks } = usePlayer()
const { playing, audioLoading, settings } = toRefs(state)
const disabled = computed(() =>
  tracks[state.idx] ? !tracks[state.idx]?.catalog : !state.queue?.length
)
const label = computed(() =>
  audioLoading.value
    ? '正在获取音频，点击取消'
    : playing.value
      ? '暂停'
      : '播放'
)
</script>

<template>
  <button
    type="button"
    data-play
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    :aria-busy="audioLoading"
  >
    <svg
      v-if="audioLoading"
      :class="{ 'motion-safe:animate-spin': settings.motion }"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        opacity=".22"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke-linecap="round"
      />
    </svg>
    <svg
      v-else-if="playing"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="5"
        width="4"
        height="14"
        rx="1"
      />
      <rect
        x="14"
        y="5"
        width="4"
        height="14"
        rx="1"
      />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  </button>
</template>
