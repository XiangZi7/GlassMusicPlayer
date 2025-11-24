import { lyric } from '@/api'

export interface LyricLine {
  time: number
  text: string
}

const state = reactive({
  lyricsOriginal: [] as LyricLine[],
  lyricsTrans: [] as LyricLine[],
  lyricsRoma: [] as LyricLine[],
  showTrans: false,
  showRoma: false,
})
const lastId = ref<string | number | null>(null)
const loading = ref(false)

const parseLrc = (lrc: string): LyricLine[] => {
  if (!lrc) return []
  const lines = lrc.split(/\r?\n/)
  const result: LyricLine[] = []
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
  let j = 0,
    k = 0
  const eps = 0.5
  for (let i = 0; i < ori.length; i++) {
    const o = ori[i]
    while (j + 1 < tran.length && tran[j + 1].time <= o.time + eps) j++
    while (k + 1 < roma.length && roma[k + 1].time <= o.time + eps) k++
    const t = tran[j] && Math.abs(tran[j].time - o.time) <= eps ? tran[j].text : undefined
    const r = roma[k] && Math.abs(roma[k].time - o.time) <= eps ? roma[k].text : undefined
    res.push({ time: o.time, ori: o.text, tran: t, roma: r })
  }
  return res
})

const activeSingleLyrics = computed<LyricLine[]>(() => {
  return mergedLines.value.map(m => ({
    time: m.time,
    text: [
      m.ori,
      state.showTrans && m.tran ? m.tran : undefined,
      state.showRoma && m.roma ? m.roma : undefined,
    ]
      .filter(Boolean)
      .join('\n'),
  }))
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
