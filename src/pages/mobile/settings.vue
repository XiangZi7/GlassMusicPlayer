<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'
import { storeToRefs } from 'pinia'
import { useGlobalStore } from '@/stores/modules/global'
import { useI18n } from 'vue-i18n'
import {
  getBackgroundOptions,
  getThemeOptions,
  getLangOptions,
  getShowHideOptions,
} from '@/config/settingsOptions'
import I18n from '@/languages'

const settings = useSettingsStore()
const { footerLyrics, backgroundType } = storeToRefs(settings)
const globalStore = useGlobalStore()
const { theme, lang } = storeToRefs(globalStore)
const { t } = useI18n()

const footerEnabled = computed({
  get: () => footerLyrics.value.enabled,
  set: v => settings.setFooterLyricsEnabled(!!v),
})

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
  <div class="h-full flex-1 overflow-auto px-3 pb-6">
    <section class="mb-6">
      <h2 class="text-primary mb-2 text-sm font-semibold">
        {{ t('components.settings.themeMode') }}
      </h2>
      <GlassSelect v-model="theme" :options="themeOptions" />
    </section>
    <section class="mb-6">
      <h2 class="text-primary mb-2 text-sm font-semibold">
        {{ t('components.settings.backgroundType') }}
      </h2>
      <GlassSelect v-model="backgroundType" :options="bgOptions" />
    </section>

    <section class="mb-6">
      <h2 class="text-primary mb-2 text-sm font-semibold">
        {{ t('components.settings.uiLanguage') }}
      </h2>
      <GlassSelect v-model="lang" :options="langOptions" />
    </section>

    <section>
      <h2 class="text-primary mb-2 text-sm font-semibold">
        {{ t('components.settings.footerLyricsTitle') }}
      </h2>
      <div class="glass-card mb-3 flex items-center justify-between p-3">
        <span class="text-primary text-sm">{{ t('components.settings.footerLyricsTitle') }}</span>
        <label class="inline-flex cursor-pointer items-center">
          <input type="checkbox" class="sr-only" v-model="footerEnabled" />
          <span class="bg-hover-glass relative h-6 w-10 rounded-full">
            <span
              :class="footerEnabled ? 'translate-x-5 bg-pink-500' : 'translate-x-0 bg-gray-500'"
              class="absolute top-1/2 left-0 h-5 w-5 -translate-y-1/2 rounded-full transition-transform"
            ></span>
          </span>
        </label>
      </div>
      <div class="glass-card p-3">
        <label class="text-primary/80 mb-2 block text-xs">{{
          t('components.settings.footerLyricsModes')
        }}</label>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="
              originalChecked
                ? 'bg-hover-glass text-primary ring-1 ring-(--glass-border)'
                : 'bg-button-glass text-primary/70'
            "
            @click="originalChecked = !originalChecked"
          >
            {{ t('common.original') }}
          </button>
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="
              transChecked
                ? 'bg-hover-glass text-primary ring-1 ring-(--glass-border)'
                : 'bg-button-glass text-primary/70'
            "
            @click="transChecked = !transChecked"
          >
            {{ t('common.trans') }}
          </button>
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="
              romaChecked
                ? 'bg-hover-glass text-primary ring-1 ring-(--glass-border)'
                : 'bg-button-glass text-primary/70'
            "
            @click="romaChecked = !romaChecked"
          >
            {{ t('common.roma') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
