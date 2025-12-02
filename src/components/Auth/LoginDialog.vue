<script setup lang="ts">
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

const state = reactive({
  tab: 'password' as 'password' | 'qr',
  loading: false,
  phone: '',
  email: '',
  password: '',
  useEmail: false,
  qrKey: '',
  qrImg: '',
  qrPolling: false,
  qrStatusText: '请使用网易云音乐 App 扫码',
  qrUser: null as null | { avatarUrl: string; nickname: string; message?: string },
})
const { tab, loading, phone, email, password, useEmail, qrImg, qrStatusText } = toRefs(state)

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
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <Transition name="mask" appear>
      <div v-if="visible" class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="visible = false" />
    </Transition>

    <Transition name="dialog" appear @after-leave="handleAfterLeave">
      <div v-if="visible" class="relative z-10 w-full max-w-xl">
        <div class="glass-container-strong overflow-hidden">
          <button
            class="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20"
            @click="visible = false"
          >
            <span class="icon-[mdi--close] text-primary h-4 w-4" />
          </button>

          <div class="relative p-6 pb-4">
            <div class="mb-6 flex items-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/25">
                <span class="icon-[mdi--account-circle] h-6 w-6 text-white" />
              </div>
              <div>
                <h2 class="text-primary text-xl font-bold">{{ t('auth.login') }}</h2>
                <p class="text-primary/50 mt-0.5 text-sm">{{ t('auth.tip') || '登录以享受完整功能' }}</p>
              </div>
            </div>

            <div class="glass-nav mb-6 inline-flex w-full gap-1 rounded-xl p-1">
              <button
                class="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
                :class="tab === 'password' ? 'bg-white/15 text-primary shadow-sm' : 'text-primary/60 hover:text-primary/80'"
                @click="tab = 'password'"
              >
                <span class="icon-[mdi--form-textbox-password] h-4 w-4" />
                {{ t('auth.passwordLogin') || '密码登录' }}
              </button>
              <button
                class="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
                :class="tab === 'qr' ? 'bg-white/15 text-primary shadow-sm' : 'text-primary/60 hover:text-primary/80'"
                @click="tab = 'qr'"
              >
                <span class="icon-[mdi--qrcode-scan] h-4 w-4" />
                {{ t('auth.qrLogin') || '扫码登录' }}
              </button>
            </div>
          </div>

          <Transition name="tab-fade" mode="out-in">
            <div v-if="tab === 'password'" key="pwd" class="px-6 pb-6">
              <div class="mb-5 flex justify-center">
                <div class="glass-nav inline-flex gap-1 rounded-full p-1">
                  <button
                    class="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all"
                    :class="!useEmail ? 'bg-white/15 text-primary' : 'text-primary/60 hover:text-primary/80'"
                    @click="useEmail = false"
                  >
                    <span class="icon-[mdi--cellphone] h-3.5 w-3.5" />
                    {{ t('auth.phone') || '手机号' }}
                  </button>
                  <button
                    class="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all"
                    :class="useEmail ? 'bg-white/15 text-primary' : 'text-primary/60 hover:text-primary/80'"
                    @click="useEmail = true"
                  >
                    <span class="icon-[mdi--email-outline] h-3.5 w-3.5" />
                    {{ t('auth.email') || '邮箱' }}
                  </button>
                </div>
              </div>

              <div class="space-y-4">
                <div class="space-y-2">
                  <label class="text-primary/60 block text-xs font-medium">
                    {{ useEmail ? (t('auth.email') || '邮箱') : (t('auth.phone') || '手机号') }}
                  </label>
                  <div class="glass-card group flex items-center gap-3 rounded-xl px-4 py-3 transition-all focus-within:ring-2 focus-within:ring-pink-400/50">
                    <span :class="useEmail ? 'icon-[mdi--email-outline]' : 'icon-[mdi--cellphone]'" class="text-primary/40 h-5 w-5 transition-colors group-focus-within:text-pink-400" />
                    <input
                      v-if="!useEmail"
                      v-model="phone"
                      type="tel"
                      :placeholder="t('auth.inputPhone') || '请输入手机号'"
                      class="text-primary w-full bg-transparent text-sm outline-none placeholder:text-white/30"
                    />
                    <input
                      v-else
                      v-model="email"
                      type="email"
                      :placeholder="t('auth.inputEmail') || '请输入邮箱'"
                      class="text-primary w-full bg-transparent text-sm outline-none placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div class="space-y-2">
                  <label class="text-primary/60 block text-xs font-medium">{{ t('auth.password') || '密码' }}</label>
                  <div class="glass-card group flex items-center gap-3 rounded-xl px-4 py-3 transition-all focus-within:ring-2 focus-within:ring-purple-400/50">
                    <span class="icon-[mdi--lock-outline] text-primary/40 h-5 w-5 transition-colors group-focus-within:text-purple-400" />
                    <input
                      v-model="password"
                      type="password"
                      :placeholder="t('auth.inputPassword') || '请输入密码'"
                      class="text-primary w-full bg-transparent text-sm outline-none placeholder:text-white/30"
                    />
                  </div>
                </div>
              </div>

              <button
                class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-pink-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:shadow-xl hover:shadow-pink-500/30 disabled:opacity-50 disabled:shadow-none"
                :disabled="loading || (!useEmail && !phone) || (useEmail && !email) || !password"
                @click="doPasswordLogin"
              >
                <span v-if="loading" class="icon-[mdi--loading] h-4 w-4 animate-spin" />
                <span v-else class="icon-[mdi--login] h-4 w-4" />
                {{ loading ? (t('common.loading') || '登录中...') : t('auth.login') }}
              </button>
            </div>

            <div v-else key="qr" class="px-6 pb-6">
              <div class="flex flex-col items-center">
                <div class="relative mb-4">
                  <div class="overflow-hidden rounded-2xl bg-white p-3 shadow-xl">
                    <img v-if="qrImg" :src="qrImg" :alt="t('auth.qr') || '二维码'" class="h-44 w-44" />
                    <div v-else class="flex h-44 w-44 items-center justify-center">
                      <span class="icon-[mdi--loading] h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  </div>
                  <Transition name="fade">
                    <div v-if="state.qrUser?.avatarUrl" class="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/80 backdrop-blur-sm">
                      <div class="flex flex-col items-center gap-2">
                        <img :src="state.qrUser.avatarUrl" :alt="state.qrUser.nickname" class="h-16 w-16 rounded-full ring-2 ring-white/20" />
                        <span class="text-primary text-sm font-medium">{{ state.qrUser.nickname }}</span>
                      </div>
                    </div>
                  </Transition>
                </div>

                <div class="mb-4 text-center">
                  <p class="text-primary/80 text-sm">{{ state.qrUser?.message || qrStatusText || (t('common.loading') + '...') }}</p>
                  <p v-if="state.qrUser?.nickname && !state.qrUser?.message" class="text-primary mt-1 font-medium">{{ state.qrUser.nickname }}</p>
                </div>

                <button
                  class="glass-button flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm transition-all hover:bg-white/15"
                  :disabled="loading"
                  @click="genQr"
                >
                  <span :class="loading ? 'icon-[mdi--loading] animate-spin' : 'icon-[mdi--refresh]'" class="text-primary h-4 w-4" />
                  <span class="text-primary">{{ t('auth.refreshQr') || '刷新二维码' }}</span>
                </button>
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all 0.2s ease;
}
.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.mask-enter-active,
.mask-leave-active {
  transition: opacity 0.3s ease;
}
.mask-enter-from,
.mask-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
