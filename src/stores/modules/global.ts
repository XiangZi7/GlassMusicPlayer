/**
 * 全局状态 Store
 * 管理主题、语言、搜索历史等应用级全局配置
 */
import { GlobalState } from '../interface'
import piniaPersistConfig from '../persist'

export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({
    count: 0,
    theme: 'system' as 'light' | 'dark' | 'system',
    /** 搜索历史记录（最多保留 10 条） */
    searchHistory: [],
    lang: undefined,
  }),
  actions: {
    /** 通用状态更新方法 */
    setGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]) {
      this.$patch(state => {
        state[key] = value
      })
    },

    /** 设置主题模式 */
    setTheme(theme: 'light' | 'dark' | 'system') {
      this.theme = theme
    },

    /** 切换明暗主题 */
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
    },

    /** 设置界面语言 */
    setLang(lang: 'zh' | 'en' | 'ja') {
      this.lang = lang
    },

    /** 添加搜索历史（去重、最新在前、最多 10 条） */
    addSearchHistory(q: string) {
      const s = q.trim()
      if (!s) return
      const idx = this.searchHistory.indexOf(s)
      if (idx !== -1) this.searchHistory.splice(idx, 1)
      this.searchHistory.unshift(s)
      if (this.searchHistory.length > 10) this.searchHistory = this.searchHistory.slice(0, 10)
    },

    /** 删除指定搜索历史 */
    removeSearchHistory(q: string) {
      const s = q.trim()
      if (!s) return
      const idx = this.searchHistory.indexOf(s)
      if (idx !== -1) this.searchHistory.splice(idx, 1)
    },

    /** 清空全部搜索历史 */
    clearSearchHistory() {
      this.searchHistory = []
    },
  },
  persist: piniaPersistConfig('global'),
})
