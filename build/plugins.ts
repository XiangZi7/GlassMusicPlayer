import { PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import path from 'path'
import viteCompression from 'vite-plugin-compression'
import removeConsole from 'vite-plugin-remove-console'
import { qrcode } from 'vite-plugin-qrcode'
import vueDevTools from 'vite-plugin-vue-devtools'

import Icons from 'unplugin-icons/vite'

export const createVitePlugins = (viteEnv: ViteEnv): (PluginOption | PluginOption[])[] => {
  return [
    vue(),
    // vueDevTools(),
    // 打包去除console
    removeConsole(),
    // basicSsl() 模拟https的配置,
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dirs: ['src/utils/**', 'src/stores/modules/**', 'src/hooks/**'],
      dts: 'src/auto-import/imports.d.ts',
      eslintrc: {
        enabled: true,
        filepath: 'src/auto-import/eslintrc-auto-import.json',
      },
    }),
    Components({
      dirs: ['src/components'],
      dts: 'src/auto-import/components.d.ts',
      resolvers: [
        // 集成图标集
        IconsResolver({
          prefix: 'icon', // 私有前缀
        }),
      ],
    }),
    Icons({
      autoInstall: true, // 自动安装所需图标集
    }),
    // 本地SVG图标作为组件的方式
    createSvgIconsPlugin({
      // 指定需要缓存的图标文件夹
      iconDirs: [path.resolve(process.cwd(), 'src/assets/svg')],
      // 指定symbolId格式
      symbolId: 'icon-[dir]-[name]',
    }),
    // 对大于 1k 的文件进行压缩
    viteCompression({
      threshold: 1000,
    }),
    // 二维码
    qrcode(),
  ]
}
