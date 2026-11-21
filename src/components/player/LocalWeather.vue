<script setup lang="ts">
import { computed } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { useLocalWeather } from '@/composables/useLocalWeather'
import { formatWeatherTemperature } from '@/services/local-weather'

const props = withDefaults(
  defineProps<{ enabled: boolean; variant?: 'titlebar' | 'fullscreen' }>(),
  { variant: 'titlebar' }
)
const weatherState = useLocalWeather(() => props.enabled)
const preferredMotion = usePreferredReducedMotion()
const presentation = computed(() =>
  props.variant === 'fullscreen'
    ? {
        pillClass:
          'fs-weather flex items-center gap-[6px] rounded-full p-[5px_11px_5px_7px] whitespace-nowrap text-white',
        iconClass:
          'wx-icon wx-icon-sm h-[23px] w-[23px] flex-none overflow-visible',
      }
    : {
        pillClass:
          'weather-pill flex min-h-[34px] items-center gap-[7px] rounded-full p-[4px_12px_4px_7px] whitespace-nowrap text-white',
        iconClass: 'wx-icon h-[29px] w-[29px] flex-none overflow-visible',
      }
)
const pill = computed(() => {
  const weather = weatherState.weather.value
  if (!weather) return null
  const updated = new Date(weather.observedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return {
    ...weather,
    temperatureText: formatWeatherTemperature(weather.temperatureCelsius),
    accessibleText: `用户当前位置实时天气：${weather.isDay ? '白天' : '夜晚'}，${weather.label}，${weather.temperatureCelsius}摄氏度；Open-Meteo，更新于${updated}`,
  }
})
const isClear = computed(
  () => pill.value?.icon === 'sun' || pill.value?.icon === 'moon'
)
const showSun = computed(
  () => pill.value?.icon === 'sun' || pill.value?.icon === 'partly-day'
)
const showMoon = computed(
  () => pill.value?.icon === 'moon' || pill.value?.icon === 'partly-night'
)
const cloudTransform = computed(() =>
  pill.value && ['rain', 'snow', 'thunder', 'fog'].includes(pill.value.icon)
    ? 'translate(0 -4)'
    : undefined
)

// CSS 无过渡仍会等两帧离场；直接结算，失效天气不能继续留在 DOM。
function leaveImmediately(_element: Element, done: () => void): void {
  done()
}
</script>

<template>
  <Transition
    name="local-weather"
    appear
    :css="preferredMotion !== 'reduce'"
    @leave="leaveImmediately"
  >
    <div
      v-if="props.enabled && pill"
      :class="presentation.pillClass"
      role="img"
      :aria-label="pill.accessibleText"
      :title="pill.accessibleText"
    >
      <svg
        :class="presentation.iconClass"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <g
          v-if="showSun"
          :transform="isClear ? 'translate(-6 7)' : undefined"
        >
          <circle
            cx="24"
            cy="10"
            r="5.7"
            fill="#F6DC8A"
          />
          <path
            d="M24 1v2M24 17v2M15 10h2M31 10h2M17.6 3.6 19 5M29 15l1.4 1.4M17.6 16.4 19 15M29 5l1.4-1.4"
            stroke="#F6DC8A"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </g>
        <g
          v-else-if="showMoon"
          :transform="isClear ? 'translate(-5 5)' : undefined"
        >
          <circle
            cx="7.5"
            cy="6.5"
            r="1.3"
            fill="#FFE9A8"
          />
          <circle
            cx="14.5"
            cy="3.6"
            r=".9"
            fill="#FFFFFF"
          />
          <path
            d="M24.6 3.4a8.2 8.2 0 1 0 7.9 11.9A9.6 9.6 0 0 1 24.6 3.4z"
            fill="#F6DC8A"
          />
        </g>
        <path
          v-if="!isClear"
          d="M8.4 27.8a5.2 5.2 0 0 1-.7-10.35 7.2 7.2 0 0 1 13.9-1.55A5.6 5.6 0 0 1 26.2 21.3c.3 3.4-2.2 6.5-6 6.5H8.4z"
          :transform="cloudTransform"
          fill="rgba(255,255,255,.94)"
        />
        <path
          v-if="pill.icon === 'rain'"
          d="m10 27-1.5 4m8-4-1.5 4m8-4-1.5 4"
          stroke="#A7D9FF"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          v-else-if="pill.icon === 'snow'"
          d="M9 27v6m-2.6-4.5 5.2 3m0-3-5.2 3M21 27v6m-2.6-4.5 5.2 3m0-3-5.2 3"
          stroke="#D6EDFF"
          stroke-width="1.4"
          stroke-linecap="round"
        />
        <path
          v-else-if="pill.icon === 'thunder'"
          d="m17 23-5 7h4l-2 6 8-9h-5l3-4z"
          fill="#F6DC8A"
        />
        <path
          v-else-if="pill.icon === 'fog'"
          d="M6 27h19M9 31h20"
          stroke="#D6EDFF"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <span
        class="wx-temp text-[15px] leading-[1] font-extrabold tracking-[-.01em]"
        >{{ pill.temperatureText }}</span
      >
      <span class="wx-cond text-[12px] leading-[1] font-bold opacity-[.85]">{{
        pill.label
      }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.local-weather-enter-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.local-weather-enter-from {
  opacity: 0;
  transform: translateY(-3px);
}

/* 禁用、请求中或过期时不让离场动画继续保留旧天气。 */
.local-weather-leave-active {
  transition: none;
}

.local-weather-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .local-weather-enter-active {
    transition: none;
  }

  .local-weather-enter-from {
    opacity: 1;
    transform: none;
  }
}
</style>
