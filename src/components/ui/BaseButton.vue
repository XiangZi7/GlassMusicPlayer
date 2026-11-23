<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
  }>(),
  { type: 'button', loading: false, disabled: false }
)
</script>

<template>
  <!-- 视觉类名、SVG 与数据钩子由原稿传入，公共组件只统一按钮语义和状态。 -->
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <svg
      v-if="loading"
      class="base-button-spinner inline-block size-3.5 shrink-0 align-middle motion-safe:animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="5.5"
        opacity=".2"
      />
      <path
        d="M8 2.5A5.5 5.5 0 0 1 13.5 8"
        stroke-linecap="round"
      />
    </svg>
    <slot />
  </button>
</template>

<style scoped>
:global(.calm .base-button-spinner) {
  animation: none;
}
</style>
