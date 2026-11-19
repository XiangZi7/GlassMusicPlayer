<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { SourceAction, SourceSnapshot } from '@/types/prototype'

const snapshot = shallowRef<SourceSnapshot>()
const lyric = computed(
  () => snapshot.value?.capsuleLyric || snapshot.value?.track.title || ''
)
let stopSnapshot: UnlistenFn | undefined
let disposed = false

// 先订阅播放快照，再向主窗口请求当前歌词。
onMounted(async () => {
  if (!isTauri()) return
  document.body.classList.add('desktop-island')
  const stop = await listen<SourceSnapshot>('player-snapshot', event => {
    snapshot.value = event.payload
  })
  if (disposed) {
    stop()
    return
  }
  stopSnapshot = stop
  await emitTo('main', 'player-ready')
})

onUnmounted(() => {
  disposed = true
  stopSnapshot?.()
  document.body.classList.remove('desktop-island')
})

// 胶囊末端的按钮恢复主窗口，拖动区由原生窗口处理。
function focusPlayer(): void {
  void emitTo<SourceAction>('main', 'player-action', { type: 'focus' })
}
</script>

<template>
  <!-- 桌面歌词胶囊：原生拖动区和返回播放器按钮。 -->
  <div
    v-if="snapshot"
    class="flex h-full w-full items-center rounded-full border border-white/25 bg-slate-950/90 px-2 text-[12.5px] font-bold text-white"
    :class="{ playing: snapshot.playing && snapshot.motion }"
  >
    <div
      class="flex h-full min-w-0 flex-1 cursor-grab items-center gap-[9px] pl-2 select-none active:cursor-grabbing"
      data-tauri-drag-region
    >
      <span
        class="cap-eq pointer-events-none flex h-3 flex-none items-end gap-[2.5px]"
        aria-hidden="true"
      >
        <i /><i /><i />
      </span>
      <span
        class="pointer-events-none truncate"
        :title="lyric"
        >{{ lyric }}</span
      >
    </div>
    <button
      type="button"
      class="size-7 shrink-0 rounded-full text-[11px] opacity-70 hover:bg-white/15 hover:opacity-100"
      aria-label="返回播放器"
      @click="focusPlayer"
    >
      ▸
    </button>
  </div>
</template>

<style scoped>
:global(body.desktop-island) {
  background: transparent;
}
</style>
