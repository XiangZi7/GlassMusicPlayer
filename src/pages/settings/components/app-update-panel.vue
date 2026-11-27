<script setup lang="ts">
import { computed, onMounted } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChoiceMenu from '@/components/ui/BaseChoiceMenu.vue'
import { usePlayer } from '@/composables/usePlayer'
import { updateSources } from '@/services/update-preferences'
import { useAppUpdaterStore } from '@/stores/app-updater'

const { state: player, setSetting } = usePlayer()
const updater = useAppUpdaterStore()
const state = updater.state
const currentVersion = __APP_INFO__.version
const busy = computed(() =>
  ['checking', 'downloading', 'installing'].includes(state.phase)
)
const manualRelease = computed(
  () => state.phase === 'available' && state.reason === 'manual'
)
const progress = computed(() =>
  state.total > 0
    ? Math.min(99, Math.round((100 * state.downloaded) / state.total))
    : undefined
)
const status = computed(() => {
  switch (state.phase) {
    case 'checking':
      return '正在检查更新…'
    case 'latest':
      return '当前已是最新版本'
    case 'available':
      return '发现新版本'
    case 'downloading':
      return '正在下载更新'
    case 'ready':
      return state.deferred ? '已就绪，可稍后安装' : '更新已就绪'
    case 'installing':
      return '正在安装，即将重启…'
    case 'error':
      return state.errorStage === 'install'
        ? '更新安装失败'
        : state.errorStage === 'download'
          ? '下载或签名校验失败'
          : '检查更新失败'
    default:
      return '检查播放器更新'
  }
})
const actionLabel = computed(() => {
  if (busy.value) return status.value
  if (manualRelease.value) return '前往下载'
  switch (state.phase) {
    case 'available':
      return '下载更新'
    case 'ready':
      return '立即更新'
    case 'error':
      return '重试'
    default:
      return state.reason === 'manual' ? '检查更新' : '检查并下载更新'
  }
})

// 根据当前阶段检查版本、重新下载或安装，手动更新入口打开正式发行页。
function runAction(): void {
  if (busy.value) return
  if (manualRelease.value) {
    void updater.openRelease()
  } else if (
    state.phase === 'ready' ||
    (state.phase === 'error' && state.errorStage === 'install')
  ) {
    void updater.command('install')
  } else if (
    state.phase === 'available' ||
    (state.phase === 'error' && state.errorStage === 'download')
  ) {
    void updater.command('download')
  } else {
    void updater.command('check')
  }
}

// 自定义地址在提交草稿时统一校验，输入过程中允许暂不完整的地址。
function editProxy(event: Event): void {
  setSetting('updateDownloadProxy', (event.target as HTMLInputElement).value)
}

onMounted(() => void updater.start())
</script>

<template>
  <!-- 应用更新卡与标题栏共用当前版本检查、下载和安装进度。 -->
  <section
    :class="{ 'update-motion': player.settings.motion }"
    aria-labelledby="app-update-heading"
  >
    <h3
      id="app-update-heading"
      class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-60"
    >
      应用更新
    </h3>
    <div
      class="set-card rounded-[16px] border border-transparent px-[14px] py-[4px]"
    >
      <div
        class="set-row update-summary flex flex-wrap items-center gap-x-[14px] gap-y-2 py-3"
      >
        <div class="set-txt min-w-0 flex-1 basis-[180px]">
          <b
            role="status"
            aria-live="polite"
          >
            <Transition
              name="update-fade"
              mode="out-in"
            >
              <span
                :key="status"
                class="update-title"
                >{{ status
                }}<template v-if="state.version && state.phase !== 'latest'">
                  · v{{ state.version }}</template
                ></span
              >
            </Transition>
          </b>
          <span v-if="state.phase === 'downloading'">
            已下载
            {{ (state.downloaded / 1024 / 1024).toFixed(1) }} MiB<template
              v-if="progress !== undefined"
            >
              · {{ progress }}%</template
            >
          </span>
          <span v-else-if="manualRelease"
            >当前版本 v{{ currentVersion }}，可前往 GitHub Releases
            下载安装包。</span
          >
          <span v-else
            >当前版本 v{{ currentVersion }} · GitHub Releases 正式版</span
          >
        </div>
        <!-- 按钮内显示进行中的操作，下载或安装失败后保留对应的重试入口。 -->
        <div class="update-actions flex flex-wrap items-center gap-2">
          <BaseButton
            class="update-action update-primary"
            :loading="busy"
            @click="runAction"
            >{{ actionLabel }}</BaseButton
          >
          <BaseButton
            v-if="state.phase === 'ready'"
            class="update-action"
            :disabled="state.deferred"
            @click="updater.command('defer')"
            >暂不更新</BaseButton
          >
          <BaseButton
            v-else-if="!manualRelease"
            class="update-action"
            @click="updater.openRelease()"
            >查看发行说明</BaseButton
          >
        </div>
        <progress
          v-if="state.phase === 'downloading'"
          class="h-1.5 w-full accent-white"
          :value="progress"
          max="100"
          aria-label="更新下载进度"
        />
        <details
          v-if="state.phase === 'error' && state.error"
          class="basis-full text-xs text-white/75"
        >
          <summary
            class="w-fit cursor-pointer rounded-sm focus-visible:outline-2"
          >
            错误详情
          </summary>
          <p
            class="panel-scroll mt-2 max-h-24 overflow-auto break-all whitespace-pre-wrap"
          >
            {{ state.error }}
          </p>
        </details>
      </div>
      <!-- 自动发现使用已保存的开关，手动检查始终由上方按钮触发。 -->
      <div class="set-row flex items-center gap-[14px] py-3">
        <div class="set-txt min-w-0 flex-1">
          <b>自动检查更新</b
          ><span id="auto-update-help"
            >启动后及每 6 小时检查新版本，发现更新时在右上角提示。</span
          >
        </div>
        <BaseButton
          class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
          :class="{ on: player.settings.autoUpdate }"
          role="switch"
          aria-label="自动检查更新"
          aria-describedby="auto-update-help"
          :aria-checked="player.settings.autoUpdate"
          @click="setSetting('autoUpdate', !player.settings.autoUpdate)"
          ><i
        /></BaseButton>
      </div>
      <!-- 更新下载线路设置区。 -->
      <div
        class="set-row flex flex-wrap items-center gap-x-[14px] gap-y-2 py-3"
      >
        <div class="set-txt min-w-0 flex-1 basis-[165px]">
          <b>更新下载线路</b
          ><span id="update-source-help"
            >自动模式优先尝试加速线路，失败后使用 GitHub 直连。</span
          >
        </div>
        <!-- 线路下拉框只更新设置草稿，随自定义地址一起提交。 -->
        <BaseChoiceMenu
          variant="field"
          label="更新下载线路"
          description-id="update-source-help"
          :value="player.settings.updateSource"
          :options="updateSources"
          :motion="player.settings.motion"
          @select="setSetting('updateSource', $event)"
        />
      </div>
      <Transition name="update-fade">
        <div
          v-if="player.settings.updateSource === 'custom'"
          class="set-row flex flex-wrap items-center gap-x-[14px] gap-y-2 py-3"
        >
          <label
            for="update-proxy"
            class="set-txt min-w-0 flex-1 basis-[135px]"
            ><b>下载加速地址</b><span>填写 HTTPS 转发前缀地址。</span></label
          >
          <input
            id="update-proxy"
            class="update-field min-w-0 flex-1 basis-[185px]"
            type="url"
            spellcheck="false"
            placeholder="https://ghfast.top/"
            autocomplete="off"
            maxlength="2048"
            :value="player.settings.updateDownloadProxy"
            @input="editProxy"
          />
        </div>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.update-summary .update-title {
  display: inline;
  font: inherit;
  color: inherit;
  opacity: 1;
  overflow-wrap: anywhere;
}
.update-action,
.update-field {
  min-height: 30px;
  padding: 5px 11px;
  border: 1px solid rgb(255 255 255 / 17%);
  border-radius: 10px;
  background: rgb(255 255 255 / 7%);
  color: inherit;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}
.update-field {
  color-scheme: dark;
}
.update-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 650;
  cursor: pointer;
}
.update-primary {
  background: rgb(255 255 255 / 17%);
}
.liquid-win .update-action,
.liquid-win .update-field {
  background: linear-gradient(
    160deg,
    rgb(255 255 255 / 20%),
    rgb(255 255 255 / 6%)
  );
  border-color: rgb(255 255 255 / 29%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 32%);
}
.update-action:hover:enabled,
.update-field:hover {
  background-color: rgb(255 255 255 / 16%);
}
.update-action:active:enabled {
  transform: translateY(1px);
}
.update-action:disabled {
  cursor: default;
  opacity: 0.65;
}
:is(.update-action, .update-field):focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  .update-motion .update-fade-enter-active,
  .update-motion .update-fade-leave-active {
    transition: opacity 160ms ease;
  }
  .update-motion .update-fade-enter-from,
  .update-motion .update-fade-leave-to {
    opacity: 0;
  }
  .update-motion .update-action {
    transition:
      background-color 140ms ease,
      transform 140ms ease;
  }
}
</style>
