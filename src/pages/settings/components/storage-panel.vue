<script setup lang="ts">
import { computed, onMounted, reactive, toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChoiceMenu from '@/components/ui/BaseChoiceMenu.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import { usePlayer } from '@/composables/usePlayer'
import { playbackQualities } from '@/constants/music'
import { notify } from '@/services/notification'
import {
  getStorageInfo,
  chooseStorageDirectory,
  openStorageDirectory,
  clearAudioCache,
  isNativeStorageSupported,
  type StorageInfo,
  type StorageDirectoryKind,
} from '@/services/storage'

const player = usePlayer()
const { settings } = toRefs(player.state)
// 下载请求使用具体的音质档位，沿用播放器的标签和图标。
const downloadQualities = playbackQualities.filter(
  option => option.value !== 'auto'
)
const supported = isNativeStorageSupported()
// 响应式状态
const state = reactive({
  // 真实原生统计，浏览器预览不使用演示目录代替。
  info: null as StorageInfo | null,
  // 当前原生操作，防止重复打开选择器或并行清理。
  busy: false,
  // 清理只删除本应用专有音频缓存，必须明确确认。
  confirmClear: false,
})
const { info, busy, confirmClear } = toRefs(state)
const cacheUsage = computed(() =>
  state.info ? bytes(state.info.cacheBytes) : '—'
)
const downloadUsage = computed(() =>
  state.info ? bytes(state.info.downloadBytes) : '—'
)

// 以二进制容量显示真实文件字节，不使用固定的演示占用数字。
function bytes(value: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB']
  const index =
    value > 0 ? Math.min(3, Math.floor(Math.log(value) / Math.log(1024))) : 0
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

// 读取目录和实际占用，只填充缺失的目录草稿，不覆盖用户刚选择的路径。
async function refresh(): Promise<void> {
  if (!supported || state.busy) return
  state.busy = true
  try {
    state.info = await getStorageInfo()
    if (!player.state.settings.cacheDirectory)
      player.setSetting('cacheDirectory', state.info.cacheDirectory)
    if (!player.state.settings.downloadDirectory)
      player.setSetting('downloadDirectory', state.info.downloadDirectory)
  } catch (error) {
    notify(
      error instanceof Error ? error.message : '无法读取存储信息。',
      'error'
    )
  } finally {
    state.busy = false
  }
}

// 系统选择器只更新草稿，点击设置底栏应用/保存后才提交目录配置。
async function choose(kind: StorageDirectoryKind): Promise<void> {
  if (!supported || state.busy) return
  state.busy = true
  try {
    const directory = await chooseStorageDirectory(kind)
    if (directory)
      player.setSetting(
        kind === 'cache' ? 'cacheDirectory' : 'downloadDirectory',
        directory
      )
  } catch (error) {
    notify(error instanceof Error ? error.message : '目录选择失败。', 'error')
  } finally {
    state.busy = false
  }
}

// 打开当前已经应用的目录，不用未提交路径启动系统程序。
async function openDirectory(kind: StorageDirectoryKind): Promise<void> {
  try {
    await openStorageDirectory(kind)
  } catch (error) {
    notify(error instanceof Error ? error.message : '无法打开目录。', 'error')
  }
}

// 用户确认后仅清除固定自有音频缓存，不清理下载文件、歌单、账号与偏好。
async function clearCache(): Promise<void> {
  if (!supported || state.busy) return
  state.confirmClear = false
  state.busy = true
  try {
    const result = await clearAudioCache()
    state.info = await getStorageInfo()
    notify(
      result.removedFiles
        ? `已清理 ${result.removedFiles} 个音频缓存，释放 ${bytes(result.removedBytes)}。`
        : '没有可清理的音频缓存。'
    )
  } catch (error) {
    notify(error instanceof Error ? error.message : '清理缓存失败。', 'error')
  } finally {
    state.busy = false
  }
}
onMounted(refresh)
</script>

<template>
  <!-- 存储设置完整业务区：原生目录、真实统计和安全清理集中展示。 -->
  <section class="space-y-[18px]">
    <div class="set-card rounded-[16px] border border-transparent p-[14px]">
      <h3 class="m-0 text-[13px] font-bold">本机目录</h3>
      <p class="mt-[6px] text-[11.5px] leading-[1.6] text-white/55">
        {{
          supported
            ? '选择的目录先保留为草稿，应用或保存后生效；更换目录不会迁移或删除旧文件。'
            : '浏览器预览不具备原生目录与下载功能，请在桌面版设置。'
        }}
      </p>
      <!-- 缓存目录字段：只读路径和明确的选择/打开操作。 -->
      <label
        class="mt-[12px] block text-[12px] font-semibold"
        for="cache-directory"
        >音频缓存目录</label
      >
      <div class="mt-[6px] flex flex-wrap gap-[7px]">
        <input
          id="cache-directory"
          :value="settings.cacheDirectory"
          readonly
          :placeholder="supported ? '读取应用默认目录…' : '桌面版可用'"
          class="min-w-0 flex-1 rounded-[10px] border border-white/10 bg-white/4 px-[10px] py-[9px] text-[11.5px] text-white/75 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        /><BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[11.5px]"
          :disabled="!supported || busy"
          @click="choose('cache')"
          >选择目录</BaseButton
        ><BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[11.5px]"
          :disabled="!supported || busy"
          @click="openDirectory('cache')"
          >打开</BaseButton
        >
      </div>
      <!-- 下载目录字段：不把应用缓存目录混作用户离线文件目录。 -->
      <label
        class="mt-[14px] block text-[12px] font-semibold"
        for="download-directory"
        >下载保存目录</label
      >
      <div class="mt-[6px] flex flex-wrap gap-[7px]">
        <input
          id="download-directory"
          :value="settings.downloadDirectory"
          readonly
          :placeholder="supported ? '读取下载目录…' : '桌面版可用'"
          class="min-w-0 flex-1 rounded-[10px] border border-white/10 bg-white/4 px-[10px] py-[9px] text-[11.5px] text-white/75 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        /><BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[11.5px]"
          :disabled="!supported || busy"
          @click="choose('download')"
          >选择目录</BaseButton
        ><BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[11.5px]"
          :disabled="!supported || busy"
          @click="openDirectory('download')"
          >打开</BaseButton
        >
      </div>
      <p class="mt-[9px] mb-0 text-[10.5px] leading-[1.6] text-white/45">
        清理只识别应用专有音频缓存。自动播放音频落盘尚未接入，初始占用为真实
        0；公开歌单、账号、EQ 与播放偏好不计入此音频目录。
      </p>
    </div>
    <!-- 下载音质偏好：不承诺平台没有授权的无损资源。 -->
    <div class="set-card rounded-[16px] border border-transparent p-[14px]">
      <div class="flex flex-wrap items-center gap-[12px]">
        <div class="min-w-0 flex-1 basis-[165px]">
          <b class="text-[12px]">默认下载音质</b>
          <p
            id="download-quality-help"
            class="mt-[5px] mb-0 text-[11px] leading-[1.6] text-white/55"
          >
            网易云支持请求指定音质，其余平台沿用原有资源。实际格式、试听与权限以上游本次返回为准。
          </p>
        </div>
        <!-- 下载音质下拉框只更新设置草稿，应用或保存后提交。 -->
        <BaseChoiceMenu
          variant="field"
          label="默认下载音质"
          description-id="download-quality-help"
          :value="settings.downloadQuality"
          :options="downloadQualities"
          :motion="settings.motion"
          @select="player.setSetting('downloadQuality', $event)"
        />
      </div>
    </div>
    <!-- 真实占用：加载在统计内容内部，不插入会挤动页面的标题行。 -->
    <div
      class="set-card storage-usage relative grid gap-4 rounded-[16px] border border-transparent px-5 py-[18px]"
      :aria-busy="busy"
    >
      <div class="grid grid-cols-2 gap-x-5 gap-y-3">
        <div>
          <b class="block text-[19px] leading-6 tabular-nums">{{ cacheUsage }}</b>
          <p class="mt-[5px] mb-0 text-[11px] leading-4 text-white/60">
            音频缓存 · {{ info?.cacheFiles || 0 }} 个文件
          </p>
        </div>
        <div>
          <b class="block text-[19px] leading-6 tabular-nums">{{ downloadUsage }}</b>
          <p class="mt-[5px] mb-0 text-[11px] leading-4 text-white/60">
            已登记下载 · {{ info?.downloadCount || 0 }} 份
          </p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[11.5px]"
          :disabled="!supported || busy"
          @click="refresh"
          >刷新占用</BaseButton
        ><BaseButton
          class="imp-pick rounded-full px-[11px] py-[6px] text-[11.5px]"
          :disabled="!supported || busy || !info?.cacheFiles"
          @click="confirmClear = true"
          >清理音频缓存</BaseButton
        >
      </div>
      <div
        v-if="busy"
        class="absolute inset-0 grid place-items-center rounded-[16px] bg-[#18181f]/80"
        role="status"
        aria-label="正在处理存储操作"
      >
        <span
          class="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
        />
      </div>
    </div>
    <!-- 会话恢复设置：只缓存稳定曲目标识与公开元数据，不自动播放。 -->
    <div
      class="set-card flex items-center gap-[12px] rounded-[16px] border border-transparent p-[14px]"
    >
      <div class="min-w-0 flex-1">
        <b class="text-[12px]">记住当前歌曲与进度</b>
        <p class="mt-[5px] mb-0 text-[11px] leading-[1.6] text-white/55">
          缓存队列、收藏、公开曲目和已应用偏好；重启后恢复位置但不自动播放。Cookie、token
          和临时音频地址不会保存。
        </p>
      </div>
      <BaseButton
        class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
        :class="{ on: settings.rememberPlayback }"
        role="switch"
        :aria-checked="settings.rememberPlayback"
        aria-label="记住当前歌曲与进度"
        @click="
          player.setSetting('rememberPlayback', !settings.rememberPlayback)
        "
        ><i
      /></BaseButton>
    </div>
    <!-- 缓存清理确认：明确保护用户下载、关联账号和已导入歌单。 -->
    <BaseDialog
      v-model="confirmClear"
      labelled-by="cache-clear-title"
      ><div class="p-[22px]">
        <h3
          id="cache-clear-title"
          class="m-0 text-[15px] font-bold"
        >
          清理音频缓存？
        </h3>
        <p class="mt-[10px] text-[12px] leading-[1.7] text-white/60">
          只删除本应用专有目录中已识别的音频缓存。下载歌曲、账号关联、导入歌单、EQ
          预设和播放偏好均保留。
        </p>
        <div class="mt-[16px] flex justify-end gap-[8px]">
          <BaseButton
            class="imp-pick rounded-full px-[13px] py-[7px]"
            @click="confirmClear = false"
            >取消</BaseButton
          ><BaseButton
            class="banner-play rounded-full px-[13px] py-[7px]"
            @click="clearCache"
            >确认清理</BaseButton
          >
        </div>
      </div></BaseDialog
    >
  </section>
</template>
