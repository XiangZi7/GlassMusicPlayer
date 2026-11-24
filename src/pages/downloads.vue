<script setup lang="ts">
import { computed, onMounted, reactive, toRefs } from 'vue'
import { useRouter } from 'vue-router'
import { isTauri } from '@tauri-apps/api/core'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
import { notify } from '@/services/notification'
import { openSettingsWindow } from '@/services/desktop'
import {
  listDownloads,
  downloadCatalogTrack,
  openStorageDirectory,
  isNativeStorageSupported,
  type DownloadedTrack,
} from '@/services/storage'

const player = usePlayer()
const router = useRouter()
const supported = isNativeStorageSupported()
const current = computed(() => player.tracks[player.state.idx])
const quality = computed(
  () =>
    ({ standard: '标准', exhigh: '极高', lossless: '无损', hires: 'Hi-Res' })[
      player.state.settings.downloadQuality as
        'standard' | 'exhigh' | 'lossless' | 'hires'
    ] || '平台默认'
)
// 响应式状态
const state = reactive({
  // 只展示原生文件和元数据验证过的真实下载。
  records: [] as DownloadedTrack[],
  // 当前是否在读取真实记录。
  loading: false,
  // 下载中不展示虚假的百分比、暂停或断点续传。
  downloading: false,
})
const { records, loading, downloading } = toRefs(state)

// 显示实际字节数，不沿用演示任务的固定容量。
function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / 1024 ** 2).toFixed(1)} MiB`
}

// 刷新真实完成记录；浏览器不调用原生存储接口。
async function refresh(): Promise<void> {
  if (!supported || state.loading) return
  state.loading = true
  try {
    state.records = await listDownloads()
  } catch (error) {
    notify(
      error instanceof Error ? error.message : '读取下载记录失败。',
      'error'
    )
  } finally {
    state.loading = false
  }
}

// 下载点击时的当前曲目，平台或预览状态由原生检查，完成后再加入真实记录。
async function downloadCurrent(): Promise<void> {
  const track = current.value
  if (!supported || !track?.catalog || state.downloading) return
  state.downloading = true
  try {
    const saved = await downloadCatalogTrack(
      track,
      track.catalog.platform === 'netease'
        ? { quality: player.state.settings.downloadQuality }
        : {}
    )
    state.records = [
      saved,
      ...state.records.filter(item => item.key !== saved.key),
    ]
    notify(
      saved.status === 'preview'
        ? `已保存「${saved.title}」的试听音频。`
        : `已保存「${saved.title}」，权限与实际音质以上游返回为准。`
    )
  } catch (error) {
    notify(
      error instanceof Error ? error.message : '下载失败，请重试。',
      'error'
    )
  } finally {
    state.downloading = false
  }
}

// 使用系统文件管理器打开已应用的下载目录。
async function openFolder(): Promise<void> {
  try {
    await openStorageDirectory('download')
  } catch (error) {
    notify(
      error instanceof Error ? error.message : '无法打开下载目录。',
      'error'
    )
  }
}

// 存储设置使用已有独立设置窗，浏览器走设置路由，不打开全屏。
function openSettings(): void {
  if (isTauri()) void openSettingsWindow()
  else void router.push('/settings')
}
onMounted(refresh)
</script>

<template>
  <!-- 下载页面：真实本机任务和文件记录，不使用原稿演示下载数据。 -->
  <div
    class="page-panel import-files hidden"
    data-panel="downloads"
  >
    <div class="pg-head">
      <h3>下载管理</h3>
      <p>
        {{ supported ? '将平台允许下载的音频保存到本机目录。' : '在桌面客户端中可将音频保存到本机目录。' }}
      </p>
    </div>
    <!-- 内容导航：沿用平台对接、上传与下载的公共标签条。 -->
    <PlayerTabs
      class="pg-tabs mt-4 inline-flex max-w-full flex-wrap gap-1 rounded-full p-1"
      role="tablist"
      aria-label="内容导入分类"
      hook="data-src-tab"
      :options="[
        { label: '平台对接', value: 'connect' },
        { label: '本地曲目', value: 'upload' },
        { label: '下载管理', value: 'downloads' },
      ]"
    />
    <!-- 下载统计：只从原生完成记录和实际进行中的请求推导。 -->
    <div class="lib-stats mt-4 grid grid-cols-3 gap-2.5">
      <div>
        <b>{{ supported ? records.length : '—' }}</b
        ><span>文件已保存</span>
      </div>
      <div>
        <b>{{ downloading ? 1 : 0 }}</b
        ><span>正在下载</span>
      </div>
      <div>
        <b class="stat-text">{{ quality }}</b
        ><span>网易云下载偏好</span>
      </div>
    </div>
    <!-- 下载工具栏：当前歌曲的真实下载、目录与存储设置入口。 -->
    <div class="pl-actions import-actions mt-[18px] flex flex-wrap items-center gap-2">
      <BaseButton
        class="banner-play rounded-full px-[16px] py-[9px] text-[12px]"
        :loading="downloading"
        :disabled="!supported || !current?.catalog || downloading"
        @click="downloadCurrent"
        >{{ downloading ? '正在保存音频…' : '下载当前歌曲' }}</BaseButton
      >
      <BaseButton
        class="imp-pick rounded-full px-[12px] py-[7px] text-[12px]"
        :disabled="!supported"
        @click="openFolder"
        >打开下载目录</BaseButton
      >
      <BaseButton
        class="imp-pick rounded-full px-[12px] py-[7px] text-[12px]"
        :disabled="loading"
        @click="refresh"
        >刷新记录</BaseButton
      >
      <BaseButton
        class="imp-pick rounded-full px-[12px] py-[7px] text-[12px]"
        @click="openSettings"
        >存储设置</BaseButton
      >
    </div>
    <p class="src-note mt-2 break-words">
      {{
        current?.catalog
          ? `当前歌曲：${current.title}`
          : '请选择已导入或搜索到的在线歌曲。'
      }}
    </p>
    <!-- 下载记录内容：加载在区域中央，空态不展示固定测试文件。 -->
    <h4 class="import-section-title">下载记录</h4>
    <section
      class="relative min-h-[120px]"
      aria-label="已保存的下载文件"
      :aria-busy="loading"
    >
      <div
        v-if="loading"
        class="absolute inset-0 grid place-items-center"
        role="status"
        aria-label="正在读取下载记录"
      >
        <span
          class="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
        />
      </div>
      <EmptyState
        v-else-if="!records.length"
        class="min-h-[120px]"
        icon="download"
        label="没有真实下载记录"
      />
      <div
        v-else
        class="space-y-[7px]"
      >
        <article
          v-for="item in records"
          :key="item.key"
          class="file-row flex min-h-[62px] items-center gap-[12px] rounded-[13px] border border-transparent px-[12px] py-[10px]"
        >
          <svg
            class="size-5 flex-none text-white/50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
          </svg>
          <div class="min-w-0 flex-1">
            <b
              class="block truncate text-[13px] font-semibold"
              :title="item.fileName"
              >{{ item.title }}</b
            >
            <p class="mt-1 mb-0 truncate text-[12px] leading-[18px] text-white/65">
              {{ item.artist }} · {{ formatBytes(item.bytes) }} ·
              {{ item.quality || '平台未报告实际音质' }}
            </p>
          </div>
          <span
            class="max-w-[45%] rounded-full bg-white/5 px-2.5 py-1 text-[12px] leading-[18px] text-white/70"
            >{{
              item.status === 'preview'
                ? '试听已保存'
                : item.status === 'full'
                  ? '音频已保存'
                  : '已保存 · 权限状态待确认'
            }}</span
          >
        </article>
      </div>
    </section>
    <p class="src-note mt-3">
      下载以平台版权与会员规则为准；文件保存不代表会员权益授权。切换保存目录不会移动或删除原目录中的文件。本页面暂不提供自动离线播放或断点续传。
    </p>
  </div>
</template>
