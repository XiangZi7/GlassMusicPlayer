import { shallowRef } from 'vue'
import type { PlaybackGrant, QrLoginProfile } from '@/api/auth'
import { httpPost } from '@/utils/http'

// 组件只读取本次扫码核实的身份，播放凭证单独保存在模块内存中。
export const playbackAccount = shallowRef<(QrLoginProfile & { badge: string }) | null>(null)
let bearer = ''
let deadline = 0
let expiry: ReturnType<typeof setTimeout> | undefined

// 切换账号、解除关联或会话过期时撤销本客户端的授权。
export function clearPlaybackGrant(): void {
  if (expiry !== undefined) clearTimeout(expiry)
  const previous = bearer
  bearer = ''
  deadline = 0
  playbackAccount.value = null
  if (previous) void httpPost('/netease/auth/playback/end', { sessionId: previous }).catch(() => {})
}

// 仅在有效二维码确认身份后接受服务端签发的限时播放授权。
export function acceptPlaybackGrant(profile: QrLoginProfile, grant?: PlaybackGrant): void {
  clearPlaybackGrant()
  if (!grant || !/^[A-Za-z0-9_-]{43}$/.test(grant.token)) return
  const until = Date.parse(grant.expiresAt)
  if (!Number.isFinite(until) || until <= Date.now()) return
  bearer = grant.token
  deadline = until
  const level = grant.vipLevel
  const badge = grant.isVip === true
    ? (typeof level === 'number' && Number.isInteger(level) && level > 0 && level < 100 ? `VIP ${level}` : 'VIP')
    : ''
  playbackAccount.value = { ...profile, badge }
  expiry = setTimeout(clearPlaybackGrant, until - Date.now())
}

// 每次点播重新检查有效期，系统休眠后也不会沿用过期授权。
export function playbackBearer(): string {
  if (bearer && Date.now() >= deadline) clearPlaybackGrant()
  return bearer
}
