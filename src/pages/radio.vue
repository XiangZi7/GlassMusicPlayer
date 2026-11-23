<script setup lang="ts">
import { toRefs } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { computed } from 'vue'
import TrackSuggestion from '@/components/player/TrackSuggestion.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, tracks, controller } = usePlayer()
const track = computed(() => tracks[state.radioSeed ?? state.idx])
const upcoming = computed(() => {
  const queue = state.queue || []
  const position = queue.indexOf(state.idx)
  return queue.slice(position + 1, position + 13)
})
// 推荐标签按原稿种子的专辑和歌手判定。
function tag(index: number): string {
  const seed = track.value
  if (!seed) return ''
  return seed.album !== '—' && tracks[index]!.album === seed.album
    ? '同专辑'
    : tracks[index]!.artist === seed.artist
      ? '同歌手'
      : '相似推荐'
}
const { radioOn } = toRefs(state)
</script>

<template>
  <!-- radio 页面：保留原稿内容区域与交互顺序。 -->
  <div
    class="page-panel hidden"
    data-panel="radio"
  >
    <div class="pg-head">
      <h3>歌曲电台</h3>
      <p>
        以正在播放的这首歌为种子 —
        先排同专辑、再同歌手，其余按相似度排队续播；播到队尾不会停，电台会继续往后续。开启后队列头会亮起「电台续播中」，队列顺序就是电台的播放顺序，照样可以拖拽调整。
      </p>
    </div>
    <!-- 当前种子卡片：开启后保持最初的歌曲。 -->
    <div
      v-if="track"
      class="radio-seed flex min-h-[82px] items-center gap-[14px] rounded-[16px] border border-transparent px-[14px] py-[12px]"
    >
      <img decoding="async" loading="lazy"
        :src="track.cover"
        alt=""
      />
      <div class="rseed-txt">
        <b>{{ track.title }}</b><span
          >{{ track.artist }} · {{ track.album }}</span
        >
      </div>
      <span class="rseed-tag">种子 · SEED</span>
    </div>
    <div class="pl-actions mt-[12px] flex items-center gap-[12px]">
      <!-- 页面操作按钮：开始电台。 -->
      <BaseButton
        class="banner-play inline-flex min-h-[38px] items-center gap-[8px] rounded-full border-none p-[9px_18px] text-[13px] font-extrabold"
        data-radio-toggle
        :disabled="!track"
        :aria-pressed="radioOn"
        @click="controller()?.toggleRadio()"
        >{{ radioOn ? '停止电台' : '开始电台' }}</BaseButton><span
        data-radio-status
        >{{
          radioOn && track
            ? `电台进行中 · 以《${track.title}》为种子，播完自动续播`
            : '选择一首歌曲即可开启电台'
        }}</span
      >
    </div>
    <div
      class="pg-secttl m-[22px_2px_8px] text-[11px] font-extrabold tracking-[.11em] opacity-[.6]"
    >
      接下来 · 电台队列
    </div>
    <div
      class="flex flex-col gap-[5px]"
      data-radio-list
    >
      <!-- 电台曲目建议组件：保留下一首播放和相似标签。 --><TrackSuggestion
        v-for="(index, position) in upcoming"
        :key="`${index}:${position}`"
        :index="index"
        :meta="tag(index)"
        show-album
      />
      <EmptyState
        v-if="!upcoming.length"
        class="min-h-[140px]"
        icon="playlist"
        :label="radioOn ? '电台正在等待后续曲目' : '电台队列为空'"
      />
    </div>
  </div>
</template>
