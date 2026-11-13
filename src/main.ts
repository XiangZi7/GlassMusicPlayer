import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { router } from '@/router'
import '@fontsource-variable/manrope'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/jetbrains-mono'
import '@/styles/main.css'

// 原生版本检测结果在首屏挂载前生效，透明区域只为 Windows 10 主窗口启用。
const nativeFrame = window.__MIRAI_WINDOW_FRAME__
if (nativeFrame?.custom) {
  document.documentElement.dataset.windowFrame = 'windows10'
  document.documentElement.style.setProperty(
    '--native-frame-inset',
    `${nativeFrame.inset}px`
  )
}

createApp(App).use(createPinia()).use(router).mount('#app')
