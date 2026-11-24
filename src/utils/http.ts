import type { AxiosRequestConfig, AxiosInstance } from 'axios'

const errorMessages: Readonly<Record<string, string>> = {
  invalid_playlist_url: '无法识别该歌单链接，请粘贴公开歌单详情页地址。',
  not_found: '平台未找到该公开资源。',
  account_authorization_required: '读取该平台的个人歌单需要平台授权。',
  auth_unsupported: '该平台的扫码登录暂未接通，请使用公开主页或歌单分享链接。',
  auth_capacity: '扫码服务暂时繁忙，请稍后重试。',
  auth_expired: '扫码流程已过期，请重新生成二维码。',
  playback_session_expired: '网易云播放授权已过期，请重新扫码。',
  favorites_scope_required: '请重新扫码登录网易云，授权同步喜欢的歌曲。',
  playback_store_unavailable: '服务端暂时无法读写已保存的播放授权，请稍后重试。',
  auth_identity_invalid: '音乐平台未能确认有效账号，请重新扫码。',
  upstream_rate_limited: '音乐平台暂时繁忙，请稍后重试。',
  upstream_timeout: '音乐平台响应超时，请重试。',
  upstream_error: '音乐平台暂时无法返回数据，请稍后重试。',
}

// 首次访问音乐服务时加载 Axios，并设置该服务的超时与错误处理。
async function loadClient(baseURL: string): Promise<AxiosInstance> {
  const { default: axios } = await import('axios')
  const client = axios.create({
    baseURL,
    timeout: 25_000,
    allowAbsoluteUrls: false,
  })
  client.interceptors.response.use(undefined, (cause: unknown) => {
    if (
      axios.isCancel(cause) ||
      !axios.isAxiosError<{ detail?: { code?: string } }>(cause)
    )
      throw cause
    if (cause.code === 'ECONNABORTED' || cause.code === 'ETIMEDOUT')
      throw new Error('音乐服务响应超时，请重试。')
    if (!cause.response)
      throw new Error('无法连接音乐服务，请检查网络连接后重试。')
    const code = cause.response.data?.detail?.code
    const error = new Error(
      (code && errorMessages[code]) ||
        `音乐服务请求失败（${cause.response.status}）。`
    )
    if (code) error.name = code
    throw error
  })
  return client
}

// 同一地址的请求共用客户端，初始化失败后允许下一次请求重新加载。
export function createRequest(baseURL: string) {
  let pending: Promise<AxiosInstance> | undefined

  // 并发的首批 GET 和 POST 等待同一次初始化。
  function getClient(): Promise<AxiosInstance> {
    return (pending ??= loadClient(baseURL).catch(error => {
      pending = undefined
      throw error
    }))
  }

  // GET 查询参数和取消配置都交给 Axios 转换。
  async function httpGet<T>(
    path: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const client = await getClient()
    return (await client.get<T>(path, config)).data
  }

  // POST 使用统一 JSON 请求头和响应处理。
  async function httpPost<T>(
    path: string,
    body: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const client = await getClient()
    return (await client.post<T>(path, body, config)).data
  }

  return { httpGet, httpPost }
}

const origin = (
  import.meta.env.VITE_APP_BASE_API || 'https://music-api.yxcr.top'
).replace(/\/+$/, '')
export const apiBaseUrl = `${origin}/api/v1`
export const { httpGet, httpPost } = createRequest(apiBaseUrl)
