import { GlobalState } from '../interface'
import piniaPersistConfig from '../persist'

export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({
    count: 0, theme: 'light' as 'light' | 'dark', searchHistory: [],
  }),
  actions: {
    setGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]) {
      this.$patch(state => {
        state[key] = value
      })
    },
    setTheme(theme: 'light' | 'dark') {
      this.theme = theme
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
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
