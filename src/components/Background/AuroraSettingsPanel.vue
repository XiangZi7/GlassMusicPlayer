<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'
import { useI18n } from 'vue-i18n'

// 读取与更新 Store
const settings = useSettingsStore()
const { t } = useI18n()

const state = reactive({
  // 颜色1（HEX）
  color1: settings.aurora.colorStops[0] || '#667eea',
  // 颜色2（HEX）
  color2: settings.aurora.colorStops[1] || '#764ba2',
  // 颜色3（HEX）
  color3: settings.aurora.colorStops[2] || '#f093fb',
  // 颜色位置1（0-1）
  pos1: settings.aurora.colorPositions[0] ?? 0,
  // 颜色位置2（0-1）
  pos2: settings.aurora.colorPositions[1] ?? 0.5,
  // 颜色位置3（0-1）
  pos3: settings.aurora.colorPositions[2] ?? 1,
  // 极光幅度
  amplitude: settings.aurora.amplitude,
  // 混合强度
  blend: settings.aurora.blend,
  // 极光速度
  speedAurora: settings.aurora.speed,
  // 极光强度
  intensity: settings.aurora.intensity,
})
const { color1, color2, color3, pos1, pos2, pos3, amplitude, blend, speedAurora, intensity } =
  toRefs(state)

// 同步到 Store
watch(
  () => [state.color1, state.color2, state.color3],
  () => {
    const stops = [state.color1, state.color2, state.color3].map(s =>
      s.startsWith('#') ? s : `#${s}`
    )
    settings.setColorStops(stops)
  }
)

watch(
  () => [state.amplitude, state.blend, state.speedAurora, state.intensity],
  () => {
    settings.setAurora({
      amplitude: state.amplitude,
      blend: state.blend,
      speed: state.speedAurora,
      intensity: state.intensity,
    })
  }
)

watch(
  () => [state.pos1, state.pos2, state.pos3],
  () => {
    settings.setColorPositions([state.pos1, state.pos2, state.pos3])
  }
)

// 重置
const reset = () => {
  settings.resetAurora()
  state.color1 = settings.aurora.colorStops[0]
  state.color2 = settings.aurora.colorStops[1]
  state.color3 = settings.aurora.colorStops[2]
  state.pos1 = settings.aurora.colorPositions[0]
  state.pos2 = settings.aurora.colorPositions[1]
  state.pos3 = settings.aurora.colorPositions[2]
  state.amplitude = settings.aurora.amplitude
  state.blend = settings.aurora.blend
  state.speedAurora = settings.aurora.speed
  state.intensity = settings.aurora.intensity
}

const previewStyle = computed(() => {
  const p1 = Math.round(state.pos1 * 100)
  const p2 = Math.round(state.pos2 * 100)
  const p3 = Math.round(state.pos3 * 100)
  const stops = [`${state.color1} ${p1}%`, `${state.color2} ${p2}%`, `${state.color3} ${p3}%`].join(', ')
  return {
    backgroundImage: `linear-gradient(135deg, ${stops})`,
    filter: `saturate(${1 + state.intensity})`,
    transition: 'background 120ms ease',
  }
})
</script>

<template>
  <div class="glass-card p-4">
    <h3 class="mb-4 text-lg font-semibold text-primary">{{ t('components.background.aurora.title') }}</h3>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="space-y-6">
        <div>
          <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.common.colors3') }}</label>
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
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.common.positions') }}</label>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="w-14 text-xs text-primary/70">{{ t('components.background.common.position1') }}</span>
              <input v-model.number="pos1" type="range" min="0" max="1" step="0.01" class="flex-1" />
              <input v-model.number="pos1" type="number" min="0" max="1" step="0.01" class="w-20 rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-14 text-xs text-primary/70">{{ t('components.background.common.position2') }}</span>
              <input v-model.number="pos2" type="range" min="0" max="1" step="0.01" class="flex-1" />
              <input v-model.number="pos2" type="number" min="0" max="1" step="0.01" class="w-20 rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-14 text-xs text-primary/70">{{ t('components.background.common.position3') }}</span>
              <input v-model.number="pos3" type="range" min="0" max="1" step="0.01" class="flex-1" />
              <input v-model.number="pos3" type="number" min="0" max="1" step="0.01" class="w-20 rounded bg-white/10 p-2 text-primary" />
            </div>
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.common.params') }}</label>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <span class="w-20 text-xs text-primary/70">{{ t('components.background.aurora.amplitude') }}</span>
              <input v-model.number="amplitude" type="range" min="0" max="3" step="0.1" class="flex-1" />
              <input v-model.number="amplitude" type="number" min="0" max="3" step="0.1" class="w-20 rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-20 text-xs text-primary/70">{{ t('components.background.aurora.blend') }}</span>
              <input v-model.number="blend" type="range" min="0" max="1" step="0.05" class="flex-1" />
              <input v-model.number="blend" type="number" min="0" max="1" step="0.05" class="w-20 rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-20 text-xs text-primary/70">{{ t('components.background.aurora.speed') }}</span>
              <input v-model.number="speedAurora" type="range" min="0.1" max="3" step="0.1" class="flex-1" />
              <input v-model.number="speedAurora" type="number" min="0.1" max="3" step="0.1" class="w-20 rounded bg-white/10 p-2 text-primary" />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-20 text-xs text-primary/70">{{ t('components.background.aurora.intensity') }}</span>
              <input v-model.number="intensity" type="range" min="0" max="2" step="0.1" class="flex-1" />
              <input v-model.number="intensity" type="number" min="0" max="2" step="0.1" class="w-20 rounded bg-white/10 p-2 text-primary" />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs text-primary/60">{{ t('components.background.aurora.tip') }}</p>
          <button class="rounded bg-white/10 px-3 py-2 text-primary hover:bg-white/20" @click="reset">{{ t('components.background.common.reset') }}</button>
        </div>
      </div>

      <div>
        <label class="mb-2 block text-sm text-primary/80">{{ t('components.background.common.preview') }}</label>
        <div class="relative overflow-hidden rounded-lg border border-white/10 bg-black/20">
          <div class="aspect-video w-full" :style="previewStyle"></div>
          <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/30 px-3 py-2 text-xs text-primary/80">
            <span>{{ color1 }} · {{ color2 }} · {{ color3 }}</span>
            <span>{{ (pos1 * 100).toFixed(0) }}% / {{ (pos2 * 100).toFixed(0) }}% / {{ (pos3 * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
