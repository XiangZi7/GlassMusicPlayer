export interface EqualizerConfig {
  enabled: boolean
  preamp: number
  gains: number[]
  autoHeadroom: boolean
}

export type EqualizerStatus = 'active' | 'bypassed' | 'pending' | 'unavailable'

export const equalizerBands = [
  { frequency: 31, label: '31 Hz', description: '极低频：低音下潜与隆隆声。' },
  { frequency: 62, label: '62 Hz', description: '低频：底鼓冲击与贝斯厚度。' },
  {
    frequency: 125,
    label: '125 Hz',
    description: '中低频：低音轮廓与温暖感。',
  },
  {
    frequency: 250,
    label: '250 Hz',
    description: '低中频：声音厚度；过多会浑浊。',
  },
  { frequency: 500, label: '500 Hz', description: '中频：乐器主体与箱体感。' },
  {
    frequency: 1000,
    label: '1 kHz',
    description: '中频：人声主体与旋律存在感。',
  },
  {
    frequency: 2000,
    label: '2 kHz',
    description: '中高频：人声清晰度与拨弦细节。',
  },
  {
    frequency: 4000,
    label: '4 kHz',
    description: '高频：起音、咬字与临场感。',
  },
  {
    frequency: 8000,
    label: '8 kHz',
    description: '高频：镲片与明亮度；过多会刺耳。',
  },
  {
    frequency: 16000,
    label: '16 kHz',
    description: '极高频：空气感与延伸，受采样率限制。',
  },
] as const

export const equalizerPresets = [
  {
    id: 'flat',
    name: '平直',
    description: '所有频段归零，保留原始音色；启用时仍经过真实音频图。',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
  },
  {
    id: 'pop',
    name: '流行',
    description: '轻微加强低频与清晰度，适合大多数流行录音。',
    gains: [2, 3, 2, 0, -1, 0, 1, 2, 2, 1],
    preamp: 0,
  },
  {
    id: 'rock',
    name: '摇滚',
    description: '突出底鼓、吉他起音与镲片，适度收紧低中频。',
    gains: [3, 4, 2, -1, -2, 0, 2, 3, 3, 1],
    preamp: 0,
  },
  {
    id: 'electronic',
    name: '电子',
    description: '增强低频下潜与高频节奏细节，保留人声中频。',
    gains: [5, 4, 2, 0, -1, 0, 1, 2, 3, 2],
    preamp: 0,
  },
  {
    id: 'jazz',
    name: '爵士',
    description: '柔和低中频，略提拨弦与铜管的自然细节。',
    gains: [1, 2, 1, 0, 0, 1, 2, 1, 1, 0],
    preamp: 0,
  },
  {
    id: 'classical',
    name: '古典',
    description: '温和的两端延伸，不刻意突出人声或打击乐。',
    gains: [2, 1, 0, 0, -1, 0, 1, 1, 2, 2],
    preamp: 0,
  },
  {
    id: 'vocal',
    name: '人声',
    description: '减少低频遮蔽，突出咬字与人声主体。',
    gains: [-3, -2, -1, 0, 1, 2, 3, 2, 0, -1],
    preamp: 0,
  },
  {
    id: 'bass',
    name: '低音增强',
    description: '强化低频量感；建议开启自动余量以避免正增益削波。',
    gains: [6, 5, 3, 1, 0, 0, 0, 0, -1, -1],
    preamp: 0,
  },
  {
    id: 'bright',
    name: '明亮',
    description: '加强高频细节与空气感；不适合已经偏亮的耳机。',
    gains: [-1, 0, 0, 0, 0, 1, 2, 3, 4, 3],
    preamp: 0,
  },
  {
    id: 'warm',
    name: '温暖',
    description: '增加柔和厚度，收敛高频刺激。',
    gains: [2, 3, 2, 1, 1, 0, -1, -2, -2, -1],
    preamp: 0,
  },
  {
    id: 'acoustic',
    name: '轻音乐',
    description: '突出原声乐器细节，同时保持低频与高频克制。',
    gains: [0, 1, 1, 0, 0, 1, 2, 2, 1, 0],
    preamp: 0,
  },
  {
    id: 'night',
    name: '深夜',
    description: '减轻轰鸣和高频疲劳；不是响度压缩或听力保护保证。',
    gains: [-3, -2, -1, 0, 1, 1, 0, -1, -2, -3],
    preamp: -2,
  },
] as const

const q = Math.SQRT2
const smoothing = 0.04

// 将异常或越界的设置收敛到有限 dB，音频参数永远不接受 NaN 或无穷大。
function decibels(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(-12, Math.min(12, value))
    : 0
}

// 解析根设置中的十段逗号字符串；形状无效时回到平直，单项越界安全钳制。
export function parseEqualizerGains(value: string): number[] {
  if (typeof value !== 'string') return equalizerBands.map(() => 0)
  const parts = value.split(',')
  if (parts.length !== equalizerBands.length) return equalizerBands.map(() => 0)
  return parts.map(part => decibels(part.trim() ? Number(part.trim()) : 0))
}

// 脱离调用方的可变数组保存配置，确保持续渲染不会悄悄改变音频曲线。
export function normalizeEqualizerConfig(
  config: EqualizerConfig
): EqualizerConfig {
  return {
    enabled: config?.enabled === true,
    preamp: decibels(config?.preamp),
    gains: equalizerBands.map((_, index) => decibels(config?.gains?.[index])),
    autoHeadroom: config?.autoHeadroom !== false,
  }
}

// 以 RBJ peaking 响应估计目标曲线的总峰值，保护相邻频段叠加而非只取单段最大值。
export function equalizerHeadroom(
  config: EqualizerConfig,
  sampleRate = 48000
): number {
  const safe = normalizeEqualizerConfig(config)
  if (!safe.autoHeadroom) return safe.preamp
  const rate =
    Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 48000
  const high = rate * 0.49
  const coefficients = safe.gains.map((gain, index) => {
    const w =
      (2 * Math.PI * Math.min(equalizerBands[index]!.frequency, high)) / rate
    const a = 10 ** (gain / 40)
    const alpha = Math.sin(w) / (2 * q)
    const mid = -2 * Math.cos(w)
    return [
      1 + alpha * a,
      mid,
      1 - alpha * a,
      1 + alpha / a,
      mid,
      1 - alpha / a,
    ]
  })
  const frequencies = [
    ...Array.from(
      { length: 256 },
      (_, index) => 20 * (high / 20) ** (index / 255)
    ),
    ...equalizerBands.map(band => Math.min(band.frequency, high)),
  ]
  let peak = 0
  for (const frequency of frequencies) {
    const w = (2 * Math.PI * frequency) / rate
    const cos1 = Math.cos(w),
      sin1 = Math.sin(w),
      cos2 = Math.cos(2 * w),
      sin2 = Math.sin(2 * w)
    let response = 0
    for (const [b0, b1, b2, a0, a1, a2] of coefficients) {
      const numerator =
        (b0! + b1! * cos1 + b2! * cos2) ** 2 + (b1! * sin1 + b2! * sin2) ** 2
      const denominator =
        (a0! + a1! * cos1 + a2! * cos2) ** 2 + (a1! * sin1 + a2! * sin2) ** 2
      response +=
        10 *
        Math.log10(Math.max(1e-20, numerator) / Math.max(1e-20, denominator))
    }
    peak = Math.max(peak, response)
  }
  const excess = safe.preamp + peak
  return safe.preamp - (excess > 0.001 ? excess + 0.75 : 0)
}

interface EqualizerEvents {
  status: (status: EqualizerStatus) => void
  // MediaElementSource 无法解绑元素，调用方必须恢复唯一未接管的原声元素。
  recover: () => void
}

// 延迟建立真实十段音频图；原声默认不接管，CORS 成功播放与运行中的 Context 缺一不可。
export function createEqualizer(
  audio: HTMLAudioElement,
  events: EqualizerEvents
) {
  let config = normalizeEqualizerConfig({
    enabled: false,
    preamp: 0,
    gains: [],
    autoHeadroom: true,
  })
  let signature = ''
  let status: EqualizerStatus = 'bypassed'
  let supported: boolean | null = null
  let context: AudioContext | undefined
  let source: MediaElementAudioSourceNode | undefined
  let preamp: GainNode | undefined
  let dry: GainNode | undefined
  let wet: GainNode | undefined
  let filters: BiquadFilterNode[] = []
  let preparing: Promise<boolean> | undefined
  let cancelPreparation: (() => void) | undefined
  let version = 0
  let destroyed = false
  let failed = false

  // 状态只在离散变化时发布，连续拖动和播放器刷新不重复触发 UI 动画。
  function publish(next: EqualizerStatus): void {
    if (destroyed || status === next) return
    status = next
    events.status(next)
  }

  // 仅在未接管媒体时关闭失败的 Context，避免关闭输出图后使原音频永久静音。
  function closeUnusedContext(): void {
    if (!context || source) return
    context.removeEventListener('statechange', contextChanged)
    const old = context
    context = undefined
    void old.close().catch(() => undefined)
  }

  // 一旦已接管的图不可用，明确不可用并由播放器恢复原声，不将静音伪装成旁路。
  function unavailable(): void {
    if (destroyed) return
    publish(config.enabled ? 'unavailable' : 'bypassed')
    if (source && !failed) {
      failed = true
      events.recover()
    } else closeUnusedContext()
  }

  // 运行状态被浏览器中断时，正在播放的受控元素必须回到可听的原声路径。
  function contextChanged(): void {
    if (destroyed || !context) return
    if (source && context.state !== 'running') unavailable()
  }

  // 参数只做 20–80ms 范围的 AudioParam 变化，快速拖动中断上一段斜坡而非重建整个图。
  function ramp(param: AudioParam, value: number, seconds = smoothing): void {
    if (!context) return
    const now = context.currentTime
    if (typeof param.cancelAndHoldAtTime === 'function')
      param.cancelAndHoldAtTime(now)
    else {
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
    }
    param.linearRampToValueAtTime(value, now + seconds)
  }

  // 在既有干湿路径上更新曲线与余量；关闭时干声增益为 1，不受用户前级设置影响。
  function apply(): void {
    if (!context || !preamp || !dry || !wet) return
    const gain = 10 ** (equalizerHeadroom(config, context.sampleRate) / 20)
    ramp(preamp.gain, gain, gain < preamp.gain.value ? 0.02 : 0.06)
    filters.forEach((filter, index) => ramp(filter.gain, config.gains[index]!))
    ramp(dry.gain, config.enabled ? 0 : 1)
    ramp(wet.gain, config.enabled ? 1 : 0)
    publish(config.enabled ? 'active' : 'bypassed')
  }

  // 激活请求可取消且有总预算；未成功运行前绝不创建 MediaElementSource。
  function prepare(): Promise<boolean> {
    if (destroyed || failed) return Promise.resolve(false)
    if (source && context?.state !== 'running') {
      unavailable()
      return Promise.resolve(false)
    }
    if (!config.enabled) return Promise.resolve(false)
    if (supported === false) {
      publish('unavailable')
      return Promise.resolve(false)
    }
    if (context?.state === 'running') return Promise.resolve(true)
    if (preparing) return preparing
    publish('pending')
    const requestVersion = version
    let candidate: AudioContext
    try {
      const Context = audio.ownerDocument.defaultView?.AudioContext
      if (!Context) {
        unavailable()
        return Promise.resolve(false)
      }
      if (context?.state === 'closed') {
        unavailable()
        return Promise.resolve(false)
      }
      context ??= new Context()
      candidate = context
      candidate.removeEventListener('statechange', contextChanged)
      candidate.addEventListener('statechange', contextChanged)
    } catch {
      unavailable()
      return Promise.resolve(false)
    }
    let timeout: ReturnType<typeof setTimeout> | undefined
    const cancelled = new Promise<boolean>(resolve => {
      cancelPreparation = () => resolve(false)
      timeout = setTimeout(() => resolve(false), 1800)
    })
    let resumed: Promise<boolean>
    try {
      resumed = candidate.resume().then(
        () => candidate.state === 'running',
        () => false
      )
    } catch {
      resumed = Promise.resolve(false)
    }
    const operation = Promise.race([resumed, cancelled])
      .then(success => {
        if (destroyed || version !== requestVersion || !config.enabled)
          return false
        if (!success || candidate.state !== 'running') {
          unavailable()
          return false
        }
        return true
      })
      .finally(() => {
        if (timeout !== undefined) clearTimeout(timeout)
        if (preparing === operation) {
          preparing = undefined
          cancelPreparation = undefined
        }
      })
    preparing = operation
    return operation
  }

  // 所有输出节点先准备完成，再接管已通过 CORS 的可播放元素；失败立即交还原声。
  async function connect(): Promise<void> {
    if (
      destroyed ||
      !config.enabled ||
      failed ||
      supported !== true ||
      audio.paused ||
      audio.readyState < 2
    )
      return
    const requestVersion = version
    if (
      !(await prepare()) ||
      destroyed ||
      requestVersion !== version ||
      !config.enabled ||
      supported !== true ||
      audio.paused
    )
      return
    if (
      !context ||
      context.state !== 'running' ||
      audio.crossOrigin !== 'anonymous'
    ) {
      unavailable()
      return
    }
    if (source) {
      apply()
      return
    }
    try {
      preamp = context.createGain()
      dry = context.createGain()
      wet = context.createGain()
      dry.gain.value = 1
      wet.gain.value = 0
      preamp.gain.value =
        10 ** (equalizerHeadroom(config, context.sampleRate) / 20)
      filters = equalizerBands.map((band, index) => {
        const filter = context!.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value = Math.min(
          band.frequency,
          context!.sampleRate * 0.49
        )
        filter.Q.value = q
        filter.gain.value = config.gains[index]!
        return filter
      })
      let tail: AudioNode = preamp
      for (const filter of filters) {
        tail.connect(filter)
        tail = filter
      }
      tail.connect(wet)
      dry.connect(context.destination)
      wet.connect(context.destination)
      // 接管之后立即连上干声，即使后续连接失败也由 recover 恢复原声元素。
      source = context.createMediaElementSource(audio)
      source.connect(dry)
      source.connect(preamp)
      apply()
    } catch {
      unavailable()
    }
  }

  // 关闭、切歌和取消会使旧激活结果失效；没有接管时同步释放待激活 Context。
  function cancel(): void {
    version++
    cancelPreparation?.()
    preparing = undefined
    cancelPreparation = undefined
    if (!source) closeUnusedContext()
  }

  // 接受已验证的 CORS 状态；直链或未加载音频不能通过开启设置强行接管。
  function setSourceSupported(value: boolean | null): void {
    if (destroyed) return
    supported = value
    if (value !== true) {
      cancel()
      if (value === false && source) {
        unavailable()
        return
      }
      publish(
        config.enabled
          ? value === false
            ? 'unavailable'
            : 'pending'
          : 'bypassed'
      )
      return
    }
    if (config.enabled) void connect()
  }

  // 设置相同配置时不重复调度斜坡；默认关闭的设置恢复不创建任何音频 Context。
  function setConfig(value: EqualizerConfig): void {
    if (destroyed) return
    const next = normalizeEqualizerConfig(value)
    const nextSignature = `${next.enabled}|${next.preamp}|${next.gains.join(',')}|${next.autoHeadroom}`
    if (signature === nextSignature) return
    signature = nextSignature
    config = next
    if (!config.enabled) {
      cancel()
      if (source && context?.state === 'running') apply()
      else publish('bypassed')
    } else if (supported === false) publish('unavailable')
    else if (source && context?.state === 'running' && supported === true)
      apply()
    else {
      publish('pending')
      if (supported === true) void connect()
    }
  }

  // 所属媒体已停止后断开所有图节点并关闭 Context，迟到的激活不会恢复旧音频。
  function destroy(): void {
    if (destroyed) return
    destroyed = true
    cancel()
    context?.removeEventListener('statechange', contextChanged)
    for (const node of [source, preamp, dry, wet, ...filters]) {
      try {
        node?.disconnect()
      } catch {
        /* 已关闭节点无需重复处理。 */
      }
    }
    const old = context
    context = undefined
    source = undefined
    filters = []
    if (old) void old.close().catch(() => undefined)
  }

  events.status(status)
  return {
    setConfig,
    setSourceSupported,
    prepare,
    connect,
    cancel,
    destroy,
    get attached() {
      return !!source
    },
    get status() {
      return status
    },
  }
}
