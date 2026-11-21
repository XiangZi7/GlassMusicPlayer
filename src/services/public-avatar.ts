// 只接受平台返回的普通 HTTPS 公开头像地址，拒绝脚本、凭据与任意内联内容。
export function publicAvatar(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}
