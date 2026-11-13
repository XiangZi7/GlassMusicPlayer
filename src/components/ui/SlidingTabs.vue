<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed } from "vue";

const props = defineProps<{
  options: { value: string; label: string }[];
  label: string;
}>();
const model = defineModel<string>({ required: true });
const activeIndex = computed(() =>
  Math.max(
    0,
    props.options.findIndex((option) => option.value === model.value),
  ),
);
</script>

<template>
  <div
    class="glass relative inline-grid max-w-full gap-1 rounded-full border border-white/10 p-1 text-xs font-bold"
    :style="{
      gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
    }"
    role="group"
    :aria-label="label"
  >
    <span
      class="sliding-pill pointer-events-none absolute inset-y-1 left-1 rounded-full"
      :style="{
        width: `calc((100% - 8px) / ${options.length})`,
        transform: `translateX(${activeIndex * 100}%)`,
      }"
    />
    <BaseButton
      v-for="option in options"
      :key="option.value"
      type="button"
      class="relative z-10 min-h-8 truncate rounded-full px-3 transition-colors"
      :class="
        model === option.value ? 'text-white' : 'text-muted hover:text-white'
      "
      :aria-pressed="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </BaseButton>
  </div>
</template>
