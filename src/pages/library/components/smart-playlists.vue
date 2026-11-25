<script setup lang="ts">
import { computed, toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackSuggestion from '@/components/player/TrackSuggestion.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'

const { state, controller } = usePlayer()
const { smartOpen } = toRefs(state)
const indices = computed(() => controller()?.smartList() || [])
</script>

<template>
  <!-- 音乐库智能歌单区：从实际曲库抽取每日曲目，支持展开预览。 -->
  <div
    class="smart-card rounded-[16px] border border-transparent p-[13px_14px]"
    :class="{ open: smartOpen === 'rewind' }"
  >
    <div class="smart-head flex items-start justify-between gap-[10px]">
      <!-- 智能歌单图标底衬：与设置页分组图标同一 24px 平涂色块配方。 -->
      <span class="smart-chip" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M16 3h5v5" />
          <path d="M4 20 21 3" />
          <path d="M21 16v5h-5" />
          <path d="m15 15 6 6" />
          <path d="m4 4 5 5" />
        </svg>
      </span>
      <div class="smart-txt">
        <b>随机重温</b><span>每天从曲库抽取一组歌曲</span>
      </div>
      <span
        class="smart-meta pt-[3px] font-mono text-[10.5px] whitespace-nowrap opacity-[.65]"
        >{{ indices.length }} 首</span
      >
    </div>
    <div class="smart-acts mt-[11px] flex gap-[8px]">
      <!-- 智能歌单按钮：从当天曲库推荐建立播放队列。 -->
      <BaseButton
        class="smart-play min-h-[32px] rounded-full border-none p-[7px_15px] text-[12px] font-extrabold"
        :disabled="!indices.length"
        @click="controller()?.playSmart()"
        >播放全部</BaseButton
      >
      <!-- 曲目预览按钮：展开当前的推荐结果。 -->
      <BaseButton
        class="smart-tog min-h-[32px] rounded-full bg-transparent p-[7px_13px] text-[12px] font-extrabold text-inherit"
        :aria-expanded="smartOpen === 'rewind'"
        @click="smartOpen = smartOpen === 'rewind' ? null : 'rewind'"
        >{{ smartOpen === 'rewind' ? '收起' : '展开' }}</BaseButton
      >
    </div>
    <div
      v-if="smartOpen === 'rewind'"
      class="smart-rows mt-[11px] flex flex-col gap-[5px]"
    >
      <!-- 推荐列表：仅展示曲库中的曲目，无数据时显示空态。 -->
      <EmptyState
        v-if="!indices.length"
        class="min-h-[140px]"
        icon="playlist"
        label="暂无可推荐的曲目"
      />
      <TrackSuggestion
        v-for="index in indices"
        :key="index"
        :index="index"
        meta=""
      />
    </div>
  </div>
</template>

<style scoped>
/* 智能歌单图标底衬：24px 圆角平涂色块配 14px 白色描边图标，与设置页分组图标同规格。 */
.smart-chip {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 8px;
  background: var(--pop-violet);
  color: #fff;
}
.smart-chip svg {
  width: 14px;
  height: 14px;
}
/* 图标底衬加入后标题区占满中间，右侧计数保持贴边。 */
.smart-txt {
  flex: 1;
  min-width: 0;
}
</style>
