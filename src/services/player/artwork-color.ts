export type ArtworkColor = readonly [number, number, number]
const cache = new Map<string, Promise<ArtworkColor | undefined>>()

// 只在换封面时取色；使用小画布统计主色，不在频谱动画循环中读取像素。
export function artworkColor(
  url: string,
  document: Document
): Promise<ArtworkColor | undefined> {
  if (!url) return Promise.resolve(undefined)
  const cached = cache.get(url)
  if (cached) return cached
  const pending = new Promise<ArtworkColor | undefined>(resolve => {
    const image = document.createElement('img')
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    const timeout = setTimeout(() => finish(undefined), 8000)
    function finish(color: ArtworkColor | undefined): void {
      clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      resolve(color)
    }
    image.onerror = () => finish(undefined)
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 24
        const paint = canvas.getContext('2d', { willReadFrequently: true })
        if (!paint) return finish(undefined)
        paint.drawImage(image, 0, 0, 24, 24)
        const pixels = paint.getImageData(0, 0, 24, 24).data
        const buckets = new Map<
          number,
          { weight: number; red: number; green: number; blue: number }
        >()
        for (let index = 0; index < pixels.length; index += 4) {
          if ((pixels[index + 3] ?? 0) < 192) continue
          const red = pixels[index]!,
            green = pixels[index + 1]!,
            blue = pixels[index + 2]!
          const highest = Math.max(red, green, blue),
            lowest = Math.min(red, green, blue)
          if (highest < 28) continue
          const saturation = (highest - lowest) / Math.max(1, highest)
          const weight = 0.25 + saturation
          const key =
            (Math.floor(red / 32) << 6) |
            (Math.floor(green / 32) << 3) |
            Math.floor(blue / 32)
          const bucket = buckets.get(key) || {
            weight: 0,
            red: 0,
            green: 0,
            blue: 0,
          }
          bucket.weight += weight
          bucket.red += red * weight
          bucket.green += green * weight
          bucket.blue += blue * weight
          buckets.set(key, bucket)
        }
        const dominant = [...buckets.values()].sort(
          (left, right) => right.weight - left.weight
        )[0]
        if (!dominant) return finish([140, 140, 150])
        const raw = [dominant.red, dominant.green, dominant.blue].map(
          channel => channel / dominant.weight
        )
        const peak = Math.max(...raw)
        const gain = Math.max(1, 170 / Math.max(1, peak))
        finish([
          Math.min(255, Math.round(raw[0]! * gain)),
          Math.min(255, Math.round(raw[1]! * gain)),
          Math.min(255, Math.round(raw[2]! * gain)),
        ])
      } catch {
        // 无 CORS 的外站图片不影响播放，调用方回退到当前歌曲已有的背景光色。
        finish(undefined)
      }
    }
    image.src = url
  })
  if (cache.size >= 64) cache.delete(cache.keys().next().value!)
  cache.set(url, pending)
  return pending
}
