/**
 * HTTP 请求封装
 * 基于 axios 封装统一的请求/响应拦截、进度条、GET/POST 方法
 */
import axios, {
    AxiosInstance,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios'
import NProgress from '@/config/nprogress'

/** 创建 axios 实例 */
const instance: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_APP_BASE_API,
    timeout: 1000000,
    withCredentials: true,
})

/** 请求拦截器：启动进度条、添加时间戳防缓存 */
instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // 开启进度条
        NProgress.start()
        if (config.params === undefined) {
            config.params = {}
        }
        // 添加或修改params
        Object.assign(config.params, {
            timestamp: Date.now(),
            realIP: '116.25.146.177',
        })
        return config
    },
    (error) => Promise.reject(error)
)

/** 响应拦截器：结束进度条、直接返回 data */
instance.interceptors.response.use(
    (response: AxiosResponse) => {
        const { data } = response

        // 进度条结束
        NProgress.done()
        return data
    },
    (error) => {
        // 响应错误时也结束进度条
        NProgress.done()
        return Promise.reject(error)
    }
)

/** GET 请求 */
export const httpGet = <T>(url: string, params?: object): Promise<T> =>
    instance.get(url, { params })

/** POST 请求 */
export const httpPost = <T>(
    url: string,
    data?: object,
    header?: object
): Promise<T> => instance.post(url, data, header)

/** 文件上传（multipart/form-data） */
export const httpUpload = <T>(
    url: string,
    formData: FormData,
    header?: object
): Promise<T> => {
    return instance.post(url, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            ...header,
        },
    })
}