export const updateSources = [
  { value: 'auto', label: '自动（优先加速）' },
  { value: 'github', label: 'GitHub 直连' },
  { value: 'ghproxy', label: 'GH-Proxy 加速' },
  { value: 'ghfast', label: 'ghfast 加速' },
  { value: 'custom', label: '自定义转发' },
] as const

// 恢复旧版偏好或接收设置窗口提交时，只接受已实现的下载线路。
export function isUpdateSource(value: string): boolean {
  return updateSources.some(source => source.value === value)
}

// 自定义线路只保存 HTTPS 转发前缀，避免把账号、查询密钥或片段写入偏好。
export function isValidUpdateProxy(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      /^https:\/\//i.test(value) &&
      !url.username &&
      !url.password &&
      !/[?#\s\\]/.test(value) &&
      value.length <= 2048
    )
  } catch {
    return false
  }
}
