<script setup lang="ts">
import { toRefs } from 'vue'
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackSuggestion from '@/components/player/TrackSuggestion.vue'
import { usePlayer } from '@/composables/usePlayer'
const { state, controller } = usePlayer()
const definitions = [
  { kind: 'stale', name: '久未听的', rule: '按上次播放距今由久到近自动排' },
  { kind: 'loop', name: '循环最多', rule: '按累计播放次数由高到低自动排' },
  { kind: 'rewind', name: '随机重温', rule: '每天换一批 · 固定种子随机抽' },
]
const lists = computed(() =>
  definitions.map(def => ({
    ...def,
    indices: controller()?.smartList(def.kind) || [],
  }))
)

// 卡片摘要沿用原稿的固定种子统计，不改变智能歌单排序。
function summary(kind: string, first?: number): string {
  if (first === undefined) return ''
  const text = controller()?.smartMeta(kind, first) || ''
  if (kind === 'stale') return '最久未听 · ' + text.replace(' 天前听过', ' 天')
  return kind === 'loop' ? '最高 · ' + text : '今日种子 · 明天换一批'
}
const { smartOpen } = toRefs(state)
</script>
<template>
  <!-- 音乐库智能歌单区：固定种子规则、展开预览与播放全部。 -->
  <div class="smart-grid flex flex-col gap-[10px]">
    <div
      v-for="list in lists"
      :key="list.kind"
      class="smart-card rounded-[16px] border border-transparent p-[13px_14px]"
      :class="{ open: smartOpen === list.kind }"
    >
      <div class="smart-head flex items-start justify-between gap-[10px]">
        <div class="smart-txt">
          <b>{{ list.name }}</b><span>{{ list.rule }}</span>
        </div>
        <span
          class="smart-meta pt-[3px] font-mono text-[10.5px] whitespace-nowrap opacity-[.65]"
          >{{ list.indices.length }} 首 ·
          {{ summary(list.kind, list.indices[0]) }}</span
        >
      </div>
      <div class="smart-acts mt-[11px] flex gap-[8px]">
        <!-- 智能歌单操作按钮：复用公共按钮组件。 -->
        <BaseButton
          class="smart-play min-h-[32px] rounded-full border-none p-[7px_15px] text-[12px] font-extrabold"
          @click="controller()?.playSmart(list.kind)"
          >播放全部</BaseButton
        >
        <!-- 智能歌单展开按钮：保留原稿展开顺序。 -->
        <BaseButton
          class="smart-tog min-h-[32px] rounded-full bg-transparent p-[7px_13px] text-[12px] font-extrabold text-inherit"
          @click="smartOpen = smartOpen === list.kind ? null : list.kind"
          >{{ smartOpen === list.kind ? '收起' : '展开' }}</BaseButton
        >
      </div>
      <div
        v-if="smartOpen === list.kind"
        class="smart-rows mt-[11px] flex flex-col gap-[5px]"
      >
        <!-- 智能歌单曲目建议组件：播放、下一首播放与统计摘要。 -->
        <TrackSuggestion
          v-for="index in list.indices"
          :key="index"
          :index="index"
          :meta="controller()?.smartMeta(list.kind, index) || ''"
        />
      </div>
    </div>
  </div>
</template>
