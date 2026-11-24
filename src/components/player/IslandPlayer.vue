<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import IslandCover from '@/components/player/IslandCover.vue'
import TrayIcon from '@/components/tray/TrayIcon.vue'
import type { SourceAction, SourceTrack } from '@/types/prototype'
import { formatTime } from '@/utils/format'

const props = withDefaults(defineProps<{
  track?: SourceTrack
  time: number
  duration: number
  playing: boolean
  loading: boolean
  playable: boolean
  motion: boolean
  openLabel: string
  embedded?: boolean
  active?: boolean
}>(), { active: true })
const emit = defineEmits<{ action: [action: SourceAction]; close: []; open: [] }>()
const close = useTemplateRef<HTMLButtonElement>('close')
const position = computed(() => Math.min(props.duration || 0, props.time))
const playLabel = computed(() => props.loading ? '取消加载' : props.playing ? '暂停' : '播放')
// 键盘焦点随展开意图即时移动，桌面内容会在收起时留在同一个胶囊内。
function focusClose(): void {
  if (props.active) close.value?.focus({ preventScroll: true })
}
onMounted(focusClose)
watch(() => props.active, focusClose, { flush: 'post' })

// 由主播放器执行定位，桌面窗口沿用同一进度比例。
function seek(event: Event): void {
  const input = event.currentTarget as HTMLInputElement
  if (props.duration > 0) emit('action', { type: 'seek', value: input.valueAsNumber / props.duration })
}
</script>

<template>
  <section
    :id="active ? 'island-player' : undefined"
    class="island-player panel-scroll"
    :class="{ 'island-player-embedded': embedded }"
    :inert="!active"
    role="dialog"
    aria-label="灵动岛播放器"
    @keydown.esc.stop.prevent="emit('close')"
  >
    <div class="flex min-w-0 items-center gap-3">
      <!-- 桌面胶囊的同一张封面在外壳中移动，这里预留它展开后的空间。 -->
      <span v-if="embedded" class="size-12 shrink-0" aria-hidden="true" />
      <IslandCover v-else :src="track?.cover" :motion="motion" large />
      <div class="island-metadata min-w-0 flex-1">
        <strong class="block truncate text-[15px] leading-5" :title="track?.title">{{ track?.title || '未选择歌曲' }}</strong>
        <span v-if="track?.artist" class="block truncate text-xs leading-5 text-white/70" :title="track.artist">{{ track.artist }}</span>
      </div>
      <button ref="close" type="button" aria-label="收起灵动岛" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </div>
    <div class="island-progress">
      <span>{{ formatTime(position) }}</span>
      <input type="range" min="0" :max="duration || 1" step="1" :value="position"
        :style="{ '--p': (duration ? position / duration * 100 : 0) + '%' }"
        aria-label="播放进度" :aria-valuetext="formatTime(position)" :disabled="!playable || !duration" @input="seek" />
      <span>{{ formatTime(duration) }}</span>
    </div>
    <div class="island-controls">
      <button type="button" aria-label="上一首" :disabled="!playable" @click="emit('action', { type: 'previous' })">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h2.5v14H7zM19 5v14L9.5 12z" /></svg>
      </button>
      <button type="button" class="island-play" :aria-label="playLabel" :aria-busy="loading" :disabled="!playable"
        @click="emit('action', { type: 'toggle' })">
        <svg v-if="loading" :class="{ 'motion-safe:animate-spin': motion }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" opacity=".25" /><path d="M12 3a9 9 0 0 1 9 9" />
        </svg>
        <TrayIcon v-else :name="playing ? 'pause' : 'play'" />
      </button>
      <button type="button" aria-label="下一首" :disabled="!playable" @click="emit('action', { type: 'next' })">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.5 5H17v14h-2.5zM5 5v14l9.5-7z" /></svg>
      </button>
      <button type="button" class="island-open" :aria-label="openLabel" :title="openLabel" @click="emit('open')"><TrayIcon name="arrow" /></button>
    </div>
  </section>
</template>

<style scoped>
.island-player {
  box-sizing: border-box;
  width: min(320px, calc(100% - 16px));
  height: 158px;
  max-height: calc(100% - 16px);
  padding: 13px 16px;
  overflow: auto;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 24px;
  background: rgb(22 22 31 / 93%);
  color: white;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 24px rgb(0 0 0 / 32%), inset 0 1px 0 rgb(255 255 255 / 10%);
}
.liquid-win .island-player {
  border-color: rgb(255 255 255 / 48%);
  background: linear-gradient(165deg, rgb(67 65 82 / 86%), rgb(23 23 35 / 84%) 64%);
  backdrop-filter: blur(14px) saturate(1.25);
  box-shadow: inset 0 1.5px 1px rgb(255 255 255 / 55%), 0 12px 28px rgb(0 0 0 / 34%);
}
.island-player.island-player-embedded {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 158px;
  max-height: none;
  overflow: hidden;
  scrollbar-gutter: auto;
  border: 0;
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
  box-shadow: none;
}
.island-player button {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  cursor: pointer;
}
.island-player svg { width: 18px; height: 18px; }
.island-player button:hover:enabled { background-color: rgb(255 255 255 / 16%); }
.island-player :focus-visible { outline: 2px solid white; outline-offset: 2px; }
.island-player.pointer-controls :focus { outline: none; }
.island-player :disabled { opacity: .38; cursor: default; }
.island-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  color: rgb(255 255 255 / 75%);
  font: 10px/1 var(--font-mono, monospace);
  font-variant-numeric: tabular-nums;
}
.island-progress input { min-width: 0; flex: 1; accent-color: white; cursor: pointer; }
.island-controls { position: relative; display: flex; align-items: center; justify-content: center; gap: 10px; }
.island-player .island-play { width: 42px; height: 42px; background: white; color: #16161e; }
.island-player .island-play:hover:enabled { background: #e4e4ec; }
.island-open { position: absolute; right: 0; }
.island-expand-enter-active, .island-expand-leave-active {
  transition: opacity 180ms ease, transform 200ms cubic-bezier(.22,.8,.25,1);
}
.island-expand-enter-from, .island-expand-leave-to { opacity: 0; transform: scale(.83, .55); }
.island-expand-leave-active { pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .island-expand-enter-active, .island-expand-leave-active { transition: none; }
}
</style>
