/**
 * 设置 Store
 * 管理背景动画、底栏歌词、音频可视化、音质等用户偏好设置
 * 所有设置自动持久化到 localStorage
 */
import { defineStore } from 'pinia'
import piniaPersistConfig from '../persist'

// ═══════ 背景动画设置接口 ═══════

/** 极光背景设置 */
export interface AuroraSettingsState {
  /** 渐变色停点 */
  colorStops: string[]
  /** 振幅 */
  amplitude: number
  /** 混合程度 */
  blend: number
  /** 动画速度 */
  speed: number
  /** 强度 */
  intensity: number
  /** 颜色位置 */
  colorPositions: number[]
}

/** 色彩弯曲背景设置 */
export interface ColorBendsSettingsState {
  /** 颜色列表 */
  colors: string[]
  /** 旋转角度 */
  rotation: number
  /** 动画速度 */
  speed: number
  /** 缩放比例 */
  scale: number
  /** 频率 */
  frequency: number
  /** 扭曲强度 */
  warpStrength: number
  /** 鼠标影响范围 */
  mouseInfluence: number
  /** 视差强度 */
  parallax: number
  /** 噪声强度 */
  noise: number
  /** 是否透明 */
  transparent: boolean
  /** 自动旋转速度 */
  autoRotate: number
}

/** 终极流体背景设置 */
export interface UltimateSettingsState {
  /** 背景色 1 */
  bg1: string
  /** 背景色 2 */
  bg2: string
  /** 流体色 1-5 */
  color1: string
  color2: string
  color3: string
  color4: string
  color5: string
  /** 交互响应颜色 */
  interactiveColor: string
  /** 圆圈大小 */
  circleSize: string
  /** 混合模式 */
  blending: string
}

/** 暗影闪耀背景设置 */
export interface ShadowBlingSettingsState {
  /** 背景颜色列表 */
  bgColors: string[]
  /** 动画速度 */
  speed: number
  /** 强度 */
  intensity: number
}

// ═══════ 功能设置接口 ═══════

/** 底栏歌词设置 */
export interface FooterLyricsSettingsState {
  /** 是否启用底栏歌词 */
  enabled: boolean
  /** 显示模式（原文/翻译/罗马音，最多选 2 个） */
  modes: Array<'original' | 'trans' | 'roma'>
}

/** 音频可视化设置 */
export interface AudioVisualizerSettingsState {
  /** 是否在底栏显示 */
  enabledInFooter: boolean
  /** 是否在抽屉面板显示 */
  enabledInDrawer: boolean
  /** 可视化类型 */
  visualizerType: 'bars' | 'wave' | 'circular'
}

/** 音频品质等级 */
export type AudioQuality = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires' | 'jyeffect' | 'sky' | 'jymaster'

// ═══════ Settings Store ═══════

export const useSettingsStore = defineStore('settings', {
  state: (): {
    aurora: AuroraSettingsState
    colorBends: ColorBendsSettingsState
    ultimate: UltimateSettingsState
    shadowBling: ShadowBlingSettingsState
    footerLyrics: FooterLyricsSettingsState
    audioVisualizer: AudioVisualizerSettingsState
    backgroundType: 'aurora' | 'colorbends' | 'ultimate' | 'shadowBling'
    audioQuality: AudioQuality
  } => ({
    aurora: {
      colorStops: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'],
      amplitude: 1.0,
      blend: 0.5,
      speed: 1.0,
      intensity: 1.0,
      colorPositions: [0.0, 0.5, 1.0],
    },
    colorBends: {
      colors: [],
      rotation: 45,
      speed: 0.2,
      transparent: true,
      autoRotate: 0,
      scale: 1,
      frequency: 1,
      warpStrength: 1,
      mouseInfluence: 1,
      parallax: 0.5,
      noise: 0.1,
    },
    ultimate: {
      bg1: '#6C00A2',
      bg2: '#001152',
      color1: '#1271FF',
      color2: '#DD4AFF',
      color3: '#64DCFF',
      color4: '#C83232',
      color5: '#B4B432',
      interactiveColor: '#8C64FF',
      circleSize: '80%',
      blending: 'hard-light',
    },
    shadowBling: {
      bgColors: ['#000000', '#ffffff', '#808080'],
      speed: 1.0,
      intensity: 1.0,
    },
    footerLyrics: {
      enabled: true,
      modes: ['original', 'trans'],
    },
    audioVisualizer: {
      enabledInFooter: true,
      enabledInDrawer: true,
      visualizerType: 'bars',
    },
    backgroundType: 'ultimate',
    audioQuality: 'jymaster',
  }),

  actions: {
    // ── 极光背景 ──
    /** 更新极光背景设置（局部合并） */
    setAurora(partial: Partial<AuroraSettingsState>) {
      this.aurora = { ...this.aurora, ...partial }
    },
    /** 设置极光渐变色停点 */
    setColorStops(stops: string[]) {
      this.aurora.colorStops = stops
    },
    /** 设置极光颜色位置（自动钳位到 0-1） */
    setColorPositions(positions: number[]) {
      this.aurora.colorPositions = positions.map(p => Math.max(0, Math.min(1, p)))
    },
    /** 重置极光背景为默认值 */
    resetAurora() {
      this.aurora = {
        colorStops: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'],
        amplitude: 1.0,
        blend: 0.5,
        speed: 1.0,
        intensity: 1.0,
        colorPositions: [0.0, 0.5, 1.0],
      }
    },

    // ── 色彩弯曲背景 ──
    /** 更新色彩弯曲设置（局部合并） */
    setColorBends(partial: Partial<ColorBendsSettingsState>) {
      this.colorBends = { ...this.colorBends, ...partial }
    },
    /** 设置色彩弯曲颜色列表 */
    setBendsColors(colors: string[]) {
      this.colorBends.colors = colors
    },
    /** 重置色彩弯曲为默认值 */
    resetColorBends() {
      this.colorBends = {
        colors: ['#ff5c7a', '#8a5cff', '#00ffd1'],
        rotation: 30,
        speed: 0.3,
        scale: 1.2,
        frequency: 1.4,
        warpStrength: 1.2,
        mouseInfluence: 0.8,
        parallax: 0.6,
        noise: 0.08,
        transparent: true,
      }
    },

    // ── 终极流体背景 ──
    /** 更新终极流体设置（局部合并） */
    setUltimate(partial: Partial<UltimateSettingsState>) {
      this.ultimate = { ...this.ultimate, ...partial }
    },
    /** 重置终极流体为默认值 */
    resetUltimate() {
      this.ultimate = {
        bg1: '#6C00A2',
        bg2: '#001152',
        color1: '#1271FF',
        color2: '#DD4AFF',
        color3: '#64DCFF',
        color4: '#C83232',
        color5: '#B4B432',
        interactiveColor: '#8C64FF',
        circleSize: '80%',
        blending: 'hard-light',
      }
    },

    // ── 暗影闪耀背景 ──
    /** 更新暗影闪耀设置（局部合并） */
    setShadowBling(partial: Partial<ShadowBlingSettingsState>) {
      this.shadowBling = { ...this.shadowBling, ...partial }
    },
    /** 重置暗影闪耀为默认值 */
    resetShadowBling() {
      this.shadowBling = {
        bgColors: ['#000000', '#ffffff', '#808080'],
        speed: 1.0,
        intensity: 1.0,
      }
    },

    // ── 通用设置 ──
    /** 切换背景类型 */
    setBackgroundType(type: 'aurora' | 'colorbends' | 'ultimate' | 'shadowBling') {
      this.backgroundType = type
    },
    /** 设置底栏歌词开关 */
    setFooterLyricsEnabled(val: boolean) {
      this.footerLyrics.enabled = !!val
    },
    /** 设置底栏歌词显示模式（去重、最多 2 个、至少保留原文） */
    setFooterLyricsModes(modes: Array<'original' | 'trans' | 'roma'>) {
      const uniq = Array.from(new Set(modes)).filter(m =>
        ['original', 'trans', 'roma'].includes(m)
      ) as Array<'original' | 'trans' | 'roma'>
      this.footerLyrics.modes = uniq.slice(0, 2)
      if (this.footerLyrics.modes.length === 0) this.footerLyrics.modes = ['original']
    },
    /** 设置音频品质 */
    setAudioQuality(quality: AudioQuality) {
      this.audioQuality = quality
    },
    /** 设置底栏音频可视化开关 */
    setAudioVisualizerFooter(enabled: boolean) {
      this.audioVisualizer.enabledInFooter = enabled
    },
    /** 设置抽屉面板音频可视化开关 */
    setAudioVisualizerDrawer(enabled: boolean) {
      this.audioVisualizer.enabledInDrawer = enabled
    },
    /** 设置音频可视化类型 */
    setAudioVisualizerType(type: 'bars' | 'wave' | 'circular') {
      this.audioVisualizer.visualizerType = type
    },
  },
  persist: piniaPersistConfig('settings'),
})
