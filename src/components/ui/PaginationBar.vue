<script setup lang="ts">
import { computed, watch } from "vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import BaseButton from "@/components/ui/BaseButton.vue";

const props = withDefaults(
  defineProps<{
    total: number;
    pageSize?: number;
    label?: string;
    unit?: string;
  }>(),
  { pageSize: 10, label: "歌曲分页", unit: "首" },
);
const currentPage = defineModel<number>({ required: true });
const pageCount = computed(() =>
  Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))),
);
const pages = computed(() => {
  if (pageCount.value <= 7)
    return Array.from({ length: pageCount.value }, (_, index) => index + 1);
  if (currentPage.value <= 4) return [1, 2, 3, 4, 5, "…", pageCount.value];
  if (currentPage.value >= pageCount.value - 3)
    return [
      1,
      "…",
      ...Array.from({ length: 5 }, (_, index) => pageCount.value - 4 + index),
    ];
  return [
    1,
    "…",
    currentPage.value - 1,
    currentPage.value,
    currentPage.value + 1,
    "…",
    pageCount.value,
  ];
});
const activeIndex = computed(() => pages.value.indexOf(currentPage.value));
watch(pageCount, (count) => {
  currentPage.value = Math.max(1, Math.min(count, currentPage.value));
});
</script>

<template>
  <nav
    v-if="pageCount > 1"
    class="mt-6 flex flex-wrap items-center justify-center gap-4"
    :aria-label="label"
  >
    <div
      class="glass flex items-center gap-1 rounded-full border border-white/10 p-1"
    >
      <BaseButton
        variant="icon"
        aria-label="上一页"
        :disabled="currentPage === 1"
        @click="currentPage--"
        ><AppIcon name="chevronLeft" :size="14"
      /></BaseButton>
      <div class="relative flex gap-0.5">
        <span
          class="sliding-pill pointer-events-none absolute top-0 size-8 rounded-full"
          :style="{ transform: `translateX(${activeIndex * 34}px)` }"
        />
        <template v-for="(value, index) in pages" :key="index">
          <BaseButton
            v-if="typeof value === 'number'"
            class="relative z-10 size-8 rounded-full font-mono text-xs"
            :aria-label="`第 ${value} 页`"
            :aria-current="currentPage === value ? 'page' : undefined"
            @click="currentPage = value"
            >{{ value }}</BaseButton
          >
          <span
            v-else
            class="grid size-8 place-items-center text-muted"
            aria-hidden="true"
            >…</span
          >
        </template>
      </div>
      <BaseButton
        variant="icon"
        aria-label="下一页"
        :disabled="currentPage === pageCount"
        @click="currentPage++"
        ><AppIcon name="chevronRight" :size="14"
      /></BaseButton>
    </div>
    <span class="text-[11px] text-muted">共 {{ total }} {{ unit }}</span>
  </nav>
</template>
