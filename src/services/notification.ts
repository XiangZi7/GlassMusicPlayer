import { reactive } from 'vue'

export const notification = reactive({
  message: '',
  type: 'info' as 'info' | 'error',
})
let timeout: ReturnType<typeof setTimeout>

// 统一展示操作反馈，新的通知替换上一条并在四秒后自动收起。
export function notify(message: string, type: 'info' | 'error' = 'info'): void {
  clearTimeout(timeout)
  notification.message = message
  notification.type = type
  timeout = setTimeout(() => {
    notification.message = ''
  }, 4000)
}
