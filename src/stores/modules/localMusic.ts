import { defineStore } from 'pinia'
import { localMusicDB, type LocalMusic } from '@/utils/indexedDB'
import { Song } from '../interface'
import * as mm from 'music-metadata-browser'

export const useLocalMusicStore = defineStore('localMusic', {
  state: () => ({
    musics: [] as LocalMusic[],
    isLoading: false,
  }),

  actions: {
    async loadMusics() {
      this.isLoading = true
      try {
        this.musics = await localMusicDB.getAll()
      } catch (error) {
        console.error('Failed to load local musics:', error)
      } finally {
        this.isLoading = false
      }
    },

    async addMusic(file: File) {
      const id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const name = file.name.replace(/\.[^/.]+$/, '') // 默认使用文件名
      
      let artist = 'Local Music'
      let album = 'Unknown Album'
      let cover = ''
      let duration = 0

      // 解析元数据
      try {
        const metadata = await mm.parseBlob(file)
        if (metadata.common.title) {
          // 如果有标题，使用标题，否则使用文件名
          // 这里可以考虑是否强制使用文件名，或者让用户选择
          // 为了体验，优先使用元数据标题，但如果标题为空则回退
          // name = metadata.common.title
        }
        if (metadata.common.artist) {
          artist = metadata.common.artist
        }
        if (metadata.common.album) {
          album = metadata.common.album
        }
        if (metadata.format.duration) {
          duration = metadata.format.duration
        }
        
        // 获取封面
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0]
          const blob = new Blob([picture.data], { type: picture.format })
          cover = URL.createObjectURL(blob)
          // 注意：Blob URL 生命周期问题。
          // 更好的方式是将图片 Blob 也存入 IndexedDB，或者转换为 Base64
          // 这里为了持久化，我们将 Blob 转为 Base64 存储
          cover = await this.blobToBase64(blob)
        }
      } catch (e) {
        console.warn('Failed to parse audio metadata', e)
      }

      // 如果元数据没解析出时长，尝试使用 Audio 对象获取
      if (duration === 0) {
        try {
          duration = await this.getAudioDuration(file)
        } catch (e) {
          console.warn('Failed to get audio duration via fallback', e)
        }
      }
      
      const music: LocalMusic = {
        id,
        name,
        artist,
        album,
        duration,
        cover,
        file,
        createTime: Date.now(),
      }

      await localMusicDB.add(music)
      this.musics.push(music)
      return music
    },

    async deleteMusic(id: string) {
      await localMusicDB.delete(id)
      this.musics = this.musics.filter(m => m.id !== id)
    },

    getAudioDuration(file: File): Promise<number> {
      return new Promise((resolve, reject) => {
        const audio = new Audio()
        const url = URL.createObjectURL(file)
        audio.src = url
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(url)
          resolve(audio.duration)
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Load audio failed'))
        }
      })
    },

    blobToBase64(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    },

    convertToSong(music: LocalMusic): Song {
      return {
        id: music.id as any, // 兼容类型
        name: music.name,
        artist: music.artist,
        album: music.album,
        cover: music.cover,
        url: URL.createObjectURL(music.file), // 创建 Blob URL
        duration: music.duration,
        // 其他字段
        mvId: 0,
        publishTime: music.createTime,
        isLocal: true, // 标记为本地音乐
      } as Song & { isLocal?: boolean }
    }
  }
})
