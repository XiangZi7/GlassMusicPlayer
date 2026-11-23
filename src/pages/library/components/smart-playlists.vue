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
