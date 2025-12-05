<template>
  <div class="relative w-full rounded-2xl" ref="rootRef">
    <button
      ref="triggerRef"
      type="button"
      class="glass-button text-primary flex w-full items-center justify-between overflow-hidden rounded-2xl px-3 py-2 text-left"
      @click="toggle"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <span
        class="icon-[mdi--chevron-down] text-primary/70 h-5 w-5 transition"
        :class="{ 'rotate-180': open }"
      ></span>
    </button>

    <Teleport to="body">
      <transition name="fade" mode="out-in">
        <div
          v-if="open"
          ref="dropdownRef"
          class="glass-dropdown fixed z-99999 overflow-hidden rounded-2xl shadow-lg backdrop-blur-md backdrop-filter"
          :style="dropdownStyle"
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
    </Teleport>
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
  open: false,
})
const { open } = toRefs(state)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const dropdownStyle = ref<{ top: string; left: string; width: string }>({
  top: '0px',
  left: '0px',
  width: '0px',
})

const updatePosition = () => {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}

const selectedLabel = computed(
  () => props.options.find(o => o.value === props.modelValue)?.label ?? ''
)
const toggle = () => {
  if (!state.open) updatePosition()
  state.open = !state.open
}
const select = (v: string | number) => {
  emit('update:modelValue', v)
  state.open = false
}
const onClickOutside = (e: MouseEvent) => {
  const root = rootRef.value
  const dropdown = dropdownRef.value
  if (!root) return
  const target = e.target as Node
  if (!root.contains(target) && !dropdown?.contains(target)) {
    state.open = false
  }
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
