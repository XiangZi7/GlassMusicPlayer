<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import GlassSelect from '@/components/Ui/GlassSelect.vue'
import GlassCheckbox from '@/components/Ui/GlassCheckbox.vue'
import { useSettingsStore } from '@/stores/modules/settings'
import { useGlobalStore } from '@/stores/modules/global'
import I18n from '@/languages'
import { useI18n } from 'vue-i18n'
import {
  getBackgroundOptions,
  getThemeOptions,
  getLangOptions,
  getShowHideOptions,
  getAudioQualityOptions,
  getVisualizerTypeOptions,
} from '@/config/settingsOptions'

// 动态导入背景设置面板组件,只在需要时加载
const AuroraSettingsPanel = defineAsyncComponent(
  () => import('@/components/Background/AuroraSettingsPanel.vue')
)
const ColorBendsSettingsPanel = defineAsyncComponent(
  () => import('@/components/Background/ColorBendsSettingsPanel.vue')
)
const UltimateSettingsPanel = defineAsyncComponent(
  () => import('@/components/Background/UltimateSettingsPanel.vue')
)
const settings = useSettingsStore()
const { backgroundType, footerLyrics, audioQuality, audioVisualizer } = storeToRefs(settings)
const globalStore = useGlobalStore()
const { theme, lang } = storeToRefs(globalStore)
const { t } = useI18n()
const bgOptions = computed(() => getBackgroundOptions(t))
const themeOptions = computed(() => getThemeOptions(t))
const langOptions = computed(() => getLangOptions(t))
const qualityOptions = computed(() => getAudioQualityOptions(t))
const visualizerTypeOptions = computed(() => getVisualizerTypeOptions(t))
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
  <div class="h-full w-full overflow-auto p-6">
    <PageSkeleton v-if="state.isPageLoading" :sections="['list']" :list-count="6" />
    <div v-else>
      <div class="mb-8">
        <h1 class="text-primary text-2xl font-bold">{{ t('components.settings.title') }}</h1>
        <p class="text-primary/50 mt-1 text-sm">{{ t('components.settings.desc') }}</p>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <div class="glass-card space-y-5 rounded-2xl p-5">
          <div class="flex items-center gap-3 border-b border-white/10 pb-4">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600"
            >
              <span class="icon-[mdi--palette-outline] h-5 w-5 text-white" />
            </div>
            <div>
              <h3 class="text-primary text-sm font-semibold">
                {{ t('components.settings.themeMode') }}
              </h3>
              <p class="text-primary/50 text-xs">{{ t('components.settings.themeModeDesc') }}</p>
            </div>
          </div>
          <GlassSelect v-model="theme" :options="themeOptions" />
        </div>

        <div class="glass-card space-y-5 rounded-2xl p-5">
          <div class="flex items-center gap-3 border-b border-white/10 pb-4">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-cyan-600"
            >
              <span class="icon-[mdi--translate] h-5 w-5 text-white" />
            </div>
            <div>
              <h3 class="text-primary text-sm font-semibold">
                {{ t('components.settings.uiLanguage') }}
              </h3>
              <p class="text-primary/50 text-xs">{{ t('components.settings.uiLanguageDesc') }}</p>
            </div>
          </div>
          <GlassSelect v-model="lang" :options="langOptions" />
        </div>

        <div class="glass-card space-y-5 rounded-2xl p-5">
          <div class="flex items-center gap-3 border-b border-white/10 pb-4">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-pink-500 to-rose-600"
            >
              <span class="icon-[mdi--image-filter-hdr] h-5 w-5 text-white" />
            </div>
            <div>
              <h3 class="text-primary text-sm font-semibold">
                {{ t('components.settings.backgroundType') }}
              </h3>
              <p class="text-primary/50 text-xs">
                {{ t('components.settings.backgroundTypeDesc') }}
              </p>
            </div>
          </div>
          <GlassSelect v-model="backgroundType" :options="bgOptions" />
        </div>

        <div class="glass-card space-y-5 rounded-2xl p-5">
          <div class="flex items-center gap-3 border-b border-white/10 pb-4">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600"
            >
              <span class="icon-[mdi--music-circle] h-5 w-5 text-white" />
            </div>
            <div>
              <h3 class="text-primary text-sm font-semibold">
                {{ t('components.settings.audioQuality.title') }}
              </h3>
              <p class="text-primary/50 text-xs">{{ t('components.settings.audioQuality.desc') }}</p>
            </div>
          </div>
          <GlassSelect v-model="audioQuality" :options="qualityOptions" />
        </div>

        <div class="glass-card space-y-5 rounded-2xl p-5">
          <div class="flex items-center gap-3 border-b border-white/10 pb-4">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-600"
            >
              <span class="icon-[mdi--subtitles-outline] h-5 w-5 text-white" />
            </div>
            <div>
              <h3 class="text-primary text-sm font-semibold">
                {{ t('components.settings.footerLyricsTitle') }}
              </h3>
              <p class="text-primary/50 text-xs">{{ t('components.settings.footerLyricsDesc') }}</p>
            </div>
          </div>
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-2">
              <span class="text-primary/70 text-xs text-nowrap"
                >{{ t('common.show') }}/{{ t('common.hide') }}</span
              >
              <GlassSelect
                :options="getShowHideOptions(t)"
                v-model="footerLyrics.enabled"
                class="w-32"
              />
            </div>
            <div>
              <span class="text-primary/70 mb-2 block text-xs">{{
                t('components.settings.footerLyricsModes')
              }}</span>
              <div class="text-primary/80 flex flex-wrap gap-3">
                <GlassCheckbox v-model="originalChecked" :label="t('common.original')" />
                <GlassCheckbox v-model="transChecked" :label="t('common.trans')" />
                <GlassCheckbox v-model="romaChecked" :label="t('common.roma')" />
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card space-y-5 rounded-2xl p-5">
          <div class="flex items-center gap-3 border-b border-white/10 pb-4">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-blue-600"
            >
              <span class="icon-[mdi--waveform] h-5 w-5 text-white" />
            </div>
            <div>
              <h3 class="text-primary text-sm font-semibold">
                {{ t('components.settings.audioVisualizer.title') }}
              </h3>
              <p class="text-primary/50 text-xs">{{ t('components.settings.audioVisualizer.desc') }}</p>
            </div>
          </div>
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-2">
              <span class="text-primary/70 text-xs text-nowrap">{{
                t('components.settings.audioVisualizer.footer')
              }}</span>
              <GlassSelect
                :options="getShowHideOptions(t)"
                v-model="audioVisualizer.enabledInFooter"
                class="w-32"
              />
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-primary/70 text-xs text-nowrap">{{
                t('components.settings.audioVisualizer.drawer')
              }}</span>
              <GlassSelect
                :options="getShowHideOptions(t)"
                v-model="audioVisualizer.enabledInDrawer"
                class="w-32"
              />
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-primary/70 text-xs text-nowrap">{{
                t('components.settings.audioVisualizer.type')
              }}</span>
              <GlassSelect
                :options="visualizerTypeOptions"
                v-model="audioVisualizer.visualizerType"
                class="w-32"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <component
          :is="
            backgroundType === 'colorbends'
              ? ColorBendsSettingsPanel
              : backgroundType === 'aurora'
                ? AuroraSettingsPanel
                : UltimateSettingsPanel
          "
        />
      </div>
    </div>
  </div>
</template>
