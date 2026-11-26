<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, useId } from 'vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import BaseButton from '@/components/ui/BaseButton.vue'
import { notify } from '@/services/notification'
import { platformNames } from '@/services/player/catalog'
import {
  beginTuneWeaveLogin,
  cancelTuneWeaveLogin,
  finishTuneWeaveLogin,
  logoutTuneWeave,
  kugouEditionNames,
  tuneWeaveAccounts,
  tuneWeaveDesktop,
  type KugouEdition,
  type TuneWeavePlatform,
} from '@/services/player/tuneweave-session'

const props = defineProps<{ platform: TuneWeavePlatform }>()
const id = useId()
const setupUrl = 'https://github.com/MOPELotus/TuneWeave#快速开始'
const account = computed(() => tuneWeaveAccounts[props.platform])
const name = computed(() => platformNames[props.platform])
const state = reactive({
  /** 用户此次选择的酷狗 App 版本。 */
  edition: 'standard' as KugouEdition,
  /** 已登录时区分更换版本与为概念版追加同账号的标准版授权。 */
  intent: 'login' as 'login' | 'replace' | 'supplement',
  /** 酷我发送验证码时使用的大陆手机号。 */
  phone: '',
  /** 本次验证码随面板关闭或提交清除。 */
  code: '',
  /** 酷我要求本人明确确认未注册号码的处理方式。 */
  allowCreation: false,
  /** 当前原生登录事务，只用于本次扫码或验证。 */
  transaction: '',
  /** 本机编码生成的二维码图片。 */
  qr: '',
  /** 酷狗已扫码、正在等待手机确认。 */
  scanned: false,
  /** 当前按钮触发的用户操作。 */
  busy: '' as '' | 'starting' | 'verifying' | 'logout',
})
const editionName = computed(() => kugouEditionNames[state.edition])
let generation = 0
let poll: ReturnType<typeof setTimeout> | undefined
let expiry: ReturnType<typeof setTimeout> | undefined

// 结束当前二维码或短信流程，并使迟到的响应不能重新打开旧流程。
function cancelChallenge(): void {
  generation++
  clearTimeout(poll)
  clearTimeout(expiry)
  if (state.transaction)
    void cancelTuneWeaveLogin(props.platform, state.transaction).catch(() => {})
  state.transaction = ''
  state.qr = ''
  state.scanned = false
  state.intent = 'login'
  state.code = ''
  state.busy = ''
}

// 统一通过播放器通知反馈连接、验证及注销错误。
function showError(error: unknown): void {
  notify(
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '收藏服务连接失败，请重试。',
    'error'
  )
}

// 桌面端在系统浏览器打开 TuneWeave 项目的本机启动说明。
function openSetup(event: MouseEvent): void {
  if (!tuneWeaveDesktop) return
  event.preventDefault()
  void openUrl(setupUrl).catch(() =>
    notify('无法打开 TuneWeave 安装说明。', 'error')
  )
}

// 酷狗定时查询手机确认结果；酷我只在用户提交验证码时核验一次。
async function verify(): Promise<void> {
  const version = generation
  const platform = props.platform
  if (!state.transaction || state.busy) return
  if (platform === 'kuwo') {
    if (!/^\d{5}$/.test(state.code)) return
    state.busy = 'verifying'
  }
  try {
    const status = await finishTuneWeaveLogin(
      platform,
      state.transaction,
      platform === 'kuwo' ? state.code : undefined,
      () => version === generation
    )
    if (version !== generation) return
    if (status === 'confirmed') {
      state.transaction = ''
      cancelChallenge()
      state.phone = ''
      state.allowCreation = false
      return
    }
    if (
      platform === 'kugou' &&
      (status === 'waiting' || status === 'scanned')
    ) {
      state.scanned = status === 'scanned'
      poll = setTimeout(verify, 2500)
      return
    }
    throw new Error(
      status === 'expired'
        ? '本次登录已过期，请重新获取。'
        : '平台未确认本次登录，请重新获取。'
    )
  } catch (error) {
    if (version !== generation) return
    cancelChallenge()
    showError(error)
  }
}

// 明确点击后才联系本机服务，迟到的事务立即取消，二维码始终在设备本地显示。
async function start(): Promise<void> {
  const platform = props.platform
  if (
    state.busy ||
    !tuneWeaveDesktop ||
    (account.value && state.intent === 'login') ||
    state.transaction
  )
    return
  if (
    platform === 'kuwo' &&
    (!/^1\d{10}$/.test(state.phone.trim()) || !state.allowCreation)
  )
    return
  const version = ++generation
  state.busy = 'starting'
  try {
    const challenge = await beginTuneWeaveLogin(
      platform === 'kuwo'
        ? {
            platform,
            phone: state.phone.trim(),
            allowAccountCreation: state.allowCreation,
          }
        : {
            platform,
            edition: state.edition,
            forConceptFavorites: state.intent === 'supplement',
          }
    )
    if (version !== generation) {
      void cancelTuneWeaveLogin(platform, challenge.transactionId).catch(
        () => {}
      )
      return
    }
    state.transaction = challenge.transactionId
    if (platform === 'kugou') {
      if (challenge.qrImage?.startsWith('data:image/png;base64,'))
        state.qr = challenge.qrImage
      else if (challenge.qrUrl) {
        const { renderSVG } = await import('uqr')
        if (version !== generation) return
        state.qr =
          'data:image/svg+xml;charset=utf-8,' +
          encodeURIComponent(renderSVG(challenge.qrUrl, { border: 4 }))
      } else throw new Error('酷狗未返回可用二维码，请重新获取。')
      poll = setTimeout(verify, 2500)
    }
    if (challenge.expiresIn && challenge.expiresIn > 0)
      expiry = setTimeout(() => {
        if (version !== generation) return
        cancelChallenge()
        notify('本次登录已过期，请重新获取。')
      }, challenge.expiresIn * 1000)
  } catch (error) {
    if (version !== generation) return
    cancelChallenge()
    showError(error)
  } finally {
    if (version === generation) state.busy = ''
  }
}

// 选择切换版本时保留当前会话；追加授权只发起同账号的标准版扫码。
function startKugouAuthorization(intent: 'replace' | 'supplement'): void {
  if (state.busy || props.platform !== 'kugou' || !account.value) return
  state.intent = intent
  state.edition =
    intent === 'supplement' || account.value.edition === 'concept'
      ? 'standard'
      : 'concept'
  if (intent === 'supplement') void start()
}

// 退出后只结束当前平台红心同步，其他平台与本地歌单保留各自状态。
async function logout(): Promise<void> {
  if (state.busy) return
  state.busy = 'logout'
  try {
    await logoutTuneWeave(props.platform)
  } catch (error) {
    showError(error)
  } finally {
    state.busy = ''
  }
}

// 离开弹窗、切换平台或连接方式时停止等待，不留后台轮询。
onBeforeUnmount(cancelChallenge)
</script>

<template>
  <section
    class="favorite-login mt-5"
    :aria-label="name + '收藏授权'"
  >
    <Transition
      name="favorite-stage"
      mode="out-in"
    >
      <div
        v-if="account && state.intent === 'login'"
        key="account"
      >
        <p class="m-0 text-[13px] font-bold break-words">
          {{ account.displayName || name + '用户' }} · UID {{ account.userId }}
        </p>
        <p class="mt-2 text-[12px] leading-relaxed text-white/65">
          <template v-if="platform === 'kugou' && account.edition"
            >{{ kugouEditionNames[account.edition] }} ·
          </template>
          {{
            account.canAddFavorites
              ? '喜欢和取消喜欢会同步到此账号。'
              : '可查看收藏。若系统歌单仍名为「我喜欢」，可以取消其中只出现一次的歌曲。授权同账号标准版后可双向同步。'
          }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <BaseButton
            v-if="account.edition === 'concept' && !account.canAddFavorites"
            class="favorite-action primary"
            @click="startKugouAuthorization('supplement')"
            >授权同账号标准版同步收藏</BaseButton
          >
          <BaseButton
            v-if="platform === 'kugou'"
            class="favorite-action"
            :disabled="!!state.busy"
            @click="startKugouAuthorization('replace')"
            >切换到{{
              account.edition === 'concept' ? '标准版' : '概念版'
            }}</BaseButton
          >
          <BaseButton
            class="favorite-action"
            :loading="state.busy === 'logout'"
            @click="logout"
            >退出收藏账号</BaseButton
          >
        </div>
      </div>
      <p
        v-else-if="!tuneWeaveDesktop"
        class="m-0 text-[12px] leading-relaxed text-white/70"
      >
        请在 MiraiPlayer 桌面版连接本机 TuneWeave 服务，登录后即可同步{{
          name
        }}收藏。
        <a
          :href="setupUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="underline underline-offset-2"
          @click="openSetup"
          >安装说明</a
        >
      </p>
      <div
        v-else
        key="login"
      >
        <p class="mt-0 mb-3 text-[12px] leading-relaxed text-white/65">
          先在本机启动 TuneWeave（127.0.0.1:7832）。登录后，点爱心会更新此{{
            name
          }}账号的收藏，退出播放器后需重新登录。
          <a
            :href="setupUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="underline underline-offset-2"
            @click="openSetup"
            >安装说明</a
          >
        </p>
        <template v-if="platform === 'kugou'">
          <p
            v-if="state.intent === 'supplement'"
            class="my-2 text-[12px] leading-relaxed text-white/80"
          >
            请用酷狗标准版登录同一账号（UID
            {{
              account?.userId
            }}）。确认两端的喜欢歌单相同后，喜欢与取消喜欢都会同步到该歌单。
          </p>
          <fieldset
            v-else
            class="mb-3 flex flex-wrap gap-2 border-0 p-0"
            :disabled="!!state.transaction || !!state.busy"
          >
            <legend class="mb-2 text-[12px] font-bold">酷狗版本</legend>
            <label
              v-for="(label, edition) in kugouEditionNames"
              :key="edition"
              class="favorite-edition"
              :class="{ active: state.edition === edition }"
            >
              <input
                v-model="state.edition"
                :name="id + '-edition'"
                type="radio"
                :value="edition"
                class="sr-only"
              />{{ label }}
            </label>
          </fieldset>
          <p
            v-if="state.edition === 'concept'"
            class="my-2 text-[12px] leading-relaxed text-white/70"
          >
            概念版可读取收藏。若系统歌单仍名为「我喜欢」，可以取消其中只出现一次的歌曲。登录后可授权同账号标准版，开启双向同步。
          </p>
          <img
            v-if="state.qr"
            :src="state.qr"
            class="mx-auto size-48 rounded-[12px] bg-white p-2"
            width="192"
            height="192"
            :alt="'请使用酷狗' + editionName + ' App 扫码确认收藏账号'"
          />
          <p
            v-if="state.qr"
            role="status"
            class="mt-2 text-center text-[12px] text-white/75"
          >
            {{
              state.scanned
                ? '已扫码，请在手机上确认。'
                : '请使用酷狗' + editionName + ' App 扫码。'
            }}
          </p>
          <BaseButton
            v-if="state.transaction && !state.busy"
            class="favorite-action"
            @click="cancelChallenge"
            >取消扫码</BaseButton
          >
          <BaseButton
            v-else
            class="favorite-action primary"
            :loading="state.busy === 'starting'"
            @click="start"
            >获取{{ editionName }}登录二维码</BaseButton
          >
          <BaseButton
            v-if="state.intent !== 'login' && !state.transaction"
            class="favorite-action ml-2"
            @click="cancelChallenge"
            >返回当前账号</BaseButton
          >
        </template>
        <form
          v-else-if="!state.transaction"
          @submit.prevent="start"
        >
          <label
            :for="id + '-phone'"
            class="mb-1.5 block text-[12px] font-bold"
            >酷我账号手机号</label
          >
          <input
            :id="id + '-phone'"
            v-model="state.phone"
            class="favorite-field"
            type="tel"
            inputmode="numeric"
            autocomplete="off"
            pattern="1[0-9]{10}"
            maxlength="11"
            placeholder="中国大陆 11 位手机号"
            required
            :disabled="!!state.busy"
          />
          <label
            class="my-3 flex items-start gap-2 text-[12px] leading-relaxed text-white/75"
          >
            <input
              v-model="state.allowCreation"
              class="mt-0.5 size-4 shrink-0 accent-white"
              type="checkbox"
              required
              :disabled="!!state.busy"
            />
            我同意在此号码尚未注册时，由酷我创建账号。
          </label>
          <BaseButton
            type="submit"
            class="favorite-action primary"
            :loading="state.busy === 'starting'"
            :disabled="
              !state.allowCreation || !/^1\d{10}$/.test(state.phone.trim())
            "
            >发送验证码</BaseButton
          >
        </form>
        <form
          v-else
          @submit.prevent="verify"
        >
          <label
            :for="id + '-code'"
            class="mb-1.5 block text-[12px] font-bold"
            >5 位短信验证码 · 尾号 {{ state.phone.slice(-4) }}</label
          >
          <input
            :id="id + '-code'"
            v-model="state.code"
            class="favorite-field"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="5"
            pattern="[0-9]{5}"
            required
            :disabled="!!state.busy"
          />
          <div class="mt-3 flex flex-wrap gap-2">
            <BaseButton
              type="submit"
              class="favorite-action primary"
              :loading="state.busy === 'verifying'"
              :disabled="!/^\d{5}$/.test(state.code)"
              >确认登录</BaseButton
            >
            <BaseButton
              class="favorite-action"
              @click="cancelChallenge"
              >取消登录</BaseButton
            >
          </div>
        </form>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.favorite-field {
  width: 100%;
  border: 1px solid #ffffff26;
  border-radius: 12px;
  background: #0002;
  padding: 10px 14px;
  font: inherit;
  font-size: 13px;
}
.favorite-action {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #ffffff26;
  border-radius: 999px;
  background: #ffffff10;
  padding: 6px 16px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
}
.favorite-action.primary {
  background: #fff;
  color: #17171c;
}
.favorite-action:not(:disabled):hover {
  filter: brightness(0.92);
}
.favorite-action:disabled {
  opacity: 0.45;
}
.favorite-edition {
  cursor: pointer;
  border: 1px solid #ffffff20;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  line-height: 1.45;
}
.favorite-edition.active {
  border-color: #ffffff60;
  background: #ffffff20;
}
.liquid-win .favorite-edition.active,
.liquid-win .favorite-action:not(.primary) {
  border-color: #ffffff57;
  background: linear-gradient(150deg, #ffffff2b, #ffffff0b);
  box-shadow: inset 0 1px 0 #ffffff40;
}
.favorite-edition:focus-within {
  outline: 2px solid #ffffffbf;
  outline-offset: 2px;
}
fieldset:disabled .favorite-edition {
  cursor: default;
}
.favorite-login :focus-visible {
  outline: 2px solid #ffffffbf;
  outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  .favorite-edition {
    transition:
      background-color 150ms ease,
      border-color 150ms ease;
  }
  .favorite-stage-enter-active,
  .favorite-stage-leave-active {
    transition: opacity 160ms ease;
  }
  .favorite-stage-enter-from,
  .favorite-stage-leave-to {
    opacity: 0;
  }
  .calm .favorite-edition,
  .calm .favorite-stage-enter-active,
  .calm .favorite-stage-leave-active {
    transition: none;
  }
}
</style>
