/**
 * 播放操作组合式函数
 * 统一封装歌曲映射、全部播放、随机播放等通用逻辑
 * 消除各页面（playlist、artist、album、charts）中的重复代码
 */
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import type { SongData } from '@/utils/transformers'

/**
 * 将 API 层的 SongData 映射为 Store 层的 Song 类型
 * @param song - API 返回的歌曲数据
 * @returns Store 层歌曲对象
 */
export function mapToStoreSong(song: SongData): StoreSong {
  return {
    id: song.id,
    name: song.name,
    artist: song.artist,
    artistId: song.artistId,
    artists: song.artists,
    album: song.album,
    albumId: song.albumId,
    duration: song.duration,
    cover: song.cover,
    liked: song.liked,
    mvId: song.mvId,
  }
}

/**
 * 批量映射歌曲数据
 * @param songs - API 返回的歌曲列表
 * @returns Store 层歌曲列表
 */
export function mapToStoreSongs(songs: SongData[]): StoreSong[] {
  return songs.map(mapToStoreSong)
}

/**
 * Fisher-Yates 洗牌算法 —— 随机打乱数组
 * @param array - 待打乱的数组
 * @returns 打乱后的新数组（不改变原数组）
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * 播放操作组合式函数
 * 提供 playAll（全部播放）和 shufflePlay（随机播放）两个通用方法
 *
 * @example
 * ```ts
 * const { playAll, shufflePlay } = usePlayActions()
 * playAll(songs)       // 顺序播放所有歌曲
 * shufflePlay(songs)   // 随机打乱后播放
 * ```
 */
export function usePlayActions() {
  const { setPlaylist, play } = useAudio()

  /**
   * 全部播放 —— 设置播放列表并从第一首开始播放
   * @param songs - 歌曲列表（SongData[] 或 StoreSong[]）
   * @param startIndex - 开始播放的索引，默认 0
   */
  const playAll = (songs: SongData[] | StoreSong[], startIndex = 0) => {
    if (!songs.length) return
    const list = isStoreSongs(songs) ? songs : mapToStoreSongs(songs)
    setPlaylist(list, startIndex)
    play(list[startIndex], startIndex)
  }

  /**
   * 随机播放 —— 打乱歌曲列表后从第一首开始播放
   * @param songs - 歌曲列表（SongData[] 或 StoreSong[]）
   */
  const shufflePlay = (songs: SongData[] | StoreSong[]) => {
    if (!songs.length) return
    const list = isStoreSongs(songs) ? songs : mapToStoreSongs(songs)
    const shuffled = shuffleArray(list)
    setPlaylist(shuffled, 0)
    play(shuffled[0], 0)
  }

  return { playAll, shufflePlay, mapToStoreSong, mapToStoreSongs }
}

/**
 * 类型守卫：判断歌曲数组是否已经是 StoreSong 类型
 * 通过检查是否缺少 SongData 特有的字段来区分
 */
function isStoreSongs(songs: SongData[] | StoreSong[]): songs is StoreSong[] {
  if (songs.length === 0) return true
  // SongData 总是有 cover 字段且没有 url 字段（StoreSong 可能有 url）
  return !('cover' in songs[0] && !('url' in songs[0]) && !('isLocal' in songs[0]))
}
