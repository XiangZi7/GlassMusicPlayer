/**
 * 本地音乐 IndexedDB 存储模块
 * 使用 IndexedDB 持久化存储用户导入的本地音乐文件
 */

/** 本地音乐数据结构 */
export interface LocalMusic {
  id: string
  name: string
  artist: string
  album: string
  duration: number
  cover: string
  file: File | Blob
  createTime: number
}

/** 数据库名称 */
const DB_NAME = 'GlassMusicPlayerDB'
/** 对象存储名称 */
const STORE_NAME = 'local_music'
/** 数据库版本 */
const DB_VERSION = 1

/**
 * 本地音乐数据库操作类
 * 封装 IndexedDB 的 CRUD 操作，统一使用 Promise 风格
 */
export class LocalMusicDB {
  private db: IDBDatabase | null = null

  /** 打开数据库连接（单例模式，已连接则复用） */
  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
    })
  }

  /**
   * 执行单次事务操作的通用辅助方法
   * 将重复的 open → transaction → store → request → promise 模式统一封装
   *
   * @param mode - 事务模式：'readonly' 或 'readwrite'
   * @param operation - 对 objectStore 执行的具体操作，返回 IDBRequest
   * @returns Promise 包装的操作结果
   */
  private async execute<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], mode)
      const store = transaction.objectStore(STORE_NAME)
      const request = operation(store)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  /** 添加或更新一首本地音乐（put 语义：存在则覆盖） */
  async add(music: LocalMusic): Promise<void> {
    await this.execute<void>('readwrite', store => store.put(music))
  }

  /** 获取所有本地音乐列表 */
  async getAll(): Promise<LocalMusic[]> {
    return this.execute<LocalMusic[]>('readonly', store => store.getAll())
  }

  /** 根据 ID 删除一首本地音乐 */
  async delete(id: string): Promise<void> {
    await this.execute<void>('readwrite', store => store.delete(id))
  }

  /** 清空所有本地音乐 */
  async clear(): Promise<void> {
    await this.execute<void>('readwrite', store => store.clear())
  }
}

/** 全局单例，供各模块直接导入使用 */
export const localMusicDB = new LocalMusicDB()
