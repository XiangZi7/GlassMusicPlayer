import { shallowRef } from 'vue'
import { invoke, isTauri } from '@tauri-apps/api/core'
import type { PlaybackGrant, QrLoginProfile, QrLoginResult } from '@/api/auth'
import { apiBaseUrl, httpPost } from '@/utils/http'
import { notify } from '@/services/notification'

type Credential = { userId: string; token: string }
const tokenPattern = /^[A-Za-z0-9_-]{43}$/
const service = new URL(apiBaseUrl, location.href)
export const rememberPlayback =
  isTauri() &&
  /Windows/i.test(navigator.userAgent) &&
  (service.protocol === 'https:' ||
    ['127.0.0.1', 'localhost', '[::1]'].includes(service.hostname))
const server = service.href
export const playbackAccount = shallowRef<
  (QrLoginProfile & { badge: string; favorites: boolean }) | null
>(null)
// 只有主动切换或撤销身份才丢弃当前音源，启动恢复不会打断首次点播。
export const playbackRevision = shallowRef(0)
let bearer = ''
let deadline = 0
let expiry: ReturnType<typeof setTimeout> | undefined
let generation = 0
let initialized = false
let restoring: Promise<void> | undefined
// 刚核验过的窗口合并一分钟内的重复聚焦，临时会话不参与前台续期。
let nextForegroundCheck = Infinity
let vaultWrites = Promise.resolve()
let linkedUser: () => string | undefined = () => undefined

// 撤销只作用于原设备授权，服务暂时离线时本机仍可解除关联。
function revoke(token: string): void {
  if (token)
    void httpPost('/netease/auth/playback/end', { sessionId: token }).catch(
      () => {}
    )
}

// 读取此服务对应的 Windows 设备授权，不接触其他平台或客户端的凭据。
function readCredential(): Promise<Credential | null> {
  return invoke<Credential | null>('read_playback_credential', { server })
}

// 重扫时提供旧会话的持有证明，服务端只在新二维码得到确认后替换它。
export async function previousPlaybackToken(): Promise<string> {
  const current = playbackBearer()
  if (current || !rememberPlayback || initialized) return current
  const version = generation
  await vaultWrites
  const saved = await readCredential().catch(() => null)
  return version === generation ? saved?.token ?? '' : playbackBearer()
}

// 串行写入系统凭据，快速切换或解绑时最后一次操作生效。
function saveCredential(
  credential: Credential | null,
  revoked: string
): Promise<void> {
  if (!rememberPlayback) return Promise.resolve()
  const write = vaultWrites.then(async () => {
    const previous = await readCredential().catch(() => null)
    await invoke('write_playback_credential', { server, credential })
    if (
      previous &&
      previous.token !== credential?.token &&
      previous.token !== revoked
    )
      revoke(previous.token)
  })
  vaultWrites = write.catch(() => {})
  return write
}

// 清除内存状态并阻止未完成的恢复请求覆盖最新身份。
function resetSession(): void {
  generation++
  restoring = undefined
  initialized = true
  clearTimeout(expiry)
  bearer = ''
  deadline = 0
  nextForegroundCheck = Infinity
  playbackAccount.value = null
}

// 切换账号、解除关联或授权过期时同时撤销本机的记住登录。
export function clearPlaybackGrant(): void {
  const previous = bearer
  resetSession()
  revoke(previous)
  void saveCredential(null, previous).catch(() =>
    notify('移除本机播放授权失败，请重试', 'error')
  )
  if (previous) playbackRevision.value++
}

// 长授权可能超过浏览器的单次定时上限，休眠恢复后也重新检查有效期。
function scheduleExpiry(): void {
  const remaining = deadline - Date.now()
  if (remaining <= 0) clearPlaybackGrant()
  else expiry = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647))
}

// 仅采用服务端确认的身份、收藏权限、授权期限与会员标记。
function applyGrant(profile: QrLoginProfile, grant?: PlaybackGrant): boolean {
  const until = Date.parse(grant?.expiresAt ?? '')
  if (
    !grant ||
    !tokenPattern.test(grant.token) ||
    !Number.isFinite(until) ||
    until <= Date.now()
  )
    return false
  bearer = grant.token
  deadline = until
  nextForegroundCheck = grant.remembered ? Date.now() + 60_000 : Infinity
  const level = grant.vipLevel
  const badge =
    grant.isVip === true
      ? typeof level === 'number' &&
        Number.isInteger(level) &&
        level > 0 &&
        level < 100
        ? `VIP ${level}`
        : 'VIP'
      : ''
  playbackAccount.value = { ...profile, badge, favorites: grant.favorites === true }
  clearTimeout(expiry)
  scheduleExpiry()
  return true
}

// 扫码成功后立即使用新身份，只有服务端确认支持跨重启的授权才进入系统凭据库。
export async function acceptPlaybackGrant(
  profile: QrLoginProfile,
  grant?: PlaybackGrant
): Promise<void> {
  const previous = bearer
  resetSession()
  if (previous && previous !== grant?.token) revoke(previous)
  const valid = applyGrant(profile, grant)
  playbackRevision.value++
  try {
    await saveCredential(
      valid && grant?.remembered
        ? { userId: profile.userId, token: grant.token }
        : null,
      previous
    )
    if (valid && rememberPlayback && !grant?.remembered)
      notify(
        '本次扫码已生效。当前服务端仅支持临时授权，更新服务端后可记住登录。'
      )
  } catch {
    notify('本次扫码已生效，但 Windows 未能保存播放授权', 'error')
  }
}

// 从系统凭据库取回本服务的授权，再向服务端核对当前网易云身份和会员权益。
async function restore(version: number): Promise<void> {
  await vaultWrites
  const saved = await readCredential()
  if (version !== generation) return
  if (!saved) {
    initialized = true
    return
  }
  if (linkedUser() && linkedUser() !== saved.userId) {
    clearPlaybackGrant()
    return
  }
  try {
    const result = await httpPost<QrLoginResult>(
      '/netease/auth/playback/restore',
      { sessionId: saved.token }
    )
    if (version !== generation) return
    if (linkedUser() && linkedUser() !== saved.userId) {
      clearPlaybackGrant()
      return
    }
    if (
      result.platform !== 'netease' ||
      result.status !== 'authorized' ||
      result.profile?.userId !== saved.userId ||
      result.playback?.token !== saved.token ||
      !result.playback.remembered ||
      !applyGrant(result.profile, result.playback)
    )
      throw new Error('网易云未能确认已保存的播放授权，请重新扫码。')
    initialized = true
  } catch (error) {
    if (version !== generation) return
    if (error instanceof Error && error.name === 'playback_session_expired')
      clearPlaybackGrant()
    throw error
  }
}

// 首次点播共用启动请求，回到前台时核验已保存的授权，播放中沿用仍有效的凭证。
export function restorePlaybackGrant(
  reason: 'playback' | 'open' = 'playback'
): Promise<void> {
  if (
    !rememberPlayback ||
    (initialized && (reason === 'playback' || Date.now() < nextForegroundCheck))
  )
    return Promise.resolve()
  const version = generation
  return (restoring ??= restore(version).finally(() => {
    if (version === generation) restoring = undefined
  }))
}

// 启动及从托盘回到前台时静默续期，只有平台确认登录失效才提示重扫。
export function onPlaybackWindowOpened(): void {
  if (restoring) return
  void restorePlaybackGrant('open').catch(error => {
    if (error instanceof Error && error.name === 'playback_session_expired')
      notify(error.message, 'error')
  })
}

// 在播放器挂载时启动恢复，公开资料只用于比对，不能据此签发播放授权。
export function initializePlaybackGrant(
  getUser: () => string | undefined
): void {
  linkedUser = getUser
  onPlaybackWindowOpened()
}

// 每次点播及处理旧请求错误前都检查当前仍然生效的凭证。
export function playbackBearer(): string {
  if (bearer && Date.now() >= deadline) clearPlaybackGrant()
  return bearer
}
