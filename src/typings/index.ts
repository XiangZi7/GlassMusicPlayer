
export interface PlaylistInfo {
  name: string
  description: string
  creator: string
  createTime: string
  songCount: number
  likes: string
  category: string
  emoji?: string
  gradient: string
  coverImgUrl: string
}

export interface PlaylistSong {
  id: number | string
  mvId?: number
  name: string
  artist: string
  album: string
  duration: number
  emoji: string
  gradient: string
  liked: boolean
  url?: string
  cover: string
}

export interface ReplyItem {
  username: string
  avatarUrl: string
  avatarGradient: string
  time: string
  content: string
}

export interface CommentItem {
  username: string
  avatarUrl: string
  avatarGradient: string
  time: string
  content: string
  likes: number
  replies: ReplyItem[]
}