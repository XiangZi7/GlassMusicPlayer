import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import '@fontsource-variable/manrope'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/jetbrains-mono'
import '@/styles/main.css'

createApp(App).use(createPinia()).use(router).mount('#app')
