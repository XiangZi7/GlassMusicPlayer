/// <reference types="vite/client" />

/** Vite 从发行清单注入的应用信息，浏览器和桌面包共用。 */
declare const __APP_INFO__: Readonly<{
  version: string
  author: string
  description: string
  homepage: string
}>

interface Window {
  /** Rust 在页面脚本执行前注入，仅主窗口的 Windows 10 外观使用。 */
  __MIRAI_WINDOW_FRAME__?: { custom: boolean; inset: number }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
interface ImportMetaEnv {
  readonly VITE_APP_BASE_API?: string
}
