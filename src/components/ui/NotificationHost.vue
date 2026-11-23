<script setup lang="ts">
import { notification } from '@/services/notification'
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-4 top-[104px] z-[90] flex justify-center"
    role="status"
    aria-atomic="true"
  >
    <Transition name="toast">
      <div
        v-if="notification.message"
        class="notification-toast flex max-w-[420px] min-w-0 items-start gap-2.5 rounded-2xl border px-4 py-2.5 text-[13px] leading-5 font-semibold [overflow-wrap:anywhere] text-white"
      >
        <span
          :class="
            notification.type === 'error' ? 'bg-red-400' : 'bg-emerald-300'
          "
          class="mt-[7px] size-1.5 shrink-0 rounded-full"
          aria-hidden="true"
        />
        <span>{{ notification.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notification-toast {
  background: rgb(26 27 37 / 88%);
  border-color: rgb(255 255 255 / 18%);
  backdrop-filter: blur(18px) saturate(1.08);
  box-shadow: 0 10px 28px rgb(0 0 0 / 30%);
}

.liquid-win .notification-toast {
  background:
    linear-gradient(160deg, rgb(255 255 255 / 18%), rgb(255 255 255 / 4%) 65%),
    rgb(22 24 34 / 86%);
  border-color: rgb(255 255 255 / 36%);
  backdrop-filter: blur(22px) saturate(1.3);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 34%),
    0 12px 30px rgb(0 0 0 / 34%);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.calm .toast-enter-active,
.calm .toast-leave-active {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
