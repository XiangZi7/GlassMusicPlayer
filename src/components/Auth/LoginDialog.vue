<script setup lang="ts">
// 登录对话框：支持密码登录与二维码登录，成功后写入用户 Store
import {
  loginCellphone,
  loginEmail,
  qrLoginKey,
  qrLoginCreate,
  qrLoginCheck,
  loginStatus,
} from '@/api'
import { useUserStore } from '@/stores/modules/user'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const emit = defineEmits<{ (e: 'close'): void; (e: 'success'): void }>()
const userStore = useUserStore()
const visible = ref(true)
const loginSuccess = ref(false)

// UI 状态
const state = reactive({
  tab: 'password' as 'password' | 'qr',
  loading: false,
  // 密码登录（手机号或邮箱）
  phone: '',
  email: '',
  password: '',
  useEmail: false,
  // 二维码登录
  qrKey: '',
  qrImg: '',
  qrPolling: false,
  qrStatusText: '请使用网易云音乐 App 扫码',
  qrUser: null as null | { avatarUrl: string; nickname: string; message?: string },
})
const { tab, loading, phone, email, password, useEmail, qrImg, qrStatusText } = toRefs(state)

// 生成二维码
const genQr = async () => {
  try {
    state.loading = true
    const keyRes: any = await qrLoginKey()
    const key: string = keyRes?.data?.unikey || keyRes?.data?.key || ''
    state.qrKey = key
    const createRes: any = await qrLoginCreate({ key, qrimg: true })
    state.qrImg = createRes?.data?.qrimg || ''
    state.qrStatusText = '请使用网易云音乐 App 扫码'
    state.qrUser = null
    pollQr()
  } finally {
    state.loading = false
  }
}

// 轮询二维码状态
let qrTimer: any = null
const pollQr = () => {
  if (!state.qrKey || state.qrPolling) return
  state.qrPolling = true
  const tick = async () => {
    try {
      const res: any = await qrLoginCheck({ key: state.qrKey })
      const code = res?.code
      if (code === 800) {
        state.qrStatusText = '二维码已过期，点击刷新'
        state.qrUser = null
        await genQr()
      } else if (code === 802) {
        const msg = res?.message || res?.data?.message || '已扫码，等待确认'
        const avatarUrl = res?.avatarUrl || res?.data?.avatarUrl || ''
        const nickname = res?.nickname || res?.data?.nickname || ''
        state.qrStatusText = String(msg)
        state.qrUser = {
          avatarUrl: String(avatarUrl),
          nickname: String(nickname),
          message: String(msg),
        }
      } else if (code === 803) {
        state.qrStatusText = '登录成功'
        await fetchLoginStatus()
        state.qrPolling = false
        clearInterval(qrTimer)
        loginSuccess.value = true
        visible.value = false
      }
    } catch {}
  }
  tick()
  qrTimer = setInterval(tick, 3000)
}

// 密码登录
const doPasswordLogin = async () => {
  if ((!state.useEmail && !state.phone) || (state.useEmail && !state.email) || !state.password)
    return
  try {
    state.loading = true
    if (state.useEmail) {
      await loginEmail({ email: state.email, password: state.password })
    } else {
      await loginCellphone({ phone: state.phone, password: state.password })
    }
    await fetchLoginStatus()
    loginSuccess.value = true
    visible.value = false
  } finally {
    state.loading = false
  }
}

// 获取登录状态并写入用户信息
const fetchLoginStatus = async () => {
  const statusRes: any = await loginStatus()
  const profile = statusRes?.data?.profile || statusRes?.profile || statusRes?.account?.profile
  if (profile) {
    userStore.setUser({
      userId: Number(profile.userId || profile.uid || 0),
      nickname: String(profile.nickname || ''),
      avatarUrl: String(profile.avatarUrl || ''),
      vipType: Number(profile.vipType || 0),
    })
  }
}

onMounted(() => {})

onUnmounted(() => {
  if (qrTimer) clearInterval(qrTimer)
})

const handleAfterLeave = () => {
  if (loginSuccess.value) emit('success')
  emit('close')
  loginSuccess.value = false
}

const stopQrPolling = () => {
  if (qrTimer) clearInterval(qrTimer)
  qrTimer = null
  state.qrPolling = false
}

watch(tab, async t => {
  if (t === 'qr') {
    await genQr()
  } else {
    stopQrPolling()
  }
})

watch(visible, v => {
  if (!v) {
    stopQrPolling()
  }
})
</script>
<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <Transition name="mask" appear>
      <div v-if="visible" class="absolute inset-0 bg-black/50" @click="visible = false"></div>
    </Transition>
    <Transition name="dialog" appear @after-leave="handleAfterLeave">
      <div v-if="visible" class="relative z-10 w-[640px] max-w-[92vw] overflow-hidden rounded-3xl">
        <div class="absolute inset-0 -z-10 opacity-30 blur-2xl"></div>
        <div class="glass-container-strong relative rounded-3xl p-8">
          <button
            class="glass-button absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full"
            @click="visible = false"
          >
            <span class="icon-[mdi--close] text-primary h-5 w-5"></span>
          </button>

          <div class="mb-6 text-center">
            <div
              class="bg-hover-glass mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            >
              <span class="icon-[mdi--account-circle] text-primary h-7 w-7"></span>
            </div>
            <h3 class="text-primary text-xl font-semibold">{{ t('auth.login') }}</h3>
            <p class="text-dropdown-glass mt-1 text-sm opacity-80">{{ t('auth.tip') || '请选择登录方式以继续' }}</p>
          </div>

          <div class="mb-6 flex items-center justify-center">
            <div class="glass-nav inline-flex gap-2 rounded-2xl p-2">
              <button
                class="glass-button px-4 py-2 text-sm"
                :class="
                  tab === 'password'
                    ? 'bg-hover-glass text-primary ring-1 ring-pink-300/40'
                    : 'text-dropdown-glass opacity-80'
                "
                @click="tab = 'password'"
              >
                {{ t('auth.passwordLogin') || '密码登录' }}
              </button>
              <button
                class="glass-button px-4 py-2 text-sm"
                :class="
                  tab === 'qr'
                    ? 'bg-hover-glass text-primary ring-1 ring-pink-300/40'
                    : 'text-dropdown-glass opacity-80'
                "
                @click="tab = 'qr'"
              >
                {{ t('auth.qrLogin') || '二维码登录' }}
              </button>
            </div>
          </div>

          <Transition name="tab-fade" mode="out-in">
            <div v-if="tab === 'password'" key="pwd" class="space-y-4">
              <div class="flex justify-center">
                <div class="glass-nav mx-auto flex w-64 gap-2 overflow-hidden rounded-full p-1">
                  <button
                    class="glass-button flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm"
                    :class="
                      !useEmail
                        ? 'bg-hover-glass text-primary ring-1 ring-pink-300/40'
                        : 'text-dropdown-glass opacity-80'
                    "
                    @click="useEmail = false"
                  >
                    <span class="icon-[mdi--cellphone] h-4 w-4"></span>
                    <span>{{ t('auth.phone') || '手机号' }}</span>
                  </button>
                  <button
                    class="glass-button flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm"
                    :class="
                      useEmail
                        ? 'bg-hover-glass text-primary ring-1 ring-pink-300/40'
                        : 'text-dropdown-glass opacity-80'
                    "
                    @click="useEmail = true"
                  >
                    <span class="icon-[mdi--email] h-4 w-4"></span>
                    <span>{{ t('auth.email') || '邮箱' }}</span>
                  </button>
                </div>
              </div>

              <div class="space-y-3">
                <label class="text-dropdown-glass block text-xs opacity-80">{{ useEmail ? (t('auth.email') || '邮箱') : (t('auth.phone') || '手机号') }}</label>
                <template v-if="!useEmail">
                  <div
                    class="glass-card flex items-center gap-2 px-4 py-3 ring-0 focus-within:ring-2 focus-within:ring-pink-300/40"
                  >
                    <span
                      class="icon-[mdi--cellphone] text-dropdown-glass h-5 w-5 opacity-80"
                    ></span>
                    <input
                      v-model="phone"
                      type="tel"
                      :placeholder="t('auth.inputPhone') || '请输入手机号'"
                      class="text-primary flex-1 bg-transparent text-sm placeholder-white/40 outline-none"
                    />
                  </div>
                </template>
                <template v-else>
                  <div
                    class="glass-card flex items-center gap-2 px-4 py-3 ring-0 focus-within:ring-2 focus-within:ring-pink-300/40"
                  >
                    <span class="icon-[mdi--email] text-dropdown-glass h-5 w-5 opacity-80"></span>
                    <input
                      v-model="email"
                      type="email"
                      :placeholder="t('auth.inputEmail') || '请输入邮箱'"
                      class="text-primary flex-1 bg-transparent text-sm placeholder-white/40 outline-none"
                    />
                  </div>
                </template>
              </div>

              <div class="space-y-3">
                <label class="text-dropdown-glass block text-xs opacity-80">{{ t('auth.password') || '密码' }}</label>
                <div
                  class="glass-card flex items-center gap-2 px-4 py-3 ring-0 focus-within:ring-2 focus-within:ring-purple-300/40"
                >
                  <span class="icon-[mdi--lock] text-dropdown-glass h-5 w-5 opacity-80"></span>
                  <input
                    v-model="password"
                    type="password"
                      :placeholder="t('auth.inputPassword') || '请输入密码'"
                    class="text-primary flex-1 bg-transparent text-sm placeholder-white/40 outline-none"
                  />
                </div>
              </div>

              <div class="mt-4">
                <button
                  class="flex w-full items-center justify-center rounded-2xl bg-linear-to-r from-pink-500 to-purple-600 px-4 py-3 text-sm font-medium text-primary shadow-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-pink-500/25 disabled:opacity-60"
                  :disabled="loading || (!useEmail && !phone) || (useEmail && !email) || !password"
                  @click="doPasswordLogin"
                >
                  {{ t('auth.login') }}
                </button>
              </div>
            </div>

            <div v-else key="qr" class="space-y-4">
              <div class="mx-auto w-80 rounded-lg">
                <div class="flex flex-col items-center space-y-4 p-6 pt-0">
                  <div class="relative">
                    <img v-if="qrImg" :src="qrImg" :alt="t('auth.qr') || '二维码'" class="h-52 w-52" />
                    <div v-else class="animate-shimmer h-52 w-52 rounded-lg bg-white/10"></div>
                    <div
                      v-if="state.qrUser?.avatarUrl"
                      class="absolute inset-0 flex items-center justify-center bg-black/70"
                    >
                      <span class="relative flex h-20 w-20 shrink-0 overflow-hidden rounded-full">
                        <img
                          v-if="state.qrUser?.avatarUrl"
                          class="aspect-square h-full w-full"
                          :alt="state.qrUser?.nickname"
                          :src="state.qrUser?.avatarUrl"
                        />
                      </span>
                    </div>
                  </div>
                  <p class="text-primary text-center text-sm">
                    {{ state.qrUser?.message || qrStatusText || (t('common.loading') + '...') }}
                  </p>
                  <div class="text-center" v-if="state.qrUser?.nickname">
                    <p class="text-primary font-semibold">{{ state.qrUser?.nickname }}</p>
                  </div>
                  <button
                    class="glass-button text-primary hover:bg-hover-glass rounded-xl px-4 py-2 text-sm"
                    :disabled="loading"
                    @click="genQr"
                  >
                    {{ t('auth.refreshQr') || '刷新二维码' }}
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: all 0.25s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.mask-enter-active,
.mask-leave-active {
  transition: opacity 0.25s ease;
}
.mask-enter-from,
.mask-leave-to {
  opacity: 0;
}
</style>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
