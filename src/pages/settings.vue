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
const state = reactive({ isPageLoading: false })
</script>

<template>
  <div class="flex w-full flex-col gap-6 p-6">
    <PageSkeleton v-if="state.isPageLoading" :sections="['list']" :list-count="6" />
    <template v-else>
      <h2 class="text-xl font-semibold text-white">设置</h2>
      <div class="flex flex-col gap-3">
        <label class="mb-2 block text-sm text-white/80">背景类型</label>
        <GlassSelect v-model="backgroundType" :options="bgOptions" />

        <!-- 参数面板 -->
        <component
          :is="backgroundType === 'colorbends' ? ColorBendsSettingsPanel : AuroraSettingsPanel"
        />
      </div>
    </template>
  </div>
</template>
