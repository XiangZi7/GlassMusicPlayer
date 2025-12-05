import i18n from '@/languages'
const { t } = i18n.global

export const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 格式化数字，超过 100000000 显示亿，超过 10000 显示万
export const formatCount = (count: number | string) => {
  const num = typeof count === 'string' ? parseInt(count) : count
  if (isNaN(num)) return count
  if (num >= 100000000) return (num / 100000000).toFixed(1) + t('common.units.billion')
  if (num >= 10000) return (num / 10000).toFixed(1) + t('common.units.tenThousand')
  return num
}
