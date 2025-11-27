<script setup lang="ts">
import AuroraSettingsPanel from '@/components/Background/AuroraSettingsPanel.vue'
import ColorBendsSettingsPanel from '@/components/Background/ColorBendsSettingsPanel.vue'
import UltimateSettingsPanel from '@/components/Background/UltimateSettingsPanel.vue'
import GlassSelect from '@/components/Ui/GlassSelect.vue'
import GlassCheckbox from '@/components/Ui/GlassCheckbox.vue'
import { useSettingsStore } from '@/stores/modules/settings'
import { useGlobalStore } from '@/stores/modules/global'
import I18n from '@/languages'
import { useI18n } from 'vue-i18n'
import { getBackgroundOptions, getThemeOptions, getLangOptions, getShowHideOptions } from '@/config/settingsOptions'
const settings = useSettingsStore()
const { backgroundType, footerLyrics } = storeToRefs(settings)
const globalStore = useGlobalStore()
const { theme, lang } = storeToRefs(globalStore)
const { t } = useI18n()
const bgOptions = computed(() => getBackgroundOptions(t))
const themeOptions = computed(() => getThemeOptions(t))
const langOptions = computed(() => getLangOptions(t))
const initialLocale = (() => {
  const cur = I18n.global.locale
  return typeof cur === 'object' && 'value' in cur ? (cur as any).value : (cur as any)
})()
if (!lang.value) lang.value = initialLocale || 'zh'
watch(lang, v => {
  const cur = I18n.global.locale
  if (typeof cur === 'object' && 'value' in cur) cur.value = v || 'zh'
  else I18n.global.locale = v || 'zh'
})
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
      <h2 class="text-xl font-semibold text-white">{{ t('components.settings.title') }}</h2>
      <div class="flex flex-col gap-3">
        <label class="mb-2 block text-sm text-white/80">{{ t('components.settings.backgroundType') }}</label>
        <GlassSelect v-model="backgroundType" :options="bgOptions" />

        <label class="mt-4 mb-2 block text-sm text-white/80">{{ t('components.settings.themeMode') }}</label>
        <GlassSelect v-model="theme" :options="themeOptions" />

        <label class="mt-4 mb-2 block text-sm text-white/80">{{ t('components.settings.uiLanguage') }}</label>
        <GlassSelect v-model="lang" :options="langOptions" />

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
          <h3 class="mb-3 text-sm font-semibold text-white">{{ t('components.settings.footerLyricsTitle') }}</h3>
          <div class="mb-3 flex items-center gap-3">
            <label class="text-xs text-nowrap text-white/80">{{ t('common.show') }}/{{ t('common.hide') }}</label>
            <GlassSelect :options="getShowHideOptions(t)" v-model="footerLyrics.enabled" />
          </div>
          <div class="space-y-2">
            <label class="text-xs text-white/80">{{ t('components.settings.footerLyricsModes') }}</label>
            <div class="flex flex-wrap gap-3 text-white/80">
              <GlassCheckbox v-model="originalChecked" :label="t('common.original')" />
              <GlassCheckbox v-model="transChecked" :label="t('common.trans')" />
              <GlassCheckbox v-model="romaChecked" :label="t('common.roma')" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
