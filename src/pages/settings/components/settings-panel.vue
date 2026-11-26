<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import { playbackQualities } from '@/constants/music'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import DeferredSettingsPanel from '@/pages/settings/components/deferred-settings-panel.vue'
import AppUpdatePanel from '@/pages/settings/components/app-update-panel.vue'
import { reactive, toRefs, useTemplateRef } from 'vue'
import {
  bannerArtAssets,
  bannerArtOptions,
  clearCustomBannerArt,
  customBannerArt,
  saveCustomBannerArt,
} from '@/services/player/banner-art'
import { usePlayer } from '@/composables/usePlayer'
import type { SettingsSection } from '@/types/settings'
import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { notify } from '@/services/notification'

defineProps<{ section: SettingsSection }>()
const { state, setSetting, setNowPlaying } = usePlayer()
const { settings, npOpen } = toRefs(state)
const appInfo = __APP_INFO__

// 桌面窗口在系统浏览器打开项目主页，网页预览沿用链接的原生行为。
async function openProject(event: MouseEvent): Promise<void> {
  if (!isTauri()) return
  event.preventDefault()
  try {
    await openUrl(appInfo.homepage)
  } catch {
    notify('无法打开项目主页，请稍后重试。', 'error')
  }
}

// 淡化滑块更新当前设置草稿，由底栏的应用或保存统一提交。
function updateCrossfade(event: Event): void {
  setSetting('crossfade', Number((event.target as HTMLInputElement).value))
}

const bannerArtInput = useTemplateRef<HTMLInputElement>('bannerArtInput')
// 横幅自定义图上传状态：处理期间禁止重复选择同一入口。
const bannerArtState = reactive({
  /** 压缩与写入本机存储进行中。 */ busy: false,
})

// 打开系统文件选择器挑一张横幅图。
function pickBannerArt(): void {
  bannerArtInput.value?.click()
}

// 保存选中的图片为自定义横幅图：压缩与存储走 banner-art 服务，成功失败都给通知；
// 图片是即时数据（不走设置草稿），选完即存、横幅随选择生效。
async function onBannerArtFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || bannerArtState.busy) return
  bannerArtState.busy = true
  try {
    await saveCustomBannerArt(file)
    notify('横幅图片已更新')
  } catch (error) {
    notify(
      error instanceof Error ? error.message : '横幅图片保存失败，请重试。',
      'error'
    )
  } finally {
    bannerArtState.busy = false
  }
}

// 移除自定义横幅图：只清图数据，横幅随即回退原始人物，人物选择本身不动。
function removeBannerArt(): void {
  clearCustomBannerArt()
  notify('已移除自定义横幅图')
}

// 人物预览卡的缩略图来源：内置人物用各自的横幅整图，自定义卡用已上传的图
// （没传时返回空，卡面显示未上传占位）。
function bannerArtThumb(value: string): string {
  if (value === 'custom') return customBannerArt.value
  return bannerArtAssets[value]?.art ?? ''
}

// 点选人物预览卡：与原分段控件同一条草稿通路，应用或保存后正式生效。
function pickBannerCharacter(value: string): void {
  setSetting('bannerCharacter', value)
}
</script>

<template>
  <!-- 设置内容组件：原有卡片、开关与滑动标签的视觉和动画保持不变。 -->
  <div
    :class="section === 'audio' ? 'space-y-[12px]' : 'space-y-[22px]'"
    data-panel="settings"
  >
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'general'"
      ><!-- 窗口设置：选择关闭主窗口后是否在托盘继续运行。 -->
      <section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          窗口
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-0 flex-1">
              <b>关闭时收起到系统托盘</b>
              <span id="close-to-tray-help"
                >开启后继续播放，可从托盘恢复窗口。关掉此选项后，关闭主窗口会退出播放器。</span
              >
            </div>
            <!-- 设置开关：只修改草稿，应用或保存后生效。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.closeToTray }"
              role="switch"
              :aria-checked="settings.closeToTray"
              aria-label="关闭时收起到系统托盘"
              aria-describedby="close-to-tray-help"
              @click="setSetting('closeToTray', !settings.closeToTray)"
              ><i></i
            ></BaseButton>
          </div>
        </div>
      </section>
      <section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          播放 · PLAYBACK
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>无缝播放</b><span>预留选项，尚未接入真实无缝音频衔接</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.gapless }"
              role="switch"
              :aria-checked="settings.gapless"
              @click="setSetting('gapless', !settings.gapless)"
              aria-label="无缝播放"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>交叉淡化</b><span>预留选项，尚未接入双音轨交叉淡化</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.crossfadeOn }"
              role="switch"
              :aria-checked="settings.crossfadeOn"
              @click="setSetting('crossfadeOn', !settings.crossfadeOn)"
              aria-label="交叉淡化"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>淡化时长</b
              ><span
                >交叉淡化持续的秒数 · 当前
                <span>{{ settings.crossfade }} 秒</span></span
              >
            </div>
            <div class="set-slider w-[172px] flex-none">
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                :value="settings.crossfade"
                :style="{ '--p': (settings.crossfade / 12) * 100 + '%' }"
                @input="updateCrossfade"
                aria-label="交叉淡化时长"
              />
            </div>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>音量标准化</b><span>预留选项，尚未接入真实响度标准化</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.normalize }"
              role="switch"
              :aria-checked="settings.normalize"
              @click="setSetting('normalize', !settings.normalize)"
              aria-label="音量标准化"
              ><i></i
            ></BaseButton>
          </div>
        </div>
      </section>
      <section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          睡眠定时器
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>睡眠定时器</b><span>此处仅保存偏好，真实定时暂停尚未接入</span>
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="sleep"
              hook="data-set-seg"
              :options="[
                { label: '关闭', value: '关闭' },
                { label: '15 分钟', value: '15 分钟' },
                { label: '30 分钟', value: '30 分钟' },
                { label: '60 分钟', value: '60 分钟' },
              ]"
            />
          </div>
        </div></section
    ></template>
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'audio'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          音质与输出 · AUDIO
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] py-[5px]">
            <div class="set-txt min-w-[0] flex-1">
              <b>默认音质</b
              ><span
                >网易云点播将请求所选音质，实际档位由平台授权决定。</span
              >
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="quality"
              hook="data-set-seg"
              :options="playbackQualities"
            />
          </div>
          <div class="set-row flex items-center gap-[14px] py-[5px]">
            <div class="set-txt min-w-[0] flex-1">
              <b>输出设备</b
              ><span>仅保存设备名称偏好，尚未调用系统输出切换</span>
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="output"
              hook="data-set-seg"
              :options="[
                { label: '桌面音箱', value: '桌面音箱' },
                { label: '耳机', value: '耳机' },
              ]"
            />
          </div>
        </div>
      </section>
      <!-- 音效完整设置：真实十频段与预设、自定义保存集中展示。 -->
      <DeferredSettingsPanel section="audio" />
    </template>
    <!-- 缓存与下载完整设置：目录草稿、实际占用、下载音质与安全清理。 -->
    <DeferredSettingsPanel v-if="section === 'storage'" section="storage" />
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'appearance'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          界面 · INTERFACE
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>玻璃质感</b
              ><span
                >整个窗口的材质风格 —
                沿用播放器的毛玻璃或液态玻璃材质，应用后同步到主窗口</span
              >
            </div>
            <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
            <PlayerTabs
              kind="segment"
              class="set-seg flex flex-none flex-wrap justify-end gap-[4px]"
              setting-key="glassStyle"
              hook="data-set-seg"
              :options="[
                { label: '跟随窗口', value: 'match' },
                { label: '毛玻璃', value: 'frosted' },
                { label: '液态玻璃', value: 'liquid' },
              ]"
            />
          </div>
          <div class="set-row flex flex-col gap-[10px] p-[12px_0]">
            <div class="set-txt min-w-[0]">
              <b>横幅人物</b
              ><span
                >首页横幅右侧的人物形象 —
                内置人物自带随音乐律动的点阵；自定义上传只显示图片本身</span
              >
            </div>
            <!-- 横幅人物预览卡：每张卡带人物横幅缩略图，点卡即选；选项数据驱动，新增内置人物只改 banner-art.ts。 -->
            <div
              class="banner-art-cards"
              role="radiogroup"
              aria-label="横幅人物"
            >
              <button
                v-for="option in bannerArtOptions"
                :key="option.value"
                type="button"
                class="banner-art-card"
                :class="{ on: settings.bannerCharacter === option.value }"
                role="radio"
                :aria-checked="settings.bannerCharacter === option.value"
                :data-banner-card="option.value"
                @click="pickBannerCharacter(option.value)"
              >
                <span class="banner-art-thumb">
                  <img
                    v-if="bannerArtThumb(option.value)"
                    :src="bannerArtThumb(option.value)"
                    alt=""
                  />
                  <span v-else class="banner-art-empty">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 16V5" />
                      <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
                      <path d="M4 16.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.5" />
                    </svg>
                    <span>未上传</span>
                  </span>
                  <span
                    v-if="settings.bannerCharacter === option.value"
                    class="banner-art-check"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m4.5 12.5 5 5 10-11" />
                    </svg>
                  </span>
                </span>
                <span class="banner-art-name">{{ option.label }}</span>
              </button>
            </div>
          </div>
          <!-- 自定义上传展开区：选中“自定义上传”才出现，含预览、换图与移除。 -->
          <Transition name="banner-art">
            <div
              v-if="settings.bannerCharacter === 'custom'"
              class="set-row flex items-center gap-[14px] p-[12px_0]"
            >
              <img
                v-if="customBannerArt"
                :src="customBannerArt"
                class="banner-art-preview"
                alt="自定义横幅图预览"
              />
              <div class="set-txt min-w-[0] flex-1">
                <b>{{ customBannerArt ? '已上传自定义图' : '尚未上传' }}</b
                ><span>{{
                  customBannerArt
                    ? '横幅正在使用这张图，换一张会立即生效。'
                    : '还没上传时横幅先显示原始人物，上传后立即切换。'
                }}</span>
              </div>
              <div class="flex flex-none items-center gap-[7px]">
                <!-- 页面操作按钮：打开系统文件选择器挑图。 -->
                <BaseButton
                  class="min-h-[30px] rounded-full px-[13px] py-[6px] text-[11.5px] font-bold disabled:opacity-40"
                  :loading="bannerArtState.busy"
                  :disabled="bannerArtState.busy"
                  @click="pickBannerArt"
                  >{{ customBannerArt ? '更换图片' : '选择图片' }}</BaseButton
                >
                <!-- 页面操作按钮：移除自定义图，横幅回退原始人物。 -->
                <BaseButton
                  v-if="customBannerArt"
                  class="min-h-[30px] rounded-full px-[13px] py-[6px] text-[11.5px] font-bold disabled:opacity-40"
                  :disabled="bannerArtState.busy"
                  @click="removeBannerArt"
                  >移除</BaseButton
                >
              </div>
              <input
                ref="bannerArtInput"
                type="file"
                accept="image/*"
                hidden
                @change="onBannerArtFile"
              />
            </div>
          </Transition>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>底栏频谱</b><span>在播放进度条下方显示音频频谱</span>
            </div>
            <BaseButton class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.bottomSpectrum }" role="switch" aria-label="底栏频谱"
              :aria-checked="settings.bottomSpectrum" @click="setSetting('bottomSpectrum', !settings.bottomSpectrum)"><i /></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>天气胶囊</b><span>顶栏与全屏显示本地天气和附近城市，地名在设备上匹配。</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.weather }"
              role="switch"
              :aria-checked="settings.weather"
              @click="setSetting('weather', !settings.weather)"
              aria-label="天气胶囊"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>界面动效</b
              ><span>天气图标漂移、全屏背景巨字缓漂等动态效果</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.motion }"
              role="switch"
              :aria-checked="settings.motion"
              @click="setSetting('motion', !settings.motion)"
              aria-label="界面动效"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>正在播放面板</b
              ><span
                >右侧大封面、歌词与播放队列面板 —
                关掉即收起，给中间列表腾出横向空间；也可以点主区与右栏接缝处的小箭头</span
              >
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: npOpen }"
              role="switch"
              :aria-checked="npOpen"
              @click="setNowPlaying(!npOpen)"
              aria-label="正在播放面板"
              ><i></i
            ></BaseButton>
          </div>
        </div></section
    ></template>
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'desktop'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          桌面窗口 · DESKTOP
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <!-- 桌面灵动岛及其拖动吸附设置。 -->
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-0 flex-1">
              <b>桌面灵动岛</b><span>在桌面置顶显示歌词，按住可拖动</span>
            </div>
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.lyricIsland }"
              role="switch"
              :aria-checked="settings.lyricIsland"
              aria-label="桌面灵动岛"
              @click="setSetting('lyricIsland', !settings.lyricIsland)"
              ><i
            /></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>桌面灵动岛贴边吸附</b><span>拖近屏幕工作区边缘后松开，胶囊会自动贴边</span>
            </div>
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0 disabled:opacity-50"
              :class="{ on: settings.lyricIslandSnap }"
              role="switch"
              :aria-checked="settings.lyricIslandSnap"
              :disabled="!settings.lyricIsland"
              aria-label="桌面灵动岛贴边吸附"
              @click="setSetting('lyricIslandSnap', !settings.lyricIslandSnap)"
            ><i /></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>桌面歌词</b
              ><span
                >页面下方桌面区的悬浮歌词窗 —
                可拖动，字号与透明度在桌面区工具条里调</span
              >
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.deskLyrics }"
              role="switch"
              :aria-checked="settings.deskLyrics"
              @click="setSetting('deskLyrics', !settings.deskLyrics)"
              aria-label="桌面歌词"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>桌面歌词锁定</b
              ><span
                >锁定后歌词窗点击穿透、不挡鼠标 — 在桌面区工具条或这里解锁</span
              >
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.deskLock }"
              role="switch"
              :aria-checked="settings.deskLock"
              @click="setSetting('deskLock', !settings.deskLock)"
              aria-label="桌面歌词锁定"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>托盘迷你播放器</b
              ><span
                >桌面区任务栏右下角的 MiraiPlayer 托盘图标 —
                关掉即隐藏，点开是迷你播放器</span
              >
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              :class="{ on: settings.trayMini }"
              role="switch"
              :aria-checked="settings.trayMini"
              @click="setSetting('trayMini', !settings.trayMini)"
              aria-label="托盘迷你播放器"
              ><i></i
            ></BaseButton>
          </div>
        </div></section
    ></template>
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'shortcuts'"
      ><section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          快捷键 · SHORTCUTS
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>播放 / 暂停</b
              ><span
                >焦点在按钮上时空格仍用于触发按钮，在输入框里打字时不触发</span
              >
            </div>
            <kbd>空格</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1"><b>快退 5 秒</b></div>
            <kbd>←</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1"><b>快进 5 秒</b></div>
            <kbd>→</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>音量增大</b><span>每次 +5</span>
            </div>
            <kbd>↑</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>音量减小</b><span>每次 −5</span>
            </div>
            <kbd>↓</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>静音 / 恢复音量</b><span>恢复到静音前的音量</span>
            </div>
            <kbd>M</kbd>
          </div>
          <div class="key-row flex items-center gap-[14px] p-[10px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>关闭全屏播放 / 返回首页</b>
            </div>
            <kbd>Esc</kbd>
          </div>
        </div>
      </section></template
    >
    <!-- 设置分组：保留原稿控件，按左侧分类展示。 -->
    <template v-if="section === 'about'">
      <!-- 关于页的更新操作与已安装的播放器信息。 -->
      <AppUpdatePanel />
      <section>
        <h3
          class="pg-secttl m-[0_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
        >
          关于 · ABOUT
        </h3>
        <div
          class="set-card rounded-[16px] border border-transparent p-[4px_14px]"
        >
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b><img src="@/assets/miraiplayer.png" width="28" height="28" class="mr-2 inline-block align-middle" alt="" />Mirai Player</b><span>{{ appInfo.description }}</span>
            </div>
            <span
              class="about-val flex-none text-right font-mono text-[11.5px] font-bold opacity-[.72]"
              :aria-label="'版本 ' + appInfo.version"
              >v{{ appInfo.version }}</span
            >
          </div>
          <div class="set-row flex flex-wrap items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-0 flex-1">
              <b>开发者</b><span>{{ appInfo.author }}</span>
            </div>
            <a
              :href="appInfo.homepage"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-sm text-[13px] font-semibold underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4"
              @click="openProject"
            >GitHub 项目主页</a>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>数据说明</b
              ><span
                >公开歌单和已应用的设置保存在本机。音频与歌词由曲目来源提供。</span
              >
            </div>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>技术栈</b><span>Vue 3 + Tauri，在线曲库通过 FastAPI 获取</span>
            </div>
          </div>
        </div>
      </section></template
    >
  </div>
</template>

<style scoped>
/* 横幅人物预览卡：等分排布（宽窗 6 列、中窗 4 列、窄窗 2 列，11 张卡排 6+5 两行不落单），缩略图按横幅 3:1 裁切不变形。 */
.banner-art-cards {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 1080px) {
  .banner-art-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 680px) {
  .banner-art-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.banner-art-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgb(255 255 255 / 10%);
  background: rgb(255 255 255 / 4%);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}
.banner-art-card:hover {
  border-color: rgb(255 255 255 / 32%);
}
.banner-art-card:focus-visible {
  outline: 2px solid rgb(255 255 255 / 75%);
  outline-offset: 2px;
}
/* 选中态沿用设置页的亮边语言：提亮描边与底色，右上角白色勾选角标，不另起彩色。 */
.banner-art-card.on {
  border-color: rgb(255 255 255 / 78%);
  background: rgb(255 255 255 / 9%);
}
.banner-art-thumb {
  position: relative;
  display: block;
  aspect-ratio: 3 / 1;
  border-radius: 8px;
  overflow: hidden;
  background: rgb(255 255 255 / 5%);
}
.banner-art-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.banner-art-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1.5px dashed rgb(255 255 255 / 28%);
  border-radius: 8px;
  color: rgb(255 255 255 / 55%);
  font-size: 10.5px;
  font-weight: 700;
}
.banner-art-empty svg {
  width: 16px;
  height: 16px;
}
.banner-art-check {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #fff;
  color: #111;
  box-shadow: 0 1px 5px rgb(0 0 0 / 45%);
}
.banner-art-check svg {
  width: 11px;
  height: 11px;
}
.banner-art-name {
  padding: 0 2px;
  font-size: 11.5px;
  font-weight: 700;
  opacity: 0.72;
}
.banner-art-card.on .banner-art-name {
  opacity: 1;
}
.settings-calm .banner-art-card {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .banner-art-card {
    transition: none;
  }
}
/* 自定义横幅图预览：按横幅 3:1 比例裁切的小图，与设置卡片的圆角和细边一致。 */
.banner-art-preview {
  width: 120px;
  height: 40px;
  flex: none;
  border-radius: 10px;
  border: 1px solid rgb(255 255 255 / 12%);
  object-fit: cover;
}
/* 自定义上传展开区淡入淡出：与设置分类切换同档（约 200ms），只动透明度与小位移。 */
.banner-art-enter-active,
.banner-art-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}
.banner-art-enter-from,
.banner-art-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.settings-calm .banner-art-enter-active,
.settings-calm .banner-art-leave-active {
  transition: none;
}
.settings-calm .banner-art-enter-from,
.settings-calm .banner-art-leave-to {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .banner-art-enter-active,
  .banner-art-leave-active {
    transition: none;
  }
  .banner-art-enter-from,
  .banner-art-leave-to {
    transform: none;
  }
}
</style>
