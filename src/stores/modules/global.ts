import { GlobalState } from '../interface'
import piniaPersistConfig from '../persist'
export const useGlobalStore = defineStore('global', {
  state: (): GlobalState => ({ count: 0 }),

  actions: {
    actions: {
      // Set GlobalState
      setGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]) {
        // 使用函数式更新解决类型推断问题
        this.$patch(state => {
          state[key] = value
        })
      },
    },
  },
  persist: piniaPersistConfig('global'),
})
