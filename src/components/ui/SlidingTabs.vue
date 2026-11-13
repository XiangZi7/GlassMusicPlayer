<script setup lang="ts">
import { useTemplateRef } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useSlidingPill } from '@/composables/useSlidingPill'
const selected = defineModel<string>({ required: true })
const root = useTemplateRef<HTMLElement>('root')
const props = defineProps<{
  options: { label: string; value: string }[]
  kind?: 'tabs' | 'segment'
  group?: string
}>()
useSlidingPill(root, () => selected.value, props.group)
</script>
<template>
  <div ref="root">
    <BaseButton
      v-for="option in options"
      :key="option.value"
      :data-slide-value="option.value"
      :class="{ on: selected === option.value }"
      :role="kind === 'segment' ? undefined : 'tab'"
      :aria-selected="
        kind !== 'segment' ? selected === option.value : undefined
      "
      :aria-pressed="kind === 'segment' ? selected === option.value : undefined"
      @click="selected = option.value"
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
