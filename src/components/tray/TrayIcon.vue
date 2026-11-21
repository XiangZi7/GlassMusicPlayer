<script setup lang="ts">
const icons = {
  music:
    'M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3c1.66 0 3 1.34 3 3ZM21 16a3 3 0 1 1-3-3c1.66 0 3 1.34 3 3Z',
  window:
    'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 9h18M7 6.5h.01M10 6.5h.01',
  mini: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM12 12h6v5h-6Z',
  lyrics: 'M4 5h16M4 10h11M4 15h16M4 20h9',
  media:
    'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 22h8M12 18v4M10 8l5 3-5 3Z',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l.5 2.2 1.8 1.1 2.2-.6 3 5.1-1.7 1.5v2.1l1.7 1.5-3 5.1-2.2-.6-1.8 1.1L15 23H9l-.5-2.2-1.8-1.1-2.2.6-3-5.1 1.7-1.5v-2.1L1.5 11.1l3-5.1 2.2.6 1.8-1.1L9 3Z',
  power: 'M12 2v10M5.64 5.64a9 9 0 1 0 12.72 0',
  play: 'M8 5.5v13L19 12Z',
  pause: 'M6 5h4v14H6ZM14 5h4v14h-4Z',
  arrow: 'M7 17 17 7M7 7h10v10',
  chevron: 'm9 5 7 7-7 7',
} as const

const props = defineProps<{ name: keyof typeof icons }>()
</script>

<template>
  <!-- 内置同一套线性 SVG，托盘首次打开不依赖在线图标服务。 -->
  <svg
    viewBox="0 0 24 24"
    :fill="
      props.name === 'play' || props.name === 'pause' ? 'currentColor' : 'none'
    "
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="icons[props.name]" />
  </svg>
</template>
