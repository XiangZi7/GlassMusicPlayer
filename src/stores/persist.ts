/**
 * Pinia 持久化配置
 * 基于 pinia-plugin-persistedstate，将指定的 state 字段存储到 localStorage
 */
import { PersistenceOptions } from 'pinia-plugin-persistedstate'

/**
 * 生成 Pinia Store 的持久化配置
 * @param key - 存储到 localStorage 的键名
 * @param paths - 需要持久化的 state 路径列表（如 ['audio.volume', 'audio.playMode']）
 * @returns PersistenceOptions 配置对象
 */
const piniaPersistConfig = (key: string, paths?: string[]) => {
  const persist: PersistenceOptions = {
    key,
    storage: localStorage,
    pick: paths,
  }
  return persist
}

export default piniaPersistConfig
