/**
 * 颜色主题适配工具
 * 根据当前主题（浅色/深色）调整颜色的亮度和饱和度
 */

/**
 * 将 RGB 颜色转换为 HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return [h * 360, s * 100, l * 100]
}

/**
 * 将 HSL 颜色转换为 RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360
  s /= 100
  l /= 100

  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/**
 * 解析颜色字符串为 RGB 数组
 */
function parseColor(color: string): [number, number, number] | null {
  // 处理 rgb/rgba 格式
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/)
  if (rgbMatch) {
    const values = rgbMatch[1].split(',').map(v => parseInt(v.trim()))
    return [values[0], values[1], values[2]]
  }

  // 处理十六进制格式
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (hexMatch) {
    return [parseInt(hexMatch[1], 16), parseInt(hexMatch[2], 16), parseInt(hexMatch[3], 16)]
  }

  // 处理简写十六进制格式
  const shortHexMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i)
  if (shortHexMatch) {
    return [
      parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
    ]
  }

  return null
}

/**
 * 检测当前是否为深色主题
 * 通过检查 document.documentElement 的类名或计算样式
 */
export function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false

  // 检查 HTML 元素上的 dark 类
  const htmlElement = document.documentElement
  if (htmlElement.classList.contains('dark')) {
    return true
  }

  // 检查背景色亮度
  const bgColor = window.getComputedStyle(htmlElement).backgroundColor
  const rgb = parseColor(bgColor)
  if (rgb) {
    // 计算相对亮度
    const [r, g, b] = rgb
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance < 0.5
  }

  return false
}

/**
 * 根据主题调整颜色
 * @param color - 原始颜色（支持 rgb/rgba/hex 格式）
 * @param isDark - 是否为深色主题
 * @returns 调整后的颜色字符串
 */
export function adaptColorForTheme(color: string, isDark: boolean): string {
  const rgb = parseColor(color)
  if (!rgb) return color

  const [r, g, b] = rgb
  let [h, s, l] = rgbToHsl(r, g, b)

  if (isDark) {
    // 深色主题：稍微提亮，增加饱和度
    l = Math.min(100, l * 1.1 + 5) // 提亮 10% + 5
    s = Math.min(100, s * 1.15) // 增加饱和度 15%
  } else {
    // 浅色主题：显著变暗，大幅增加饱和度
    l = Math.max(0, l * 0.5 - 10) // 变暗 50% - 10
    s = Math.min(100, s * 1.3 + 10) // 增加饱和度 30% + 10
  }

  const [nr, ng, nb] = hslToRgb(h, s, l)
  return `rgb(${nr}, ${ng}, ${nb})`
}

/**
 * 批量调整颜色数组
 * @param colors - 颜色数组
 * @param isDark - 是否为深色主题（可选，默认自动检测）
 * @returns 调整后的颜色数组
 */
export function adaptColorsForTheme(colors: string[], isDark?: boolean): string[] {
  const darkTheme = isDark !== undefined ? isDark : isDarkTheme()
  return colors.map(color => adaptColorForTheme(color, darkTheme))
}
