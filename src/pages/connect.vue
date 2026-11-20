<script setup lang="ts">
import {
  computed,
  nextTick,
  onDeactivated,
  reactive,
  toRefs,
  useTemplateRef,
  watch,
} from 'vue'
import type { MusicPlatform } from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import PlatformIcon from '@/components/player/PlatformIcon.vue'
import PlatformConnectionDialog from '@/components/player/PlatformConnectionDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlatformImport } from '@/composables/usePlatformImport'
import { defaultCover, platformNames } from '@/services/player/catalog'

const importer = usePlatformImport()
const {
  active,
  page,
  selected,
  link,
  loading,
  loaded,
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
})
const { dialogOpen, dialogPlatform } = toRefs(state)
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
    caption: '账号授权 · 歌单',
    description: '通过账户授权读取用户歌单，公开歌单也可通过分享链接导入。',
  },
  {
    id: 'kuwo',
    short: '酷我',
    caption: '公开主页 · UID',
    description: '关联酷我个人主页或 UID，选择公开歌单导入。',
  },
] as const
const activeProfile = computed(() =>
  importer.active.value && importer.active.value !== 'kugou'
    ? importer.linkedProfiles.value[importer.active.value]
    : undefined
)
const profileByPlatform = computed(() => ({
  ...importer.linkedProfiles.value,
  kugou: undefined,
}))
const dialogInitialValue = computed(() => {
  const platform = state.dialogPlatform
  return platform && platform !== 'kugou'
    ? importer.linkedProfiles.value[platform]?.userId || ''
    : ''
})
const selection = useTemplateRef<HTMLElement>('selection')

function openConnectionDialog(platform: MusicPlatform): void {
  state.dialogPlatform = platform
  clearProfileError()
  state.dialogOpen = true
}

// 已关联的卡片直接查看歌单，未关联的卡片只打开连接弹窗。
async function showConnection(platform: MusicPlatform): Promise<void> {
  if (profileByPlatform.value[platform]) {
    openPlatform(platform)
    await nextTick()
    selection.value?.scrollIntoView({ block: 'nearest' })
  } else openConnectionDialog(platform)
}

async function submitProfile(input: string): Promise<void> {
  if (!state.dialogPlatform) return
  const connected = await connectProfile(state.dialogPlatform, input)
  if (!connected) return
  state.dialogOpen = false
  await nextTick()
  selection.value?.scrollIntoView({ block: 'nearest' })
}

watch(
  () => state.dialogOpen,
  visible => {
    if (!visible) cancelProfileConnection()
  }
)
onDeactivated(() => {
  state.dialogOpen = false
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
        { label: '上传歌曲', value: 'upload' },
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
            profileByPlatform[card.id] ? '查看歌单' : '连接' + card.short
          }}</BaseButton
        >
      </section>
    </div>

    <!-- 账户公开资料和可勾选歌单。 -->
    <section
      id="platform-playlist-selection"
      ref="selection"
      class="mt-[20px]"
      aria-label="选择要导入的歌单"
    >
      <h4 class="pg-secttl mb-[8px] text-[12px] font-extrabold">
        选择要导入的歌单<span v-if="selected.length">
          · 已选 {{ selected.length }}</span
        >
      </h4>
      <EmptyState
        v-if="!activeProfile"
        class="min-h-[120px]"
        icon="link"
        label="连接平台后可选择账户的公开歌单"
      />
      <template v-else>
        <div
          class="pl-actions mb-[12px] flex flex-wrap items-center gap-[10px]"
        >
          <span>{{
            activeProfile.displayName || 'UID ' + activeProfile.userId
          }}</span>
          <BaseButton
            class="imp-pick rounded-full px-[12px] py-[6px]"
            :disabled="!!loading"
            @click="changePage(1)"
            >刷新歌单</BaseButton
          >
          <BaseButton
            class="imp-pick rounded-full px-[12px] py-[6px]"
            :disabled="!!loading"
            @click="active && openConnectionDialog(active)"
            >更换连接</BaseButton
          >
          <BaseButton
            class="imp-pick rounded-full px-[12px] py-[6px]"
            :disabled="!!loading"
            @click="disconnect"
            >取消关联</BaseButton
          >
        </div>
        <p
          v-if="loading === 'profile'"
          class="empty-note py-[10px] text-[13px]"
          role="status"
        >
          正在读取公开歌单…
        </p>
        <EmptyState
          v-else-if="page && !page.playlists.length"
          class="min-h-[120px]"
          icon="playlist"
          label="本页没有公开歌单"
        />
        <!-- 保留歌单封面、歌曲数和独立勾选操作。 -->
        <label
          v-for="item in page?.playlists"
          :key="item.id"
          class="imp-row mb-[7px] flex items-center gap-[11px] rounded-[13px] border border-transparent px-[11px] py-[9px]"
        >
          <img
            :src="item.coverUrl || defaultCover"
            alt=""
            loading="lazy"
          />
          <span class="it min-w-0 flex-1"
            ><b>{{ item.title }}</b
            ><span>{{
              item.trackCount === null ? '公开歌单' : item.trackCount + ' 首'
            }}</span></span
          >
          <span
            v-if="isImported(item.id)"
            class="text-[12px] opacity-[.7]"
            >已导入</span
          >
          <input
            v-else
            v-model="selected"
            type="checkbox"
            :value="item.id"
            :aria-label="'选择导入 ' + item.title"
            :disabled="!!loading"
          />
        </label>
        <div
          v-if="page"
          class="pl-actions mt-[12px] flex flex-wrap items-center gap-[10px]"
        >
          <BaseButton
            class="banner-play rounded-full px-[18px] py-[9px]"
            :disabled="!selected.length || !!loading"
            @click="importPlaylists('selection')"
            >导入所选歌单</BaseButton
          >
          <BaseButton
            v-if="page.pageNum > 1"
            class="imp-pick rounded-full px-[12px] py-[6px]"
            :disabled="!!loading"
            @click="changePage(page.pageNum - 1)"
            >上一页</BaseButton
          >
          <BaseButton
            v-if="page.hasMore"
            class="imp-pick rounded-full px-[12px] py-[6px]"
            :disabled="!!loading"
            @click="changePage(page.pageNum + 1)"
            >下一页</BaseButton
          >
          <span
            v-if="loading === 'selection'"
            role="status"
            >当前歌单已读取 {{ loaded }} 首</span
          >
        </div>
      </template>
    </section>

    <!-- 公开分享链接仍可单独导入。 -->
    <form
      class="mt-[22px]"
      @submit.prevent="importPlaylists('link')"
    >
      <label
        for="public-playlist-link"
        class="pg-secttl text-[12px] font-extrabold"
        >用链接导入 · 公开歌单分享链接</label
      >
      <div class="link-row mt-[10px] flex gap-[8px]">
        <input
          id="public-playlist-link"
          v-model="link"
          type="text"
          placeholder="例如 music.163.com/playlist?id=3778678"
          :disabled="!!loading"
        />
        <BaseButton
          type="submit"
          class="up-add min-h-[38px] rounded-[11px] px-[16px] text-[12.5px] font-extrabold whitespace-nowrap"
          :disabled="!!loading || !link.trim()"
          >导入歌单</BaseButton
        >
      </div>
      <p
        v-if="loading === 'link'"
        class="src-note mt-[12px] text-[12px]"
        role="status"
      >
        已读取 {{ loaded }} 首
      </p>
    </form>
    <PlatformConnectionDialog
      v-model="dialogOpen"
      :platform="dialogPlatform"
      :busy="loading === 'profile'"
      :error="profileError"
      :initial-value="dialogInitialValue"
      @profile="submitProfile"
      @clear-error="clearProfileError"
    />
  </div>
</template>
