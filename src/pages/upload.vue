<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import SlidingTabs from '@/components/ui/SlidingTabs.vue';
import {computed} from 'vue';
import TrackList from '@/components/player/TrackList.vue';
import {usePlayer} from '@/composables/usePlayer';
const {tracks}=usePlayer();
const uploadedIndices=computed(()=>tracks.map((_,index)=>index).filter(index=>tracks[index]!.mine));
</script>

<template>
<!-- upload 页面：保留原稿内容区域与交互顺序。 -->
<div class="page-panel" data-panel="upload">
      <div class="pg-head">
        <h3>上传歌曲</h3>
        <p>
          把你自己的歌带进来 —
          选文件、选整个文件夹，或手动填写信息直接进音乐库。原型里文件只在本页读取文件名与大小、不上传到任何服务器；正式版会写入本地音乐文件夹并自动补封面与歌词。
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
      <div class="up-drop" data-drop>
        <b>把音频文件或整个文件夹拖到这里</b>
        <p>
          支持 FLAC · WAV · MP3 · M4A · OGG · APE — 单个文件建议 ≤ 200MB<br />选文件夹会连同子文件夹里的音频一起读进来，整个歌单文件夹一次搬完
        </p>
        <div class="up-pickrow">
          <BaseButton class="banner-play" data-pick-files>选择文件</BaseButton
          ><BaseButton class="up-ghostbtn" data-pick-dir>选择文件夹</BaseButton>
        </div>
        <input
          type="file"
          data-file-input
          accept="audio/*,.flac,.ape,.wav,.mp3,.m4a,.ogg"
          multiple
          hidden
        />
        <input type="file" data-dir-input webkitdirectory hidden />
      </div>
      <div class="lib-stats">
        <div><b data-up-stat-q>0</b><span>队列文件</span></div>
        <div><b data-up-stat-done>0</b><span>已加入曲库</span></div>
        <div><b>6 种</b><span>支持格式</span></div>
        <div><b>本地</b><span>存储位置</span></div>
      </div>
      <div class="pg-secttl">导入队列</div>
      <div data-file-list></div>
      <div class="empty-note" data-file-empty>
        队列还是空的 —
        选几首你自己的歌试试，文件名和大小会真实读出来，加入后能在音乐库和搜索里找到。
      </div>
      <div class="pg-secttl">手动添加一首 · 填写信息直接进曲库</div>
      <div class="up-form">
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
        /><BaseButton class="up-add" data-up-add>加入音乐库</BaseButton>
      </div>
      <div class="src-note" data-up-status></div>
      <div class="pg-secttl">我上传的歌 · <span data-up-mine>0</span> 首</div>
      <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
<TrackList :indices="uploadedIndices" list-key="up" />
      <div class="empty-note" data-up-empty>
        还没有上传的歌 —
        上面手动添加或从队列加入的第一首会出现在这里，也会同步进音乐库。
      </div>
    </div>
</template>
