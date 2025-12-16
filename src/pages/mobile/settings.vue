<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'
import { storeToRefs } from 'pinia'
import { useGlobalStore } from '@/stores/modules/global'
import { useI18n } from 'vue-i18n'
import { getBackgroundOptions, getThemeOptions, getLangOptions, getAudioQualityOptions } from '@/config/settingsOptions'
import I18n from '@/languages'
import Button from '@/components/Ui/Button.vue'

const settings = useSettingsStore()
const { footerLyrics, backgroundType, audioQuality } = storeToRefs(settings)
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
const qualityOptions = computed(() => getAudioQualityOptions(t))
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
  <div class="h-full flex-1 overflow-auto px-4 pb-8">
    <div class="mb-6 pt-2">
      <h1 class="text-primary text-xl font-bold">{{ t('components.settings.title') }}</h1>
      <p class="text-primary/50 mt-1 text-xs">
        {{ t('components.settings.desc') }}
      </p>
    </div>

    <section class="settings-card mb-4">
      <div class="card-header">
        <div class="icon-wrapper bg-linear-to-br from-violet-500 to-purple-600">
          <span class="icon-[mdi--palette-outline] h-4 w-4 text-primary"></span>
        </div>
        <div>
          <h2 class="card-title">{{ t('components.settings.themeMode') }}</h2>
          <p class="card-desc">{{ t('components.settings.themeModeDesc') }}</p>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        <Button
          v-for="opt in themeOptions"
          :key="String(opt.value)"
          variant="ghost"
          size="none"
          class="theme-option"
          :class="{ active: theme === opt.value }"
          @click="theme = opt.value"
        >
          <span
            class="option-icon"
            :class="
              opt.value === 'light'
                ? 'icon-[mdi--white-balance-sunny]'
                : opt.value === 'dark'
                  ? 'icon-[mdi--moon-waning-crescent]'
                  : 'icon-[mdi--theme-light-dark]'
            "
          ></span>
          <span class="option-label">{{ opt.label }}</span>
        </Button>
      </div>
    </section>

    <section class="settings-card mb-4">
      <div class="card-header">
        <div class="icon-wrapper bg-linear-to-br from-cyan-500 to-blue-600">
          <span class="icon-[mdi--image-filter-hdr] h-4 w-4 text-primary"></span>
        </div>
        <div>
          <h2 class="card-title">{{ t('components.settings.backgroundType') }}</h2>
          <p class="card-desc">
            {{ t('components.settings.backgroundTypeDesc') }}
          </p>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        <Button
          v-for="opt in bgOptions"
          :key="String(opt.value)"
          variant="ghost"
          size="none"
          class="theme-option"
          :class="{ active: backgroundType === opt.value }"
          @click="backgroundType = opt.value"
        >
          <span
            class="option-icon"
            :class="
              opt.value === 'aurora'
                ? 'icon-[mdi--weather-night]'
                : opt.value === 'colorbends'
                  ? 'icon-[mdi--gradient-horizontal]'
                  : 'icon-[mdi--blur]'
            "
          ></span>
          <span class="option-label">{{ opt.label }}</span>
        </Button>
      </div>
    </section>

    <section class="settings-card mb-4">
      <div class="card-header">
        <div class="icon-wrapper bg-linear-to-br from-amber-500 to-orange-600">
          <span class="icon-[mdi--translate] h-4 w-4 text-primary"></span>
        </div>
        <div>
          <h2 class="card-title">{{ t('components.settings.uiLanguage') }}</h2>
          <p class="card-desc">{{ t('components.settings.uiLanguageDesc') }}</p>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        <Button
          v-for="opt in langOptions"
          :key="String(opt.value)"
          variant="ghost"
          size="none"
          class="theme-option"
          :class="{ active: lang === opt.value }"
          @click="lang = opt.value"
        >
          <span class="option-label text-sm font-medium">{{ opt.label }}</span>
        </Button>
      </div>
    </section>

    <section class="settings-card mb-4">
      <div class="card-header">
        <div class="icon-wrapper bg-linear-to-br from-emerald-500 to-teal-600">
          <span class="icon-[mdi--music-circle] h-4 w-4 text-primary"></span>
        </div>
        <div>
          <h2 class="card-title">{{ t('components.settings.audioQuality.title') }}</h2>
          <p class="card-desc">{{ t('components.settings.audioQuality.desc') }}</p>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <Button
          v-for="opt in qualityOptions"
          :key="String(opt.value)"
          variant="ghost"
          size="none"
          class="theme-option"
          :class="{ active: audioQuality === opt.value }"
          @click="audioQuality = opt.value"
        >
          <span class="option-label text-xs font-medium">{{ opt.label }}</span>
        </Button>
      </div>
    </section>

    <section class="settings-card">
      <div class="card-header">
        <div class="icon-wrapper bg-linear-to-br from-pink-500 to-rose-600">
          <span class="icon-[mdi--music-note] h-4 w-4 text-primary"></span>
        </div>
        <div class="flex-1">
          <h2 class="card-title">{{ t('components.settings.footerLyricsTitle') }}</h2>
          <p class="card-desc">
            {{ t('components.settings.footerLyricsDesc') }}
          </p>
        </div>
        <Button
          variant="ghost"
          size="none"
          class="toggle-switch"
          :class="{ active: footerEnabled }"
          @click="footerEnabled = !footerEnabled"
        >
          <span class="toggle-dot"></span>
        </Button>
      </div>

      <div v-if="footerEnabled" class="mt-4 border-t border-white/10 pt-4">
        <p class="text-primary/60 mb-3 text-xs">{{ t('components.settings.footerLyricsModes') }}</p>
        <div class="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="none"
            class="mode-chip"
            :class="{ active: originalChecked }"
            icon="mdi--format-text"
            icon-class="h-3.5 w-3.5"
            @click="originalChecked = !originalChecked"
          >
            {{ t('common.original') }}
          </Button>
          <Button
            variant="ghost"
            size="none"
            class="mode-chip"
            :class="{ active: transChecked }"
            icon="mdi--translate"
            icon-class="h-3.5 w-3.5"
            @click="transChecked = !transChecked"
          >
            {{ t('common.trans') }}
          </Button>
          <Button
            variant="ghost"
            size="none"
            class="mode-chip"
            :class="{ active: romaChecked }"
            icon="mdi--alphabetical"
            icon-class="h-3.5 w-3.5"
            @click="romaChecked = !romaChecked"
          >
            {{ t('common.roma') }}
          </Button>
        </div>
      </div>
    </section>

    <div class="mt-8 text-center">
      <p class="text-primary/30 text-xs">Glass Music Player</p>
    </div>
  </div>
</template>

<style scoped>
.settings-card {
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-border);
  border-radius: 1rem;
  padding: 1rem;
  backdrop-filter: blur(12px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--glass-text);
}

.card-desc {
  font-size: 0.625rem;
  color: var(--glass-text);
  opacity: 0.5;
  margin-top: 0.125rem;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem 0.5rem;
  border-radius: 0.75rem;
  background: var(--glass-hover-item-bg);
  border: 1.5px solid transparent;
  transition: all 0.2s ease;
}

.theme-option:active {
  transform: scale(0.96);
}

.theme-option.active {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15));
  border-color: rgba(236, 72, 153, 0.4);
}

.option-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--glass-text);
  opacity: 0.7;
}

.theme-option.active .option-icon {
  color: rgb(236, 72, 153);
  opacity: 1;
}

.option-label {
  font-size: 0.625rem;
  color: var(--glass-text);
  opacity: 0.7;
}

.theme-option.active .option-label {
  opacity: 1;
}

.toggle-switch {
  position: relative;
  width: 2.75rem;
  height: 1.5rem;
  border-radius: 0.75rem;
  background: var(--glass-hover-item-bg);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.toggle-switch.active {
  background: linear-gradient(135deg, rgb(236, 72, 153), rgb(139, 92, 246));
  border-color: transparent;
}

.toggle-dot {
  position: absolute;
  top: 50%;
  left: 0.25rem;
  transform: translateY(-50%);
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.toggle-switch.active .toggle-dot {
  left: calc(100% - 1.25rem);
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: 2rem;
  font-size: 0.75rem;
  background: var(--glass-hover-item-bg);
  color: var(--glass-text);
  opacity: 0.7;
  border: 1.5px solid transparent;
  transition: all 0.2s ease;
}

.mode-chip:active {
  transform: scale(0.96);
}

.mode-chip.active {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
  border-color: rgba(236, 72, 153, 0.5);
  color: rgb(236, 72, 153);
  opacity: 1;
}
</style>
