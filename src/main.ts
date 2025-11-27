import { createApp } from 'vue'
import App from './App.vue'

// Global style
import './style/index.scss'
// router
import router from './routers'

// vue i18n
import I18n from '@/languages'

// pinia
import Pinia from '@/stores'

// svg icon
import 'virtual:svg-icons-register'
import { useGlobalStore } from '@/stores/modules/global'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useWindowSize, useDebounceFn, usePreferredDark } from '@vueuse/core'

const app = createApp(App)

app.use(Pinia)
app.use(router)
app.use(I18n)

app.mount('#app')

const globalStore = useGlobalStore()
const { theme, lang } = storeToRefs(globalStore)
const preferredDark = usePreferredDark()
const applyThemeClass = (t: 'light' | 'dark') => {
  const root = document.documentElement
  if (t === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}
const resolveTheme = (t?: 'light' | 'dark' | 'system') => (t === 'system' ? (preferredDark.value ? 'dark' : 'light') : t || 'dark')
applyThemeClass(resolveTheme(theme.value))
watch([theme, preferredDark], () => applyThemeClass(resolveTheme(theme.value)))

const { width } = useWindowSize()
const setRootFontSize = (w: number) => {
  const raw = 13 + (w - 1280) / 960
  const size = Math.min(15, Math.max(11, Math.round(raw * 10) / 10))
  document.documentElement.style.fontSize = `${size}px`
}
setRootFontSize(window.innerWidth)
watch(
  width,
  useDebounceFn(w => setRootFontSize(w), 100)
)
const setLocale = (l?: 'zh' | 'en' | 'ja') => {
  const cur = I18n.global.locale as any
  if (cur && typeof cur === 'object' && 'value' in cur) cur.value = l || cur.value
  else (I18n.global.locale as any) = l || cur
}
if (lang.value) setLocale(lang.value)
watch(lang, l => setLocale(l))
