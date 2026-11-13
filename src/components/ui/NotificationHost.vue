<script setup lang="ts">
import { notification } from "@/services/notification";
</script>

<template>
  <Transition name="toast">
    <div
      v-if="notification.message"
      role="status"
      class="glass fixed bottom-24 left-1/2 z-[100] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3 text-sm shadow-2xl"
      :class="
        notification.type === 'error'
          ? 'border-red-300/30 text-red-100'
          : 'border-white/15 text-white'
      "
    >
      <span
        :class="notification.type === 'error' ? 'bg-red-400' : 'bg-emerald-300'"
        class="size-1.5 shrink-0 rounded-full"
      />
      {{ notification.message }}
    </div>
  </Transition>
</template>
