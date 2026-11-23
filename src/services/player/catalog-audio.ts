import {
  getCatalogAudioUrl,
  getCatalogPlayback,
  type PlaybackStatus,
} from '@/api'
import { notify } from '@/services/notification'
import type { CatalogSource } from '@/types/prototype'
import { catalogKey } from '@/services/player/catalog'
import {
  createEqualizer,
  normalizeEqualizerConfig,
  type EqualizerConfig,
  type EqualizerStatus,
} from '@/services/player/equalizer'
import {
  createSpectrum,
  type SpectrumPlayback,
} from '@/services/player/spectrum'

export type CatalogAudioStatus = PlaybackStatus | 'loading' | 'error' | null

interface AudioEvents {
  time: (time: number, duration: number) => void
  playing: (playing: boolean) => void
  status: (status: CatalogAudioStatus) => void
  loading?: (loading: boolean) => void
  quality?: (quality: string) => void
  ended: () => void
  equalizer?: (status: EqualizerStatus) => void
}

// 主窗口拥有唯一活动音频元素；EQ 默认不接管，上游签名地址只在当前曲目内存中保留。
export function createCatalogAudio(root: HTMLElement, events: AudioEvents) {
  let destroyed = false
  let loaded: string | null = null
  let pending: AbortController | undefined
  let version = 0
  let nativeFallback = false
  let requestedPlaying = false
  let removePositionListeners = () => {}
  let removeAudioListeners = () => {}
  let spectrumMotion = true
  let spectrumArtwork: [string, string, boolean] | undefined
  let spectrumPlayback: SpectrumPlayback | undefined
  let equalizerConfig = normalizeEqualizerConfig({
    enabled: false,
    preamp: 0,
    gains: [],
    autoHeadroom: true,
  })
  const canvas = root.querySelector<HTMLCanvasElement>('[data-spectrum]')

  // 创建单个受播放器拥有的媒体元素，替换前必须先停止并移除旧元素。
  function makeAudio(): HTMLAudioElement {
    const element = root.ownerDocument.createElement('audio')
    element.preload = 'metadata'
    element.hidden = true
    root.append(element)
    return element
  }

  let audio = makeAudio()
  let spectrum = canvas ? createSpectrum(canvas, audio) : undefined
  let equalizer = makeEqualizer(audio)

  // 每个音频图的状态和恢复回调都绑定对应元素，迟到的旧图不能修改新媒体。
  function makeEqualizer(element: HTMLAudioElement) {
    return createEqualizer(element, {
      status(status) {
        if (!destroyed && element === audio) events.equalizer?.(status)
      },
      recover() {
        if (!destroyed && element === audio) recoverNativePlayback()
      },
    })
  }

  // 用实际媒体时钟发布进度和时长，metadata 后根层可通过 seek 恢复已保存进度。
  function publishTime(element: HTMLAudioElement): void {
    if (!destroyed && element === audio && loaded)
      events.time(
        element.currentTime,
        Number.isFinite(element.duration) ? element.duration : 0
      )
  }

  // 所有监听绑定单个具体元素并可移除，旧元素被替换后不再发布播放或进度事件。
  function bindAudio(element: HTMLAudioElement): void {
    const listeners: [string, EventListener][] = []
    // 记录媒体监听，替换及销毁时成组清理。
    function listen(type: string, callback: () => void): void {
      const guarded = () => {
        if (!destroyed && element === audio) callback()
      }
      element.addEventListener(type, guarded)
      listeners.push([type, guarded])
    }
    listen('timeupdate', () => publishTime(element))
    listen('durationchange', () => publishTime(element))
    listen('loadedmetadata', () => publishTime(element))
    listen('playing', () => {
      if (!requestedPlaying) {
        element.pause()
        return
      }
      if (loaded && !element.paused) {
        equalizer.setSourceSupported(
          !nativeFallback && element.crossOrigin === 'anonymous'
        )
        events.playing(true)
        spectrum?.update()
      }
    })
    listen('pause', () => {
      spectrum?.stop()
      if (loaded && element.paused) events.playing(false)
    })
    listen('waiting', () => spectrum?.stop())
    listen('ended', () => {
      spectrum?.stop()
      if (loaded && element.ended) events.ended()
    })
    listen('error', () => {
      if (loaded && element.error && !pending)
        fail('音频无法播放，请重试或前往原平台。')
    })
    const removePosition = removePositionListeners
    removeAudioListeners = () => {
      for (const [type, listener] of listeners)
        element.removeEventListener(type, listener)
      removePosition()
    }
  }
  bindAudio(audio)

  // 旧 Web Audio 源无法解绑；先停止旧图与媒体，再创建唯一未接管元素恢复原声。
  function replaceWithNativeAudio(preserveSource: boolean): {
    wasPlaying: boolean
    key: string | null
  } {
    const old = audio
    const saved = {
      src: old.currentSrc || old.src,
      crossOrigin: old.crossOrigin,
      time: old.currentTime,
      volume: old.volume,
      muted: old.muted,
      wasPlaying: !old.paused,
      key: loaded,
    }
    removeAudioListeners()
    old.pause()
    equalizer.destroy()
    spectrum?.destroy()
    old.removeAttribute('src')
    old.load()
    old.remove()
    audio = makeAudio()
    removePositionListeners = () => {}
    audio.volume = saved.volume
    audio.muted = saved.muted
    nativeFallback = true
    equalizer = makeEqualizer(audio)
    equalizer.setConfig(equalizerConfig)
    equalizer.setSourceSupported(false)
    spectrum = canvas ? createSpectrum(canvas, audio) : undefined
    bindSpectrumViews()
    spectrum?.setMotion(spectrumMotion)
    if (spectrumArtwork) spectrum?.setArtwork(...spectrumArtwork)
    if (spectrumPlayback) spectrum?.setPlayback(spectrumPlayback)
    if (preserveSource && saved.src) {
      const current = audio
      // 恢复监听早于时钟发布，避免 metadata 首次回调把已有进度错误写回零。
      const restore = () => {
        if (
          destroyed ||
          current !== audio ||
          loaded !== saved.key ||
          current.readyState < 1
        )
          return
        if (Number.isFinite(saved.time)) {
          try {
            current.currentTime = saved.time
          } catch {
            /* 未就绪时仍可由根层 seek 恢复。 */
          }
        }
        removePositionListeners()
      }
      removePositionListeners = () => {
        current.removeEventListener('loadedmetadata', restore)
        current.removeEventListener('durationchange', restore)
      }
      current.addEventListener('loadedmetadata', restore)
      current.addEventListener('durationchange', restore)
      if (saved.crossOrigin) current.crossOrigin = saved.crossOrigin
      current.src = saved.src
    }
    bindAudio(audio)
    return { wasPlaying: saved.wasPlaying, key: saved.key }
  }

  // 已接管音频的 Context/连接失败时恢复当前原声，保留时钟、音量和真实频谱机制。
  function recoverNativePlayback(): void {
    if (destroyed) return
    const recoveryVersion = ++version
    pending?.abort()
    pending = undefined
    const restored = replaceWithNativeAudio(true)
    if (!restored.wasPlaying || !restored.key) return
    const current = audio
    void current.play().catch(() => {
      if (
        !destroyed &&
        current === audio &&
        version === recoveryVersion &&
        loaded === restored.key
      )
        fail('音频恢复失败，请重新播放或前往原平台。')
    })
  }

  // 清理已加载或正在加载的音频，切歌后旧响应不能恢复音频图或媒体时钟。
  function reset(): void {
    requestedPlaying = false
    version++
    pending?.abort()
    pending = undefined
    loaded = null
    events.quality?.('')
    events.loading?.(false)
    equalizer.setSourceSupported(null)
    spectrum?.reset()
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  // 暂停本曲并取消未完成的请求与 EQ 激活，保留已加载音频供下一次继续播放。
  function pause(): void {
    requestedPlaying = false
    version++
    if (pending && !loaded) events.status(null)
    pending?.abort()
    pending = undefined
    events.loading?.(false)
    equalizer.cancel()
    audio.pause()
    events.playing(false)
  }

  // 播放失败只通过公共通知反馈，EQ 不可用但原声可播时不误报音源失败。
  function fail(message: string): void {
    if (destroyed) return
    reset()
    events.status('error')
    events.playing(false)
    notify(message, 'error')
  }

  // 点击曲目后现取允许的音频地址；先激活 Context，但仅成功 CORS 播放后才接管。
  async function play(track: CatalogSource, preferredQuality = 'auto'): Promise<void> {
    if (destroyed || pending) return
    requestedPlaying = true
    spectrum?.resume()
    const operation = new AbortController()
    const playVersion = version
    pending = operation
    const key = catalogKey(track)
    const needsLoad = loaded !== key || !!audio.error
    const quality = track.platform === 'netease' && preferredQuality !== 'auto' ? preferredQuality : undefined
    events.loading?.(needsLoad || audio.readyState < 3)
    if (needsLoad) equalizer.setSourceSupported(null)
    void equalizer.prepare()
    try {
      if (needsLoad) {
        events.status('loading')
        const response = await getCatalogPlayback(
          track.platform,
          track.id,
          operation.signal,
          quality
        )
        if (destroyed || operation.signal.aborted || playVersion !== version)
          return
        if (!response.url || response.status === 'unavailable') {
          requestedPlaying = false
          equalizer.setSourceSupported(false)
          events.status('unavailable')
          notify('当前曲目没有可用的播放地址，可在原平台打开。', 'error')
          return
        }
        const stream = new URL(response.url)
        if (!['https:', 'http:'].includes(stream.protocol))
          throw new Error('平台返回了无效音频地址。')
        spectrum?.reset()
        loaded = key
        nativeFallback = false
        events.status(response.status)
        events.quality?.(response.quality ?? (response.bitrateKbps ? `${response.bitrateKbps} kbps` : ''))
        audio.crossOrigin = 'anonymous'
        audio.src = response.accountPlayback ? stream.href : getCatalogAudioUrl(track.platform, track.id, quality)
        const proxyElement = audio
        try {
          await proxyElement.play()
        } catch (error) {
          if (
            destroyed ||
            operation.signal.aborted ||
            playVersion !== version ||
            proxyElement !== audio
          )
            return
          if (
            error instanceof DOMException &&
            error.name !== 'NotSupportedError' &&
            !audio.error
          )
            throw error
          // 无 CORS 直链不能留在受 Web Audio 接管的元素上，否则浏览器会输出静音。
          if (equalizer.attached) replaceWithNativeAudio(false)
          nativeFallback = true
          equalizer.setSourceSupported(false)
          audio.removeAttribute('crossorigin')
          audio.src = response.url
          await audio.play()
        }
        return
      }
      await audio.play()
    } catch (error) {
      if (!destroyed && !operation.signal.aborted && playVersion === version) {
        fail(
          error instanceof DOMException
            ? '音频加载失败，请重新播放或前往原平台。'
            : error instanceof Error
              ? error.message
              : '播放失败。'
        )
      }
    } finally {
      if (pending === operation) {
        pending = undefined
        events.loading?.(false)
      }
    }
  }

  // 拖动进度和根层的缓存恢复都直接控制唯一媒体时间；未就绪时等待 metadata 回调再调用。
  function seek(time: number): void {
    if (loaded && audio.readyState > 0 && Number.isFinite(time))
      audio.currentTime = Math.max(0, time)
  }

  // 逐字填色读取当前媒体元素的位置，切源和原声回退后仍使用真实时钟。
  function position(): number | undefined {
    return loaded ? audio.currentTime : undefined
  }

  // 只保存有限、脱离调用方的曲线；真实图是否生效通过独立状态回调告知根层。
  function setEqualizer(config: EqualizerConfig): void {
    equalizerConfig = normalizeEqualizerConfig(config)
    equalizer.setConfig(equalizerConfig)
  }

  // 把当前路由的横幅交给底栏频谱渲染器，复用同一次音频分析。
  function bindSpectrumViews(): void {
    spectrum?.setBannerCanvas(root.querySelector<HTMLCanvasElement>('[data-banner-spectrum]'))
  }

  // 用户关闭界面动效时同步停止频谱，替换原声元素后仍恢复同一偏好。
  function setSpectrumMotion(motion: boolean): void {
    spectrumMotion = motion
    spectrum?.setMotion(motion)
  }

  // 在线曲目按实际封面取色，原稿示例曲目保持其专辑背景光色。
  function setSpectrumArtwork(
    cover: string,
    glow: string,
    preferArtwork = true
  ): void {
    spectrumArtwork = [cover, glow, preferArtwork]
    spectrum?.setArtwork(cover, glow, preferArtwork)
  }

  // 频谱仍跟随根层唯一媒体时钟，不通过 EQ 另起计时器或伪造分析数据。
  function setSpectrumPlayback(playback: SpectrumPlayback): void {
    spectrumPlayback = { ...playback }
    spectrum?.setPlayback(playback)
  }

  // 音量和静音由主播放器统一控制，异常外部输入不污染媒体参数。
  function setVolume(volume: number): void {
    audio.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0
  }

  // 布局卸载后移除媒体监听、源、频谱及 Context，不允许迟到事件再次发布状态。
  function destroy(): void {
    if (destroyed) return
    destroyed = true
    reset()
    removeAudioListeners()
    equalizer.destroy()
    spectrum?.destroy()
    audio.remove()
  }

  return {
    play,
    pause,
    reset,
    seek,
    position,
    setEqualizer,
    bindSpectrumViews,
    setSpectrumMotion,
    setSpectrumArtwork,
    setSpectrumPlayback,
    setVolume,
    destroy,
  }
}
