// 基础响应类型
export type BaseResponse<T> = {
    ret: boolean
    msg: string
    data: T
    code?: number
}
