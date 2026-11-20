<script setup lang="ts">
import { toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import { computed } from 'vue'
import TrackList from '@/components/player/TrackList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, tracks, controller } = usePlayer()
const uploadedIndices = computed(() =>
  tracks.map((_, index) => index).filter(index => tracks[index]!.mine)
)
const { uploads, upAdded, upMsg } = toRefs(state)
</script>

<template>
  <!-- upload 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="upload"
  >
    <div class="pg-head">
      <h3>上传歌曲</h3>
      <p>
        把你自己的歌带进来 —
        选文件、选整个文件夹，或手动填写信息直接进音乐库。原型里文件只在本页读取文件名与大小、不上传到任何服务器；正式版会写入本地音乐文件夹并自动补封面与歌词。
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
    <div
      class="up-drop mt-[16px] rounded-[18px] p-[26px_18px] text-center"
      data-drop
    >
      <b>把音频文件或整个文件夹拖到这里</b>
      <p>
        支持 FLAC · WAV · MP3 · M4A · OGG · APE — 单个文件建议 ≤ 200MB<br />选文件夹会连同子文件夹里的音频一起读进来，整个歌单文件夹一次搬完
      </p>
      <div class="up-pickrow flex flex-wrap justify-center gap-[9px]">
        <!-- 页面操作按钮：选择文件。 -->
        <BaseButton
          class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
          data-pick-files
          >选择文件</BaseButton
        ><!-- 页面操作按钮：选择文件夹。 -->
        <BaseButton
          class="up-ghostbtn min-h-[38px] rounded-full p-[9px_18px] text-[13px] font-extrabold"
          data-pick-dir
          >选择文件夹</BaseButton
        >
      </div>
      <input
        type="file"
        data-file-input
        accept="audio/*,.flac,.ape,.wav,.mp3,.m4a,.ogg"
        multiple
        hidden
      />
      <input
        type="file"
        data-dir-input
        webkitdirectory
        hidden
      />
    </div>
    <div class="lib-stats mt-[16px] grid grid-cols-[repeat(4,1fr)] gap-[10px]">
      <div>
        <b>{{ uploads.length }}</b><span>队列文件</span>
      </div>
      <div>
        <b>{{ upAdded }}</b><span>已加入曲库</span>
      </div>
      <div><b>6 种</b><span>支持格式</span></div>
      <div><b>本地</b><span>存储位置</span></div>
    </div>
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      导入队列
    </div>
    <!-- 本地文件队列：展示真实文件名与大小，加入同一曲库。 -->
    <div>
      <div
        v-for="(file, index) in uploads"
        :key="index"
        class="file-row mb-[7px] flex items-center gap-[11px] rounded-[13px] border border-transparent p-[9px_11px]"
      >
        <span class="fi">♪</span
        ><span class="it"
          ><b>{{ file.name }}</b
          ><span
            >{{ file.folder ? '文件夹「' + file.folder + '」 · ' : ''
            }}{{ file.size }} · {{ file.ext || 'AUDIO' }}</span
          ></span
        ><!-- 页面操作按钮：复用公共按钮的点击、禁用与加载语义。 -->
        <BaseButton
          class="imp-pick min-h-[30px] flex-none rounded-full p-[6px_12px] text-[11.5px] font-extrabold"
          :class="{ on: file.added }"
          :disabled="file.added"
          @click="controller()?.addUploadToLibrary(index)"
          >{{ file.added ? '已加入' : '加入曲库' }}</BaseButton><span
          class="st"
          >{{ file.added ? '已入库' : '待加入' }}</span
        >
      </div>
    </div>
    <EmptyState
      v-if="!uploads.length"
      class="min-h-[140px]"
      icon="upload"
      label="上传队列为空，选择音频文件后可加入曲库"
    />
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      手动添加一首 · 填写信息直接进曲库
    </div>
    <div class="up-form mt-[12px] grid grid-cols-[1fr_1fr_1fr_auto] gap-[8px]">
      <input
        type="text"
        data-up-title
        placeholder="歌名（必填）"
        aria-label="歌名"
      /><input
        type="text"
        data-up-artist
        placeholder="歌手"
        aria-label="歌手"
      /><input
        type="text"
        data-up-album
        placeholder="专辑"
        aria-label="专辑"
      /><!-- 页面操作按钮：加入音乐库。 -->
      <BaseButton
        class="up-add min-h-[38px] rounded-[11px] border-none bg-white p-[0_16px] text-[12.5px] font-extrabold whitespace-nowrap"
        data-up-add
        >加入音乐库</BaseButton
      >
    </div>
    <div class="src-note mt-[12px] text-[11.5px] leading-[1.65] opacity-[.55]">
      {{ upMsg }}
    </div>
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      我上传的歌 · <span>{{ upAdded }}</span> 首
    </div>
    <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
    <TrackList
      :indices="uploadedIndices"
      list-key="up"
      empty-icon="upload"
      empty="暂无上传歌曲"
    />
  </div>
</template>
