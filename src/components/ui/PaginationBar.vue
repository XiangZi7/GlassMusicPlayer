<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
defineProps<{
  pageKey: string;
  total: number;
  current: number;
  slots: (number | string)[];
}>();
</script>
<template>
  <!-- 原稿公共分页：保留所有类名、SVG、间距与事件数据，胶囊沿用原来的 FLIP 动画。 -->
  <BaseButton
    class="pg-btn"
    :data-pg-go="pageKey + ':' + (current - 1)"
    :disabled="current <= 1"
    aria-label="上一页"
    ><svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M14.5 5.5L8 12l6.5 6.5" /></svg
  ></BaseButton>
  <template v-for="(page, index) in slots" :key="index">
    <span v-if="page === '…'" class="pg-ellipsis" aria-hidden="true">…</span>
    <BaseButton
      v-else
      class="pg-btn"
      :class="{ on: page === current }"
      :data-pg-go="pageKey + ':' + page"
      :aria-label="'第 ' + page + ' 页'"
      :aria-current="page === current ? 'page' : undefined"
      >{{ page }}</BaseButton
    >
  </template>
  <BaseButton
    class="pg-btn"
    :data-pg-go="pageKey + ':' + (current + 1)"
    :disabled="current >= Math.ceil(total / 10)"
    aria-label="下一页"
    ><svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9.5 5.5L16 12l-6.5 6.5" /></svg
  ></BaseButton>
  <span class="pg-total">共 {{ total }} 首</span>
  <span class="pg-pill" aria-hidden="true" />
</template>
