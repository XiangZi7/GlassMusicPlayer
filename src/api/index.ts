// 获取 banner 轮播图
// params.type:
// 0: pc, 1: android, 2: iphone, 3: ipad
export const banner = (params?: { type?: 0 | 1 | 2 | 3 }) => httpGet('/banner', params)

// 登录相关
export const loginCellphone = (params: {
  phone: string
  password?: string
  md5_password?: string
  captcha?: string
  countrycode?: string
}) => httpGet('/login/cellphone', params)

export const loginEmail = (params: { email: string; password?: string; md5_password?: string }) =>
  httpGet('/login', params)

export const loginRefresh = () => httpGet('/login/refresh')

export const loginStatus = () => httpGet('/login/status')

export const loginAnonymous = () => httpGet('/register/anonimous')

// 验证码相关
export const captchaSent = (params: { phone: string; ctcode?: number }) =>
  httpGet('/captcha/sent', params)

export const captchaVerify = (params: { phone: string; captcha: string; ctcode?: number }) =>
  httpGet('/captcha/verify', params)

// 二维码登录
export const qrLoginKey = () => httpGet('/login/qr/key')

export const qrLoginCreate = (params: { key: string; qrimg?: boolean }) =>
  httpGet('/login/qr/create', params)

export const qrLoginCheck = (params: { key: string; noCookie?: boolean }) =>
  httpGet('/login/qr/check', params)

// 搜索相关
export const search = (params: {
  keywords: string
  limit?: number
  offset?: number
  type?: 1 | 10 | 100 | 1000 | 1002 | 1004 | 1006 | 1009 | 1014 | 1018 | 2000
}) => httpGet('/search', params)

export const cloudSearch = (params: {
  keywords: string
  limit?: number
  offset?: number
  type?: 1 | 10 | 100 | 1000 | 1002 | 1004 | 1006 | 1009 | 1014 | 1018 | 2000
}) => httpGet('/cloudsearch', params)

export const searchSuggest = (params: { keywords: string; type?: 'mobile' }) =>
  httpGet('/search/suggest', params)
export const searchHot = () => httpGet('/search/hot')
export const searchHotDetail = () => httpGet('/search/hot/detail')
export const searchDefault = () => httpGet('/search/default')
export const searchMultimatch = (params: { keywords: string }) =>
  httpGet('/search/multimatch', params)

// 音乐链接相关
export const songUrl = (params: { id: string; br?: number }) => httpGet('/song/url', params)

export const songUrlV1 = (params: {
  id: string
  level?: 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires' | 'jyeffect' | 'sky' | 'jymaster'
}) => httpGet('/song/url/v1', params)

export const checkMusic = (params: { id: string; br?: number }) => httpGet('/check/music', params)
export const songDownloadUrl = (params: { id: string; br?: number }) =>
  httpGet('/song/download/url', params)

// 评论相关
export const commentMusic = (params: {
  id: number
  limit?: number
  offset?: number
  before?: number
}) => httpGet('/comment/music', params)

export const commentHot = (params: {
  id: number
  type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  limit?: number
  offset?: number
  before?: number
}) => httpGet('/comment/hot', params)

export const commentNew = (params: {
  id: number
  type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  sortType?: 1 | 2 | 3
  pageNo?: number
  pageSize?: number
  cursor?: number
}) => httpGet('/comment/new', params)

export const commentSend = (params: {
  t: 1 | 2
  type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  id?: number
  threadId?: string
  content: string
  commentId?: number
}) => httpGet('/comment', params)

export const commentDelete = (params: {
  t: 0
  type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  id?: number
  threadId?: string
  commentId: number
}) => httpGet('/comment', params)

// 歌曲详情
export const songDetail = (params: { ids: string }) => httpGet('/song/detail', params)

export const albumDetail = (params: { id: number | string }) => httpGet('/album', params)

// 歌单相关
export const playlistDetail = (params: { id: number; s?: number }) =>
  httpGet('/playlist/detail', params)

export const playlistTrackAll = (params: { id: number; limit?: number; offset?: number }) =>
  httpGet('/playlist/track/all', params)

export const userPlaylist = (params: { uid: number; limit?: number; offset?: number }) =>
  httpGet('/user/playlist', params)

export const topPlaylist = (params: {
  order?: 'new' | 'hot'
  cat?: string
  limit?: number
  offset?: number
}) => httpGet('/top/playlist', params)

export const topSong = (params: { type: 0 | 7 | 96 | 8 | 16 }) => httpGet('/top/song', params)

export const recordRecentSong = (params?: { limit?: number }) =>
  httpGet('/record/recent/song', params)

// MV 详情与播放
export const mvDetail = (params: { mvid: number | string }) => httpGet('/mv/detail', params)
export const mvUrl = (params: { id: number | string; r?: number }) => httpGet('/mv/url', params)
export const simiMv = (params: { mvid: number | string }) => httpGet('/simi/mv', params)
export const mvAll = (params: {
  area?: string
  type?: string
  order?: string
  limit?: number
  offset?: number
}) => httpGet('/mv/all', params)
export const searchSong = (params: { keywords: string; limit?: number; offset?: number }) =>
  httpGet('/search', params)

// 歌词相关
export const lyric = (params: { id: number | string }) => httpGet('/lyric', params)

// 推荐相关
export const personalized = (params?: { limit?: number }) => httpGet('/personalized', params)
export const personalizedNewsong = (params?: { limit?: number }) =>
  httpGet('/personalized/newsong', params)
export const personalizedMv = () => httpGet('/personalized/mv')
export const playlistCatlist = () => httpGet('/playlist/catlist')
export const topArtists = (params?: { limit?: number; offset?: number }) =>
  httpGet('/top/artists', params)
export const artistList = (params?: {
  type?: number
  area?: number
  initial?: string
  limit?: number
  offset?: number
}) => httpGet('/artist/list', params)

export const artistDetail = (params: { id: number }) => httpGet('/artist/detail', params)
export const artistTopSong = (params: { id: number }) => httpGet('/artist/top/song', params)
export const artistAlbum = (params: { id: number; limit?: number; offset?: number }) =>
  httpGet('/artist/album', params)
export const artistDesc = (params: { id: number }) => httpGet('/artist/desc', params)
export const artistMv = (params: { id: number; limit?: number; offset?: number }) =>
  httpGet('/artist/mv', params)
