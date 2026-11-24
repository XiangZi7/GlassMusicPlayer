<script setup lang="ts">
import { computed } from 'vue'
import type { MusicPlatform } from '@/api'
import type { QrLoginProfile } from '@/api/auth'
import type { LoginViewStatus } from '@/services/platform-login'
import { platformNames } from '@/services/player/catalog'
import { rememberPlayback } from '@/services/player/playback-session'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = defineProps<{
  platform: MusicPlatform | null
  supported: boolean
  status: LoginViewStatus
  qrCodeUrl: string
  error: string
  profile: QrLoginProfile | null
  busy: boolean
}>()
const emit = defineEmits<{
  refresh: []
  profile: [input: string]
}>()
const platformLabel = computed(() =>
  props.platform ? platformNames[props.platform] : '音乐平台'
)
const message = computed(() => {
  if (!props.supported)
    return props.platform === 'kugou'
      ? '酷狗账号登录与主页歌单暂未接通。公开歌单仍可用分享链接导入。'
      : '酷我扫码登录暂未接通。请切换主页链接，用个人主页或 UID 读取公开歌单。'
  switch (props.status) {
    case 'creating':
      return '正在向音乐平台申请二维码…'
    case 'waiting':
      return `请使用${platformLabel.value} App 扫码，并在 App 内确认。`
    case 'scanned':
      return `已扫码，请在${platformLabel.value} App 内确认登录。`
    case 'authorized':
      return props.platform === 'kugou'
        ? '酷狗账号已确认，正在关联公开资料。'
        : props.busy
          ? '账号已确认，正在读取公开歌单…'
          : '账号已确认。'
    case 'expired':
      return '二维码已过期，请重新生成后扫码。'
    case 'error':
      return '本次扫码未完成，可以重试或使用公开主页。'
    default:
      return `生成二维码后，使用${platformLabel.value} App 扫码。`
  }
})
const showQr = computed(
  () =>
    props.supported &&
    !!props.qrCodeUrl &&
    (props.status === 'waiting' || props.status === 'scanned')
)
</script>

<template>
  <section
    class="mt-5 text-center"
    aria-label="扫码登录"
  >
    <div
      v-if="showQr"
      class="mx-auto grid size-[212px] place-items-center rounded-[14px] bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,.18)]"
    >
      <img decoding="async" loading="lazy"
        :src="qrCodeUrl"
        :alt="'使用' + platformLabel + ' App 扫描此登录二维码'"
        class="block size-full"
        width="188"
        height="188"
      />
    </div>
    <div
      v-else
      class="mx-auto my-5 grid size-14 place-items-center rounded-full border border-white/10 bg-white/5 text-white/55"
      aria-hidden="true"
    >
      <svg
        v-if="status === 'creating'"
        class="size-6 animate-spin motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          opacity=".2"
        />
        <path
          d="M12 3a9 9 0 0 1 9 9"
          stroke-linecap="round"
        />
      </svg>
      <svg
        v-else-if="status === 'authorized'"
        class="size-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
      <svg
        v-else
        class="size-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      >
        <circle
          cx="12"
          cy="8"
          r="3.5"
        />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </svg>
    </div>
    <p
      class="mt-3 text-[12px] leading-relaxed text-white/75"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </p>
    <p
      v-if="status === 'authorized' && profile"
      class="mt-1 text-[12px] font-bold text-white/90"
    >
      {{ profile.displayName || 'UID ' + profile.userId }}
    </p>
    <p
      v-if="error"
      class="mt-2 text-[12px] leading-relaxed text-red-300"
      role="alert"
    >
      {{ error }}
    </p>
    <BaseButton
      v-if="supported && status === 'authorized' && profile"
      class="mt-2 min-h-11 rounded-full bg-white px-5 text-[12px] font-extrabold text-[#121218]"
      :loading="busy"
      @click="emit('profile', profile.userId)"
      >{{
        busy
          ? '正在读取…'
          : platform === 'kugou'
            ? '确认关联资料'
            : '重试读取公开歌单'
      }}</BaseButton
    >
    <BaseButton
      v-else-if="supported"
      class="mt-2 min-h-11 rounded-full bg-white px-5 text-[12px] font-extrabold text-[#121218] disabled:opacity-40"
      :disabled="status === 'creating' || busy"
      @click="emit('refresh')"
      >{{ showQr ? '刷新二维码' : '生成二维码' }}</BaseButton
    >
    <p
      v-if="supported"
      class="mt-4 mb-0 text-[11px] leading-relaxed text-white/55"
    >
      {{ platform === 'netease'
        ? (rememberPlayback
          ? '扫码后可读取你的网易云每日推荐和会员权益，并在此 Windows 设备上记住登录。'
          : '扫码后，本次会话可读取你的网易云每日推荐和会员权益。')
        : '酷狗扫码可关联公开资料，公开歌单可通过分享链接导入。' }}
    </p>
  </section>
</template>
