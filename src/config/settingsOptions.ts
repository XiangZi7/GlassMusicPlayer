import type { AudioQuality } from '@/stores/modules/settings'

export type Option<T = any> = { value: T; label: string }

export const getBackgroundOptions = (t: (k: string) => string): Option<string>[] => [
  { value: 'aurora', label: t('components.settings.backgroundNames.aurora') },
  { value: 'colorbends', label: t('components.settings.backgroundNames.colorbends') },
  { value: 'ultimate', label: t('components.settings.backgroundNames.ultimate') },
]

export const getThemeOptions = (t: (k: string) => string): Option<string>[] => [
  { value: 'light', label: t('components.settings.themeOptions.light') },
  { value: 'dark', label: t('components.settings.themeOptions.dark') },
  { value: 'system', label: t('components.settings.themeOptions.system') },
]

export const getLangOptions = (t: (k: string) => string): Option<string>[] => [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

export const getAudioQualityOptions = (t: (k: string) => string): Option<AudioQuality>[] => [
  { value: 'standard', label: t('components.settings.audioQuality.standard') },
  { value: 'higher', label: t('components.settings.audioQuality.higher') },
  { value: 'exhigh', label: t('components.settings.audioQuality.exhigh') },
  { value: 'lossless', label: t('components.settings.audioQuality.lossless') },
  { value: 'hires', label: t('components.settings.audioQuality.hires') },
  { value: 'jymaster', label: t('components.settings.audioQuality.jymaster') },
]

export const getShowHideOptions = (t: (k: string) => string): Option<boolean>[] => [
  { value: true, label: t('common.show') },
  { value: false, label: t('common.hide') },
]

export const getVisualizerTypeOptions = (
  t: (k: string) => string
): Option<'bars' | 'wave' | 'circular'>[] => [
  { value: 'bars', label: t('components.settings.visualizerType.bars') },
  { value: 'wave', label: t('components.settings.visualizerType.wave') },
  { value: 'circular', label: t('components.settings.visualizerType.circular') },
]
