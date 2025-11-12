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

export const useSettingsStore = defineStore('settings', {
  state: (): {
    aurora: AuroraSettingsState
    colorBends: ColorBendsSettingsState
    backgroundType: 'aurora' | 'colorbends'
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
    backgroundType: 'aurora',
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
    setBackgroundType(type: 'aurora' | 'colorbends') {
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
  },
  persist: piniaPersistConfig('settings'),
})
