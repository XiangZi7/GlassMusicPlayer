<script setup lang="ts">
defineProps<{ active: boolean }>()
</script>

<template>
  <!-- 每行预留相同宽度，切歌时右侧时长和操作按钮保持对齐。 -->
  <span
    class="bars flex h-[14px] w-[16px] flex-none items-end justify-center justify-self-center gap-[2.5px]"
    aria-hidden="true"
  >
    <template v-if="active"><i /><i /><i /></template>
  </span>
</template>
