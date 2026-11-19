import axios, { type AxiosRequestConfig } from 'axios'

const errorMessages: Readonly<Record<string, string>> = {
  invalid_playlist_url: '无法识别该歌单链接，请粘贴公开歌单详情页地址。',
  not_found: '平台未找到该公开资源。',
  account_authorization_required: '读取该平台的个人歌单需要平台授权。',
  upstream_rate_limited: '音乐平台暂时繁忙，请稍后重试。',
  upstream_timeout: '音乐平台响应超时，请重试。',
  upstream_error: '音乐平台暂时无法返回数据，请稍后重试。',
}

// 创建独立的 Axios 客户端，统一处理超时、取消、服务端错误和响应体解包。
export function createRequest(baseURL: string) {
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
      throw new Error('无法连接音乐服务，请确认 FastAPI 已启动。')
    const code = cause.response.data?.detail?.code
    throw new Error(
      (code && errorMessages[code]) ||
        `音乐服务请求失败（${cause.response.status}）。`
    )
  })

  // GET 查询参数和取消配置都交给 Axios 转换。
  async function httpGet<T>(
    path: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return (await client.get<T>(path, config)).data
  }

  // POST 使用统一 JSON 请求头和响应处理。
  async function httpPost<T>(
    path: string,
    body: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return (await client.post<T>(path, body, config)).data
  }

  return { httpGet, httpPost }
}

const origin = (
  import.meta.env.VITE_APP_BASE_API || 'http://127.0.0.1:8000'
).replace(/\/+$/, '')
export const apiBaseUrl = `${origin}/api/v1`
export const { httpGet, httpPost } = createRequest(apiBaseUrl)
