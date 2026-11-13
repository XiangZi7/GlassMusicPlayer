<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
defineProps<{
  options: { label: string; value: string }[];
  hook: string;
  kind?: "tabs" | "segment";
}>();
</script>

<template>
  <!-- 保留原稿标签条的 DOM 与滑动胶囊，由原稿导航逻辑切换当前项。 -->
  <div>
    <BaseButton
      v-for="option in options"
      :key="option.value"
      v-bind="{ [hook]: option.value }"
      >{{ option.label }}</BaseButton
    >
    <span
      class="tab-pill"
      :class="{ 'seg-pill': kind === 'segment' }"
      aria-hidden="true"
    />
  </div>
</template>
