<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    total: number
    pageSize: number
    maxButtons?: number
    isCar?: boolean
  }>(),
  { maxButtons: 5, isCar: true }
)
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const page = computed({
  get: () => props.modelValue || 1,
  set: v => emit('update:modelValue', Math.max(1, v)),
})
const totalPages = computed(() =>
  Math.max(1, Math.ceil((props.total || 0) / (props.pageSize || 1)))
)
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

const pageNumbers = computed(() => {
  const max = props.maxButtons
  const total = totalPages.value
  const cur = page.value
  let start = Math.max(1, cur - Math.floor(max / 2))
  let end = Math.min(total, start + max - 1)
  if (end - start + 1 < max) start = Math.max(1, end - max + 1)
  const arr: number[] = []
  for (let i = start; i <= end; i++) arr.push(i)
  return arr
})

const goPrev = () => {
  if (canPrev.value) page.value = page.value - 1
}
const goNext = () => {
  if (canNext.value) page.value = page.value + 1
}
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2"
    :class="[isCar ? 'glass-nav' : '']"
  >
    <button
      class="glass-button px-3 py-2 text-sm"
      :class="canPrev ? 'text-white' : 'cursor-not-allowed text-white opacity-50'"
      :disabled="!canPrev"
      @click="goPrev"
    >
      {{ t('components.pagination.prev') }}
    </button>
    <div class="flex items-center gap-2">
      <button
        v-for="p in pageNumbers"
        :key="p"
        class="page-btn glass-button px-2 py-1 text-sm"
        :class="p === page ? 'selected' : 'text-white'"
        @click="page = p"
      >
        {{ p }}
      </button>
    </div>
    <span class="text-xs whitespace-nowrap text-white sm:text-sm">
      {{ t('components.pagination.status', { page, totalPages: totalPages, total: props.total }) }}
    </span>
    <button
      class="glass-button px-3 py-2 text-sm"
      :class="canNext ? 'text-white' : 'cursor-not-allowed text-white opacity-50'"
      :disabled="!canNext"
      @click="goNext"
    >
      {{ t('components.pagination.next') }}
    </button>
  </div>
</template>

<style scoped>
.page-btn {
  transition: all 0.2s ease;
}
</style>
