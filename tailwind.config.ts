// tailwind.config.ts
// @ts-ignore
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],

  theme: {
    extend: {
      // 主题扩展
    },
  },

  // 处理动态类名
  safelist: [
    // 匹配 icon-[...] 格式的类名
    { pattern: /icon-\[.+]/ },

    // 其他，动态的颜色或背景色
    // { pattern: /bg-(red|green|blue)-(100|200|300)/ },
    // { pattern: /text-(xs|sm|lg|xl)/ },
  ],

  plugins: [],
}

export default config
