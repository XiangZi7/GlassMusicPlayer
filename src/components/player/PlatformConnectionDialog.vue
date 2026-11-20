<script setup lang="ts">
import {
  computed,
  nextTick,
  reactive,
  toRefs,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import type { MusicPlatform } from '@/api'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlatformIcon from '@/components/player/PlatformIcon.vue'
import { platformNames } from '@/services/player/catalog'

const props = withDefaults(
  defineProps<{
    platform: MusicPlatform | null
    busy?: boolean
    error?: string
    initialValue?: string
    loginSupported?: boolean
    loginMessage?: string
  }>(),
  {
    busy: false,
    error: '',
    initialValue: '',
    loginSupported: false,
    loginMessage: '账号登录接口正在接入，当前不会生成假二维码或标记已登录。',
  }
)
const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  profile: [input: string]
  login: []
  clearError: []
}>()
const id = useId()
const titleId = `${id}-title`
const descriptionId = `${id}-description`
const errorId = `${id}-error`
const inputId = `${id}-profile`
const profileField = useTemplateRef<HTMLInputElement>('profileField')
const platformLabel = computed(() =>
  props.platform ? platformNames[props.platform] : '音乐平台'
)
const profileSupported = computed(
  () => !!props.platform && props.platform !== 'kugou'
)

// 响应式状态
const state = reactive({
  // 当前选中的连接方式。
  mode: 'profile' as 'profile' | 'login',
  // 用户填写的个人主页链接或 UID，不保存账号密码。
  draft: '',
})
const { mode, draft } = toRefs(state)

watch(open, visible => {
  if (!visible) return
  state.mode = 'profile'
  state.draft = props.initialValue
  emit('clearError')
})
watch(
  [open, () => state.mode],
  async ([visible]) => {
    if (!visible) return
    emit('clearError')
    await nextTick()
    if (open.value && state.mode === 'profile' && profileSupported.value)
      profileField.value?.focus()
  },
  { flush: 'post' }
)

function submitProfile(): void {
  if (props.busy || !profileSupported.value || !state.draft.trim()) return
  emit('profile', state.draft.trim())
}
</script>

<template>
  <BaseDialog
    id="platform-connection-dialog"
    v-model="open"
    :labelled-by="titleId"
    :described-by="descriptionId"
  >
    <div class="p-6">
      <header class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <PlatformIcon
            v-if="platform"
            :platform="platform"
          />
          <div>
            <h2
              :id="titleId"
              class="m-0 text-[18px] font-extrabold"
            >
              连接{{ platformLabel }}
            </h2>
            <p
              :id="descriptionId"
              class="mt-1 mb-0 text-[12px] leading-relaxed text-white/55"
            >
              选择连接方式，读取用户资料与歌单。
            </p>
          </div>
        </div>
        <BaseButton
          class="grid size-8 flex-none place-items-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label="关闭连接弹窗"
          @click="open = false"
        >
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </BaseButton>
      </header>

      <fieldset
        class="mt-5 grid grid-cols-2 gap-2 border-0 p-0"
        aria-label="连接方式"
      >
        <label
          class="flex cursor-pointer items-center gap-2.5 rounded-[14px] border px-3.5 py-3 text-[13px] font-bold transition-colors focus-within:ring-2 focus-within:ring-white/60"
          :class="
            mode === 'login'
              ? 'border-white/30 bg-white/10'
              : 'border-white/10 hover:bg-white/5'
          "
        >
          <input
            v-model="mode"
            :name="id + '-mode'"
            class="sr-only"
            type="radio"
            value="login"
            :disabled="busy"
          />
          <svg
            class="size-4.5 flex-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="8"
              r="3.5"
            />
            <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
          </svg>
          登录平台
        </label>
        <label
          class="flex cursor-pointer items-center gap-2.5 rounded-[14px] border px-3.5 py-3 text-[13px] font-bold transition-colors focus-within:ring-2 focus-within:ring-white/60"
          :class="
            mode === 'profile'
              ? 'border-white/30 bg-white/10'
              : 'border-white/10 hover:bg-white/5'
          "
        >
          <input
            v-model="mode"
            :name="id + '-mode'"
            class="sr-only"
            type="radio"
            value="profile"
            :disabled="busy"
          />
          <svg
            class="size-4.5 flex-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path
              d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"
            />
          </svg>
          主页链接
        </label>
      </fieldset>

      <form
        v-if="mode === 'profile'"
        class="mt-5"
        @submit.prevent="submitProfile"
      >
        <template v-if="profileSupported">
          <label
            :for="inputId"
            class="mb-2 block text-[12px] font-bold text-white/75"
            >个人主页链接或 UID</label
          >
          <input
            :id="inputId"
            ref="profileField"
            v-model="draft"
            class="w-full rounded-[12px] border border-white/15 bg-black/15 px-3.5 py-3 text-[13px] text-white transition-colors outline-none placeholder:text-white/35 focus:border-white/45"
            type="text"
            placeholder="粘贴个人主页链接，或输入数字 UID"
            autocomplete="off"
            :disabled="busy"
            :aria-invalid="!!error"
            :aria-describedby="error ? errorId : undefined"
            @input="emit('clearError')"
          />
          <p class="mt-2 mb-0 text-[11.5px] leading-relaxed text-white/45">
            只读取公开资料与歌单，不需要填写账号密码。
          </p>
        </template>
        <p
          v-else
          class="text-[12px] leading-relaxed text-white/60"
        >
          酷狗主页歌单需要账户授权，请使用登录方式。公开歌单分享链接仍可在页面下方导入。
        </p>
        <p
          v-if="error"
          :id="errorId"
          role="alert"
          class="mt-3 mb-0 text-[12px] leading-relaxed text-red-300"
        >
          {{ error }}
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <BaseButton
            class="min-h-9 rounded-full border border-white/15 px-4 text-[12px] font-bold text-white/75"
            @click="open = false"
            >取消</BaseButton
          >
          <BaseButton
            type="submit"
            class="flex min-h-9 items-center justify-center gap-2 rounded-full border-0 bg-white px-5 text-[12px] font-extrabold text-[#121218] disabled:opacity-40"
            :disabled="!profileSupported || !draft.trim()"
            :loading="busy"
            >{{ busy ? '正在读取…' : '读取资料与歌单' }}</BaseButton
          >
        </div>
      </form>
      <div
        v-else
        class="mt-5 text-center"
      >
        <svg
          class="mx-auto my-5 size-12 text-white/35"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6z" />
        </svg>
        <p class="text-[12px] leading-relaxed text-white/60">
          {{ loginMessage }}
        </p>
        <BaseButton
          class="mt-2 min-h-9 rounded-full bg-white px-5 text-[12px] font-extrabold text-[#121218] disabled:opacity-35"
          :disabled="!loginSupported || busy"
          @click="emit('login')"
          >扫码登录{{ platformLabel }}</BaseButton
        >
      </div>
    </div>
  </BaseDialog>
</template>
