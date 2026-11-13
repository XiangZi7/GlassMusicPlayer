<script setup lang="ts">
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
</script>

<template>
<!-- downloads 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="downloads">
      <div class="pg-head">
        <h3>下载管理</h3>
        <p>
          离线下载的歌曲与队列 — 演示数据，可暂停 /
          继续单个任务，正式版会写入本地缓存并支持断点续传。
        </p>
      </div>
      <SlidingTabs
        class="pg-tabs"
        role="tablist"
        aria-label="内容导入分类"
        hook="data-src-tab"
        :options="[
          { label: '平台对接', value: 'connect' },
          { label: '上传歌曲', value: 'upload' },
          { label: '下载管理', value: 'downloads' },
        ]"
      />
      <div class="lib-stats">
        <div><b>3</b><span>已下载</span></div>
        <div><b data-dl-active>2</b><span>进行中</span></div>
        <div><b>FLAC</b><span>默认下载音质</span></div>
        <div><b>本地缓存</b><span>存储位置</span></div>
      </div>
      <div class="pg-secttl">下载队列</div>
      <div data-dl-list></div>
      <p class="src-note">
        提示：平台对接导入的歌曲能否下载，取决于该平台的版权与会员规则；本地与自上传歌曲不受限制。
      </p>
    </div>
</template>
