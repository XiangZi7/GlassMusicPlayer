
export interface PlaylistInfo {
  name: string
  description: string
  creator: string
  creatorAvatar?: string
  createTime: string
  songCount: number
  playCount?: number
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


export interface MVInfo {
  id: number
  title: string
  artist: string
  artistId?: number
  duration: number
  cover: string
  playCount: string
  likes: string
  publishDate: string
  category: string
  emoji: string
  gradient: string
  liked: boolean
  isNew: boolean
  description: string
  url: string
}

export interface RelatedMV {
  id: number
  title: string
  artist: string
  duration: number
  playCount: string
  cover: string
  emoji: string
  gradient: string
}

export interface MVComment {
  username: string
  avatarUrl: string
  time: string
  content: string
  likes: number
}