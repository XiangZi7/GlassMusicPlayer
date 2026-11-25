<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'

const { state, tracks, controller } = usePlayer()
// 电台种子就是当前曲目，与电台页的种子口径一致。
const seed = computed(() => tracks[state.idx])
// 副文案区分播出中、待开启与尚无种子三种状态。
const subtitle = computed(() => {
  const track = seed.value
  if (state.radioOn && track) return '播出中 · 以《' + track.title + '》为种子'
  if (track) return '以《' + track.title + '》为种子 · ' + track.artist
  return '选一首歌开启电台'
})
</script>

<template>
  <BaseButton
    class="tile radio-tile"
    :class="{ 'radio-live': state.radioOn, 'radio-anim': state.settings.motion }"
    aria-label="打开歌曲电台"
    @click="controller()?.navigate('radio')"
  >
    <!-- 同心波纹：以中心唱片为圆心荡开，播出中且动效允许时缓慢呼吸。 -->
    <span class="radio-ripples" aria-hidden="true">
      <span class="ripple ripple-1"></span>
      <span class="ripple ripple-2"></span>
      <span class="ripple ripple-3"></span>
      <span class="radio-disc">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.2" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      </span>
    </span>
    <span class="radio-text">
      <b>歌曲电台</b>
      <span>{{ subtitle }}</span>
    </span>
    <span v-if="state.radioOn" class="radio-onair" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="radio-arrow" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    </span>
  </BaseButton>
</template>

<style scoped>
/* 电台 tile：整卡可点，左侧波纹唱片是视觉锚，右侧是状态与入口。 */
.radio-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  overflow: hidden;
  color: inherit;
  text-align: start;
  cursor: pointer;
}
.radio-tile:hover,
.radio-tile:focus-visible {
  background: rgb(255 255 255 / 7.5%);
}
.radio-tile:focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}
.radio-ripples {
  position: relative;
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  flex: none;
}
.ripple {
  position: absolute;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 50%;
}
.ripple-1 {
  inset: 16px;
}
.ripple-2 {
  inset: 8px;
  border-color: rgb(255 255 255 / 9%);
}
.ripple-3 {
  inset: 0;
  border-color: rgb(255 255 255 / 5.5%);
}
.radio-disc {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgb(255 255 255 / 26%);
  border-radius: 50%;
  background: rgb(255 255 255 / 9%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 14%);
  color: #fff;
}
.liquid-win .radio-disc {
  background: linear-gradient(155deg, rgb(255 255 255 / 22%), rgb(255 255 255 / 7%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 30%);
}
.radio-text {
  min-width: 0;
  flex: 1;
}
.radio-text b,
.radio-text span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.radio-text b {
  font-size: 15px;
  font-weight: 750;
  line-height: 1.35;
  color: #fff;
}
.radio-text span {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.45;
  color: rgb(255 255 255 / 60%);
}
/* 播出中三柱律动与电台页 ON AIR 同一语言，动效关闭时保持静态三柱。 */
.radio-onair {
  display: flex;
  align-items: flex-end;
  gap: 2.5px;
  height: 14px;
  flex: none;
}
.radio-onair i {
  width: 3px;
  border-radius: 2px;
  background: #fff;
}
.radio-onair i:nth-child(1) {
  height: 8px;
}
.radio-onair i:nth-child(2) {
  height: 13px;
}
.radio-onair i:nth-child(3) {
  height: 6px;
}
.radio-arrow {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 50%;
  color: rgb(255 255 255 / 78%);
}
@media (prefers-reduced-motion: no-preference) {
  .radio-live.radio-anim .ripple-3 {
    animation: radio-ripple 3.6s ease-in-out infinite;
  }
  .radio-live.radio-anim .radio-onair i {
    animation: radio-bars 0.9s ease-in-out infinite alternate;
  }
  .radio-live.radio-anim .radio-onair i:nth-child(2) {
    animation-delay: 0.22s;
  }
  .radio-live.radio-anim .radio-onair i:nth-child(3) {
    animation-delay: 0.44s;
  }
}
@keyframes radio-ripple {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.045);
    opacity: 0.55;
  }
}
@keyframes radio-bars {
  from {
    transform: scaleY(0.55);
  }
  to {
    transform: scaleY(1);
  }
}
.radio-onair i {
  transform-origin: bottom;
}
</style>
