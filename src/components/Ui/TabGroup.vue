<script setup lang="ts" generic="T extends string | number">
export interface Tab<T> {
  key: T
  labelKey: string
  icon: string
  count?: number
}

interface Props {
  tabs: readonly Tab<T>[]
  modelValue: T
  variant?: 'glass' | 'gradient'
  size?: 'sm' | 'md'
  showCount?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'glass',
  size: 'md',
  showCount: true,
})

const emit = defineEmits<{
  'click': [value: T]
}>()

const handleTabClick = (key: T) => {
  emit('click', key)
}
</script>

<template>
  <div
    class="flex items-center gap-2 p-1.5 transition-all"
    :class="{
      'glass-card': variant === 'glass',
      'rounded-xl bg-white/5 backdrop-blur-sm': variant === 'gradient',
    }"
  >
    <button
      v-for="tab in tabs"
      :key="String(tab.key)"
      class="relative flex items-center gap-2 rounded-xl transition-all duration-300"
      :class="[
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        modelValue === tab.key
          ? variant === 'glass'
            ? 'bg-hover-glass text-primary shadow-sm font-medium'
            : 'bg-linear-to-r from-pink-500/80 to-rose-500/80 text-white shadow-sm font-medium'
          : 'text-primary/60 hover:text-primary/80 hover:bg-hover-glass/50 font-medium',
      ]"
      @click="handleTabClick(tab.key)"
    >
      <span :class="tab.icon" class="h-4 w-4"></span>
      <span>{{ $t(tab.labelKey) }}</span>
      <span
        v-if="showCount && tab.count !== undefined"
        class="rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
        :class="
          modelValue === tab.key
            ? variant === 'glass'
              ? 'bg-button-glass text-primary'
              : 'bg-white/20 text-white'
            : 'bg-button-glass/50 text-primary/60'
        "
      >
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>
