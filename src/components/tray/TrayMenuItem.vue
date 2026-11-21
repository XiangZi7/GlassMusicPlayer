<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import TrayIcon from '@/components/tray/TrayIcon.vue'
import type { TrayMenuEntry, TrayMenuAction } from '@/types/tray'

const props = withDefaults(
  defineProps<{
    entry: TrayMenuEntry
    disabled?: boolean
    pending?: boolean
    loading?: boolean
  }>(),
  { disabled: false, pending: false, loading: false }
)
const emit = defineEmits<{ select: [action: TrayMenuAction] }>()
</script>

<template>
  <BaseButton
    role="menuitem"
    class="tray-menu-item"
    :class="{
      'tray-menu-primary': entry.id === 'main',
      'tray-menu-exit': entry.id === 'exit',
    }"
    :data-tray-action="entry.id"
    :disabled="disabled || pending"
    :aria-label="disabled ? `${entry.label}，已在设置中关闭` : entry.label"
    :aria-busy="loading || undefined"
    @click="emit('select', props.entry.id)"
  >
    <span class="tray-item-icon"><TrayIcon :name="entry.icon" /></span>
    <span class="tray-item-label">{{ entry.label }}</span>
    <span
      v-if="loading"
      class="tray-item-spinner"
      aria-hidden="true"
    />
    <span
      v-else-if="disabled"
      class="tray-item-hint"
      >已关闭</span
    >
    <TrayIcon
      v-else-if="entry.id === 'main'"
      name="arrow"
      class="tray-item-arrow"
    />
  </BaseButton>
</template>

<style scoped>
.tray-menu-item {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 11px;
  padding: 7px 10px;
  color: rgb(255 255 255 / 0.88);
  background: transparent;
  text-align: left;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}
.tray-menu-item:not(:disabled):hover {
  border-color: rgb(255 255 255 / 0.07);
  background: rgb(255 255 255 / 0.08);
  color: #fff;
}
.tray-menu-item:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.7);
  outline-offset: -2px;
  background: rgb(255 255 255 / 0.08);
}
.tray-menu-item:disabled {
  cursor: default;
  opacity: 0.45;
}
.tray-item-icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 8px;
  background: rgb(255 255 255 / 0.055);
}
.tray-item-icon svg {
  width: 16px;
  height: 16px;
}
.tray-item-label {
  min-width: 0;
  flex: 1;
  font-size: 12.5px;
  font-weight: 650;
  line-height: 1.45;
}
.tray-item-hint {
  flex: none;
  font-size: 10px;
  font-weight: 500;
}
.tray-menu-primary {
  border-color: rgb(255 255 255 / 0.12);
  background: rgb(255 255 255 / 0.075);
}
.tray-menu-primary .tray-item-icon {
  border-color: transparent;
  background: rgb(255 255 255 / 0.93);
  color: #14141c;
}
.tray-item-arrow {
  width: 15px;
  height: 15px;
  color: rgb(255 255 255 / 0.65);
}
.tray-menu-exit {
  color: #f6abab;
}
.tray-menu-exit:not(:disabled):hover,
.tray-menu-exit:focus-visible {
  border-color: rgb(248 113 113 / 0.14);
  background: rgb(248 113 113 / 0.09);
  color: #ffc4c4;
}
.tray-item-spinner {
  width: 13px;
  height: 13px;
  flex: none;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: tray-item-spin 700ms linear infinite;
}
@keyframes tray-item-spin {
  to {
    transform: rotate(360deg);
  }
}
:global([data-tray-motion='off'] .tray-menu-item) {
  transition: none;
}
:global([data-tray-motion='off'] .tray-item-spinner) {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .tray-menu-item {
    transition: none;
  }
  .tray-item-spinner {
    animation: none;
  }
}
</style>
