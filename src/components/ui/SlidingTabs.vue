<script setup lang="ts">
import { useTemplateRef } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useSlidingPill } from '@/composables/useSlidingPill'
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const root = useTemplateRef<HTMLElement>('root')
const props = defineProps<{
  modelValue: string
  options: readonly { label: string; value: string }[]
  kind?: 'tabs' | 'segment'
  group?: string
}>()
useSlidingPill(root, () => props.modelValue, props.group)
</script>
<template>
  <div ref="root">
    <BaseButton
      v-for="option in options"
      :key="option.value"
      :data-slide-value="option.value"
      :class="{ on: modelValue === option.value }"
      :role="kind === 'segment' ? undefined : 'tab'"
      :aria-selected="
        kind !== 'segment' ? modelValue === option.value : undefined
      "
      :aria-pressed="kind === 'segment' ? modelValue === option.value : undefined"
      @click="emit('update:modelValue', option.value)"
      >{{ option.label }}</BaseButton
    >
    <span
      class="tab-pill"
      :class="{ 'seg-pill': kind === 'segment' }"
      data-slide-pill
      aria-hidden="true"
    />
  </div>
</template>
