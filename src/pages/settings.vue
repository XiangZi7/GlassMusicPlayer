<script setup lang="ts">
import { computed } from "vue";
import SlidingTabs from "@/components/ui/SlidingTabs.vue";
import { usePlayerStore } from "@/stores/player";
const player = usePlayerStore();
const glass = computed({
  get: () => player.settings.glass,
  set: (value: string) => {
    player.settings.glass = value === "liquid" ? "liquid" : "frosted";
  },
});
const sleep = computed({
  get: () => String(player.settings.sleep),
  set: (value: string) => {
    player.settings.sleep = Number(value);
  },
});
const glassOptions = [
  { value: "frosted", label: "毛玻璃" },
  { value: "liquid", label: "液态玻璃" },
];
const sleepOptions = [
  { value: "0", label: "关闭" },
  { value: "15", label: "15 分钟" },
  { value: "30", label: "30 分钟" },
  { value: "60", label: "60 分钟" },
];
const toggles = [
  {
    key: "panelOpen",
    label: "正在播放面板",
    description: "在右侧显示封面、歌词和播放队列。",
  },
  {
    key: "weather",
    label: "天气胶囊",
    description: "显示原稿的月云天气动画，当前为演示天气。",
  },
  {
    key: "motion",
    label: "界面动效",
    description: "开启封面呼吸、歌词过渡和玻璃视差。",
  },
] as const;
const shortcuts = [
  { key: "Space", action: "播放 / 暂停" },
  { key: "← / →", action: "快退 / 快进 5 秒" },
  { key: "↑ / ↓", action: "调整音量" },
  { key: "M", action: "静音 / 恢复声音" },
  { key: "Esc", action: "关闭全屏播放" },
  { key: "Ctrl + F", action: "搜索音乐库" },
];
</script>

<template>
  <div>
    <!-- 设置页标题：所有偏好即时生效并在本地保存。 -->
    <h1 class="page-heading">设置</h1>
    <p class="page-description">让每一次聆听，都更合你的心意。</p>
    <h2 class="section-heading">界面 · APPEARANCE</h2>
    <section class="rounded-2xl border border-white/10 bg-white/3 px-5">
      <div class="setting-row">
        <div>
          <h3 class="text-xs font-bold">玻璃质感</h3>
          <p class="mt-2 text-[10px] text-muted">
            为侧边栏、播放器和小控件选择一种触感。
          </p>
        </div>
        <SlidingTabs v-model="glass" :options="glassOptions" label="玻璃质感" />
      </div>
      <label
        v-for="item in toggles"
        :key="item.key"
        class="setting-row cursor-pointer"
        ><span
          ><b class="text-xs">{{ item.label }}</b
          ><span class="mt-2 block text-[10px] text-muted">{{
            item.description
          }}</span></span
        ><span class="relative shrink-0"
          ><input
            v-model="player.settings[item.key]"
            type="checkbox"
            class="peer sr-only"
            :aria-label="item.label" /><span
            class="block h-6 w-11 rounded-full bg-white/10 transition-colors peer-checked:bg-white/80 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" /><span
            class="absolute left-1 top-1 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-zinc-800" /></span
      ></label>
    </section>
    <h2 class="section-heading">播放 · PLAYBACK</h2>
    <section class="rounded-2xl border border-white/10 bg-white/3 px-5">
      <div class="setting-row">
        <div>
          <h3 class="text-xs font-bold">睡眠定时器</h3>
          <p class="mt-2 text-[10px] text-muted">
            倒计时结束后自动暂停，留一场好梦。
          </p>
        </div>
        <SlidingTabs
          v-model="sleep"
          :options="sleepOptions"
          label="睡眠定时器"
        />
      </div>
      <div class="setting-row">
        <div>
          <h3 class="text-xs font-bold">音频输出</h3>
          <p class="mt-2 text-[10px] text-muted">跟随系统默认扬声器或耳机。</p>
        </div>
        <span class="secondary-button cursor-default">系统默认输出</span>
      </div>
      <div class="setting-row">
        <div>
          <h3 class="text-xs font-bold">播放音质</h3>
          <p class="mt-2 text-[10px] text-muted">
            保留本地音频的原始格式与音质。
          </p>
        </div>
        <span
          class="rounded-full border border-white/10 px-4 py-2 font-mono text-[10px] text-white/60"
          >ORIGINAL AUDIO</span
        >
      </div>
    </section>
    <!-- 快捷键区：键盘操作说明与实际播放器事件保持一致。 -->
    <h2 class="section-heading">快捷键 · SHORTCUTS</h2>
    <div
      class="grid grid-cols-1 gap-x-8 rounded-2xl border border-white/10 bg-white/3 px-5 sm:grid-cols-2"
    >
      <div
        v-for="shortcut in shortcuts"
        :key="shortcut.key"
        class="flex items-center justify-between border-b border-white/7 py-4 text-[11px]"
      >
        <span class="text-muted">{{ shortcut.action }}</span><kbd
          class="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px]"
          >{{ shortcut.key }}</kbd
        >
      </div>
    </div>
    <!-- 关于区：明确当前演示与真实本地播放的功能边界。 -->
    <section class="my-8 text-center">
      <p class="text-sm font-extrabold tracking-tight">
        Mirai Music
        <span class="ml-2 font-mono text-[9px] font-normal text-muted"
          >v0.1.0</span
        >
      </p>
      <p class="mt-3 text-[10px] leading-6 text-muted">
        24 首演示曲目仅供界面预览 · 导入本地音频即可真实播放<br />三方平台登录、均衡器、交叉淡化与云同步尚未接入
      </p>
    </section>
  </div>
</template>
