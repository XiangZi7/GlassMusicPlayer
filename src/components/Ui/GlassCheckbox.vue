<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; label?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
const onToggle = () => emit('update:modelValue', !props.modelValue)
const onChange = (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked)
</script>

<template>
  <label class="inline-flex cursor-pointer items-center gap-2">
    <input type="checkbox" class="sr-only" :checked="modelValue" @change="onChange" />
    <span
      class="flex h-5 w-5 items-center justify-center rounded-md border"
      :class="[
        modelValue
          ? 'border-white/40 bg-white/70 text-black'
          : 'border-white/30 bg-transparent text-primary/70',
      ]"
      @click.prevent="onToggle"
    >
      <span v-if="modelValue" class="icon-[mdi--check] h-4 w-4"></span>
    </span>
    <span class="text-sm" :class="modelValue ? 'text-primary' : 'text-muted-glass'">{{ label }}</span>
  </label>
</template>

<style scoped>
</style>