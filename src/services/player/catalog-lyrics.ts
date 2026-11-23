import type { CatalogLyrics } from '@/api'

interface LyricWord {
  start: number
  duration: number
  text: string
}

interface LyricLine {
  t: number
  o: string
  tr: string
  words?: LyricWord[]
  trWords?: LyricWord[]
}

// 读取同一句的多个 LRC 时间戳，忽略没有时间的元数据和空行。
function parseLrc(lrc: string): Map<number, string> {
  const lines = new Map<number, string>()
  const timestamp = /\[(\d+):(\d{1,2}(?:\.\d+)?)\]/g
  for (const line of lrc.split(/\r?\n/)) {
    const text = line.replace(timestamp, '').trim()
    if (!text) continue
    for (const [, minutes, seconds] of line.matchAll(timestamp)) {
      const ms = Math.round((Number(minutes) * 60 + Number(seconds)) * 1000)
      if (Number.isSafeInteger(ms) && !lines.has(ms)) lines.set(ms, text)
    }
  }
  return lines
}

// 读取平台 YRC 的绝对毫秒起点和持续时间，缺损的句子交给 LRC 回退。
function parseYrc(yrc: string): Map<number, LyricWord[]> {
  const lines = new Map<number, LyricWord[]>()
  for (const line of yrc.split(/\r?\n/)) {
    const header = /^\[(\d+),(\d+)\]/.exec(line)
    if (!header) continue
    const start = Number(header[1])
    const duration = Number(header[2])
    if (!Number.isSafeInteger(start + duration) || duration <= 0) continue
    const content = line.slice(header[0].length)
    const marks = [...content.matchAll(/\((\d+),(\d+),-?\d+\)/g)]
    if (!marks.length || marks[0]?.index !== 0) continue
    const words = marks.map((mark, index) => ({
      start: Number(mark[1]) / 1000,
      duration: Number(mark[2]) / 1000,
      text: content.slice(mark.index + mark[0].length, marks[index + 1]?.index),
    }))
    if (!words.some(word => word.text.trim() && word.duration > 0)) continue
    if (
      words.some((word, index) => {
        const previous = words[index - 1]
        return (
          !Number.isFinite(word.start + word.duration) ||
          word.start * 1000 < start - 1 ||
          word.start * 1000 > start + duration + 1 ||
          (previous && word.start < previous.start)
        )
      })
    )
      continue
    lines.set(
      start,
      words.filter(word => word.text !== '')
    )
  }
  return lines
}

// 合并逐字和整句版本，按时间配对译文，并保留未配对的普通歌词。
export function parseCatalogLyrics(lyrics: CatalogLyrics): LyricLine[] {
  const plain = parseLrc(lyrics.lrc)
  const translated = parseLrc(lyrics.translatedLrc)
  const timed = parseYrc(lyrics.yrc ?? '')
  const translatedByYrc = parseLrc(lyrics.ytlrc ?? '')
  const timedTranslation = parseYrc(lyrics.ytlrc ?? '')

  // 译文优先与 YRC 句时间对应，只有译文自己的词段才进行逐字填色。
  function translationAt(
    ms: number,
    fallback = ms
  ): Pick<LyricLine, 'tr' | 'trWords'> {
    const words = timedTranslation.get(ms) ?? timedTranslation.get(fallback)
    if (words)
      return {
        tr: words
          .map(word => word.text)
          .join('')
          .trim(),
        trWords: words,
      }
    return {
      tr:
        translatedByYrc.get(ms) ??
        translatedByYrc.get(fallback) ??
        translated.get(ms) ??
        translated.get(fallback) ??
        '',
    }
  }
  const lines: LyricLine[] = []
  for (const [ms, words] of timed) {
    const o = words
      .map(word => word.text)
      .join('')
      .trim()
    const normalized = o.replace(/\s/g, '')
    let match: number | undefined
    let distance = Infinity
    for (const [stamp, original] of plain) {
      const delta = Math.abs(stamp - ms)
      if (delta >= distance || delta > 1000) continue
      if (delta > 150 && original.replace(/\s/g, '') !== normalized) continue
      match = stamp
      distance = delta
    }
    if (match !== undefined) plain.delete(match)
    lines.push({
      t: ms / 1000,
      o,
      ...translationAt(ms, match),
      words,
    })
  }
  for (const [ms, o] of plain)
    lines.push({ t: ms / 1000, o, ...translationAt(ms) })
  return lines.sort((a, b) => a.t - b.t)
}
