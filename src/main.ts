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
import { useWindowSize, useDebounceFn } from '@vueuse/core'

const app = createApp(App)

app.use(Pinia)
app.use(router)
app.use(I18n)

app.mount('#app')

const globalStore = useGlobalStore()
const { theme } = storeToRefs(globalStore)
const applyThemeClass = (t: 'light' | 'dark') => {
  const root = document.documentElement
  if (t === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}
applyThemeClass(theme.value || 'light')
watch(theme, t => applyThemeClass(t || 'light'))

const { width } = useWindowSize()
const setRootFontSize = (w: number) => {
  const size = Math.min(16, Math.max(12, Math.round(14 + (w - 1280) / 640)))
  document.documentElement.style.fontSize = `${size}px`
}
setRootFontSize(window.innerWidth)
watch(
  width,
  useDebounceFn(w => setRootFontSize(w), 100)
)
