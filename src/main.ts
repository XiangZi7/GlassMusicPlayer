import { createApp } from 'vue'
import App from './App.vue'

// Global style
import './style/index.scss'
// router
import router from './routers'

// vue i18n
import I18n from "@/languages"

// pinia
import Pinia from '@/stores'

// svg icon
import 'virtual:svg-icons-register'

const app = createApp(App)

app.use(Pinia)
app.use(router)
app.use(I18n)

app.mount('#app')
