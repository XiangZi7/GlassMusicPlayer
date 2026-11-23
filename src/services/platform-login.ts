import type { MusicPlatform } from '@/api'
import type { QrLoginProfile, QrLoginResult, QrLoginSession } from '@/api/auth'
import { publicAvatar } from '@/services/public-avatar'

export type LoginViewStatus =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'scanned'
  | 'authorized'
  | 'expired'
  | 'error'

export interface PlatformLoginState {
  status: LoginViewStatus
  qrCodeUrl: string
  expiresAt: string
  profile: QrLoginProfile | null
  error: string
}

export interface PlatformLoginApi {
  authorized?: (profile: QrLoginProfile, grant?: QrLoginResult['playback']) => void | Promise<void>
  create: (
    platform: MusicPlatform,
    signal: AbortSignal
  ) => Promise<QrLoginSession>
  check: (
    platform: MusicPlatform,
    sessionId: string,
    signal: AbortSignal
  ) => Promise<QrLoginResult>
  cancel: (platform: MusicPlatform, sessionId: string) => Promise<void>
}

const sessionPattern = /^[A-Za-z0-9_-]{43}$/
const qrImagePattern = /^data:image\/(?:svg\+xml|png);base64,[A-Za-z0-9+/]+=*$/
const maximumQrLifetime = 5 * 60_000

// 初始化只包含界面状态；服务端流程凭证和 Cookie 不进入响应式或持久化数据。
export function createPlatformLoginState(): PlatformLoginState {
  return {
    // 当前弹窗阶段，授权只能来自上游确认与有效账号资料。
    status: 'idle',
    // 仅当前有效流程的本地二维码图片。
    qrCodeUrl: '',
    // 当前流程的服务端到期时间。
    expiresAt: '',
    // 上游已确认的公开用户资料，不含 Cookie。
    profile: null,
    // 本次扫码流程的可读错误提示。
    error: '',
  }
}

// 上游确认授权后仍须具有有效账号 UID，不以扫码/HTTP 成功伪造已登录。
function verifiedProfile(value: unknown): QrLoginProfile {
  if (!value || typeof value !== 'object')
    throw new Error('音乐平台未返回有效账号资料，请重新扫码。')
  const profile = value as Partial<QrLoginProfile>
  if (
    typeof profile.userId !== 'string' ||
    !/^[1-9]\d{0,19}$/.test(profile.userId) ||
    typeof profile.displayName !== 'string' ||
    !profile.displayName.trim() ||
    profile.displayName.length > 200
  )
    throw new Error('音乐平台未返回有效账号资料，请重新扫码。')
  return {
    userId: profile.userId,
    displayName: profile.displayName.trim(),
    avatarUrl: publicAvatar(profile.avatarUrl),
  }
}

// 串行轮询和世代隔离：取消、刷新、过期和离开页面后，旧请求均不得恢复登录状态。
export function createPlatformLoginFlow(
  state: PlatformLoginState,
  api: PlatformLoginApi,
  now: () => number = Date.now
) {
  let generation = 0
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let session:
    { platform: MusicPlatform; id: string; deadline: number } | undefined

  function release(platform: MusicPlatform, id: string): void {
    void api.cancel(platform, id).catch(() => undefined)
  }

  function stop(): void {
    generation++
    controller?.abort()
    controller = undefined
    if (timer !== undefined) clearTimeout(timer)
    if (expiryTimer !== undefined) clearTimeout(expiryTimer)
    timer = undefined
    expiryTimer = undefined
    const old = session
    session = undefined
    if (old) release(old.platform, old.id)
  }

  function cancel(): void {
    stop()
    Object.assign(state, createPlatformLoginState())
  }

  function expire(): void {
    stop()
    state.status = 'expired'
    state.qrCodeUrl = ''
    state.profile = null
    state.error = ''
  }

  function fail(error: unknown): void {
    stop()
    state.status = 'error'
    state.qrCodeUrl = ''
    state.profile = null
    state.error =
      error instanceof Error ? error.message : '扫码登录失败，请重试。'
  }

  function schedule(current: number): void {
    if (current !== generation || !session) return
    const remaining = session.deadline - now()
    if (remaining <= 0) {
      expire()
      return
    }
    timer = setTimeout(
      () => {
        timer = undefined
        void poll(current)
      },
      Math.min(1_500, remaining)
    )
  }

  async function poll(current: number): Promise<void> {
    const active = session
    const request = controller
    if (current !== generation || !active || !request) return
    if (now() >= active.deadline) {
      expire()
      return
    }
    try {
      const result = await api.check(active.platform, active.id, request.signal)
      if (current !== generation || request.signal.aborted) return
      if (now() >= active.deadline) {
        expire()
        return
      }
      if (result.platform !== active.platform)
        throw new Error('扫码流程返回的平台不匹配，请重新扫码。')
      if (result.status === 'authorized') {
        const profile = verifiedProfile(result.profile)
        if (active.platform === 'netease' && api.authorized) {
          await api.authorized(profile, result.playback)
          if (current !== generation || request.signal.aborted) return
        }
        // 已取得公开身份后立即回收服务端槽位，不等弹窗关闭或 TTL 清理。
        release(active.platform, active.id)
        session = undefined
        controller = undefined
        if (expiryTimer !== undefined) clearTimeout(expiryTimer)
        expiryTimer = undefined
        state.profile = profile
        state.qrCodeUrl = ''
        state.status = 'authorized'
        return
      }
      if (result.status === 'expired') {
        expire()
        return
      }
      if (result.status !== 'waiting' && result.status !== 'scanned')
        throw new Error('音乐平台返回了未知登录状态，请重新扫码。')
      if (state.status !== 'scanned' || result.status !== 'waiting')
        state.status = result.status
      schedule(current)
    } catch (error) {
      if (current === generation && !request.signal.aborted) fail(error)
    }
  }

  async function start(platform: MusicPlatform): Promise<void> {
    stop()
    Object.assign(state, createPlatformLoginState())
    if (platform !== 'netease' && platform !== 'kugou') {
      fail(new Error('该平台暂未接通账号登录，请使用公开主页或歌单分享链接。'))
      return
    }
    state.status = 'creating'
    const current = generation
    const request = new AbortController()
    controller = request
    try {
      const result = await api.create(platform, request.signal)
      if (current !== generation || request.signal.aborted) {
        if (
          result.platform === platform &&
          typeof result.sessionId === 'string' &&
          sessionPattern.test(result.sessionId)
        )
          release(platform, result.sessionId)
        return
      }
      const deadline = Date.parse(result.expiresAt)
      if (
        result.platform !== platform ||
        result.status !== 'waiting' ||
        typeof result.sessionId !== 'string' ||
        !sessionPattern.test(result.sessionId)
      )
        throw new Error('音乐服务返回了无效扫码流程，请重试。')
      session = { platform, id: result.sessionId, deadline }
      if (
        typeof result.qrCodeUrl !== 'string' ||
        result.qrCodeUrl.length > 400_000 ||
        !qrImagePattern.test(result.qrCodeUrl) ||
        !Number.isFinite(deadline) ||
        deadline - now() > maximumQrLifetime
      )
        throw new Error('音乐服务返回了无效二维码，请重试。')
      if (deadline <= now()) {
        expire()
        return
      }
      state.qrCodeUrl = result.qrCodeUrl
      state.expiresAt = result.expiresAt
      state.status = 'waiting'
      // 轮询网络延迟也不能延长二维码在界面上的有效期。
      expiryTimer = setTimeout(() => {
        if (current === generation) expire()
      }, deadline - now())
      schedule(current)
    } catch (error) {
      if (current === generation && !request.signal.aborted) fail(error)
    }
  }

  return { start, cancel }
}
