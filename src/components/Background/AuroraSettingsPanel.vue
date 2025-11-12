<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'

// 读取与更新 Store
const settings = useSettingsStore()

// 本地表单状态
const color1 = ref(settings.aurora.colorStops[0] || '#667eea')
const color2 = ref(settings.aurora.colorStops[1] || '#764ba2')
const color3 = ref(settings.aurora.colorStops[2] || '#f093fb')
const pos1 = ref(settings.aurora.colorPositions[0] ?? 0)
const pos2 = ref(settings.aurora.colorPositions[1] ?? 0.5)
const pos3 = ref(settings.aurora.colorPositions[2] ?? 1)

const amplitude = ref(settings.aurora.amplitude)
const blend = ref(settings.aurora.blend)
const speedAurora = ref(settings.aurora.speed)
const intensity = ref(settings.aurora.intensity)

// 同步到 Store
watch([color1, color2, color3], () => {
  const stops = [color1.value, color2.value, color3.value].map(s =>
    s.startsWith('#') ? s : `#${s}`
  )
  settings.setColorStops(stops)
})

watch([amplitude, blend, speedAurora, intensity], () => {
  settings.setAurora({
    amplitude: amplitude.value,
    blend: blend.value,
    speed: speedAurora.value,
    intensity: intensity.value,
  })
})

watch([pos1, pos2, pos3], () => {
  settings.setColorPositions([pos1.value, pos2.value, pos3.value])
})


// 重置
const reset = () => {
  settings.resetAurora()
  color1.value = settings.aurora.colorStops[0]
  color2.value = settings.aurora.colorStops[1]
  color3.value = settings.aurora.colorStops[2]
  pos1.value = settings.aurora.colorPositions[0]
  pos2.value = settings.aurora.colorPositions[1]
  pos3.value = settings.aurora.colorPositions[2]
  amplitude.value = settings.aurora.amplitude
  blend.value = settings.aurora.blend
  speedAurora.value = settings.aurora.speed
  intensity.value = settings.aurora.intensity
}
</script>

<template>
  <div class="glass-card p-4">
    <h3 class="mb-4 text-lg font-semibold text-white">背景设置</h3>

    <div class="space-y-6">

      <!-- 颜色设置 -->
      <div>
        <label class="mb-2 block text-sm text-white/80">颜色（前三个生效）</label>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div class="flex items-center gap-2">
            <input v-model="color1" type="color" class="h-8 w-12 rounded" />
            <input v-model="color1" type="text" class="flex-1 rounded bg-white/10 p-2 text-white" />
          </div>
          <div class="flex items-center gap-2">
            <input v-model="color2" type="color" class="h-8 w-12 rounded" />
            <input v-model="color2" type="text" class="flex-1 rounded bg-white/10 p-2 text-white" />
          </div>
          <div class="flex items-center gap-2">
            <input v-model="color3" type="color" class="h-8 w-12 rounded" />
            <input v-model="color3" type="text" class="flex-1 rounded bg-white/10 p-2 text-white" />
          </div>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label class="mb-2 block text-sm text-white/80">位置1 (0-1)</label>
            <input v-model.number="pos1" type="range" min="0" max="1" step="0.01" class="w-full" />
            <input v-model.number="pos1" type="number" min="0" max="1" step="0.01" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
          </div>
          <div>
            <label class="mb-2 block text-sm text-white/80">位置2 (0-1)</label>
            <input v-model.number="pos2" type="range" min="0" max="1" step="0.01" class="w-full" />
            <input v-model.number="pos2" type="number" min="0" max="1" step="0.01" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
          </div>
          <div>
            <label class="mb-2 block text-sm text-white/80">位置3 (0-1)</label>
            <input v-model.number="pos3" type="range" min="0" max="1" step="0.01" class="w-full" />
            <input v-model.number="pos3" type="number" min="0" max="1" step="0.01" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
          </div>
        </div>
      </div>

      <!-- 强度/幅度设置 -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm text-white/80">幅度 amplitude</label>
          <input v-model.number="amplitude" type="range" min="0" max="3" step="0.1" class="w-full" />
          <input v-model.number="amplitude" type="number" min="0" max="3" step="0.1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">混合 blend</label>
          <input v-model.number="blend" type="range" min="0" max="1" step="0.05" class="w-full" />
          <input v-model.number="blend" type="number" min="0" max="1" step="0.05" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">速度 speed</label>
          <input v-model.number="speedAurora" type="range" min="0.1" max="3" step="0.1" class="w-full" />
          <input v-model.number="speedAurora" type="number" min="0.1" max="3" step="0.1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">强度 intensity</label>
          <input v-model.number="intensity" type="range" min="0" max="2" step="0.1" class="w-full" />
          <input v-model.number="intensity" type="number" min="0" max="2" step="0.1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
      </div>


      <div class="flex items-center justify-between">
        <p class="text-xs text-white/60">Aurora 支持 3 个颜色与位置。</p>
        <button class="rounded bg-white/10 px-3 py-2 text-white hover:bg-white/20" @click="reset">重置默认</button>
      </div>
    </div>
  </div>
  
</template>
