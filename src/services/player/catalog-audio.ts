import {
  getCatalogAudioUrl,
  getCatalogPlayback,
  type CatalogLyrics,
  type PlaybackStatus,
} from '@/api'
import { notify } from '@/services/notification'
import type { CatalogSource } from '@/types/prototype'
import { catalogKey } from '@/services/player/catalog'
import {
  createSpectrum,
  type SpectrumPlayback,
} from '@/services/player/spectrum'

export type CatalogAudioStatus = PlaybackStatus | 'loading' | 'error' | null

interface AudioEvents {
  time: (time: number, duration: number) => void
  playing: (playing: boolean) => void
  status: (status: CatalogAudioStatus) => void
  ended: () => void
}

// 主窗口拥有唯一音频元素，上游地址只在当前曲目生命周期内保留。
export function createCatalogAudio(root: HTMLElement, events: AudioEvents) {
  const audio = root.ownerDocument.createElement('audio')
  audio.preload = 'metadata'
  audio.hidden = true
  root.append(audio)
  const canvas = root.querySelector<HTMLCanvasElement>('[data-spectrum]')
  const spectrum = canvas ? createSpectrum(canvas, audio) : undefined
  let loaded: string | null = null
  let pending: AbortController | undefined

  // 用实际媒体时钟发布进度和时长，试听时长由媒体决定。
  function publishTime(): void {
    if (loaded)
      events.time(
        audio.currentTime,
        Number.isFinite(audio.duration) ? audio.duration : 0
      )
  }

  // 清理已加载或正在加载的音频，防止切歌后前一首的事件继续更新状态。
  function reset(): void {
    pending?.abort()
    pending = undefined
    loaded = null
    spectrum?.reset()
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  // 暂停本曲并取消未完成的请求，保留已加载音频供下一次继续播放。
  function pause(): void {
    pending?.abort()
    pending = undefined
    audio.pause()
    events.playing(false)
  }

  // 若地址已失效，可再次点击通过 API 重新取地址。
  function fail(message: string): void {
    reset()
    events.status('error')
    events.playing(false)
    notify(message, 'error')
  }

  // 点击曲目后现取音频地址，切歌或取消时丢弃迟到的响应。
  async function play(track: CatalogSource): Promise<void> {
    if (pending) return
    spectrum?.resume()
    const operation = new AbortController()
    pending = operation
    const key = catalogKey(track)
    try {
      if (loaded !== key || audio.error) {
        events.status('loading')
        const response = await getCatalogPlayback(
          track.platform,
          track.id,
          operation.signal
        )
        if (operation.signal.aborted) return
        if (!response.url || response.status === 'unavailable') {
          events.status('unavailable')
          notify('当前曲目没有可用的播放地址，可在原平台打开。', 'error')
          return
        }
        const stream = new URL(response.url)
        if (!['https:', 'http:'].includes(stream.protocol))
          throw new Error('平台返回了无效音频地址。')
        spectrum?.reset()
        loaded = key
        events.status(response.status)
        audio.crossOrigin = 'anonymous'
        audio.src = getCatalogAudioUrl(track.platform, track.id)
        try {
          await audio.play()
        } catch (error) {
          if (operation.signal.aborted) return
          if (
            error instanceof DOMException &&
            error.name !== 'NotSupportedError' &&
            !audio.error
          )
            throw error
          // 旧服务版本或上游中转失败时回退到原播放地址，避免影响已有播放。
          audio.removeAttribute('crossorigin')
          audio.src = response.url
          await audio.play()
        }
        return
      }
      await audio.play()
    } catch (error) {
      if (!operation.signal.aborted) {
        fail(
          error instanceof DOMException
            ? '音频加载失败，请重新播放或前往原平台。'
            : error instanceof Error
              ? error.message
              : '播放失败。'
        )
      }
    } finally {
      if (pending === operation) pending = undefined
    }
  }

  // 拖动进度条和上一首重播操作直接控制媒体时间。
  function seek(time: number): void {
    if (loaded && audio.readyState > 0) audio.currentTime = time
  }

  audio.addEventListener('timeupdate', publishTime)
  audio.addEventListener('durationchange', publishTime)
  audio.addEventListener('playing', () => {
    if (loaded && !audio.paused) {
      events.playing(true)
      spectrum?.update()
    }
  })
  audio.addEventListener('pause', () => {
    spectrum?.stop()
    if (loaded && audio.paused) events.playing(false)
  })
  audio.addEventListener('waiting', () => spectrum?.stop())
  audio.addEventListener('ended', () => {
    spectrum?.stop()
    if (loaded && audio.ended) events.ended()
  })
  audio.addEventListener('error', () => {
    if (loaded && audio.error && !pending)
      fail('音频无法播放，请重试或前往原平台。')
  })

  return {
    play,
    pause,
    reset,
    seek,
    // 用户关闭界面动效时同步停止频谱更新。
    setSpectrumMotion: (motion: boolean) => spectrum?.setMotion(motion),
    // 在线曲目按实际封面取色，原稿示例曲目保持其专辑背景光色。
    setSpectrumArtwork: (cover: string, glow: string, preferArtwork = true) =>
      spectrum?.setArtwork(cover, glow, preferArtwork),
    setSpectrumPlayback: (playback: SpectrumPlayback) =>
      spectrum?.setPlayback(playback),
    // 音量和静音由主播放器状态统一控制。
    setVolume: (volume: number) => {
      audio.volume = volume
    },
    // 布局卸载时释放音频连接及元素。
    destroy: () => {
      reset()
      spectrum?.destroy()
      audio.remove()
    },
  }
}

// 读取 LRC 一行内的多个时间戳，并按时间匹配翻译文本。
export function parseCatalogLyrics(
  lyrics: CatalogLyrics
): { t: number; o: string; tr: string }[] {
  // 同一时间只保留第一条非空文本，忽略标题和制作者等无时间戳的字段。
  function parse(lrc: string): Map<number, string> {
    const lines = new Map<number, string>()
    for (const line of lrc.split(/\r?\n/)) {
      const stamps = [...line.matchAll(/\[(\d+):(\d{1,2}(?:\.\d+)?)\]/g)]
      const text = line.replace(/\[\d+:\d{1,2}(?:\.\d+)?\]/g, '').trim()
      if (!text) continue
      for (const [, minutes, seconds] of stamps) {
        const ms = Math.round((Number(minutes) * 60 + Number(seconds)) * 1000)
        if (Number.isFinite(ms) && !lines.has(ms)) lines.set(ms, text)
      }
    }
    return lines
  }
  const translated = parse(lyrics.translatedLrc)
  return [...parse(lyrics.lrc)]
    .sort(([a], [b]) => a - b)
    .map(([ms, o]) => ({ t: ms / 1000, o, tr: translated.get(ms) || '' }))
}
