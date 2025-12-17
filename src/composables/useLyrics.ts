import { lyric } from '@/api'

export interface LyricLine {
  time: number
  ori: string
  tran?: string
  roma?: string
}

interface RawLyricLine {
  time: number
  text: string
}

const state = reactive({
  lyricsOriginal: [] as RawLyricLine[],
  lyricsTrans: [] as RawLyricLine[],
  lyricsRoma: [] as RawLyricLine[],
  showTrans: true,
  showRoma: false,
})
const lastId = ref<string | number | null>(null)
const loading = ref(false)

const parseLrc = (lrc: string): RawLyricLine[] => {
  if (!lrc) return []
  const lines = lrc.split(/\r?\n/)
  const result: RawLyricLine[] = []
  const timeTag = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g
  for (const raw of lines) {
    if (!raw) continue
    let match: RegExpExecArray | null
    const text = raw.replace(timeTag, '').trim()
    if (!text) continue
    timeTag.lastIndex = 0
    while ((match = timeTag.exec(raw))) {
      const m = Number(match[1])
      const s = Number(match[2])
      const ms = match[3] ? Number(match[3].slice(0, 3)) : 0
      const time = m * 60 + s + ms / 1000
      result.push({ time, text })
    }
  }
  return result.sort((a, b) => a.time - b.time)
}

interface LyricMerged {
  time: number
  ori: string
  tran?: string
  roma?: string
}
const mergedLines = computed<LyricMerged[]>(() => {
  const ori = state.lyricsOriginal
  const tran = state.lyricsTrans
  const roma = state.lyricsRoma
  const res: LyricMerged[] = []
  let j = 0, k = 0
  const eps = 0.5

  const splitBilingual = (text: string) => {
    const idx = text.search(/[\u4e00-\u9fff]/)
    if (idx > 0) {
      const left = text.slice(0, idx).trim()
      const right = text.slice(idx).trim()
      // 如果左侧仅包含空白或标点（例如《【（等），则不拆分，整行视为原文
      if (/^[\p{P}\s]+$/u.test(left)) {
        return { oriPart: text, tranPart: undefined }
      }
      return { oriPart: left, tranPart: right && right !== left ? right : undefined }
    }
    return { oriPart: text, tranPart: undefined }
  }

  for (let i = 0; i < ori.length; i++) {
    const o = ori[i]
    while (j + 1 < tran.length && tran[j + 1].time <= o.time + eps) j++
    while (k + 1 < roma.length && roma[k + 1].time <= o.time + eps) k++

    const { oriPart, tranPart } = splitBilingual(o.text)
    const tCandidate = tran[j] && Math.abs(tran[j].time - o.time) <= eps ? tran[j].text : undefined
    const rCandidate = roma[k] && Math.abs(roma[k].time - o.time) <= eps ? roma[k].text : undefined

    const finalTran = tCandidate ?? tranPart
    res.push({ time: o.time, ori: oriPart, tran: finalTran, roma: rCandidate })
  }
  return res
})

const activeSingleLyrics = computed<LyricLine[]>(() => {
  return mergedLines.value.map(m => ({ time: m.time, ori: m.ori, tran: m.tran, roma: m.roma }))
})

const activeTimeline = computed<number[]>(() => mergedLines.value.map(m => m.time))
const timeForIndex = (index: number) => mergedLines.value[index]?.time ?? 0

const fetchLyrics = async (id?: string | number, force = false) => {
  try {
    if (!id) {
      state.lyricsOriginal = []
      state.lyricsTrans = []
      state.lyricsRoma = []
      lastId.value = null
      return
    }
    if (!force && lastId.value === id) return
    if (loading.value) return
    loading.value = true
    const res: any = await lyric({ id: String(id) })
    const rawOri: string = res?.lrc?.lyric || ''
    const rawTrans: string = res?.tlyric?.lyric || ''
    const rawRoma: string = res?.romalrc?.lyric || ''
    const ori = parseLrc(rawOri)
    const tran = parseLrc(rawTrans)
    const roma = parseLrc(rawRoma)
    state.lyricsOriginal = ori.length ? ori : [{ time: 0, text: '暂无歌词' }]
    state.lyricsTrans = tran
    state.lyricsRoma = roma
    lastId.value = id
  } catch {
    state.lyricsOriginal = [{ time: 0, text: '歌词获取失败' }]
    state.lyricsTrans = []
    state.lyricsRoma = []
  } finally {
    loading.value = false
  }
}

export const useLyrics = () => {
  return {
    ...toRefs(state),
    mergedLines,
    activeSingleLyrics,
    activeTimeline,
    timeForIndex,
    fetchLyrics,
    loading,
  }
}
