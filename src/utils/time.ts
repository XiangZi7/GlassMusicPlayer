/**
 * 时间与数字格式化工具
 * 提供歌曲时长、播放次数、日期等格式化方法
 */
import i18n from '@/languages'
const { t } = i18n.global

/**
 * 格式化歌曲时长（毫秒 → m:ss）
 * @param ms - 毫秒数
 * @returns 格式化后的时间字符串，如 "3:05"
 */
export const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * 格式化播放次数等大数字（自动转为 万/亿 单位）
 * @param count - 数字或字符串
 * @returns 格式化后的字符串，如 "3.2万"、"1.5亿"
 */
export const formatCount = (count: number | string) => {
  const num = typeof count === 'string' ? parseInt(count) : count
  if (isNaN(num)) return count
  if (num >= 100000000) return (num / 100000000).toFixed(1) + t('common.units.billion')
  if (num >= 10000) return (num / 10000).toFixed(1) + t('common.units.tenThousand')
  return num
}

/**
 * 格式化时间戳
 * @param time 时间戳（毫秒）
 * @returns 格式化后的时间字符串
 */
export const formatDate = (time: number) => {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 1分钟内
  if (diff < 60000) {
    return t('common.justNow')
  }

  // 1小时内
  if (diff < 3600000) {
    return Math.floor(diff / 60000) + t('common.minutesAgo')
  }

  // 24小时内
  if (diff < 86400000) {
    return Math.floor(diff / 3600000) + t('common.hoursAgo')
  }

  // 超过24小时显示具体日期
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  if (year === now.getFullYear()) {
    return `${month}月${day}日`
  }
  
  return `${year}年${month}月${day}日`
}
