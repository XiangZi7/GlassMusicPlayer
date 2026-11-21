import type { MusicPlatform } from '@/api'
import { httpPost } from '@/utils/http'

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
  platform: MusicPlatform
  status: QrLoginStatus
  profile?: QrLoginProfile | null
}

// 只创建短期扫码流程；二维码由服务端本地编码，不向第三方图片服务发送登录链接。
export function createQrLogin(platform: MusicPlatform, signal: AbortSignal) {
  return httpPost<QrLoginSession>(`/${platform}/auth/qr`, undefined, { signal })
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
  create: createQrLogin,
  check: checkQrLogin,
  cancel: cancelQrLogin,
}
