<script setup lang="ts">
import { computed, nextTick, onDeactivated, reactive, toRefs, watch } from 'vue'
import type { MusicPlatform } from '@/api'
import { useRoute } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import PlatformIcon from '@/components/player/PlatformIcon.vue'
import PlatformConnectionDialog from '@/components/player/PlatformConnectionDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlatformImport } from '@/composables/usePlatformImport'
import { usePlatformQrLogin } from '@/composables/usePlatformQrLogin'
import { defaultCover, platformNames } from '@/services/player/catalog'

const route = useRoute()
const importer = usePlatformImport()
const {
  active,
  page,
  selected,
  link,
  loading,
  loaded,
  importTotal,
  importDone,
  retryTasks,
  togglePageSelection,
  cancelImport,
  profileError,
  imported,
  connections,
  importedCount,
  latestSync,
  openPlatform,
  connectProfile,
  clearProfileError,
  cancelProfileConnection,
  changePage,
  disconnect,
  importPlaylists,
  isImported,
} = importer

// 响应式状态
const state = reactive({
  // 是否展示平台连接弹窗。
  dialogOpen: false,
  // 本次连接弹窗所对应的平台。
  dialogPlatform: null as MusicPlatform | null,
  // 当前连接方式，只有登录面板可启动短期扫码请求。
  dialogMode: 'profile' as 'profile' | 'login',
  // 账号歌单只在独立选择弹窗展示，不占据平台页主体。
  selectionOpen: false,
})
const { dialogOpen, dialogPlatform, dialogMode, selectionOpen } = toRefs(state)
const loginEnabled = computed(
  () => state.dialogOpen && state.dialogMode === 'login'
)
const login = usePlatformQrLogin(dialogPlatform, loginEnabled)
const {
  status: loginStatus,
  qrCodeUrl: loginQrCodeUrl,
  error: loginError,
  profile: loginProfile,
  supported: loginSupported,
} = login
const cards = [
  {
    id: 'netease',
    short: '网易云',
    caption: '扫码登录 · 公开主页',
    description: '选择登录或主页链接方式关联资料，导入用户歌单。',
  },
  {
    id: 'kugou',
    short: '酷狗',
    caption: '扫码登录 · 公开身份',
    description: '使用酷狗 App 扫码确认资料，公开歌单可用分享链接导入。',
  },
  {
    id: 'kuwo',
    short: '酷我',
    caption: '公开主页 · UID',
    description: '关联酷我个人主页或 UID，选择公开歌单导入。',
  },
] as const
const activeProfile = computed(() =>
  importer.active.value
    ? importer.linkedProfiles.value[importer.active.value]
    : undefined
)
const profileByPlatform = computed(() => importer.linkedProfiles.value)
const dialogInitialValue = computed(() => {
  const platform = state.dialogPlatform
  return platform && platform !== 'kugou'
    ? importer.linkedProfiles.value[platform]?.userId || ''
    : ''
})

// 未关联平台优先展示可用扫码方式，酷我沿用公开主页方式。
function openConnectionDialog(
  platform: MusicPlatform,
  mode: 'profile' | 'login' = platform === 'kuwo' ? 'profile' : 'login'
): void {
  state.selectionOpen = false
  state.dialogMode = mode
  state.dialogPlatform = platform
  clearProfileError()
  state.dialogOpen = true
}

// 已关联的卡片直接查看歌单，未关联的卡片只打开连接弹窗。
async function showConnection(platform: MusicPlatform): Promise<void> {
  if (profileByPlatform.value[platform]) {
    if (platform === 'kugou') {
      openConnectionDialog(platform)
      return
    }
    state.selectionOpen = true
    openPlatform(platform)
  } else openConnectionDialog(platform)
}

// 关联成功后从登录面板进入歌单选择弹窗；关闭或切换平台时不接受旧结果。
async function submitProfile(input: string): Promise<void> {
  const platform = state.dialogPlatform
  if (!platform || !state.dialogOpen) return
  const verifiedProfile =
    login.status.value === 'authorized' && login.profile.value?.userId === input
      ? login.profile.value
      : null
  const connected = verifiedProfile
    ? await importer.connectQrProfile(platform, verifiedProfile)
    : await connectProfile(platform, input)
  if (!connected || !state.dialogOpen || state.dialogPlatform !== platform)
    return
  state.dialogOpen = false
  await nextTick()
  state.selectionOpen = platform !== 'kugou'
}

// 只有服务端验证了账号后才读取同一 UID 的公开歌单；失败仍可重试，不伪造关联。
watch(
  () => login.profile.value,
  profile => {
    if (
      profile &&
      login.status.value === 'authorized' &&
      state.dialogOpen &&
      (state.dialogPlatform === 'netease' || state.dialogPlatform === 'kugou')
    )
      void submitProfile(profile.userId)
  }
)
watch(() => state.dialogPlatform, cancelProfileConnection)

// 头像菜单可在任何页面或当前连接页再次选择平台，只处理本应用允许的平台值。
watch(
  () => [route.path, route.query.platform, route.query.account] as const,
  ([path, platform]) => {
    if (
      path === '/connect' &&
      (platform === 'netease' || platform === 'kugou' || platform === 'kuwo')
    )
      openConnectionDialog(platform, platform === 'kuwo' ? 'profile' : 'login')
  },
  { immediate: true }
)

// 重试扫码前清除旧的主页错误，不改变已保存账号。
function refreshLogin(): void {
  clearProfileError()
  login.refresh()
}

watch(
  () => state.dialogOpen,
  visible => {
    if (!visible) cancelProfileConnection()
  }
)
// 选择弹窗关闭时停止本次加载或导入，已经完整保存的歌单不回滚。
watch(
  () => state.selectionOpen,
  visible => {
    if (!visible) {
      cancelProfileConnection()
      if (importer.loading.value === 'selection') cancelImport()
    }
  }
)
// 取消账号关联后收起选择弹窗，不删除已经导入的歌单。
function unlinkProfile(): void {
  disconnect()
  state.selectionOpen = false
}
onDeactivated(() => {
  state.dialogOpen = false
  state.selectionOpen = false
})
</script>

<template>
  <div
    class="page-panel hidden"
    data-panel="connect"
  >
    <div class="pg-head">
      <h3>平台对接</h3>
      <p>
        关联你的音乐平台资料，选择要导入的歌单。导入的歌单保存在左侧「我的歌单」。
      </p>
    </div>
    <!-- 内容来源导航。 -->
    <PlayerTabs
      class="pg-tabs mt-[16px] inline-flex max-w-full flex-wrap gap-[4px] rounded-full p-[4px]"
      role="tablist"
      aria-label="内容导入分类"
      hook="data-src-tab"
      :options="[
        { label: '平台对接', value: 'connect' },
        { label: '本地曲目', value: 'upload' },
        { label: '下载管理', value: 'downloads' },
      ]"
    />

    <!-- 四项统计均来自实际本地关联和导入记录。 -->
    <div class="lib-stats mt-[16px] grid grid-cols-[repeat(4,1fr)] gap-[10px]">
      <div>
        <b>{{ connections }} / 3</b><span>已关联平台</span>
      </div>
      <div>
        <b>{{ imported.length }}</b><span>已导入歌单</span>
      </div>
      <div>
        <b>{{ importedCount }}</b><span>已导入歌曲</span>
      </div>
      <div>
        <b>{{ latestSync }}</b><span>最近同步</span>
      </div>
    </div>

    <!-- 平台连接卡：按原稿横排展示标识、资料状态和连接操作。 -->
    <div class="plat-grid mt-[16px] grid">
      <section
        v-for="card in cards"
        :key="card.id"
        class="plat-card min-h-[100px] rounded-[18px] border border-transparent p-[15px]"
        :data-plat-card="card.id"
      >
        <div class="plat-top flex items-center gap-[11px]">
          <PlatformIcon :platform="card.id" />
          <div>
            <b>{{ platformNames[card.id] }}</b><span>{{ card.caption }}</span>
          </div>
          <span
            class="plat-status ml-auto flex-none rounded-full px-[9px] py-[5px] text-[11px] font-extrabold whitespace-nowrap"
            :class="{ on: profileByPlatform[card.id] }"
            >{{ profileByPlatform[card.id] ? '已关联' : '未连接' }}</span
          >
        </div>
        <p>{{ card.description }}</p>
        <div
          class="plat-meta flex flex-wrap gap-[8px] text-[11px] opacity-[.7]"
        >
          <span v-if="profileByPlatform[card.id]">{{
            profileByPlatform[card.id]?.displayName ||
            'UID ' + profileByPlatform[card.id]?.userId
          }}</span>
          <span v-else>{{
            card.id === 'kugou' ? '需平台授权' : '公开歌单'
          }}</span>
        </div>
        <!-- 卡片按钮展开连接表单，或读取已关联的公开歌单。 -->
        <BaseButton
          class="plat-btn min-h-[36px] rounded-full text-[12.5px] font-extrabold"
          :disabled="!!loading"
          :aria-haspopup="profileByPlatform[card.id] ? undefined : 'dialog'"
          :aria-controls="
            profileByPlatform[card.id]
              ? 'platform-playlist-selection'
              : 'platform-connection-dialog'
          "
          :aria-expanded="
            profileByPlatform[card.id]
              ? active === card.id
              : dialogOpen && dialogPlatform === card.id
          "
          @click="showConnection(card.id)"
          >{{
            profileByPlatform[card.id]
              ? card.id === 'kugou'
                ? '查看资料'
                : '查看歌单'
              : '连接' + card.short
          }}</BaseButton
        >
      </section>
    </div>

    <!-- 账号歌单选择区：原生弹窗提供全选、多选、分页和统一导入。 -->
    <BaseDialog
      v-model="selectionOpen"
      labelled-by="playlist-selection-title"
      described-by="playlist-selection-help"
      class="playlist-dialog"
    >
      <header
        class="flex shrink-0 items-start justify-between gap-[14px] border-b border-white/10 px-[20px] py-[16px]"
      >
        <div class="min-w-0">
          <h2
            id="playlist-selection-title"
            class="m-0 text-[16px] font-bold"
          >
            选择要导入的歌单
          </h2>
          <p
            id="playlist-selection-help"
            class="mt-[5px] mb-0 text-[12px] leading-[1.5] text-white/55"
          >
            {{ activeProfile?.displayName || '公开歌单' }} ·
            可全选本页或勾选部分，已导入的歌单可更新。
          </p>
        </div>
        <!-- 歌单选择弹窗：关闭按钮保留已导入结果并取消未完成请求。 -->
        <BaseButton
          class="grid size-[32px] flex-none place-items-center rounded-[10px] bg-white/5 text-white/70 hover:bg-white/10"
          aria-label="关闭歌单选择"
          @click="selectionOpen = false"
          ><svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" /></svg
        ></BaseButton>
      </header>
      <div
        class="flex shrink-0 flex-wrap items-center gap-[8px] border-b border-white/7 px-[20px] py-[10px]"
      >
        <!-- 歌单选择工具栏：统一字号的刷新、账号切换与取消关联入口。 -->
        <BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[12px]"
          :disabled="!!loading"
          @click="changePage(1)"
          >刷新歌单</BaseButton
        >
        <BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[12px]"
          :disabled="!!loading"
          @click="active && openConnectionDialog(active)"
          >更换账号</BaseButton
        >
        <BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[12px]"
          :disabled="!!loading"
          @click="unlinkProfile"
          >取消关联</BaseButton
        >
        <span class="ml-auto text-[12px] text-white/60"
          >已选 {{ selected.length }} 份</span
        >
      </div>
      <section
        id="platform-playlist-selection"
        class="panel-scroll relative max-h-[430px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[16px] py-[12px]"
        tabindex="0"
        aria-label="可选择的公开歌单"
        :aria-busy="loading === 'profile'"
      >
        <!-- 歌单选择内容：加载居中，原有数据不使用固定演示列表替代。 -->
        <div
          v-if="loading === 'profile'"
          class="grid min-h-[180px] place-items-center"
          role="status"
        >
          <span
            class="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
            aria-label="正在读取公开歌单"
          />
        </div>
        <template v-else>
          <EmptyState
            v-if="!page?.playlists.length"
            class="min-h-[180px]"
            icon="playlist"
            label="没有可展示的公开歌单，可尝试刷新"
          />
          <!-- 歌单选择列表：整行可点击，清晰区分已导入状态与选择状态。 -->
          <label
            v-for="item in page?.playlists"
            :key="item.id"
            class="playlist-pick mb-[7px] flex min-h-[62px] cursor-pointer items-center gap-[12px] rounded-[13px] border border-white/8 bg-white/3 px-[12px] py-[9px] transition-colors hover:bg-white/6"
            :class="{ 'playlist-picked': selected.includes(item.id) }"
          >
            <img decoding="async"
              :src="item.coverUrl || defaultCover"
              alt=""
              loading="lazy"
              class="size-[38px] flex-none rounded-[9px] object-cover"
            />
            <span class="min-w-0 flex-1"
              ><b
                class="block truncate text-[13px] leading-[1.5] font-semibold"
                >{{ item.title }}</b
              ><span class="mt-[2px] block text-[11px] text-white/50">{{
                item.trackCount === null ? '公开歌单' : item.trackCount + ' 首'
              }}</span></span
            >
            <span
              v-if="isImported(item.id)"
              class="flex-none text-[11px] text-white/45"
              >已导入 · 可更新</span
            >
            <input
              v-model="selected"
              type="checkbox"
              :value="item.id"
              :aria-label="
                (isImported(item.id) ? '选择更新 ' : '选择导入 ') + item.title
              "
              :disabled="!!loading"
              class="size-4 flex-none cursor-pointer accent-white"
            />
          </label>
        </template>
      </section>
      <footer
        class="panel-actions flex flex-wrap items-center gap-[8px]"
      >
        <!-- 歌单选择底栏：全选保持跨页选择，用户显式确认后才导入。 -->
        <BaseButton
          class="imp-pick rounded-full px-[12px] py-[7px]"
          :disabled="!!loading || !page?.playlists.length"
          @click="togglePageSelection"
          >全选 / 取消本页</BaseButton
        >
        <BaseButton
          v-if="page && page.pageNum > 1"
          class="imp-pick rounded-full px-[10px] py-[7px]"
          :disabled="!!loading"
          @click="changePage(page.pageNum - 1)"
          >上一页</BaseButton
        >
        <BaseButton
          v-if="page?.hasMore"
          class="imp-pick rounded-full px-[10px] py-[7px]"
          :disabled="!!loading"
          @click="changePage(page!.pageNum + 1)"
          >下一页</BaseButton
        >
        <BaseButton
          v-if="loading === 'selection'"
          class="imp-pick rounded-full px-[12px] py-[7px]"
          @click="cancelImport"
          >停止</BaseButton
        >
        <BaseButton
          class="banner-play ml-auto inline-flex h-9 min-w-32 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 font-extrabold whitespace-nowrap"
          :disabled="!selected.length || !!loading"
          :loading="loading === 'selection'"
          @click="importPlaylists('selection')"
          ><span>{{ loading === 'selection' ? '正在导入…' : '导入 / 更新所选' }}</span></BaseButton
        >
        <span
          v-if="loading === 'selection'"
          class="w-full text-[11px] text-white/55"
          role="status"
          >已处理 {{ importDone }} / {{ importTotal }} 项 · 当前歌单
          {{ loaded }} 首</span
        >
      </footer>
    </BaseDialog>

    <!-- 分享导入区：接受整段分享内容或多行链接，不需要先关联账号。 -->
    <form
      class="mt-[22px]"
      @submit.prevent="importPlaylists('link')"
    >
      <label
        for="public-playlist-link"
        class="pg-secttl text-[12px] font-extrabold"
        >粘贴分享内容 · 无需登录</label
      >
      <div class="link-row mt-[10px] flex flex-wrap items-start gap-[8px]">
        <textarea
          id="public-playlist-link"
          v-model="link"
          rows="3"
          maxlength="32768"
          class="focus-visible:ring-accent min-h-[80px] min-w-0 flex-1 resize-y rounded-[11px] px-[12px] py-[10px] text-[13px] outline-none focus-visible:ring-2"
          placeholder="直接粘贴 App 复制的分享文字，或多行歌单链接（每批最多 50 个）"
          aria-describedby="playlist-share-help"
          :disabled="!!loading"
        />
        <!-- 分享导入区：公共按钮启动批量导入，过程中防止重复提交。 -->
        <BaseButton
          type="submit"
          class="up-add min-h-[38px] rounded-[11px] px-[16px] text-[12.5px] font-extrabold whitespace-nowrap"
          :disabled="!!loading || !link.trim()"
          >{{
            loading === 'link' ? '正在导入…' : '导入 / 更新歌单'
          }}</BaseButton
        >
      </div>
      <p
        id="playlist-share-help"
        class="src-note mt-[8px] text-[12px]"
      >
        自动识别平台并去重；已导入歌单会更新。支持公开歌单详情链接，短链接暂不展开。
      </p>
    </form>
    <!-- 批次操作区：公共按钮停止任务或仅重试未完成项，不重复展示错误通知。 -->
    <div
      class="pl-actions mt-[12px] flex flex-wrap items-center gap-[10px]"
      :aria-busy="loading === 'link' || loading === 'selection'"
    >
      <span
        v-if="loading === 'link' || loading === 'selection'"
        role="status"
      >
        已处理 {{ importDone }} / {{ importTotal }} 项 · 当前歌单
        {{ loaded }} 首
      </span>
      <BaseButton
        v-if="loading === 'link' || loading === 'selection'"
        class="imp-pick rounded-full px-[12px] py-[6px]"
        @click="cancelImport"
        >停止导入</BaseButton
      >
      <BaseButton
        v-if="retryTasks.length && !loading"
        class="imp-pick rounded-full px-[12px] py-[6px]"
        @click="importPlaylists('retry')"
        >重试未完成项（{{ retryTasks.length }}）</BaseButton
      >
    </div>
    <!-- 平台连接区：公共弹窗提供扫码确认身份或主页链接关联。 -->
    <PlatformConnectionDialog
      v-model="dialogOpen"
      :platform="dialogPlatform"
      :busy="loading === 'profile'"
      :error="profileError"
      :initial-value="dialogInitialValue"
      :initial-mode="dialogMode"
      :login-supported="loginSupported"
      :login-status="loginStatus"
      :login-qr-code-url="loginQrCodeUrl"
      :login-error="loginError"
      :login-profile="loginProfile"
      @mode-change="dialogMode = $event"
      @login="refreshLogin"
      @profile="submitProfile"
      @clear-error="clearProfileError"
    />
  </div>
</template>

<style scoped>
.playlist-dialog {
  width: min(640px, calc(100vw - 32px));
  max-width: 640px;
  overflow: hidden;
  font-family: var(--font-sans);
  color-scheme: dark;
}
.playlist-dialog[open] {
  display: flex;
  flex-direction: column;
}
.playlist-dialog :deep(button) {
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
}
.playlist-dialog :deep(:focus-visible:not(.panel-scroll)) {
  outline: 2px solid rgb(255 255 255 / 0.75);
  outline-offset: 3px;
}
.playlist-pick.playlist-picked {
  border-color: rgb(255 255 255 / 0.3);
  background: rgb(255 255 255 / 0.075);
}
</style>
