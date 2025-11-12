<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/modules/settings'

const settings = useSettingsStore()

const color1 = ref(settings.colorBends.colors[0] || '#ff5c7a')
const color2 = ref(settings.colorBends.colors[1] || '#8a5cff')
const color3 = ref(settings.colorBends.colors[2] || '#00ffd1')

const rotation = ref(settings.colorBends.rotation)
const speed = ref(settings.colorBends.speed)
const scale = ref(settings.colorBends.scale)
const frequency = ref(settings.colorBends.frequency)
const warpStrength = ref(settings.colorBends.warpStrength)
const mouseInfluence = ref(settings.colorBends.mouseInfluence)
const parallax = ref(settings.colorBends.parallax)
const noise = ref(settings.colorBends.noise)
const transparent = ref(settings.colorBends.transparent)

watch([color1, color2, color3], () => {
  const cols = [color1.value, color2.value, color3.value].map(s =>
    s.startsWith('#') ? s : `#${s}`
  )
  settings.setBendsColors(cols)
})

watch([rotation, speed, scale, frequency, warpStrength, mouseInfluence, parallax, noise, transparent], () => {
  settings.setColorBends({
    rotation: rotation.value,
    speed: speed.value,
    scale: scale.value,
    frequency: frequency.value,
    warpStrength: warpStrength.value,
    mouseInfluence: mouseInfluence.value,
    parallax: parallax.value,
    noise: noise.value,
    transparent: transparent.value,
  })
})

const reset = () => {
  settings.resetColorBends()
  const cols = settings.colorBends.colors
  color1.value = cols[0]
  color2.value = cols[1]
  color3.value = cols[2]
  rotation.value = settings.colorBends.rotation
  speed.value = settings.colorBends.speed
  scale.value = settings.colorBends.scale
  frequency.value = settings.colorBends.frequency
  warpStrength.value = settings.colorBends.warpStrength
  mouseInfluence.value = settings.colorBends.mouseInfluence
  parallax.value = settings.colorBends.parallax
  noise.value = settings.colorBends.noise
  transparent.value = settings.colorBends.transparent
}
</script>

<template>
  <div class="glass-card p-4">
    <h3 class="mb-4 text-lg font-semibold text-white">ColorBends 设置</h3>

    <div class="space-y-6">
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
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm text-white/80">旋转 rotation</label>
          <input v-model.number="rotation" type="range" min="0" max="360" step="1" class="w-full" />
          <input v-model.number="rotation" type="number" min="0" max="360" step="1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">速度 speed</label>
          <input v-model.number="speed" type="range" min="0.05" max="3" step="0.05" class="w-full" />
          <input v-model.number="speed" type="number" min="0.05" max="3" step="0.05" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">缩放 scale</label>
          <input v-model.number="scale" type="range" min="0.5" max="3" step="0.1" class="w-full" />
          <input v-model.number="scale" type="number" min="0.5" max="3" step="0.1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">频率 frequency</label>
          <input v-model.number="frequency" type="range" min="0.5" max="3" step="0.1" class="w-full" />
          <input v-model.number="frequency" type="number" min="0.5" max="3" step="0.1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">扭曲 warpStrength</label>
          <input v-model.number="warpStrength" type="range" min="0" max="3" step="0.1" class="w-full" />
          <input v-model.number="warpStrength" type="number" min="0" max="3" step="0.1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">鼠标影响 mouseInfluence</label>
          <input v-model.number="mouseInfluence" type="range" min="0" max="2" step="0.1" class="w-full" />
          <input v-model.number="mouseInfluence" type="number" min="0" max="2" step="0.1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">视差 parallax</label>
          <input v-model.number="parallax" type="range" min="0" max="2" step="0.1" class="w-full" />
          <input v-model.number="parallax" type="number" min="0" max="2" step="0.1" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div>
          <label class="mb-2 block text-sm text-white/80">噪声 noise</label>
          <input v-model.number="noise" type="range" min="0" max="0.5" step="0.01" class="w-full" />
          <input v-model.number="noise" type="number" min="0" max="0.5" step="0.01" class="mt-2 w-full rounded bg-white/10 p-2 text-white" />
        </div>
        <div class="flex items-center gap-2">
          <input id="trans" v-model="transparent" type="checkbox" class="h-4 w-4" />
          <label for="trans" class="text-sm text-white/80">透明叠加 transparent</label>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <p class="text-xs text-white/60">ColorBends 参数独立，切换背景互不影响。</p>
        <button class="rounded bg-white/10 px-3 py-2 text-white hover:bg-white/20" @click="reset">重置默认</button>
      </div>
    </div>
  </div>
</template>

