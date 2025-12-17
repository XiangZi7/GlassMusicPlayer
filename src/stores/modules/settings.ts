import { defineStore } from 'pinia'
import piniaPersistConfig from '../persist'

export interface AuroraSettingsState {
  colorStops: string[]
  amplitude: number
  blend: number
  speed: number
  intensity: number
  colorPositions: number[]
}

export interface ColorBendsSettingsState {
  colors: string[]
  rotation: number
  speed: number
  scale: number
  frequency: number
  warpStrength: number
  mouseInfluence: number
  parallax: number
  noise: number
  transparent: boolean
  autoRotate: number
}

export interface UltimateSettingsState {
  bg1: string
  bg2: string
  color1: string
  color2: string
  color3: string
  color4: string
  color5: string
  interactiveColor: string
  circleSize: string
  blending: string
}

export interface FooterLyricsSettingsState {
  enabled: boolean
  modes: Array<'original' | 'trans' | 'roma'>
}

export interface AudioVisualizerSettingsState {
  enabledInFooter: boolean
  enabledInDrawer: boolean
  visualizerType: 'bars' | 'wave' | 'circular'
}

export type AudioQuality = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires' | 'jyeffect' | 'sky' | 'jymaster'

export const useSettingsStore = defineStore('settings', {
  state: (): {
    aurora: AuroraSettingsState
    colorBends: ColorBendsSettingsState
    ultimate: UltimateSettingsState
    footerLyrics: FooterLyricsSettingsState
    audioVisualizer: AudioVisualizerSettingsState
    backgroundType: 'aurora' | 'colorbends' | 'ultimate'
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
    
    setAurora(partial: Partial<AuroraSettingsState>) {
      this.aurora = { ...this.aurora, ...partial }
    },
    setColorStops(stops: string[]) {
      this.aurora.colorStops = stops
    },
    setColorPositions(positions: number[]) {
      this.aurora.colorPositions = positions.map(p => Math.max(0, Math.min(1, p)))
    },
    setBackgroundType(type: 'aurora' | 'colorbends' | 'ultimate') {
      this.backgroundType = type
    },
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
    setColorBends(partial: Partial<ColorBendsSettingsState>) {
      this.colorBends = { ...this.colorBends, ...partial }
    },
    setBendsColors(colors: string[]) {
      this.colorBends.colors = colors
    },
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
    setUltimate(partial: Partial<UltimateSettingsState>) {
      this.ultimate = { ...this.ultimate, ...partial }
    },
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
    setFooterLyricsEnabled(val: boolean) {
      this.footerLyrics.enabled = !!val
    },
    setFooterLyricsModes(modes: Array<'original' | 'trans' | 'roma'>) {
      console.log("🚀 ~ file: settings.ts:157 ~ modes:", modes)
      const uniq = Array.from(new Set(modes)).filter(m =>
        ['original', 'trans', 'roma'].includes(m)
      ) as Array<'original' | 'trans' | 'roma'>
      this.footerLyrics.modes = uniq.slice(0, 2)
      if (this.footerLyrics.modes.length === 0) this.footerLyrics.modes = ['original']
    },
    setAudioQuality(quality: AudioQuality) {
      this.audioQuality = quality
    },
    setAudioVisualizerFooter(enabled: boolean) {
      this.audioVisualizer.enabledInFooter = enabled
    },
    setAudioVisualizerDrawer(enabled: boolean) {
      this.audioVisualizer.enabledInDrawer = enabled
    },
    setAudioVisualizerType(type: 'bars' | 'wave' | 'circular') {
      this.audioVisualizer.visualizerType = type
    },
  },
  persist: piniaPersistConfig('settings'),
})
