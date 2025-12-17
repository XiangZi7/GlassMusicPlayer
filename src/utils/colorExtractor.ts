/**
 * 图像颜色提取工具
 * 从图片中提取主色调和配色方案
 */

export interface RGB {
  r: number
  g: number
  b: number
}

export interface ColorPalette {
  dominant: string // 主色调
  vibrant: string // 鲜艳色
  muted: string // 柔和色
  gradient: string[] // 渐变色数组
}

/**
 * 将 RGB 转换为十六进制颜色
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    // 确保值在 0-255 范围内
    const val = Math.max(0, Math.min(255, Math.round(x)))
    const hex = val.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * 计算颜色亮度 (0-255)
 */
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * 计算颜色饱和度 (0-1)
 */
function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  if (max === 0) return 0
  return delta / max
}

/**
 * 增强颜色饱和度
 */
function enhanceSaturation(r: number, g: number, b: number, factor: number): RGB {
  const avg = (r + g + b) / 3
  return {
    r: Math.min(255, avg + (r - avg) * factor),
    g: Math.min(255, avg + (g - avg) * factor),
    b: Math.min(255, avg + (b - avg) * factor)
  }
}

/**
 * 调整颜色亮度
 */
function adjustBrightness(r: number, g: number, b: number, factor: number): RGB {
  return {
    r: Math.min(255, Math.max(0, r * factor)),
    g: Math.min(255, Math.max(0, g * factor)),
    b: Math.min(255, Math.max(0, b * factor))
  }
}

/**
 * 使用 k-means 聚类提取主要颜色
 */
function kMeansClustering(pixels: RGB[], k: number = 5, maxIterations: number = 10): RGB[] {
  if (pixels.length === 0) return []

  // 随机初始化中心点
  let centers: RGB[] = []
  const step = Math.floor(pixels.length / k)
  for (let i = 0; i < k; i++) {
    centers.push({ ...pixels[i * step] })
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // 分配像素到最近的中心
    const clusters: RGB[][] = Array.from({ length: k }, () => [])

    for (const pixel of pixels) {
      let minDist = Infinity
      let clusterIndex = 0

      for (let i = 0; i < k; i++) {
        const dist = Math.sqrt(
          Math.pow(pixel.r - centers[i].r, 2) +
          Math.pow(pixel.g - centers[i].g, 2) +
          Math.pow(pixel.b - centers[i].b, 2)
        )

        if (dist < minDist) {
          minDist = dist
          clusterIndex = i
        }
      }

      clusters[clusterIndex].push(pixel)
    }

    // 更新中心点
    const newCenters: RGB[] = []
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) {
        newCenters.push(centers[i])
        continue
      }

      const avgR = clusters[i].reduce((sum, p) => sum + p.r, 0) / clusters[i].length
      const avgG = clusters[i].reduce((sum, p) => sum + p.g, 0) / clusters[i].length
      const avgB = clusters[i].reduce((sum, p) => sum + p.b, 0) / clusters[i].length

      newCenters.push({ r: avgR, g: avgG, b: avgB })
    }

    centers = newCenters
  }

  return centers
}

/**
 * 从图片 URL 提取颜色调色板 (优化版)
 */
export async function extractColorsFromImage(imageUrl: string): Promise<ColorPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous' // 允许跨域

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // 大幅缩小图片以提高性能 (最大 50x50)
        const scale = Math.min(50 / img.width, 50 / img.height)
        canvas.width = Math.ceil(img.width * scale)
        canvas.height = Math.ceil(img.height * scale)

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // 更激进的采样 (每 20 个像素采样一次)
        const pixels: RGB[] = []
        for (let i = 0; i < data.length; i += 80) { // 每 20 个像素
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          // 跳过透明像素和太暗/太亮的像素
          if (a < 125) continue
          const lum = getLuminance(r, g, b)
          if (lum < 20 || lum > 235) continue

          pixels.push({ r, g, b })
        }

        if (pixels.length === 0) {
          // 如果没有有效像素,返回默认渐变
          resolve({
            dominant: '#667eea',
            vibrant: '#764ba2',
            muted: '#f093fb',
            gradient: ['#667eea', '#764ba2', '#f093fb']
          })
          return
        }

        // 使用 k-means 提取 3 个主要颜色 (减少到 3 个)
        const mainColors = kMeansClustering(pixels, 3, 5) // 减少迭代次数到 5

        // 按饱和度排序
        const sortedByVibrance = [...mainColors].sort((a, b) => {
          const satA = getSaturation(a.r, a.g, a.b)
          const satB = getSaturation(b.r, b.g, b.b)
          return satB - satA
        })

        // 主色调: 饱和度最高的颜色
        const vibrantColor = sortedByVibrance[0]
        const enhancedVibrant = enhanceSaturation(vibrantColor.r, vibrantColor.g, vibrantColor.b, 1.3)

        // 柔和色: 降低饱和度
        const mutedColor = sortedByVibrance[sortedByVibrance.length - 1]
        const enhancedMuted = adjustBrightness(mutedColor.r, mutedColor.g, mutedColor.b, 1.2)

        // 主色调: 最常见的颜色
        const dominantColor = mainColors[0]

        // 生成渐变色数组 (3 个颜色)
        const gradientColors: string[] = sortedByVibrance.map(color => {
          const enhanced = enhanceSaturation(color.r, color.g, color.b, 1.2)
          return rgbToHex(enhanced.r, enhanced.g, enhanced.b)
        })

        resolve({
          dominant: rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b),
          vibrant: rgbToHex(enhancedVibrant.r, enhancedVibrant.g, enhancedVibrant.b),
          muted: rgbToHex(enhancedMuted.r, enhancedMuted.g, enhancedMuted.b),
          gradient: gradientColors
        })

      } catch (error) {
        console.error('Color extraction error:', error)
        // 返回默认渐变
        resolve({
          dominant: '#667eea',
          vibrant: '#764ba2',
          muted: '#f093fb',
          gradient: ['#667eea', '#764ba2', '#f093fb']
        })
      }
    }

    img.onerror = () => {
      console.error('Failed to load image:', imageUrl)
      // 返回默认渐变
      resolve({
        dominant: '#667eea',
        vibrant: '#764ba2',
        muted: '#f093fb',
        gradient: ['#667eea', '#764ba2', '#f093fb']
      })
    }

    // 添加时间戳避免缓存问题
    img.src = imageUrl.includes('?') ? imageUrl : `${imageUrl}?t=${Date.now()}`
  })
}

/**
 * 从十六进制颜色生成渐变色数组
 */
export function generateGradientFromColor(hexColor: string, count: number = 3): string[] {
  // 解析十六进制颜色
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)

  const colors: string[] = [hexColor]

  // 生成变体
  if (count > 1) {
    // 更亮的版本
    const brighter = adjustBrightness(r, g, b, 1.3)
    colors.push(rgbToHex(brighter.r, brighter.g, brighter.b))
  }

  if (count > 2) {
    // 更饱和的版本
    const saturated = enhanceSaturation(r, g, b, 1.5)
    colors.push(rgbToHex(saturated.r, saturated.g, saturated.b))
  }

  return colors.slice(0, count)
}

/**
 * 缓存颜色调色板,避免重复提取
 */
const colorCache = new Map<string, ColorPalette>()

export async function getColorPalette(imageUrl: string, useCache: boolean = true): Promise<ColorPalette> {
  if (useCache && colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!
  }

  const palette = await extractColorsFromImage(imageUrl)

  if (useCache) {
    colorCache.set(imageUrl, palette)

    // 限制缓存大小
    if (colorCache.size > 50) {
      const firstKey = colorCache.keys().next().value
      colorCache.delete(firstKey)
    }
  }

  return palette
}
