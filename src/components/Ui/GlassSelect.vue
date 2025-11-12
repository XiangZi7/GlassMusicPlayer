<template>
  <div class="relative w-full" ref="rootRef">
    <button
      type="button"
      class="flex w-full items-center justify-between rounded bg-white/10 px-3 py-2 text-left text-white backdrop-blur transition hover:bg-white/15"
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
        class="absolute z-50 mt-2 w-full overflow-hidden rounded bg-black/40 shadow-lg backdrop-blur"
      >
        <ul class="max-h-60 overflow-auto">
          <li
            v-for="opt in options"
            :key="String(opt.value)"
            class="cursor-pointer px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
            :class="{ 'bg-white/10 text-white': opt.value === modelValue }"
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
  value: string | number
}
const props = defineProps<{ modelValue: string | number; options: OptionItem[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | number): void }>()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const selectedLabel = computed(
  () => props.options.find(o => o.value === props.modelValue)?.label ?? ''
)
const toggle = () => (open.value = !open.value)
const select = (v: string | number) => {
  emit('update:modelValue', v)
  open.value = false
}
const onClickOutside = (e: MouseEvent) => {
  const el = rootRef.value
  if (!el) return
  if (!el.contains(e.target as Node)) open.value = false
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
</style>
