import type { SourceTrack } from '@/types/prototype'
import { preferenceTrackKey } from '@/services/player/preferences'

const statsKey = 'miraiMusic.playStats.v1'

export interface PlayStats {
  /** 每首歌的真实播放次数，按稳定曲目标识计。 */
  counts: Record<string, number>
  /** 每天真实聆听的秒数，键为本地日期 YYYY-MM-DD。 */
  days: Record<string, number>
  /** 统计开始积累的本地日期，启用前为空串。 */
  since: string
}

// 本地日期键：按用户本地日历分桶，不用 UTC，避免深夜聆听记错天。
export function localDayKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// 读取真实播放统计，损坏或旧数据一律回退空统计，不伪造历史。
export function readPlayStats(): PlayStats {
  const empty: PlayStats = { counts: {}, days: {}, since: '' }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(statsKey) || 'null')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return empty
    const row = saved as Record<string, unknown>
    const counts: Record<string, number> = {}
    const days: Record<string, number> = {}
    if (row.counts && typeof row.counts === 'object' && !Array.isArray(row.counts)) {
      for (const [key, value] of Object.entries(row.counts as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) counts[key] = Math.floor(value)
      }
    }
    if (row.days && typeof row.days === 'object' && !Array.isArray(row.days)) {
      for (const [key, value] of Object.entries(row.days as Record<string, unknown>)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof value === 'number' && Number.isFinite(value) && value > 0) {
          days[key] = Math.floor(value)
        }
      }
    }
    return {
      counts,
      days,
      since: typeof row.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.since) ? row.since : '',
    }
  } catch {
    return empty
  }
}

// 保存播放统计，写入失败静默忽略，不影响播放。
function writePlayStats(stats: PlayStats): void {
  try {
    localStorage.setItem(statsKey, JSON.stringify(stats))
  } catch {
    /* 本机存储不可用时不记录，不打断播放。 */
  }
}

// 记录一次真实播放开始：同一首歌每次被切到并开始播放计一次。
export function recordPlayStart(track: SourceTrack): void {
  const stats = readPlayStats()
  if (!stats.since) stats.since = localDayKey()
  const key = preferenceTrackKey(track)
  stats.counts[key] = (stats.counts[key] || 0) + 1
  writePlayStats(stats)
}

// 累加一段真实聆听时长：只在音频实际播放时由布局层按固定间隔调用。
export function recordListeningSeconds(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return
  const stats = readPlayStats()
  if (!stats.since) stats.since = localDayKey()
  const day = localDayKey()
  stats.days[day] = (stats.days[day] || 0) + Math.floor(seconds)
  writePlayStats(stats)
}
