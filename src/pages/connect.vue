<script setup lang="ts">
import { toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { computed } from 'vue'
import { usePlayer } from '@/composables/usePlayer'
import { importPlaylists } from '@/constants/music'
const { state } = usePlayer()
const connected = computed(
  () => Object.values(state.platforms).filter(Boolean).length
)
const available = computed(() =>
  importPlaylists.filter(
    item => state.platforms[item.plat as keyof typeof state.platforms]
  )
)
const picked = computed(
  () => importPlaylists.filter(item => state.impPicked[item.id]).length
)
// 已导入歌单保持原稿禁用状态，避免重复导入。
function isImported(name: string): boolean {
  return state.imported.some(item => item.name === name)
}
const { imported, lastSync, platforms, impPicked, impMsg, linkMsg } =
  toRefs(state)
</script>

<template>
  <!-- connect 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="connect"
  >
    <div class="pg-head">
      <h3>平台对接</h3>
      <p>
        把你在其他平台的歌单、喜欢和收藏搬进来 —
        连接后可勾选要导入的歌单，导入的歌单会出现在左侧「我的歌单」下方，两窗口同步。本页为设计原型：连接与导入在本页内演示，不会真的登录你的第三方账号；正式版需各平台开放平台授权（OAuth）后接入。
      </p>
    </div>
    <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
    <PlayerTabs
      class="pg-tabs mt-[16px] inline-flex max-w-[100%] flex-wrap gap-[4px] rounded-full p-[4px]"
      role="tablist"
      aria-label="内容导入分类"
      hook="data-src-tab"
      :options="[
        { label: '平台对接', value: 'connect' },
        { label: '上传歌曲', value: 'upload' },
        { label: '下载管理', value: 'downloads' },
      ]"
    />
    <div class="lib-stats mt-[16px] grid grid-cols-[repeat(4,1fr)] gap-[10px]">
      <div>
        <b>{{ connected }} / 3</b><span>已连接平台</span>
      </div>
      <div>
        <b>{{ imported.length }}</b><span>已导入歌单</span>
      </div>
      <div>
        <b>{{ imported.reduce((sum, item) => sum + item.count, 0) }}</b><span
          >导入歌曲（演示）</span
        >
      </div>
      <div>
        <b>{{ lastSync || '—' }}</b><span>最近同步</span>
      </div>
    </div>
    <div class="plat-grid mt-[16px] grid grid-cols-[repeat(3,1fr)] gap-[12px]">
      <div
        class="plat-card rounded-[18px] border border-transparent p-[15px]"
        data-plat-card="netease"
        :class="{ connected: platforms.netease }"
      >
        <div class="plat-top flex items-center gap-[11px]">
          <div
            class="plat-logo ne grid h-[40px] w-[40px] flex-none place-items-center rounded-[12px] text-[17px] font-black text-white"
          >
            云
          </div>
          <div><b>网易云音乐</b><span>歌单 · 我喜欢 · 每日推荐</span></div>
          <span
            class="plat-status ml-auto rounded-full p-[5px_10px] text-[11px] font-extrabold whitespace-nowrap"
            :class="{ on: platforms.netease }"
            >{{ platforms.netease ? '已连接' : '未连接' }}</span
          >
        </div>
        <p>同步你的网易云歌单与红心歌曲，封面、歌词与播放记录一并对齐。</p>
        <div
          class="plat-meta mb-[12px] flex flex-wrap gap-[12px] font-mono text-[10.5px] opacity-[.75]"
        >
          <span>歌单 12</span><span>喜欢 486 首</span><span>等级 LV.8</span>
        </div>
        <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          class="plat-btn min-h-[36px] w-full rounded-full p-[9px] text-[12.5px] font-extrabold"
          data-conn-btn="netease"
          :class="{ off: platforms.netease }"
          >{{ platforms.netease ? '断开连接' : '连接网易云' }}</BaseButton
        >
        <div class="plat-detail mt-[12px] hidden pt-[11px]">
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>自动同步新歌单</b><span>在网易云新建的歌单自动出现在这里</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch on relative h-[25px] w-[42px] flex-none rounded-full p-0"
              data-src-toggle="neaseAuto"
              role="switch"
              aria-checked="true"
              aria-label="网易云自动同步"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>同步「我喜欢」</b><span>红心歌曲合并进「我喜欢的」</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch on relative h-[25px] w-[42px] flex-none rounded-full p-0"
              data-src-toggle="neaseLiked"
              role="switch"
              aria-checked="true"
              aria-label="网易云同步喜欢"
              ><i></i
            ></BaseButton>
          </div>
        </div>
      </div>
      <div
        class="plat-card rounded-[18px] border border-transparent p-[15px]"
        data-plat-card="kugou"
        :class="{ connected: platforms.kugou }"
      >
        <div class="plat-top flex items-center gap-[11px]">
          <div
            class="plat-logo kg grid h-[40px] w-[40px] flex-none place-items-center rounded-[12px] text-[17px] font-black text-white"
          >
            狗
          </div>
          <div><b>酷狗音乐</b><span>歌单 · 收藏 · 本地歌曲</span></div>
          <span
            class="plat-status ml-auto rounded-full p-[5px_10px] text-[11px] font-extrabold whitespace-nowrap"
            :class="{ on: platforms.kugou }"
            >{{ platforms.kugou ? '已连接' : '未连接' }}</span
          >
        </div>
        <p>导入酷狗的自建歌单与收藏夹，蝰蛇音效等平台专属设置不迁移。</p>
        <div
          class="plat-meta mb-[12px] flex flex-wrap gap-[12px] font-mono text-[10.5px] opacity-[.75]"
        >
          <span>歌单 6</span><span>收藏 213 首</span><span>本地 58 首</span>
        </div>
        <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          class="plat-btn min-h-[36px] w-full rounded-full p-[9px] text-[12.5px] font-extrabold"
          data-conn-btn="kugou"
          :class="{ off: platforms.kugou }"
          >{{ platforms.kugou ? '断开连接' : '连接酷狗' }}</BaseButton
        >
        <div class="plat-detail mt-[12px] hidden pt-[11px]">
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>自动同步新歌单</b><span>在酷狗新建的歌单自动出现在这里</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch on relative h-[25px] w-[42px] flex-none rounded-full p-0"
              data-src-toggle="kgAuto"
              role="switch"
              aria-checked="true"
              aria-label="酷狗自动同步"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>同步收藏夹</b><span>收藏歌曲合并进音乐库</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              data-src-toggle="kgFav"
              role="switch"
              aria-checked="false"
              aria-label="酷狗同步收藏"
              ><i></i
            ></BaseButton>
          </div>
        </div>
      </div>
      <div
        class="plat-card rounded-[18px] border border-transparent p-[15px]"
        data-plat-card="kuwo"
        :class="{ connected: platforms.kuwo }"
      >
        <div class="plat-top flex items-center gap-[11px]">
          <div
            class="plat-logo kw grid h-[40px] w-[40px] flex-none place-items-center rounded-[12px] text-[17px] font-black text-white"
          >
            我
          </div>
          <div><b>酷我音乐</b><span>歌单 · 无损专辑 · 电台</span></div>
          <span
            class="plat-status ml-auto rounded-full p-[5px_10px] text-[11px] font-extrabold whitespace-nowrap"
            :class="{ on: platforms.kuwo }"
            >{{ platforms.kuwo ? '已连接' : '未连接' }}</span
          >
        </div>
        <p>导入酷我歌单与已购无损专辑清单，方便和本地 FLAC 库对照去重。</p>
        <div
          class="plat-meta mb-[12px] flex flex-wrap gap-[12px] font-mono text-[10.5px] opacity-[.75]"
        >
          <span>歌单 4</span><span>已购专辑 9</span><span>无损 121 首</span>
        </div>
        <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          class="plat-btn min-h-[36px] w-full rounded-full p-[9px] text-[12.5px] font-extrabold"
          data-conn-btn="kuwo"
          :class="{ off: platforms.kuwo }"
          >{{ platforms.kuwo ? '断开连接' : '连接酷我' }}</BaseButton
        >
        <div class="plat-detail mt-[12px] hidden pt-[11px]">
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>自动同步新歌单</b><span>在酷我新建的歌单自动出现在这里</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch relative h-[25px] w-[42px] flex-none rounded-full p-0"
              data-src-toggle="kwAuto"
              role="switch"
              aria-checked="false"
              aria-label="酷我自动同步"
              ><i></i
            ></BaseButton>
          </div>
          <div class="set-row flex items-center gap-[14px] p-[12px_0]">
            <div class="set-txt min-w-[0] flex-1">
              <b>同步已购专辑</b><span>已购无损专辑出现在专辑页</span>
            </div>
            <!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
            <BaseButton
              class="switch on relative h-[25px] w-[42px] flex-none rounded-full p-0"
              data-src-toggle="kwBuy"
              role="switch"
              aria-checked="true"
              aria-label="酷我同步已购"
              ><i></i
            ></BaseButton>
          </div>
        </div>
      </div>
    </div>
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      选择要导入的歌单 · <span>已选 {{ picked }}</span>
    </div>
    <!-- 平台歌单导入区：Vue 列表维护选择、禁用和导入完成状态。 -->
    <div>
      <div
        v-if="!available.length"
        class="empty-note p-[14px_4px] text-[13px] leading-[1.7] opacity-[.55]"
      >
        还没有已连接的平台 — 先在上方连接网易云 / 酷狗 /
        酷我中的任意一个，这里会列出可导入的歌单。
      </div>
      <div
        v-for="item in available"
        :key="item.id"
        class="imp-row mb-[7px] flex items-center gap-[11px] rounded-[13px] border border-transparent p-[9px_11px]"
      >
        <img
          :src="item.cover"
          alt=""
        /><span class="it"
          ><b>{{ item.name }}</b
          ><span>{{ item.platName }} · {{ item.count }} 首</span></span
        ><!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          class="imp-pick min-h-[30px] flex-none rounded-full p-[6px_12px] text-[11.5px] font-extrabold"
          :class="{ on: isImported(item.name) || impPicked[item.id] }"
          :disabled="isImported(item.name)"
          @click="impPicked[item.id] = !impPicked[item.id]"
          >{{
            isImported(item.name)
              ? '已导入'
              : impPicked[item.id]
                ? '已勾选'
                : '选择导入'
          }}</BaseButton
        >
      </div>
    </div>
    <div
      class="pl-actions mt-[14px] flex items-center gap-[12px]"
      style="margin-top: 6px"
    >
      <!-- 页面操作按钮：导入所选歌单。 -->
      <BaseButton
        class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
        data-import-go
        >导入所选歌单</BaseButton
      ><span>{{ impMsg || '先连接任意平台，再勾选歌单导入' }}</span>
    </div>
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      用链接导入 · 粘贴歌单分享链接
    </div>
    <div class="link-row mt-[10px] flex gap-[8px]">
      <input
        type="text"
        data-link-input
        placeholder="粘贴网易云 / 酷狗 / 酷我歌单链接，例如 music.163.com/playlist?id=…"
        aria-label="歌单分享链接"
      /><!-- 页面操作按钮：解析。 -->
      <BaseButton
        class="up-add min-h-[38px] rounded-[11px] border-none bg-white p-[0_16px] text-[12.5px] font-extrabold whitespace-nowrap"
        data-link-parse
        >解析</BaseButton
      >
    </div>
    <div class="src-note mt-[12px] text-[11.5px] leading-[1.65] opacity-[.55]">
      {{ linkMsg }}
    </div>
    <div
      class="imp-row mb-[7px] flex items-center gap-[11px] rounded-[13px] border border-transparent p-[9px_11px]"
      style="margin-top: 16px"
    >
      <span class="it"
        ><b>功能全景</b
        ><span>已有功能 · 本轮新增 · 正式版缺口，一页看清</span></span
      ><!-- 页面操作按钮：查看。 -->
      <BaseButton
        class="imp-pick min-h-[30px] flex-none rounded-full p-[6px_12px] text-[11.5px] font-extrabold"
        data-goto="hub"
        >查看</BaseButton
      >
    </div>
    <p class="src-note mt-[12px] text-[11.5px] leading-[1.65] opacity-[.55]">
      版权说明：平台曲库歌曲受各平台版权与会员规则限制，导入的是歌单结构与元数据；正式版中，能否直接播放取决于对应平台的授权与你的会员状态，无版权歌曲会标注并给出本地文件匹配建议。
    </p>
  </div>
</template>
