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
    class="page-panel import-files hidden"
    data-panel="upload"
  >
    <div class="pg-head">
      <h3>本地曲目登记</h3>
      <p>选择文件或手动填写曲目信息。当前只登记资料，暂未接入本地音频播放。</p>
    </div>
    <!-- 页面分类与排序组件：复用公共标签条和原稿滑动胶囊。 -->
    <PlayerTabs
      class="pg-tabs mt-[16px] inline-flex max-w-[100%] flex-wrap gap-[4px] rounded-full p-[4px]"
      role="tablist"
      aria-label="内容导入分类"
      hook="data-src-tab"
      :options="[
        { label: '平台对接', value: 'connect' },
        { label: '本地曲目', value: 'upload' },
        { label: '下载管理', value: 'downloads' },
      ]"
    />
    <div
      class="up-drop mt-[16px] rounded-[18px] p-[26px_18px] text-center"
      data-drop
    >
      <!-- 波普贴纸：黄星压在上传框右上角，全页唯一一枚点缀。 -->
      <span
        class="up-drop-star pop-sticker"
        style="--pop-sticker-angle: 10deg"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24">
          <path
            class="sticker-halo"
            d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z"
          />
          <path
            class="sticker-star"
            d="M12 1.8l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 17.7l-6.4 3.5 1.4-7.1-5.3-4.9 7.2-.8z"
          />
        </svg>
      </span>
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
      <div><b class="stat-text">本次会话</b><span>保留时长</span></div>
    </div>
    <h4 class="import-section-title">导入队列</h4>
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
          >{{ file.added ? '已登记' : '登记资料' }}</BaseButton><span
          class="st"
          >{{ file.added ? '已登记' : '待登记' }}</span
        >
      </div>
    </div>
    <EmptyState
      v-if="!uploads.length"
      class="min-h-[140px]"
      icon="upload"
      label="文件队列为空，选择音频文件后可登记资料"
    />
    <h4 class="import-section-title">手动登记曲目信息</h4>
    <form class="up-form grid items-end gap-2" @submit.prevent>
      <label>歌名 <span class="text-white/55">（必填）</span>
        <input type="text" data-up-title aria-required="true" />
      </label>
      <label>歌手<input type="text" data-up-artist /></label>
      <label>专辑<input type="text" data-up-album /></label>
      <!-- 页面操作按钮：加入音乐库。 -->
      <BaseButton
        type="submit"
        class="up-add min-h-[38px] rounded-[11px] border-none bg-white px-4 font-bold whitespace-nowrap"
        data-up-add
        >登记曲目</BaseButton
      >
    </form>
    <div v-if="upMsg" class="src-note mt-2">
      {{ upMsg }}
    </div>
    <h4 class="import-section-title">
      已登记曲目 · <span>{{ upAdded }}</span> 首
    </h4>
    <!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->
    <TrackList
      :indices="uploadedIndices"
      list-key="up"
      empty-icon="upload"
      empty="暂无已登记曲目"
    />
  </div>
</template>

<style scoped>
/* 页头标题与首页版块标题同规格。 */
.pg-head h3 {
  font-size: 17px;
}
/* 上传框作贴纸定位锚点，虚线框本体与拖拽状态不变。 */
.up-drop {
  position: relative;
}
/* 星星贴纸：外圈白星作贴纸白边，内星黄底粗黑描边；倾斜与投影走共享 .pop-sticker。 */
.up-drop-star {
  position: absolute;
  top: -13px;
  right: 22px;
  z-index: 1;
  width: 36px;
  height: 36px;
}
.up-drop-star svg {
  display: block;
  width: 100%;
  height: 100%;
}
.up-drop-star .sticker-halo {
  fill: #fff;
}
.up-drop-star .sticker-star {
  fill: var(--pop-yellow);
  stroke: var(--pop-ink);
  stroke-width: 1.4;
  transform: scale(0.76);
  transform-origin: center;
}
</style>
