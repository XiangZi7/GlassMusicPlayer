<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'
import { useI18n } from 'vue-i18n'
import { reactive, toRefs, watch, computed } from 'vue'
import presets from '@/config/shadowBlingPresets.json'

const settings = useSettingsStore()
const { t, locale } = useI18n()

const state = reactive({
  color1: settings.shadowBling.bgColors[0] || '#000000',
  color2: settings.shadowBling.bgColors[1] || '#ffffff',
  color3: settings.shadowBling.bgColors[2] || '#808080',
  speed: settings.shadowBling.speed,
  intensity: settings.shadowBling.intensity,
})

const { color1, color2, color3, speed, intensity } = toRefs(state)

const applyPreset = (preset: typeof presets[0]) => {
  state.color1 = preset.params.bgColors[0]
  state.color2 = preset.params.bgColors[1]
  state.color3 = preset.params.bgColors[2]
  state.speed = preset.params.speed
  state.intensity = preset.params.intensity
}

watch(
  () => [state.color1, state.color2, state.color3],
  () => {
    const colors = [state.color1, state.color2, state.color3].map(s =>
      s.startsWith('#') ? s : `#${s}`
    )
    settings.setShadowBling({ bgColors: colors })
  }
)

watch(
  () => [state.speed, state.intensity],
  () => {
    settings.setShadowBling({
      speed: state.speed,
      intensity: state.intensity,
    })
  }
)

const reset = () => {
  settings.resetShadowBling()
  state.color1 = settings.shadowBling.bgColors[0]
  state.color2 = settings.shadowBling.bgColors[1]
  state.color3 = settings.shadowBling.bgColors[2]
  state.speed = settings.shadowBling.speed
  state.intensity = settings.shadowBling.intensity
}

const previewStyle = computed(() => {
  return {
    background: `linear-gradient(135deg, ${state.color1}, ${state.color2}, ${state.color3})`,
    filter: `brightness(${1 + state.intensity * 0.5})`,
    transition: 'background 120ms ease',
  }
})
</script>

<template>
  <div class="glass-card p-4">
    <h3 class="mb-4 text-lg font-semibold text-primary">{{ t('components.background.shadowBling.title') }}</h3>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="space-y-6">
        <div>
          <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.common.colors3') }}</label>
          <div class="grid grid-cols-3 gap-3">
            <input type="color" v-model="color1" class="h-10 w-full cursor-pointer rounded border-none bg-transparent" />
            <input type="color" v-model="color2" class="h-10 w-full cursor-pointer rounded border-none bg-transparent" />
            <input type="color" v-model="color3" class="h-10 w-full cursor-pointer rounded border-none bg-transparent" />
          </div>
        </div>

        <div class="space-y-4">
          <label class="block text-sm text-primary/80">Presets</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in presets"
              :key="preset.id"
              @click="applyPreset(preset)"
              class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-primary transition hover:bg-white/10 active:scale-95"
              :title="locale === 'zh' ? preset.description : preset.description"
            >
              {{ locale === 'zh' && preset.nameZh ? preset.nameZh : preset.name }}
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <label class="block text-sm text-primary/80">{{ t('components.background.common.params') }}</label>
          
          <div class="flex items-center gap-3">
            <span class="w-16 text-xs">{{ t('components.background.shadowBling.speed') }}</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              v-model.number="speed"
              class="range-sm h-1.5 flex-1 appearance-none rounded-full bg-primary/20 accent-primary outline-none"
            />
            <span class="w-8 text-right text-xs">{{ speed }}</span>
          </div>

          <div class="flex items-center gap-3">
            <span class="w-16 text-xs">{{ t('components.background.shadowBling.intensity') }}</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              v-model.number="intensity"
              class="range-sm h-1.5 flex-1 appearance-none rounded-full bg-primary/20 accent-primary outline-none"
            />
            <span class="w-8 text-right text-xs">{{ intensity }}</span>
          </div>
        </div>

        <div class="pt-2">
          <button
            @click="reset"
            class="rounded bg-primary/10 px-4 py-2 text-sm text-primary transition hover:bg-primary/20 active:scale-95"
          >
            {{ t('components.background.common.reset') }}
          </button>
        </div>
      </div>

      <div class="hidden md:block">
        <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.common.preview') }}</label>
        <div class="h-64 w-full rounded-xl shadow-inner" :style="previewStyle">
          <div class="flex h-full items-center justify-center text-white/50">
            {{ t('components.background.shadowBling.tip') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
