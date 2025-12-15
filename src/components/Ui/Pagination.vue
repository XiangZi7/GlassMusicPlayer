<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/Ui/Button.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    modelValue: number
    total: number
    pageSize: number
    maxButtons?: number
    showCard?: boolean
  }>(),
  { maxButtons: 5, showCard: true }
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
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-center gap-2 rounded-xl px-3 py-2"
    :class="[showCard ? 'glass-card' : '']"
  >
    <Button
      variant="ghost"
      size="sm"
      rounded="lg"
      class="h-8 w-8 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
      :disabled="!canPrev"
      @click="goPrev"
    >
      <span class="icon-[mdi--chevron-left] h-5 w-5" />
      <span class="hidden text-sm font-medium sm:inline">{{ t('components.pagination.prev') }}</span>
    </Button>

    <div class="flex items-center gap-1.5">
      <template v-for="(p, idx) in pageNumbers" :key="p">
        <span
          v-if="idx === 0 && p > 1"
          class="hidden px-1 text-primary/40 sm:inline"
        >...</span>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all"
          :class="p === page
            ? 'bg-linear-to-br from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/25'
            : 'glass-card text-primary/70 hover:bg-hover-glass hover:text-primary'"
          @click="page = p"
        >
          {{ p }}
        </button>
        <span
          v-if="idx === pageNumbers.length - 1 && p < totalPages"
          class="hidden px-1 text-primary/40 sm:inline"
        >...</span>
      </template>
    </div>

    <Button
      variant="ghost"
      size="sm"
      rounded="lg"
      class="h-8 w-8 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
      :disabled="!canNext"
      @click="goNext"
    >
      <span class="hidden text-sm font-medium sm:inline">{{ t('components.pagination.next') }}</span>
      <span class="icon-[mdi--chevron-right] h-5 w-5" />
    </Button>

    <span class="ml-1 hidden text-xs text-primary/50 sm:inline">
      {{ page }} / {{ totalPages }}
    </span>
  </div>
</template>
