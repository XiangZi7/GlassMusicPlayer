const referenceBands = 168

// 原稿的种子天际线；只用于静态和示例频谱，不伪造真实音频的频率能量。
export function spectrumProfile(seed: number, count: number): Float32Array {
  let randomSeed = (seed * 7919 + 13) % 2147483647
  if (randomSeed <= 0) randomSeed += 2147483646
  const random = () => {
    randomSeed = (randomSeed * 16807) % 2147483647
    return randomSeed / 2147483647
  }
  const phase1 = random() * 6.283
  const phase2 = random() * 6.283
  const phase3 = random() * 6.283
  const raw = Array.from({ length: referenceBands }, (_, band) =>
    Math.max(
      0.16,
      Math.min(
        1,
        0.46 +
          0.27 * Math.sin(band * 0.105 + phase1) +
          0.17 * Math.sin(band * 0.029 + phase2) +
          0.13 * Math.sin(band * 0.47 + phase3) +
          (random() - 0.5) * 0.2
      )
    )
  )
  const smoothed = raw.map(
    (value, band) =>
      (raw[(band - 1 + referenceBands) % referenceBands]! +
        value * 2 +
        raw[(band + 1) % referenceBands]!) /
      4
  )
  // 映射到实际细柱数量，保留原型轮廓而不把宽窗口的柱子拉成色块。
  return Float32Array.from({ length: count }, (_, band) => {
    const position = count > 1 ? (band / (count - 1)) * (referenceBands - 1) : 0
    const left = Math.floor(position)
    const right = Math.min(referenceBands - 1, left + 1)
    return (
      smoothed[left]! + (smoothed[right]! - smoothed[left]!) * (position - left)
    )
  })
}

function simHash(a: number, b: number, c: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
  return value - Math.floor(value)
}

// 沿用原稿的 94–140 BPM、鼓/贝斯/琶音/踩镲包络，与已有播放时钟同步。
export function spectrumRhythm(
  seed: number,
  time: number,
  duration: number,
  profile: Float32Array,
  output: Float32Array
): void {
  const bpm = 94 + simHash(seed, 7, 1) * 46
  const beat = (time * bpm) / 60
  const beatInt = Math.floor(beat)
  const beatFrac = beat - beatInt
  const beatInBar = ((beatInt % 4) + 4) % 4
  const bar = Math.floor(beatInt / 4)
  const step8 = Math.floor(beat * 2)
  const eighthFrac = beat * 2 - step8
  const step16 = Math.floor(beat * 4)
  const half = simHash(seed, 3, 9) > 0.72
  const kickOn = half
    ? beatInBar % 2 === 0 || (beatInBar === 3 && simHash(seed, bar, 5) < 0.25)
    : simHash(seed, bar * 4 + beatInBar, 5) > 0.12
  const kick = Math.exp(-3.4 * (beatFrac + (kickOn ? 0 : 1)))
  const snare =
    beatInBar === 1 || beatInBar === 3
      ? Math.exp(-5 * beatFrac)
      : Math.exp(-5 * (beatFrac + 1))
  const bass = 0.42 + 0.58 * Math.exp(-2.1 * eighthFrac)
  const hat =
    step8 % 2 === 1
      ? Math.exp(-7 * eighthFrac) *
        (simHash(seed, step16, 3) > 0.3 ? 0.85 : 0.25)
      : Math.exp(-7 * (eighthFrac + 0.5)) * 0.3
  const position = Math.min(1, time / Math.max(1, duration))
  const intensity =
    (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, position + 0.06))) *
    (0.92 + 0.08 * Math.sin(time * 0.45))
  for (let band = 0; band < output.length; band++) {
    const x = output.length > 1 ? band / (output.length - 1) : 0
    const referenceBand = Math.round(x * (referenceBands - 1))
    const kickWeight = Math.exp(-x * 4.2)
    const bassWeight = Math.exp(-x * 2.4)
    const mid = Math.max(0, Math.min(1, (x - 0.12) / 0.76))
    const midWeight = Math.sin(Math.PI * mid) ** 1.4
    const highWeight = Math.max(0, (x - 0.5) / 0.5)
    const gate =
      simHash(seed, step8, Math.floor(referenceBand / 14)) > 0.42 ? 1 : 0.35
    const arp = gate * Math.exp(-2.6 * eighthFrac) + (1 - gate) * 0.12
    let value =
      kick * kickWeight * 0.95 +
      snare * (bassWeight * 0.3 + midWeight * 0.28) +
      bass * bassWeight * 0.5 +
      arp * midWeight * 0.55 +
      hat * highWeight * highWeight * 0.5
    value *= (0.45 + 0.55 * (profile[band] ?? 0.6)) * intensity
    value *= 0.85 + 0.3 * simHash(seed, step16, referenceBand % 9)
    output[band] = Math.max(0, Math.min(1, value))
  }
}
