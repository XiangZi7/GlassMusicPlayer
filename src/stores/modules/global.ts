import { GlobalState } from '../interface'
import piniaPersistConfig from '../persist'

export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({
    count: 0, theme: 'light' as 'light' | 'dark',
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
  },
  persist: piniaPersistConfig('global'),
})
