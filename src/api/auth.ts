import type { MusicPlatform } from '@/api'
import { httpPost } from '@/utils/http'
import {
  acceptPlaybackGrant,
  previousPlaybackToken,
  rememberPlayback,
} from '@/services/player/playback-session'

export type QrLoginStatus = 'waiting' | 'scanned' | 'authorized' | 'expired'

export interface QrLoginProfile {
  userId: string
  displayName: string | null
  avatarUrl: string | null
}

export interface QrLoginSession {
  platform: MusicPlatform
  sessionId: string
  qrCodeUrl: string
  expiresAt: string
  status: 'waiting'
}

export interface QrLoginResult {
  playback?: PlaybackGrant
  platform: MusicPlatform
  status: QrLoginStatus
  profile?: QrLoginProfile | null
}

export interface PlaybackGrant {
  favorites?: boolean
  remembered?: boolean
  token: string
  expiresAt: string
  isVip: boolean
  vipLevel: number | null
}

// 网易云扫码同时申请点播和红心权限，其他平台按各自支持的身份流程登录。
export async function createQrLogin(platform: MusicPlatform, signal: AbortSignal) {
  const netease = platform === 'netease'
  const previous = netease ? await previousPlaybackToken() : ''
  return httpPost<QrLoginSession>(`/${platform}/auth/qr`, undefined, {
    signal,
    params: netease ? { playback: true, favorites: true, remember: rememberPlayback || undefined } : undefined,
    headers: previous ? { Authorization: `Bearer ${previous}` } : undefined,
  })
}

// 流程凭证仅放在请求体，不出现在 URL、日志、持久化存储或播放接口中。
export function checkQrLogin(
  platform: MusicPlatform,
  sessionId: string,
  signal: AbortSignal
) {
  return httpPost<QrLoginResult>(
    `/${platform}/auth/qr/status`,
    { sessionId },
    { signal }
  )
}

// 关闭弹窗或更换方式时释放服务端流程；使用独立的短超时，不复用已取消的请求。
export function cancelQrLogin(platform: MusicPlatform, sessionId: string) {
  return httpPost<void>(
    `/${platform}/auth/qr/cancel`,
    { sessionId },
    { timeout: 5_000 }
  )
}

export const qrLoginApi = {
  authorized: acceptPlaybackGrant,
  create: createQrLogin,
  check: checkQrLogin,
  cancel: cancelQrLogin,
}
