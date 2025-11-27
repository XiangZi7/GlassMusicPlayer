import { createI18n } from 'vue-i18n'
import { getBrowserLang } from '@/utils'

import zh from './modules/zh'
import en from './modules/en'
import ja from './modules/ja'

function getPersistedLang(): string | undefined {
  try {
    const raw = localStorage.getItem('global')
    if (!raw) return undefined
    const obj = JSON.parse(raw)
    const v = obj?.lang
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

const initialLocale = getPersistedLang() || getBrowserLang()

const i18n = createI18n({
  allowComposition: true,
  legacy: false,
  locale: initialLocale,
  messages: {
    zh,
    en,
    ja,
  },
})

export default i18n
