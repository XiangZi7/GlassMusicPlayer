<script setup lang="ts">
import AuroraSettingsPanel from '@/components/Background/AuroraSettingsPanel.vue'
import ColorBendsSettingsPanel from '@/components/Background/ColorBendsSettingsPanel.vue'
import UltimateSettingsPanel from '@/components/Background/UltimateSettingsPanel.vue'
import GlassSelect from '@/components/Ui/GlassSelect.vue'
import GlassCheckbox from '@/components/Ui/GlassCheckbox.vue'
import { useSettingsStore } from '@/stores/modules/settings'
import { useGlobalStore } from '@/stores/modules/global'
const settings = useSettingsStore()
const { backgroundType, footerLyrics } = storeToRefs(settings)
const globalStore = useGlobalStore()
const { theme } = storeToRefs(globalStore)

const bgOptions = [
  { label: 'Aurora', value: 'aurora' },
  { label: 'ColorBends', value: 'colorbends' },
  { label: 'Ultimate', value: 'ultimate' },
]
const themeOptions = [
  { label: '浅色模式', value: 'light' },
  { label: '暗黑模式', value: 'dark' },
]
const state = reactive({ isPageLoading: false })

 

const toggleMode = (mode: 'original' | 'trans' | 'roma', checked: boolean) => {
  const modes = new Set(footerLyrics.value.modes)
  if (checked) {
    modes.add(mode)
    const arr = Array.from(modes).slice(0, 2)
    settings.setFooterLyricsModes(arr as Array<'original' | 'trans' | 'roma'>)
  } else {
    modes.delete(mode)
    const arr = Array.from(modes)
    settings.setFooterLyricsModes(arr as Array<'original' | 'trans' | 'roma'>)
  }
}

const originalChecked = computed({
  get: () => footerLyrics.value.modes.includes('original'),
  set: v => toggleMode('original', v as boolean),
})
const transChecked = computed({
  get: () => footerLyrics.value.modes.includes('trans'),
  set: v => toggleMode('trans', v as boolean),
})
const romaChecked = computed({
  get: () => footerLyrics.value.modes.includes('roma'),
  set: v => toggleMode('roma', v as boolean),
})

</script>

<template>
  <div class="flex w-full flex-col gap-6 overflow-auto p-6">
    <PageSkeleton v-if="state.isPageLoading" :sections="['list']" :list-count="6" />
    <template v-else>
      <h2 class="text-xl font-semibold text-white">设置</h2>
      <div class="flex flex-col gap-3">
        <label class="mb-2 block text-sm text-white/80">背景类型</label>
        <GlassSelect v-model="backgroundType" :options="bgOptions" />

        <label class="mt-4 mb-2 block text-sm text-white/80">主题模式</label>
        <GlassSelect v-model="theme" :options="themeOptions" />

        

        <!-- 参数面板 -->
        <component
          :is="
            backgroundType === 'colorbends'
              ? ColorBendsSettingsPanel
              : backgroundType === 'aurora'
                ? AuroraSettingsPanel
                : UltimateSettingsPanel
          "
        />
        <div class="glass-card mt-6 p-4">
          <h3 class="mb-3 text-sm font-semibold text-white">底部播放器歌词</h3>
          <div class="mb-3 flex items-center gap-3">
            <label class="text-xs text-nowrap text-white/80">是否显示</label>
            <GlassSelect
              :options="[
                { label: '显示', value: true },
                { label: '隐藏', value: false },
              ]"
              v-model="footerLyrics.enabled"
            />
          </div>
          <div class="space-y-2">
            <label class="text-xs text-white/80">显示语言（最多选择两种）</label>
            <div class="flex flex-wrap gap-3 text-white/80">
              <GlassCheckbox v-model="originalChecked" label="原文" />
              <GlassCheckbox v-model="transChecked" label="译文" />
              <GlassCheckbox v-model="romaChecked" label="罗马音" />
            </div>
          </div>
        </div>

        
      </div>
    </template>
  </div>
</template>
