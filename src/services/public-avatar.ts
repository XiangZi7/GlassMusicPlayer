// 网易云公开头像有时返回 HTTP，同 CDN 升级为 HTTPS；其他头像仍只接受安全链接。
export function publicAvatar(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (url.username || url.password) return null
    if (
      url.protocol === 'http:' &&
      !url.port &&
      /^p\d+\.music\.126\.net$/.test(url.hostname)
    )
      url.protocol = 'https:'
    if (url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}
