import { GlobalState } from '../interface'
import piniaPersistConfig from '../persist'

export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({
    count: 0,
    theme: 'system' as 'light' | 'dark' | 'system',
    searchHistory: [],
    lang: undefined,
  }),
  actions: {
    setGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]) {
      this.$patch(state => {
        state[key] = value
      })
    },
    setTheme(theme: 'light' | 'dark' | 'system') {
      this.theme = theme
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
    },
    setLang(lang: 'zh' | 'en' | 'ja') {
      this.lang = lang
    },
    addSearchHistory(q: string) {
      const s = q.trim()
      if (!s) return
      const idx = this.searchHistory.indexOf(s)
      if (idx !== -1) this.searchHistory.splice(idx, 1)
      this.searchHistory.unshift(s)
      if (this.searchHistory.length > 10) this.searchHistory = this.searchHistory.slice(0, 10)
    },
    removeSearchHistory(q: string) {
      const s = q.trim()
      if (!s) return
      const idx = this.searchHistory.indexOf(s)
      if (idx !== -1) this.searchHistory.splice(idx, 1)
    },
    clearSearchHistory() {
      this.searchHistory = []
    },
  },
  persist: piniaPersistConfig('global'),
})
