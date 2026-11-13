<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "plain" | "primary" | "secondary" | "icon";
    size?: "sm" | "md" | "lg";
    type?: "button" | "submit" | "reset";
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: "plain",
    size: "md",
    type: "button",
    loading: false,
    disabled: false,
  },
);

const variantClasses = {
  plain: "",
  primary: "primary-button",
  secondary: "secondary-button",
  icon: "icon-button",
};
const buttonClasses = computed(() => [
  variantClasses[props.variant],
  {
    "min-h-8 px-3 text-[10px]":
      props.size === "sm" &&
      props.variant !== "icon" &&
      props.variant !== "plain",
    "min-h-12 px-6 text-sm":
      props.size === "lg" &&
      props.variant !== "icon" &&
      props.variant !== "plain",
    "size-6": props.size === "sm" && props.variant === "icon",
    "size-10": props.size === "lg" && props.variant === "icon",
  },
]);
</script>

<template>
  <button
    :type="type"
    :class="buttonClasses"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span
      v-if="loading"
      class="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent align-middle"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
