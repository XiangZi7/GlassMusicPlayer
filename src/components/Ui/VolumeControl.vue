<script setup lang="ts">
import { useAudio } from '@/composables/useAudio'
import { useEventListener } from '@vueuse/core'

const { volume, isMuted, setVolume, toggleMute } = useAudio()

const volumeBarRef = useTemplateRef('volumeBarRef')

const state = reactive({
  isDragging: false,
  dragVolume: null as number | null,
  showVolumePreview: false,
  previewVolume: 0,
  previewPosition: 0,
})

const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) return 'icon-[mdi--volume-off]'
  if (volume.value < 0.3) return 'icon-[mdi--volume-low]'
  if (volume.value < 0.7) return 'icon-[mdi--volume-medium]'
  return 'icon-[mdi--volume-high]'
})

const handleVolumeHover = (event: MouseEvent) => {
  if (!volumeBarRef.value) return
  const rect = volumeBarRef.value.getBoundingClientRect()
  const hoverX = event.clientX - rect.left
  const hoverVolume = Math.max(0, Math.min(1, hoverX / rect.width))

  state.previewVolume = hoverVolume
  state.previewPosition = hoverX
  state.showVolumePreview = true
}

const handleVolumeLeave = () => {
  state.showVolumePreview = false
}

const handleVolumeDrag = (clientX: number) => {
  if (!state.isDragging || !volumeBarRef.value) return
  const rect = volumeBarRef.value.getBoundingClientRect()
  const x = clientX - rect.left
  const newVolume = Math.max(0, Math.min(1, x / rect.width))
  state.dragVolume = newVolume

  setVolume(newVolume)

  state.previewVolume = newVolume
  state.previewPosition = x
}

const startDrag = (event: MouseEvent | TouchEvent) => {
  if (event instanceof TouchEvent) {
    // 阻止默认滚动行为
  } else {
    event.preventDefault()
  }
  state.isDragging = true
  state.dragVolume = volume.value
  document.body.style.userSelect = 'none'

  const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX
  handleVolumeDrag(clientX)
}

const stopDrag = () => {
  state.isDragging = false
  state.dragVolume = null
  document.body.style.userSelect = ''
}

const handleMouseMove = (event: MouseEvent) => {
  if (state.isDragging) {
    event.preventDefault()
    handleVolumeDrag(event.clientX)
  }
}

const handleTouchMove = (event: TouchEvent) => {
  if (state.isDragging) {
    handleVolumeDrag(event.touches[0].clientX)
  }
}

const handleVolumeClick = (event: MouseEvent) => {
  if (!volumeBarRef.value) return
  const rect = volumeBarRef.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newVolume = Math.max(0, Math.min(1, clickX / rect.width))
  setVolume(newVolume)
}

useEventListener(document, 'mousemove', handleMouseMove)
useEventListener(document, 'mouseup', stopDrag)
useEventListener(document, 'touchmove', handleTouchMove, { passive: false })
useEventListener(document, 'touchend', stopDrag)

const displayVolume = computed(() => {
  return (state.isDragging && state.dragVolume !== null ? state.dragVolume : volume.value) * 100
})

const previewPositionPercent = computed(() => {
  if (state.isDragging) {
    return displayVolume.value
  }
  if (!volumeBarRef.value) return 0
  const width = volumeBarRef.value.getBoundingClientRect().width
  return width > 0 ? (state.previewPosition / width) * 100 : 0
})

const previewVolumeText = computed(() => {
  return Math.round(state.previewVolume * 100) + '%'
})
</script>

<template>
  <div class="flex items-center gap-2">
    <Button
      variant="ghost"
      size="icon-md"
      rounded="full"
      @click="toggleMute"
      class="text-primary/70 hover:text-primary flex items-center transition-colors"
      title="Toggle Mute"
      :icon="volumeIcon"
      icon-class="h-6 w-6"
    >
    </Button>

    <div
      ref="volumeBarRef"
      @click="handleVolumeClick"
      @mousemove="handleVolumeHover"
      @mouseleave="handleVolumeLeave"
      @mousedown="startDrag"
      @touchstart.prevent="startDrag"
      class="progress-wrapper group relative h-6 w-24 cursor-pointer select-none"
    >
      <!-- Volume Preview Tooltip -->
      <Transition name="fade">
        <div
          v-if="state.showVolumePreview || state.isDragging"
          class="volume-preview absolute bottom-full mb-2 -translate-x-1/2 rounded-lg bg-black/80 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg backdrop-blur-sm"
          :style="{ left: `${previewPositionPercent}%` }"
        >
          {{ previewVolumeText }}
          <div
            class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/80"
          ></div>
        </div>
      </Transition>

      <div
        class="progress-track absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full transition-all group-hover:h-1.5"
        :class="state.isDragging ? 'h-1.5' : ''"
      >
        <div
          class="progress-fill absolute inset-y-0 left-0 rounded-full"
          :style="{ width: `${displayVolume}%` }"
        ></div>
      </div>
      <div
        class="progress-thumb absolute top-1/2"
        :class="state.isDragging ? 'active' : ''"
        :style="{ left: `${displayVolume}%` }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style/tailwind.css";

.progress-wrapper {
  touch-action: none;
}

.progress-track {
  background: rgba(255, 255, 255, 0.15);
}

.progress-fill {
  background: linear-gradient(90deg, #ec4899, #8b5cf6);
  box-shadow: 0 0 8px rgba(236, 72, 153, 0.4);
  transition: width 0.05s linear;
}

.progress-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%);
  opacity: 0;
  transition:
    opacity 0.2s,
    transform 0.2s,
    box-shadow 0.2s;
}

.progress-wrapper:hover .progress-thumb,
.progress-thumb.active {
  opacity: 1;
}

.progress-thumb.active {
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(236, 72, 153, 0.6);
}

.volume-preview {
  pointer-events: none;
  z-index: 100;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
