// 用户信息存储模块：负责登录状态与用户资料管理
import piniaPersistConfig from '@/stores/persist'
import { defineStore } from 'pinia'

export interface UserProfile {
  userId: number
  nickname: string
  avatarUrl: string
  vipType?: number
}

export const useUserStore = defineStore('user', {
  state: () => ({
    isLoggedIn: false,
    profile: null as UserProfile | null,
    lastLoginAt: 0,
  }),
  getters: {
    nickname: state => state.profile?.nickname || '',
    avatarUrl: state => state.profile?.avatarUrl || '',
  },
  actions: {
    // 设置用户信息
    setUser(profile: UserProfile) {
      this.isLoggedIn = true
      this.profile = profile
      this.lastLoginAt = Date.now()
    },
    // 清理用户信息
    logout() {
      this.isLoggedIn = false
      this.profile = null
      this.lastLoginAt = 0
    },
  },
  persist: piniaPersistConfig('user', ['isLoggedIn', 'profile', 'lastLoginAt']),
})