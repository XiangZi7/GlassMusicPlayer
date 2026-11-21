import {
  computed,
  onBeforeUnmount,
  onDeactivated,
  reactive,
  toRefs,
  watch,
  type Ref,
} from 'vue'
import type { MusicPlatform } from '@/api'
import { qrLoginApi } from '@/api/auth'
import {
  createPlatformLoginFlow,
  createPlatformLoginState,
} from '@/services/platform-login'

// 弹窗负责呈现、流程负责串行轮询；切换方式、平台和缓存路由时立即释放短期扫码会话。
export function usePlatformQrLogin(
  platform: Ref<MusicPlatform | null>,
  enabled: Ref<boolean>
) {
  // 响应式状态：所有字段只用于当前弹窗，不保存账号凭证。
  const state = reactive(createPlatformLoginState())
  const flow = createPlatformLoginFlow(state, qrLoginApi)
  const supported = computed(
    () => platform.value === 'netease' || platform.value === 'kugou'
  )
  function refresh(): void {
    if (enabled.value && platform.value && supported.value)
      void flow.start(platform.value)
  }
  watch(
    [enabled, platform],
    ([visible]) => {
      if (visible && supported.value) refresh()
      else flow.cancel()
    },
    { immediate: true }
  )
  onBeforeUnmount(flow.cancel)
  onDeactivated(flow.cancel)
  return { ...toRefs(state), supported, refresh, cancel: flow.cancel }
}
