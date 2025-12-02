<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'
import GlassSelect from '@/components/Ui/GlassSelect.vue'
import { useI18n } from 'vue-i18n'

const settings = useSettingsStore()
const { t } = useI18n()

const state = reactive({
  bg1: settings.ultimate.bg1,
  bg2: settings.ultimate.bg2,
  color1: settings.ultimate.color1,
  color2: settings.ultimate.color2,
  color3: settings.ultimate.color3,
  color4: settings.ultimate.color4,
  color5: settings.ultimate.color5,
  interactiveColor: settings.ultimate.interactiveColor,
  circleSize: settings.ultimate.circleSize,
  blending: settings.ultimate.blending,
})
const {
  bg1,
  bg2,
  color1,
  color2,
  color3,
  color4,
  color5,
  interactiveColor,
  circleSize,
  blending,
} = toRefs(state)

const blendingOptions = [
  { label: 'normal', value: 'normal' },
  { label: 'multiply', value: 'multiply' },
  { label: 'screen', value: 'screen' },
  { label: 'overlay', value: 'overlay' },
  { label: 'darken', value: 'darken' },
  { label: 'lighten', value: 'lighten' },
  { label: 'color-dodge', value: 'color-dodge' },
  { label: 'color-burn', value: 'color-burn' },
  { label: 'hard-light', value: 'hard-light' },
  { label: 'soft-light', value: 'soft-light' },
  { label: 'difference', value: 'difference' },
  { label: 'exclusion', value: 'exclusion' },
  { label: 'hue', value: 'hue' },
  { label: 'saturation', value: 'saturation' },
  { label: 'color', value: 'color' },
  { label: 'luminosity', value: 'luminosity' },
]

watch(
  () => [
    state.bg1,
    state.bg2,
    state.color1,
    state.color2,
    state.color3,
    state.color4,
    state.color5,
    state.interactiveColor,
    state.circleSize,
    state.blending,
  ],
  () => {
    settings.setUltimate({
      bg1: state.bg1,
      bg2: state.bg2,
      color1: state.color1,
      color2: state.color2,
      color3: state.color3,
      color4: state.color4,
      color5: state.color5,
      interactiveColor: state.interactiveColor,
      circleSize: state.circleSize,
      blending: state.blending,
    })
  }
)

const reset = () => {
  settings.resetUltimate()
  state.bg1 = settings.ultimate.bg1
  state.bg2 = settings.ultimate.bg2
  state.color1 = settings.ultimate.color1
  state.color2 = settings.ultimate.color2
  state.color3 = settings.ultimate.color3
  state.color4 = settings.ultimate.color4
  state.color5 = settings.ultimate.color5
  state.interactiveColor = settings.ultimate.interactiveColor
  state.circleSize = settings.ultimate.circleSize
  state.blending = settings.ultimate.blending
}

const previewStyle = computed(() => {
  return {
    backgroundImage: `linear-gradient(90deg, ${state.bg1}, ${state.bg2})`,
  }
})
</script>

<template>
  <div class="glass-card p-4">
    <h3 class="mb-4 text-lg font-semibold text-primary">{{ t('components.background.ultimate.title') }}</h3>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="space-y-6">
        <div>
          <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.ultimate.background') }}</label>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <input v-model="bg1" type="color" class="h-9 w-full rounded" />
              <input v-model="bg1" type="text" class="w-full rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="space-y-2">
              <input v-model="bg2" type="color" class="h-9 w-full rounded" />
              <input v-model="bg2" type="text" class="w-full rounded bg-white/10 p-2 text-primary" />
            </div>
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.ultimate.colors') }}</label>
          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-2">
              <input v-model="color1" type="color" class="h-9 w-full rounded" />
              <input v-model="color1" type="text" class="w-full rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="space-y-2">
              <input v-model="color2" type="color" class="h-9 w-full rounded" />
              <input v-model="color2" type="text" class="w-full rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="space-y-2">
              <input v-model="color3" type="color" class="h-9 w-full rounded" />
              <input v-model="color3" type="text" class="w-full rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="space-y-2">
              <input v-model="color4" type="color" class="h-9 w-full rounded" />
              <input v-model="color4" type="text" class="w-full rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="space-y-2">
              <input v-model="color5" type="color" class="h-9 w-full rounded" />
              <input v-model="color5" type="text" class="w-full rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="space-y-2">
              <input v-model="interactiveColor" type="color" class="h-9 w-full rounded" />
              <input v-model="interactiveColor" type="text" class="w-full rounded bg-white/10 p-2 text-primary" />
            </div>
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.common.params') }}</label>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="w-24 text-xs text-primary/70">{{ t('components.background.ultimate.circleSize') }}</span>
              <input v-model="circleSize" type="text" class="w-24 rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-24 text-xs text-primary/70">{{ t('components.background.ultimate.blending') }}</span>
              <GlassSelect v-model="blending" :options="blendingOptions" />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs text-primary/60">{{ t('components.background.ultimate.tip') }}</p>
          <button class="rounded bg-white/10 px-3 py-2 text-primary hover:bg-white/20" @click="reset">{{ t('components.background.common.reset') }}</button>
        </div>
      </div>

      <div>
        <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.common.preview') }}</label>
        <div class="relative overflow-hidden rounded-lg border border-white/10 bg-black/20">
          <div class="aspect-video w-full" :style="previewStyle"></div>
          <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/30 px-3 py-2 text-xs text-primary/80">
            <span>{{ bg1 }} · {{ bg2 }}</span>
            <span>{{ blending }} / {{ circleSize }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* no-op */
</style>
