<script setup lang="ts">
import { toRefs } from 'vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
import { downloads } from '@/constants/music'
const { state } = usePlayer()
const active = computed(
  () =>
    downloads.filter((item, index) => item.prog < 100 && !state.dlPaused[index])
      .length
)
const { dlPaused } = toRefs(state)
</script>

<template>
  <!-- downloads 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="downloads"
  >
    <div class="pg-head">
      <h3>下载管理</h3>
      <p>
        离线下载的歌曲与队列 — 演示数据，可暂停 /
        继续单个任务，正式版会写入本地缓存并支持断点续传。
      </p>
    </div>
    <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
    <PlayerTabs
      class="pg-tabs mt-4 inline-flex max-w-full flex-wrap gap-1 rounded-full p-1"
      role="tablist"
      aria-label="内容导入分类"
      hook="data-src-tab"
      :options="[
        { label: '平台对接', value: 'connect' },
        { label: '上传歌曲', value: 'upload' },
        { label: '下载管理', value: 'downloads' },
      ]"
    />
    <div class="lib-stats mt-4 grid grid-cols-[repeat(4,1fr)] gap-2.5">
      <div><b>3</b><span>已下载</span></div>
      <div>
        <b>{{ active }}</b><span>进行中</span>
      </div>
      <div><b>FLAC</b><span>默认下载音质</span></div>
      <div><b>本地缓存</b><span>存储位置</span></div>
    </div>
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      下载队列
    </div>
    <!-- 下载任务区：保留原稿演示任务与单项暂停/继续操作。 -->
    <EmptyState
      v-if="!downloads.length"
      class="min-h-[140px]"
      icon="download"
      label="下载队列为空"
    />
    <div v-else>
      <div
        v-for="(item, index) in downloads"
        :key="item.name"
        class="file-row mb-1.75 flex items-center gap-2.75 rounded-[13px] border border-transparent p-[9px_11px]"
      >
        <span class="fi">↓</span
        ><span class="it"
          ><b>{{ item.name }}</b
          ><span
            >{{ item.artist }} · {{ item.size }} ·
            {{
              item.prog >= 100
                ? '已完成'
                : (dlPaused[index] ? '已暂停 · ' : '下载中 · ') +
                  item.prog +
                  '%'
            }}</span
          ></span
        ><!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          v-if="item.prog < 100"
          class="imp-pick min-h-7.5 flex-none rounded-full p-[6px_12px] text-[11.5px] font-extrabold"
          :class="{ on: dlPaused[index] }"
          @click="dlPaused[index] = !dlPaused[index]"
          >{{ dlPaused[index] ? '继续' : '暂停' }}</BaseButton><span
          v-else
          class="st"
          >可离线播放</span
        >
      </div>
    </div>
    <p class="src-note mt-3 text-[11.5px] leading-[1.65] opacity-[.55]">
      提示：平台对接导入的歌曲能否下载，取决于该平台的版权与会员规则；本地与自上传歌曲不受限制。
    </p>
  </div>
</template>
