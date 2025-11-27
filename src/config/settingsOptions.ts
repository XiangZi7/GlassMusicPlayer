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

export const getShowHideOptions = (t: (k: string) => string): Option<boolean>[] => [
  { value: true, label: t('common.show') },
  { value: false, label: t('common.hide') },
]
