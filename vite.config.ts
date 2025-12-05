import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { wrapperEnv } from './build/getEnv'
import { createProxy } from './build/proxy'
import { createVitePlugins } from './build/plugins'

export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root)
  const viteEnv = wrapperEnv(env)

  return {
    plugins: createVitePlugins(viteEnv),
    server: {
      port: 5089,
      host: true,
      // 代理配置
      proxy: createProxy(viteEnv.VITE_PROXY),
    },
    
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    base: viteEnv.VITE_PUBLIC_PATH,
    build: {
      rollupOptions: {
        // 静态资源分类打包
        output: {
          entryFileNames: 'static/js/[name]-[hash].js',
          chunkFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
          // 静态资源分拆打包
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.toString().indexOf('.pnpm/') !== -1) {
                return id.toString().split('.pnpm/')[1].split('/')[0].toString()
              } else if (id.toString().indexOf('node_modules/') !== -1) {
                return id.toString().split('node_modules/')[1].split('/')[0].toString()
              }
            }
          },
        },
      },
    },
  }
})
