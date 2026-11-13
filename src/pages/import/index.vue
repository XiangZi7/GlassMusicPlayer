<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import {
  computed,
  onBeforeUnmount,
  reactive,
  toRefs,
  useTemplateRef,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "@/components/ui/AppIcon.vue";
import SlidingTabs from "@/components/ui/SlidingTabs.vue";
import TrackList from "@/components/music/TrackList.vue";
import { usePlayerStore } from "@/stores/player";
import { formatSize } from "@/utils/format";
import { notify } from "@/services/notification";
import type { Track } from "@/types/music";
const route = useRoute();
const router = useRouter();
const player = usePlayerStore();
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
const folderInput = useTemplateRef<HTMLInputElement>("folderInput");
const playlistInput = useTemplateRef<HTMLInputElement>("playlistInput");
// 响应式状态：导入过程与结果队列只在当前页面展示。
const state = reactive({
  // 防止重复提交的导入状态。
  importing: false,
  // 拖放音频时的高亮状态。
  dragging: false,
  // 本次待处理文件数量。
  total: 0,
  // 已处理文件数量。
  completed: 0,
  // 本次文件的结果记录。
  results: [] as { name: string; size: string; status: string }[],
});
const { importing, dragging, total, completed, results } = toRefs(state);
let disposed = false;
const options = [
  { value: "local", label: "本地导入" },
  { value: "platforms", label: "平台歌单" },
  { value: "downloads", label: "下载管理" },
  { value: "features", label: "功能全景" },
];
const tab = computed({
  get: () =>
    options.some((option) => option.value === route.params.tab)
      ? String(route.params.tab)
      : "local",
  set: (value: string) => {
    void router.push(`/import/${value}`);
  },
});
const platforms = [
  {
    name: "网易云音乐",
    initials: "云",
    color: "#d53d48",
    description: "收藏的每一首歌，都有一段故事。",
  },
  {
    name: "酷狗音乐",
    initials: "K",
    color: "#2f90dc",
    description: "把熟悉的歌单，带到新的聆听空间。",
  },
  {
    name: "酷我音乐",
    initials: "W",
    color: "#c8a82a",
    description: "让不同平台的音乐收藏相遇。",
  },
];

// 按文件逐个落盘并更新结果；重复文件跳过，失败不阻止其他音频导入。
async function importFiles(files: File[]): Promise<void> {
  if (state.importing) return;
  const audioFiles = files.filter((file) =>
    /\.(mp3|wav|flac|ogg|m4a|aac|opus|aiff|aif|webm)$/i.test(file.name),
  );
  if (!audioFiles.length) {
    notify("请选择 MP3、FLAC、WAV、OGG 等音频文件", "error");
    return;
  }
  state.importing = true;
  state.total = audioFiles.length;
  state.completed = 0;
  state.results = [];
  let added = 0;
  for (const file of audioFiles) {
    if (disposed) break;
    let status = "已导入";
    try {
      const track = await player.importFile(file);
      if (track) added++;
      else status = "已存在，跳过";
    } catch {
      status = "导入失败";
    }
    state.results.push({
      name: file.name,
      size: formatSize(file.size),
      status,
    });
    state.completed++;
  }
  state.importing = false;
  const failures = state.results.filter(
    (item) => item.status === "导入失败",
  ).length;
  notify(
    `已导入 ${added} 首歌曲${failures ? `，${failures} 个文件失败` : ""}`,
    failures ? "error" : "info",
  );
}

// 文件选择与文件夹选择共用处理流程，结束后清空 input 便于重新选同一文件。
function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  void importFiles(Array.from(input.files || []));
  input.value = "";
}

// 拖入文件夹时递归读取目录条目，将子目录音频一并交给导入队列。
async function collectEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile)
    return new Promise((resolve, reject) =>
      (entry as FileSystemFileEntry).file((file) => resolve([file]), reject),
    );
  if (!entry.isDirectory) return [];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const files: File[] = [];
  while (true) {
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (!entries.length) return files;
    for (const child of entries) files.push(...(await collectEntry(child)));
  }
}

// 接收文件或目录拖放，目录读取失败时通过公共通知提供反馈。
async function onDrop(event: DragEvent): Promise<void> {
  state.dragging = false;
  if (state.importing || !event.dataTransfer) return;
  const entries = Array.from(event.dataTransfer.items)
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => !!entry);
  const fallback = Array.from(event.dataTransfer.files);
  try {
    await importFiles(
      entries.length
        ? (await Promise.all(entries.map(collectEntry))).flat()
        : fallback,
    );
  } catch {
    notify("无法读取文件夹，请使用「选择文件夹」重新导入", "error");
  }
}

// 从用户选择的 JSON 歌单按歌名和歌手匹配本地曲库，不伪造第三方授权或音源。
async function importPlaylist(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const data: unknown = JSON.parse(await file.text());
    if (
      !data ||
      typeof data !== "object" ||
      !("name" in data) ||
      !("tracks" in data) ||
      typeof data.name !== "string" ||
      !data.name.trim() ||
      !Array.isArray(data.tracks)
    )
      throw new Error();
    const ids: string[] = [];
    for (const item of data.tracks) {
      if (!item || typeof item !== "object" || typeof item.title !== "string")
        continue;
      const match = player.tracks.find(
        (track) =>
          track.title.toLowerCase() === item.title.toLowerCase() &&
          (!item.artist ||
            track.artist.toLowerCase() === String(item.artist).toLowerCase()),
      );
      if (match && !ids.includes(match.id)) ids.push(match.id);
    }
    if (!ids.length) {
      notify("歌单中没有匹配到本地歌曲，请先导入对应音频");
      return;
    }
    const id = player.createPlaylist(data.name.slice(0, 40), ids);
    const playlist = player.playlists.find((item) => item.id === id);
    if (playlist) playlist.imported = true;
    notify(`已导入歌单「${data.name}」，匹配 ${ids.length} 首歌曲`);
  } catch {
    notify("歌单格式无效，请使用包含 name 和 tracks 的 JSON 文件", "error");
  }
}

// 导出歌单格式示例，帮助用户把已有曲库收藏迁入本应用。
function downloadTemplate(): void {
  const sample = {
    name: "我的音乐收藏",
    tracks: [
      { title: "Midnight Drift", artist: "Neon Coast" },
      { title: "Solar Wind", artist: "June Harbor" },
    ],
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "mirai-playlist-example.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
onBeforeUnmount(() => {
  disposed = true;
});
const localTracks = computed<Track[]>(() => player.localTracks);
</script>

<template>
  <div>
    <!-- 内容导入导航区：本地音频、平台歌单和功能边界。 -->
    <h1 class="page-heading">内容导入</h1>
    <p class="page-description">把散落的音乐，收进同一处。</p>
    <SlidingTabs
      v-model="tab"
      :options="options"
      label="内容导入分类"
      class="mt-5"
    />
    <!-- 本地音频投放区：支持文件、整个文件夹以及拖放目录。 -->
    <section v-if="tab === 'local'" class="mt-6" :aria-busy="importing">
      <div
        class="relative flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/3 p-6 text-center transition-colors"
        :class="{ 'border-accent bg-accent/10': dragging }"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <AppIcon name="upload" :size="32" class="mb-5 text-white/60" />
        <h2 class="text-base font-bold">把喜欢的音乐，拖到这里</h2>
        <p class="mt-3 text-[11px] text-muted">
          MP3 · FLAC · WAV · OGG · M4A · 支持整个文件夹
        </p>
        <div class="mt-6 flex gap-3">
          <BaseButton
            variant="primary"
            :disabled="importing"
            @click="fileInput?.click()"
          >
            选择音频文件</BaseButton
          ><BaseButton
            variant="secondary"
            :disabled="importing"
            @click="folderInput?.click()"
          >
            <AppIcon name="folder" :size="14" />选择文件夹
          </BaseButton>
        </div>
        <div
          v-if="importing"
          class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl bg-surface/90"
          role="status"
        >
          <span
            class="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white"
          />
          <p class="text-xs">正在导入 {{ completed }} / {{ total }}</p>
        </div>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="audio/*,.flac,.opus,.aiff"
        multiple
        class="hidden"
        @change="onFileChange"
      /><input
        ref="folderInput"
        type="file"
        webkitdirectory
        multiple
        class="hidden"
        @change="onFileChange"
      />
      <div
        v-if="results.length"
        class="my-6 rounded-2xl border border-white/10 p-4"
      >
        <h2 class="mb-3 text-xs font-bold">本次导入</h2>
        <div
          v-for="(result, index) in results"
          :key="index"
          class="flex items-center gap-3 border-b border-white/5 py-2 text-[10px] last:border-0"
        >
          <span class="min-w-0 flex-1 truncate">{{ result.name }}</span><span
            class="text-muted"
            >{{ result.size }}</span
          ><span
            :class="
              result.status === '导入失败'
                ? 'text-rose-300'
                : 'text-emerald-200/70'
            "
            >{{ result.status }}</span
          >
        </div>
      </div>
      <h2 class="section-heading">我导入的 · {{ localTracks.length }} 首</h2>
      <TrackList
        :tracks="localTracks"
        sortable
        empty-text="导入本地音频后，即可离线播放并添加到你的歌单。"
      />
    </section>
    <!-- 平台歌单区：保留原稿平台卡片，真实账号入口明确标记未接入。 -->
    <section v-else-if="tab === 'platforms'" class="mt-6 space-y-3">
      <div
        v-for="platform in platforms"
        :key="platform.name"
        class="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-5"
      >
        <span
          class="grid size-11 shrink-0 place-items-center rounded-xl text-lg font-extrabold"
          :style="{ backgroundColor: platform.color }"
          >{{ platform.initials }}</span
        >
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-bold">{{ platform.name }}</h2>
          <p class="mt-2 text-[10px] leading-5 text-muted">
            {{ platform.description }}
          </p>
        </div>
        <span
          class="rounded-full border border-white/10 px-3 py-2 text-[10px] text-muted"
          >官方授权待接入</span
        >
      </div>
      <div class="mt-6 rounded-2xl border border-white/10 p-5">
        <h2 class="text-sm font-bold">导入已有歌单</h2>
        <p class="mt-3 text-[11px] leading-6 text-muted">
          通过 JSON
          歌单文件匹配本地音乐库中的歌曲。歌单只记录收藏，不包含音频文件。
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <BaseButton variant="primary" @click="playlistInput?.click()">
            选择歌单文件</BaseButton
          ><BaseButton variant="secondary" @click="downloadTemplate">
            下载格式示例
          </BaseButton>
        </div>
        <input
          ref="playlistInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="importPlaylist"
        />
      </div>
    </section>
    <!-- 下载管理区：只展示可真实导出的本地音频，不使用模拟下载进度。 -->
    <section v-else-if="tab === 'downloads'" class="mt-6">
      <div class="mb-6 rounded-2xl border border-white/10 bg-white/3 p-5">
        <h2 class="text-sm font-bold">本地音频文件</h2>
        <p class="page-description">
          歌曲菜单中的「导出音频文件」可以保存已导入的原文件。平台在线下载尚未接入。
        </p>
      </div>
      <TrackList
        :tracks="localTracks"
        empty-text="暂无可导出的音频，请先导入本地歌曲。"
      />
    </section>
    <!-- 功能全景区：区分当前可用功能与尚需授权或后端的能力。 -->
    <section v-else class="mt-6 grid gap-4 xl:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-white/3 p-6">
        <h2 class="mb-5 text-sm font-bold">现在就能使用</h2>
        <ul class="space-y-4 text-[11px] leading-6 text-muted">
          <li>本地音频导入、文件夹递归读取与离线播放</li>
          <li>搜索、音乐库、专辑、歌手与歌单管理</li>
          <li>收藏、最近播放、排序、分页与智能歌单</li>
          <li>全屏歌词、播放队列拖动、歌曲电台与睡眠定时</li>
          <li>毛玻璃 / 液态玻璃、置顶歌词窗与迷你播放器</li>
          <li>JSON 歌单导入与本地音频导出</li>
        </ul>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/3 p-6">
        <h2 class="mb-5 text-sm font-bold">后续接入</h2>
        <ul class="space-y-4 text-[11px] leading-6 text-muted">
          <li>第三方官方账号授权与在线音源</li>
          <li>实时天气、歌词自动匹配与翻译</li>
          <li>音效均衡器、交叉淡化与音量标准化</li>
          <li>多设备同步、云端收藏与离线下载</li>
          <li>系统托盘、年度报告与重复歌曲整理</li>
        </ul>
      </div>
    </section>
  </div>
</template>
