<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import {
  computed,
  nextTick,
  reactive,
  toRefs,
  useTemplateRef,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { useResizeObserver } from "@vueuse/core";
import AppIcon from "@/components/ui/AppIcon.vue";
import { usePlayerStore } from "@/stores/player";
import { openDesktop } from "@/services/desktop";
import { notify } from "@/services/notification";

const player = usePlayerStore();
const route = useRoute();
const router = useRouter();
const sidebar = useTemplateRef<HTMLElement>("sidebar");
const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const nameInput = useTemplateRef<HTMLInputElement>("nameInput");
// 响应式状态：歌单编辑表单与导航胶囊位置。
const state = reactive({
  // 当前歌单表单名称。
  playlistName: "",
  // 正在改名的歌单编号，空值表示新建。
  editingId: "",
  // 删除确认中的歌单编号。
  deletingId: "",
  // 导航胶囊相对滚动容器的纵向位置。
  pillTop: 0,
  // 导航胶囊高度。
  pillHeight: 40,
});
const { playlistName, editingId, deletingId, pillTop, pillHeight } =
  toRefs(state);
const navItems = [
  { path: "/", label: "首页", icon: "home" },
  { path: "/search", label: "搜索", icon: "search" },
  { path: "/library", label: "音乐库", icon: "library" },
  { path: "/import", label: "内容导入", icon: "link" },
  { path: "/radio", label: "歌曲电台", icon: "radio" },
];
const activeKey = computed(() =>
  route.name === "collection"
    ? `collection:${route.params.kind}:${route.params.id}`
    : route.name === "home"
      ? "/"
      : `/${String(route.name)}`,
);

// 页面切换后测量选中入口，让同一颗高亮胶囊滑到目标位置。
async function updatePill(): Promise<void> {
  await nextTick();
  const element = sidebar.value?.querySelector<HTMLElement>(
    '[aria-current="page"]',
  );
  if (element) {
    state.pillTop = element.offsetTop;
    state.pillHeight = element.offsetHeight;
  }
}
watch(activeKey, updatePill, { immediate: true, flush: "post" });
useResizeObserver(sidebar, updatePill);

// 打开原生对话框新建或改名歌单，并把焦点交给名称输入框。
async function editPlaylist(id = ""): Promise<void> {
  state.editingId = id;
  state.playlistName =
    player.playlists.find((list) => list.id === id)?.name || "";
  dialog.value?.showModal();
  await nextTick();
  nameInput.value?.focus();
}

// 保存经过非空校验的歌单名称，新歌单创建后进入详情页。
function savePlaylist(): void {
  const name = state.playlistName.trim();
  if (!name) return;
  if (state.editingId) {
    const playlist = player.playlists.find(
      (list) => list.id === state.editingId,
    );
    if (playlist) playlist.name = name;
  } else {
    const id = player.createPlaylist(name);
    void router.push(`/collection/playlist/${id}`);
  }
  dialog.value?.close();
  notify(
    state.editingId
      ? "歌单名称已更新"
      : "歌单已创建，可从歌曲的更多操作添加歌曲",
  );
}

// 确认删除自建歌单；正在查看它时返回首页，避免进入失效详情。
function removePlaylist(id: string): void {
  player.deletePlaylist(id);
  state.deletingId = "";
  if (route.params.id === id) void router.push("/");
}
</script>

<template>
  <!-- 主侧边栏：主导航、歌单与桌面功能入口，可独立纵向滚动。 -->
  <aside
    ref="sidebar"
    class="glass relative flex min-h-0 flex-col gap-1 overflow-y-auto border-r border-white/10 px-3 pb-4 pt-5"
  >
    <span
      class="sliding-pill pointer-events-none absolute left-3 right-3 rounded-xl"
      :style="{ top: `${pillTop}px`, height: `${pillHeight}px` }"
    />
    <div class="relative mb-4 flex items-center gap-3 px-2">
      <span
        class="grid size-9 place-items-center rounded-xl bg-white text-xl text-zinc-900"
        >♪</span
      >
      <div>
        <b class="text-[15px] tracking-tight">Aura Player</b>
        <p
          class="mt-0.5 text-[9px] font-semibold tracking-widest text-white/50"
        >
          {{
            player.settings.glass === "liquid"
              ? "LIQUID EDITION"
              : "FROSTED EDITION"
          }}
        </p>
      </div>
    </div>
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-bold transition-colors hover:bg-white/5"
      :aria-current="activeKey === item.path ? 'page' : undefined"
      ><AppIcon :name="item.icon" :size="17" />{{ item.label
      }}<span
        v-if="item.path === '/library'"
        class="ml-auto font-mono text-[10px] text-white/45"
        >{{ player.tracks.length }}</span
      ><span
        v-if="item.path === '/radio' && player.radio"
        class="ml-auto size-1.5 rounded-full bg-emerald-300"
    /></RouterLink>
    <div class="relative mb-1 mt-7 flex items-center justify-between px-3">
      <span class="section-label">我的歌单</span
      ><BaseButton
        class="glass rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-muted hover:text-white"
        @click="editPlaylist()"
      >
        ＋ 新建
      </BaseButton>
    </div>
    <RouterLink
      v-for="album in player.albums.filter((item) => item.source === 'demo')"
      :key="album.album"
      :to="`/collection/album/${encodeURIComponent(album.album)}`"
      class="relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-xs font-semibold hover:bg-white/5"
      :aria-current="
        activeKey === `collection:album:${album.album}` ? 'page' : undefined
      "
      ><img
        :src="album.cover"
        alt=""
        class="size-7 rounded-lg object-cover"
      /><span class="truncate">{{ album.album }}</span></RouterLink
    >
    <div
      v-for="playlist in player.playlists"
      :key="playlist.id"
      class="group relative"
    >
      <div
        v-if="deletingId === playlist.id"
        class="flex min-h-12 items-center justify-between gap-1 rounded-xl bg-white/5 p-2 text-[10px]"
      >
        <span>删除此歌单？</span
        ><BaseButton class="text-rose-300" @click="removePlaylist(playlist.id)">
          删除</BaseButton
        ><BaseButton @click="deletingId = ''">取消</BaseButton>
      </div>
      <template v-else
        ><RouterLink
          :to="`/collection/playlist/${playlist.id}`"
          class="flex min-h-11 items-center gap-3 rounded-xl px-3 pr-14 text-xs font-semibold hover:bg-white/5"
          :aria-current="
            activeKey === `collection:playlist:${playlist.id}`
              ? 'page'
              : undefined
          "
          ><span
            class="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10"
            ><AppIcon name="music" :size="14" /></span
          ><span class="truncate">{{ playlist.name }}</span></RouterLink
        >
        <div
          class="absolute right-1 top-2 flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <BaseButton
            variant="icon"
            class="size-6"
            :aria-label="`重命名 ${playlist.name}`"
            @click="editPlaylist(playlist.id)"
          >
            <AppIcon name="edit" :size="12" /></BaseButton
          ><BaseButton
            variant="icon"
            class="size-6"
            :aria-label="`删除 ${playlist.name}`"
            @click="deletingId = playlist.id"
          >
            <AppIcon name="trash" :size="12" />
          </BaseButton></div
      ></template>
    </div>
    <p class="section-label relative mb-1 mt-7 px-3">桌面独有</p>
    <BaseButton class="sidebar-action" @click="openDesktop('mini')">
      <AppIcon name="monitor" :size="17" />迷你播放器
    </BaseButton>
    <BaseButton class="sidebar-action" @click="openDesktop('lyrics')">
      <AppIcon name="lyrics" :size="17" />悬浮歌词窗
    </BaseButton>
    <RouterLink
      to="/settings"
      class="sidebar-action"
      :aria-current="activeKey === '/settings' ? 'page' : undefined"
      ><AppIcon name="settings" :size="17" />设置</RouterLink
    >
    <div class="relative mt-auto pt-8">
      <div class="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
        <img
          src="/images/night-drive.webp"
          alt="用户头像"
          class="size-8 rounded-full object-cover"
        />
        <div>
          <b class="block text-xs">Haruto</b
          ><span class="mt-1 block text-[10px] text-muted"
            >本地音乐库 · FLAC</span
          >
        </div>
        <span class="ml-auto size-1.5 rounded-full bg-emerald-300" />
      </div>
    </div>
    <!-- 歌单编辑弹窗：原生 dialog 提供焦点约束和 Escape 关闭。 -->
    <dialog
      ref="dialog"
      class="glass m-auto w-96 rounded-3xl border border-white/15 p-6 text-white backdrop:bg-black/60"
    >
      <form @submit.prevent="savePlaylist">
        <h2 class="mb-2 text-xl font-bold">
          {{ editingId ? "重命名歌单" : "创建新歌单" }}
        </h2>
        <p class="mb-6 text-xs text-muted">给下一段音乐时光，起个名字。</p>
        <label class="text-xs text-muted" for="playlist-name">歌单名称</label
        ><input
          id="playlist-name"
          ref="nameInput"
          v-model="playlistName"
          maxlength="40"
          required
          class="text-field mb-6 mt-2"
          placeholder="例如：一个人的深夜电台"
        />
        <div class="flex justify-end gap-3">
          <BaseButton
            variant="secondary"
            type="button"
            @click="dialog?.close()"
          >
            取消</BaseButton
          ><BaseButton
            variant="primary"
            type="submit"
            :disabled="!playlistName.trim()"
          >
            保存歌单
          </BaseButton>
        </div>
      </form>
    </dialog>
  </aside>
</template>
