<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    total: number
    pageSize: number
    maxButtons?: number
  }>(),
  { maxButtons: 5 }
)
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const page = computed({
  get: () => props.modelValue || 1,
  set: v => emit('update:modelValue', Math.max(1, v)),
})
const totalPages = computed(() => Math.max(1, Math.ceil((props.total || 0) / (props.pageSize || 1))))
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
  <div class="glass-nav flex items-center gap-2 rounded-xl px-3 py-2">
    <button
      class="glass-button px-3 py-2 text-sm"
      :class="canPrev ? 'text-glass' : 'cursor-not-allowed opacity-50 text-muted-glass'"
      :disabled="!canPrev"
      @click="goPrev"
    >
      上一页
    </button>
    <div class="flex items-center gap-2">
      <button
        v-for="p in pageNumbers"
        :key="p"
        class="glass-button px-3 py-1 text-sm"
        :class="p === page ? 'bg-white/25 text-pink-300 ring-1 ring-pink-300/40' : 'text-muted-glass'"
        @click="page = p"
      >
        {{ p }}
      </button>
    </div>
    <span class="text-muted-glass">
      第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 条
    </span>
    <button
      class="glass-button px-3 py-2 text-sm"
      :class="canNext ? 'text-glass' : 'cursor-not-allowed opacity-50 text-muted-glass'"
      :disabled="!canNext"
      @click="goNext"
    >
      下一页
    </button>
  </div>
</template>

<style scoped>
/* no-op */
</style>