<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrayIcon from '@/components/tray/TrayIcon.vue'
import type { SourceSnapshot } from '@/types/prototype'

const props = defineProps<{
  snapshot: SourceSnapshot | null
  pending: boolean
  animate: boolean
}>()
const emit = defineEmits<{ toggle: [] }>()
// 封面加载失败时显示本地音乐图标，不使用不相关的占位专辑。
const coverFailed = shallowRef(false)
watch(
  () => props.snapshot?.track.cover,
  () => {
    coverFailed.value = false
  }
)
const title = computed(() => props.snapshot?.track.title || '音乐随时在场')
const artist = computed(
  () => props.snapshot?.track.artist || '打开主播放器，开始聆听'
)
const playing = computed(() => props.snapshot?.playing === true)
</script>

<template>
  <div class="tray-now-playing">
    <div class="tray-cover">
      <img decoding="async" loading="lazy"
        v-if="snapshot?.track.cover && !coverFailed"
        :src="snapshot.track.cover"
        alt="当前歌曲专辑封面"
        referrerpolicy="no-referrer"
        @error="coverFailed = true"
      />
      <TrayIcon
        v-else
        name="music"
      />
    </div>
    <div class="tray-track-text">
      <span
        class="tray-track-title"
        :title="title"
        >{{ title }}</span
      >
      <span
        class="tray-track-artist"
        :title="artist"
        >{{ artist }}</span
      >
      <span
        v-if="snapshot"
        class="tray-track-state"
      >
        <span
          class="tray-track-eq"
          :class="{ 'is-playing': playing && animate }"
          aria-hidden="true"
          ><i /><i /><i
        /></span>
        {{ playing ? '正在播放' : '已暂停' }}
      </span>
    </div>
    <BaseButton
      class="tray-toggle"
      :disabled="!snapshot || pending"
      :aria-label="playing ? '暂停播放' : '继续播放'"
      :title="playing ? '暂停播放' : '继续播放'"
      @click="emit('toggle')"
    >
      <TrayIcon :name="playing ? 'pause' : 'play'" />
    </BaseButton>
  </div>
</template>

<style scoped>
.tray-now-playing {
  display: flex;
  min-height: 68px;
  align-items: center;
  gap: 10px;
  margin: 4px 0 10px;
  padding: 10px;
  border: 1px solid rgb(255 255 255 / 0.075);
  border-radius: 12px;
  background: rgb(255 255 255 / 0.035);
}
.tray-cover {
  display: grid;
  width: 42px;
  height: 42px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 9px;
  background: rgb(255 255 255 / 0.075);
  color: rgb(255 255 255 / 0.65);
}
.tray-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tray-cover svg {
  width: 21px;
  height: 21px;
}
.tray-track-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}
.tray-track-title,
.tray-track-artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tray-track-title {
  font-size: 12px;
  font-weight: 750;
  line-height: 1.45;
}
.tray-track-artist {
  color: rgb(255 255 255 / 0.66);
  font-size: 10.5px;
  line-height: 1.4;
}
.tray-track-state {
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgb(255 255 255 / 0.64);
  font-size: 9px;
  line-height: 1.4;
}
.tray-track-eq {
  display: flex;
  height: 9px;
  align-items: end;
  gap: 2px;
}
.tray-track-eq i {
  width: 2px;
  height: 4px;
  border-radius: 1px;
  background: currentColor;
}
.tray-track-eq i:nth-child(2) {
  height: 7px;
}
.tray-track-eq.is-playing i {
  transform-origin: bottom;
  animation: tray-equalizer 900ms ease-in-out infinite alternate;
}
.tray-track-eq.is-playing i:nth-child(2) {
  animation-delay: -300ms;
}
.tray-track-eq.is-playing i:nth-child(3) {
  animation-delay: -600ms;
}
.tray-toggle {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 0.13);
  border-radius: 50%;
  background: rgb(255 255 255 / 0.09);
  color: #fff;
  transition: background-color 160ms ease;
}
.tray-toggle svg {
  width: 15px;
  height: 15px;
}
.tray-toggle:not(:disabled):hover {
  background: rgb(255 255 255 / 0.17);
}
.tray-toggle:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.75);
  outline-offset: 2px;
}
.tray-toggle:disabled {
  cursor: default;
  opacity: 0.45;
}
@keyframes tray-equalizer {
  to {
    transform: scaleY(0.35);
  }
}
:global([data-tray-motion='off'] .tray-toggle) {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .tray-track-eq.is-playing i {
    animation: none;
  }
  .tray-toggle {
    transition: none;
  }
}
</style>
