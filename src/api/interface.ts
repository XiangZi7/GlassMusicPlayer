// 基础响应类型
export type BaseResponse<T> = {
  ret: boolean
  msg: string
  data: T
  code?: number
}

// 首页数据类型定义
export interface BannerItem {
  // 标题文案
  title: string
  // 描述文案
  description: string
  // 封面地址
  coverImgUrl: string
  // 跳转链接
  url: string
}

export interface PlaylistItem {
  // 歌单ID
  id: number | string
  // 歌单名称
  name: string
  // 播放量
  count: number
  // 曲目数量
  trackCount?: number
  // 封面地址
  coverImgUrl: string
  // 创建者名称
  creatorName?: string
  // 描述
  description?: string
}

export interface SongItem {
  // 唯一标识
  id: number | string
  // 歌名
  name: string
  // 艺术家名（已拼接）
  artist: string
  // 艺术家ID
  artistId?: number | string
  // 专辑名
  album: string
  // 专辑ID
  albumId?: number | string
  // 时长（毫秒）
  duration: number
  // 表情图标
  emoji: string
  // Tailwind 渐变类名
  gradient: string
  // 是否喜欢
  liked: boolean
  // 封面地址
  cover: string
}

export interface RecentItem {
  // 歌曲或内容名称
  name: string
  // 艺术家
  artist: string
  // 播放时间文本
  playTime: string
  // 表情图标
  emoji: string
  // Tailwind 渐变类名
  gradient: string
}
