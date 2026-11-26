import { invoke, isTauri } from '@tauri-apps/api/core'
import { reactive } from 'vue'

export type TuneWeavePlatform = 'kugou' | 'kuwo'
export type KugouEdition = 'standard' | 'concept'
type NativeAccount = {
  uid: string
  name: string
  edition?: KugouEdition
  canAddFavorites: boolean
}
type FavoriteAccount = {
  userId: string
  displayName: string
  edition?: KugouEdition
  canAddFavorites: boolean
}
export const kugouEditionNames = {
  standard: '标准版',
  concept: '概念版',
} as const
export const tuneWeaveDesktop = isTauri()
export const tuneWeaveAccounts = reactive<
  Record<TuneWeavePlatform, FavoriteAccount | null>
>({
  /** 酷狗当前可读写红心的账号，仅在播放器运行期间有效。 */
  kugou: null,
  /** 酷我当前可读写红心的账号，与公开资料关联分别管理。 */
  kuwo: null,
})
const revisions = { kugou: 0, kuwo: 0 }

type Challenge = {
  transactionId: string
  qrUrl?: string
  qrImage?: string
  expiresIn?: number
}
type LoginResult = {
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'failed'
  account?: NativeAccount
}

// 标准版与概念版分别建立身份，写权限采用原生端对当前账号和歌单的核验结果。
function favoriteAccount(account: NativeAccount): FavoriteAccount {
  return {
    userId: account.uid,
    displayName: account.name,
    edition: account.edition,
    canAddFavorites: account.canAddFavorites,
  }
}

// 从原生进程读取已核验身份；重新聚焦或重载窗口时沿用同一账号快照。
export async function refreshTuneWeaveAccount(
  platform: TuneWeavePlatform
): Promise<void> {
  if (!tuneWeaveDesktop) return
  const revision = ++revisions[platform]
  const account = await invoke<NativeAccount | null>('tuneweave_account', {
    platform,
  })
  if (revision !== revisions[platform]) return
  const previous = tuneWeaveAccounts[platform]
  if (!account) tuneWeaveAccounts[platform] = null
  else if (
    previous?.userId === account.uid &&
    previous.edition === account.edition &&
    previous.canAddFavorites === account.canAddFavorites
  )
    previous.displayName = account.name
  else tuneWeaveAccounts[platform] = favoriteAccount(account)
}

// 用户点击后才请求酷狗二维码或酷我验证码；短信注册许可取自本次明确勾选。
export function beginTuneWeaveLogin(
  options:
    | { platform: 'kuwo'; phone: string; allowAccountCreation: boolean }
    | { platform: 'kugou'; edition: KugouEdition; forConceptFavorites: boolean }
): Promise<Challenge> {
  return invoke('tuneweave_begin_login', options)
}

// 核验当前事务，只在原生端确认新会话后替换红心使用的身份。
export async function finishTuneWeaveLogin(
  platform: TuneWeavePlatform,
  transactionId: string,
  code: string | undefined,
  isCurrent: () => boolean
): Promise<LoginResult['status']> {
  const result = await invoke<LoginResult>('tuneweave_finish_login', {
    platform,
    transactionId,
    code,
  })
  if (result.status === 'confirmed' && isCurrent()) {
    if (!result.account?.uid)
      throw new Error('平台未返回收藏账号，请重新登录。')
    revisions[platform]++
    tuneWeaveAccounts[platform] = favoriteAccount(result.account)
  }
  return result.status
}

// 收起登录面板时撤销该次扫码或短信事务，保留已确认的账号。
export function cancelTuneWeaveLogin(
  platform: TuneWeavePlatform,
  transactionId: string
): Promise<void> {
  return invoke('tuneweave_cancel_login', { platform, transactionId })
}

// 结束此平台的收藏会话，立即使播放器丢弃与旧账号有关的红心缓存。
export async function logoutTuneWeave(
  platform: TuneWeavePlatform
): Promise<void> {
  await invoke('tuneweave_logout', { platform })
  revisions[platform]++
  tuneWeaveAccounts[platform] = null
}
