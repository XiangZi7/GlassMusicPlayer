<script setup lang="ts">
import { toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { computed, nextTick, watch, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import type { Playlist } from '@/stores/player'
import { usePlayer } from '@/composables/usePlayer'
import { defaultCover } from '@/constants/music'
import { firstTrackIndices } from '@/services/player/library'
const { state, tracks, controller } = usePlayer()
const router = useRouter()
const sidebarRoot = useTemplateRef<HTMLElement>('sidebarRoot')
const albums = computed(() => firstTrackIndices(tracks, 'album', true))
// 侧栏本地专辑入口按曲库索引打开。
function openPlaylist(index: number): void {
  state.customPl = null
  controller()?.navigate('playlist', index)
}

// 已导入歌单按稳定 ID 进入路由，自建歌单沿用现有本地入口。
function openCustom(item: Playlist): void {
  if (item.id) {
    if (router.currentRoute.value.path === '/playlist' && router.currentRoute.value.query.playlist === item.id) {
      state.playlistReload++
      return
    }
    const path = router.resolve({ path: '/playlist', query: { playlist: item.id } }).fullPath
    controller()?.navigate('playlist', state.playlistIdx, false, path)
    return
  }
  state.customPl = { ...item }
  controller()?.navigate('playlist', state.playlistIdx)
}
// 编辑歌单后聚焦名称输入框，不重新生成侧栏 DOM。
async function rename(index: number): Promise<void> {
  state._renaming = index
  state._delPl = null
  await nextTick()
  const input =
    sidebarRoot.value?.querySelector<HTMLInputElement>('.plist-edit input')
  input?.focus()
  input?.select()
}
// 保存名称时同步当前打开的歌单。
function save(index: number, event: Event): void {
  const row = (event.currentTarget as HTMLElement).closest('.plist-edit')
  const name = row?.querySelector('input')?.value.trim()
  const item = state.myLists[index]
  if (name && item) {
    const old = item.name
    item.name = name
    if (!state.customPl?.id && state.customPl?.name === old)
      state.customPl.name = name
  }
  state._renaming = -1
  controller()?.render()
}
// 删除前切换到原稿的行内确认状态，退出重命名。
function confirmDelete(name: string): void {
  state._delPl = name
  state._renaming = -1
}

// 删除选中的自建歌单，删除当前项后返回首页。
function remove(index: number): void {
  const item = state.myLists[index]
  if (!item) return
  const opened = !state.customPl?.id && state.customPl?.name === item.name
  state.myLists.splice(index, 1)
  state._delPl = null
  state._renaming = -1
  if (opened) {
    state.customPl = null
    controller()?.navigate('home')
  } else controller()?.render()
}
// Vue 完成侧栏列表更新后再定位原稿的滑动高亮。
watch(
  () => [
    state.myLists.length,
    state.imported,
    state.customPl?.id ?? state.customPl?.name,
    state._renaming,
    state._delPl,
  ],
  () => {
    controller()?.render()
  },
  { flush: 'post' }
)
const {
  linkedProfiles,
  page,
  customPl,
  playlistIdx,
  myLists,
  _renaming,
  _delPl,
  imported,
} = toRefs(state)
</script>

<template>
  <!-- 原稿迁移区：结构、类名、图标、文案与交互钩子直接保留。 -->
  <aside
    ref="sidebarRoot"
    class="sidebar relative flex min-h-[0] flex-col gap-[4px] overflow-hidden p-[14px_12px_14px]"
  >
    <div
      class="side-pill pointer-events-none absolute top-[0] right-[12px] left-[12px] z-[1] h-[38px] opacity-[0]"
      data-pill
      aria-hidden="true"
    ></div>
    <div class="brand flex items-center gap-[12px] p-[6px_8px_16px]">
      <img class="logo" src="@/assets/miraiplayer.png" width="40" height="40" alt="" />
      <div class="min-w-0"><b>Mirai Player</b><span>{{ state.settings.glassStyle === 'liquid' ? 'LIQUID EDITION' : 'FROSTED EDITION' }}</span></div>
    </div>
    <BaseButton
      class="navitem on flex min-h-[38px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[9px_10px] text-left text-[13.5px] font-bold text-inherit"
      data-nav="home"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z" /></svg
      >首页</BaseButton
    >
    <BaseButton
      class="navitem flex min-h-[38px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[9px_10px] text-left text-[13.5px] font-bold text-inherit"
      data-nav="search"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        />
        <path d="M20 20l-3.5-3.5" /></svg
      >搜索</BaseButton
    >
    <BaseButton
      class="navitem flex min-h-[38px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[9px_10px] text-left text-[13.5px] font-bold text-inherit"
      data-nav="library"
      data-hub="lib"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M4 6h16M4 12h16M4 18h10" /></svg
      >音乐库<span class="count">{{ tracks.length }}</span></BaseButton
    >
    <BaseButton
      class="navitem flex min-h-[38px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[9px_10px] text-left text-[13.5px] font-bold text-inherit"
      data-nav="connect"
      data-hub="src"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M10 14a5 5 0 007.1 0l2.4-2.4a5 5 0 00-7.1-7.1L11 5.9" />
        <path d="M14 10a5 5 0 00-7.1 0L4.5 12.4a5 5 0 007.1 7.1L13 18.1" /></svg
      >内容导入<span class="count"
        >{{ Object.keys(linkedProfiles).length }}/3</span
      ></BaseButton
    >
    <BaseButton
      class="navitem flex min-h-[38px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[9px_10px] text-left text-[13.5px] font-bold text-inherit"
      data-nav="radio"
      ><svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <circle
          cx="12"
          cy="12"
          r="1.6"
          fill="currentColor"
          stroke="none"
        />
        <path
          d="M8.5 15.5a5 5 0 010-7M15.5 8.5a5 5 0 010 7M5.6 18.4a9.4 9.4 0 010-12.8M18.4 5.6a9.4 9.4 0 010 12.8"
        /></svg
      >歌曲电台<span
        class="count"
        data-radio-count
      ></span
    ></BaseButton>
    <div
      class="side-label side-mini-label flex items-center justify-between p-[12px_10px_6px] pr-[6px] text-[10.5px] font-extrabold tracking-[.12em] opacity-[.55]"
    >
      <span>我的歌单</span
      ><BaseButton
        class="newpl-btn min-h-[22px] rounded-full p-[3px_9px] text-[10.5px] font-extrabold"
        data-newpl
        type="button"
        >＋ 新建</BaseButton
      >
    </div>
    <div data-sidebar-lists>
      <BaseButton
        v-for="index in albums"
        :key="index"
        class="plist flex min-h-[40px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[7px_10px] text-left text-[13px] font-semibold text-inherit"
        :class="{
          on:
            page === 'playlist' &&
            !customPl &&
            tracks[playlistIdx]?.album === tracks[index]!.album,
        }"
        @click="openPlaylist(index)"
        ><img decoding="async" loading="lazy"
          :src="tracks[index]!.cover"
          alt=""
        /><span>{{ tracks[index]!.album }}</span></BaseButton
      >
    </div>
    <div>
      <template
        v-for="(item, index) in myLists"
        :key="index"
      >
        <div
          v-if="_renaming === index"
          class="plist-edit flex items-center gap-[5px] p-[3px_2px]"
        >
          <input
            type="text"
            :value="item.name"
            maxlength="30"
            aria-label="歌单名称"
            @keydown.stop.enter="save(index, $event)"
            @keydown.stop.esc="_renaming = -1"
          /><BaseButton
            class="pl-mini min-h-[26px] flex-none cursor-pointer rounded-full p-[4px_10px] text-[11px] font-extrabold"
            @click="save(index, $event)"
            >保存</BaseButton
          ><BaseButton
            class="pl-mini min-h-[26px] flex-none cursor-pointer rounded-full p-[4px_10px] text-[11px] font-extrabold"
            @click="_renaming = -1"
            >取消</BaseButton
          >
        </div>
        <div
          v-else-if="_delPl === item.name"
          class="plist-confirm flex items-center gap-[6px] rounded-[11px] p-[6px_8px]"
        >
          <span
            class="cf-txt min-w-[0] flex-1 overflow-hidden text-[12px] font-bold text-ellipsis whitespace-nowrap"
            >删除「{{ item.name }}」？</span
          ><BaseButton
            class="pl-mini danger min-h-[26px] flex-none cursor-pointer rounded-full p-[4px_10px] text-[11px] font-extrabold"
            @click="remove(index)"
            >删除</BaseButton
          ><BaseButton
            class="pl-mini min-h-[26px] flex-none cursor-pointer rounded-full p-[4px_10px] text-[11px] font-extrabold"
            @click="_delPl = null"
            >取消</BaseButton
          >
        </div>
        <div
          v-else
          class="plist-row flex items-center gap-[2px]"
        >
          <BaseButton
            class="plist flex min-h-[40px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[7px_10px] text-left text-[13px] font-semibold text-inherit"
            :data-custom="item.name"
            :class="{ on: page === 'playlist' && customPl?.name === item.name }"
            @click="openCustom(item)"
            ><img decoding="async" loading="lazy"
              :src="item.cover || defaultCover"
              alt=""
            /><span>{{ item.name }}</span></BaseButton
          ><span class="pl-acts hidden flex-none gap-[4px] pr-[2px]"
            ><BaseButton
              class="pl-act grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-[8px] p-0 text-white"
              :aria-label="'重命名歌单 ' + item.name"
              title="重命名"
              @click.stop="rename(index)"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5z"
                /></svg></BaseButton
            ><BaseButton
              class="pl-act grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-[8px] p-0 text-white"
              :aria-label="'删除歌单 ' + item.name"
              title="删除"
              @click.stop="confirmDelete(item.name)"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                /></svg></BaseButton
          ></span>
        </div>
      </template>
      <BaseButton
        v-for="item in imported"
        :key="item.id"
        class="plist flex min-h-[40px] w-full items-center gap-[10px] rounded-[11px] border-none bg-transparent p-[7px_10px] text-left text-[13px] font-semibold text-inherit"
        :data-custom="item.id"
        :class="{ on: page === 'playlist' && customPl?.id === item.id }"
        @click="openCustom(item)"
        ><img decoding="async" loading="lazy"
          :src="item.cover || defaultCover"
          alt=""
        /><span>{{ item.name }}</span></BaseButton
      >
    </div>
    <!-- 桌面功能在系统托盘；账号头像与设置统一在右上标题栏。 -->
  </aside>
</template>
