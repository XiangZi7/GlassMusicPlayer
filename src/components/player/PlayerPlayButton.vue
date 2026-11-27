<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { usePlayer } from '@/composables/usePlayer'

const { state, tracks } = usePlayer()
const { playing, audioLoading, settings } = toRefs(state)
const disabled = computed(() =>
  tracks[state.idx] ? !tracks[state.idx]?.catalog : !state.queue?.length
)
const label = computed(() =>
  audioLoading.value
    ? '正在获取音频，点击取消'
    : playing.value
      ? '暂停'
      : '播放'
)

// 播放与暂停共用一条路径：两段子路径的命令结构完全一致（M + 3L + Z ×2），
// 播放态把两段拼成三角，暂停态回到双竖条，切换时由 CSS 对 d 做 280ms 插值形变。
const PLAY_D =
  'M7.6 4.9 L12.2 8.45 L12.2 15.55 L7.6 19.1 Z M12.2 8.45 L19 12 L12.2 15.55 L12.2 8.45 Z'
const PAUSE_D =
  'M6.2 5 L9.8 5 L9.8 19 L6.2 19 Z M14.2 5 L17.8 5 L17.8 19 L14.2 19 Z'
// 形变路径同时写进 style 的 d 属性：支持 d 过渡的引擎走插值，不支持的引擎回退到属性值直接切换。
const glyphStyle = computed(() => ({
  d: `path("${playing.value ? PAUSE_D : PLAY_D}")`,
}))
</script>

<template>
  <button
    type="button"
    data-play
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    :aria-busy="audioLoading"
  >
    <svg
      v-if="audioLoading"
      :class="{ 'motion-safe:animate-spin': settings.motion }"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        opacity=".22"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke-linecap="round"
      />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        class="play-glyph"
        :class="{ 'glyph-static': !settings.motion }"
        :d="playing ? PAUSE_D : PLAY_D"
        :style="glyphStyle"
      />
    </svg>
  </button>
</template>

<style scoped>
/* 播放/暂停形变：280ms 路径插值，缓动与全屏入场同语言；关动效或系统减动效时直接切换。 */
.play-glyph {
  transition: d 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
.play-glyph.glyph-static {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .play-glyph {
    transition: none;
  }
}
</style>
