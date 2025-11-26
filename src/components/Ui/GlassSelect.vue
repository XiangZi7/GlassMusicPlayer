<template>
  <div class="relative w-full rounded-2xl" ref="rootRef">
    <button
      type="button"
      class="glass-button text-primary flex w-full items-center justify-between overflow-hidden rounded-2xl px-3 py-2 text-left"
      @click="toggle"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <span
        class="icon-[mdi--chevron-down] h-5 w-5 text-white/70 transition"
        :class="{ 'rotate-180': open }"
      ></span>
    </button>

    <transition name="fade" mode="out-in">
      <div
        v-if="open"
        class="glass-dropdown absolute z-50 w-full overflow-hidden rounded-2xl shadow-lg backdrop-blur-md backdrop-filter"
      >
        <ul class="max-h-60 overflow-auto">
          <li
            v-for="opt in options"
            :key="String(opt.value)"
            class="option-item cursor-pointer rounded-md px-3 py-2 text-sm transition"
            :class="{ selected: opt.value === modelValue }"
            @click="select(opt.value)"
          >
            {{ opt.label }}
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
interface OptionItem {
  label: string
  value: any
}
const props = defineProps<{ modelValue: any; options: OptionItem[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: any): void }>()
const state = reactive({
  // 下拉是否展开
  open: false,
})
const { open } = toRefs(state)
const rootRef = ref<HTMLElement | null>(null)
const selectedLabel = computed(
  () => props.options.find(o => o.value === props.modelValue)?.label ?? ''
)
const toggle = () => (state.open = !state.open)
const select = (v: string | number) => {
  emit('update:modelValue', v)
  state.open = false
}
const onClickOutside = (e: MouseEvent) => {
  const el = rootRef.value
  if (!el) return
  if (!el.contains(e.target as Node)) state.open = false
}
onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.option-item {
  color: var(--glass-dropdown-text);
}
.option-item:hover {
  background: var(--glass-hover-item-bg);
}
.option-item.selected {
  background: var(--glass-hover-item-bg);
  color: var(--glass-hover-text);
}
</style>
