<script setup lang="ts">
import AuroraSettingsPanel from '@/components/Background/AuroraSettingsPanel.vue'
import ColorBendsSettingsPanel from '@/components/Background/ColorBendsSettingsPanel.vue'
import GlassSelect from '@/components/Ui/GlassSelect.vue'
import { useSettingsStore } from '@/stores/modules/settings'

const settings = useSettingsStore()
const { backgroundType } = storeToRefs(settings)

const bgOptions = [
  { label: 'Aurora', value: 'aurora' },
  { label: 'ColorBends', value: 'colorbends' },
]
</script>

<template>
  <div class="flex w-full flex-col gap-6 p-6">
    <h2 class="text-xl font-semibold text-white">设置</h2>
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div class="xl:col-span-3">
        <label class="mb-2 block text-sm text-white/80">背景类型</label>
        <GlassSelect v-model="backgroundType" :options="bgOptions" />
      </div>

      <!-- 参数面板 -->
      <component
        :is="backgroundType === 'colorbends' ? ColorBendsSettingsPanel : AuroraSettingsPanel"
      />
    </div>
  </div>
</template>
