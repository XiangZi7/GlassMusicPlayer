<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import type { MusicPlatform } from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import PlatformIcon from '@/components/player/PlatformIcon.vue'
import { usePlatformImport } from '@/composables/usePlatformImport'
import { defaultCover, platformNames } from '@/services/player/catalog'

const {
  active,
  profileInput,
  page,
  selected,
  link,
  loading,
  loaded,
  linkedProfiles,
  imported,
  connections,
  importedCount,
  latestSync,
  openPlatform,
  connectProfile,
  changePage,
  disconnect,
  importPlaylists,
  isImported,
} = usePlatformImport()

const cards = [
  {
    id: 'netease',
    short: '网易云',
    caption: '公开主页 · 歌单',
    description: '关联网易云公开主页，选择用户公开的歌单导入。',
  },
  {
    id: 'kugou',
    short: '酷狗',
    caption: '账号 · 歌单 · 收藏',
    description: '连接个人账号后可读取自建歌单和收藏。',
  },
  {
    id: 'kuwo',
    short: '酷我',
    caption: '公开 UID · 歌单',
    description: '关联酷我用户 UID，选择其公开歌单导入。',
  },
] as const

const activeProfile = computed(() =>
  active.value && active.value !== 'kugou'
    ? linkedProfiles.value[active.value]
    : undefined
)
const profileByPlatform = computed(() => ({
  ...linkedProfiles.value,
  kugou: undefined,
}))
const selection = useTemplateRef<HTMLElement>('selection')

// 卡片展开后将关联表单带入可视区域，避免小窗口看不到后续操作。
async function showConnection(platform: MusicPlatform): Promise<void> {
  openPlatform(platform)
  if (active.value !== platform) return
  await nextTick()
  selection.value?.scrollIntoView({ block: 'nearest' })
}
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
          :aria-expanded="active === card.id"
          @click="showConnection(card.id)"
          >{{
            profileByPlatform[card.id] ? '查看歌单' : '连接' + card.short
          }}</BaseButton
        >
      </section>
    </div>

    <!-- 账户公开资料和可勾选歌单。 -->
    <section
      ref="selection"
      class="mt-[20px]"
      aria-label="选择要导入的歌单"
    >
      <h4 class="pg-secttl mb-[8px] text-[12px] font-extrabold">
        选择要导入的歌单<span v-if="selected.length">
          · 已选 {{ selected.length }}</span
        >
      </h4>
      <p
        v-if="!active"
        class="empty-note py-[10px] text-[13px]"
      >
        连接平台后，在这里选择账户的公开歌单。
      </p>
      <p
        v-else-if="active === 'kugou'"
        class="empty-note py-[10px] text-[13px]"
      >
        酷狗个人歌单需要账户授权。可将酷狗的公开歌单分享链接粘贴到下方导入。
      </p>
      <template v-else>
        <form
          v-if="!activeProfile"
          class="link-row flex gap-[8px]"
          @submit.prevent="connectProfile"
        >
          <input
            v-model="profileInput"
            type="text"
            :aria-label="platformNames[active] + '公开主页或 UID'"
            placeholder="粘贴个人主页链接或输入数字 UID"
            :disabled="!!loading"
          />
          <!-- 确认提交用户公开资料。 -->
          <BaseButton
            type="submit"
            class="up-add rounded-[11px] px-[14px] whitespace-nowrap"
            :disabled="!profileInput.trim() || !!loading"
            >关联公开资料</BaseButton
          >
        </form>
        <div
          v-else
          class="pl-actions mb-[12px] flex items-center gap-[10px]"
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
        <p
          v-else-if="page && !page.playlists.length"
          class="empty-note py-[10px] text-[13px]"
        >
          本页没有公开歌单。
        </p>
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
  </div>
</template>
