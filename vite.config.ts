import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import manifest from './package.json' with { type: 'json' }
// @ts-expect-error type error without @types/node package
import process from 'node:process'
const { version, author, description, homepage } = manifest
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [vue(), tailwindcss()],
  define: { __APP_INFO__: JSON.stringify({ version, author, description, homepage }) },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
    },
  },
  optimizeDeps: { entries: ['index.html'] },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    // Windows 上 localhost 可能优先绑定已占用的 ::1，与 Tauri 统一使用 IPv4。
    host: host || '127.0.0.1',
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 跳过原生产物、浏览器测试资料和本地依赖仓库，避免启动时遍历大量缓存文件。
      ignored: ['**/src-tauri/**', '**/.tmp/**', '**/.pnpm-store/**'],
    },
  },
}))
