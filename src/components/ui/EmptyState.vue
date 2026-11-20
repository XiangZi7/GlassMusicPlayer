<script setup lang="ts">
type EmptyIcon =
  | 'music'
  | 'search'
  | 'playlist'
  | 'download'
  | 'upload'
  | 'link'
  | 'heart'
  | 'history'

withDefaults(defineProps<{ icon?: EmptyIcon; label?: string }>(), {
  icon: 'music',
  label: '暂无内容',
})
</script>

<template>
  <div
    class="flex h-full w-full items-center justify-center"
    role="img"
    :aria-label="label"
    data-empty-state
    :data-empty-icon="icon"
  >
    <svg
      class="size-12 opacity-30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path
        v-if="icon === 'heart'"
        d="M12 20.7C6.4 17 3 13.6 3 9.9C3 7.2 5 5 7.6 5C9.3 5 10.7 6 12 7.6C13.3 6 14.7 5 16.4 5C19 5 21 7.2 21 9.9C21 13.6 17.6 17 12 20.7Z"
      />
      <template v-else-if="icon === 'history'">
        <path d="M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5M12 7v5l4 2" />
      </template>
      <template v-else-if="icon === 'search'">
        <circle
          cx="10.5"
          cy="10.5"
          r="6.5"
        />
        <path d="m16 16 5 5" />
      </template>
      <template v-else-if="icon === 'playlist'">
        <path d="M4 5h16M4 10h16M4 15h7M17 14v7M13.5 17.5h7" />
      </template>
      <template v-else-if="icon === 'download'">
        <path
          d="M12 3v12m-5-5 5 5 5-5M5 17v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"
        />
      </template>
      <template v-else-if="icon === 'upload'">
        <path
          d="M12 16V3m-5 5 5-5 5 5M5 17v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"
        />
      </template>
      <template v-else-if="icon === 'link'">
        <path
          d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"
        />
      </template>
      <template v-else>
        <path d="M9 18V5l12-2v13M9 8l12-2" />
        <ellipse
          cx="6"
          cy="18"
          rx="3"
          ry="3"
        />
        <ellipse
          cx="18"
          cy="16"
          rx="3"
          ry="3"
        />
      </template>
    </svg>
  </div>
</template>
