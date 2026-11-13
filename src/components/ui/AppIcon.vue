<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });

const paths: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z",
  search: "M21 21l-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  library: "M4 6h16M4 12h16M4 18h10",
  link: "m10 14 4-4M8 16l-2 2a4.2 4.2 0 0 1-6-6l5-5a4.2 4.2 0 0 1 6 0m2 2 2-2a4.2 4.2 0 0 1 6 6l-5 5a4.2 4.2 0 0 1-6 0",
  radio:
    "M12 12h.01M8.5 15.5a5 5 0 0 1 0-7m7 0a5 5 0 0 1 0 7M5.5 18.5a9.2 9.2 0 0 1 0-13m13 0a9.2 9.2 0 0 1 0 13",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Zm6 9a3 3 0 1 0-6 0 3 3 0 0 0 6 0",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  play: "m9 5 11 7-11 7Z",
  pause: "M8 5v14M16 5v14",
  previous: "M5 5v14m14-14L8 12l11 7Z",
  next: "M19 5v14M5 5l11 7-11 7Z",
  shuffle:
    "M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4",
  repeat:
    "m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3",
  volume: "m11 5-5 4H3v6h3l5 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
  mute: "m11 5-5 4H3v6h3l5 4Zm5 4 6 6m0-6-6 6",
  queue: "M3 6h18M3 12h18M3 18h10m4-3 4 3-4 3",
  speaker: "M6 3h12v18H6Zm9 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0M12 7h.01",
  monitor: "M3 4h18v13H3Zm5 17h8m-4-4v4",
  lyrics: "M4 6h16M4 12h10M4 18h13",
  chevronLeft: "m15 5-7 7 7 7",
  chevronRight: "m9 5 7 7-7 7",
  chevronDown: "m5 9 7 7 7-7",
  close: "m6 6 12 12M18 6 6 18",
  minus: "M5 12h14",
  maximize: "M5 5h14v14H5Z",
  plus: "M12 5v14M5 12h14",
  upload: "M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6",
  folder: "M3 6h7l2 3h9v12H3Z",
  download: "M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  edit: "m15 4 5 5M3 21l5-1L21 7l-5-5L3 15Z",
  check: "m5 12 4 4L20 5",
  lock: "M6 10h12v11H6Zm3 0V6a3 3 0 0 1 6 0v4",
  music: "M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3m15 1a3 3 0 1 1-3-3",
};
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="name === 'pause' ? 4 : 1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <path
      :d="paths[name] || paths.music"
      :fill="name === 'play' ? 'currentColor' : 'none'"
    />
  </svg>
</template>
