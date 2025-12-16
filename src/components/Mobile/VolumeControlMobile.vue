<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue'
import { useAudio } from '@/composables/useAudio'
import { onClickOutside } from '@vueuse/core'

const { volume, isMuted, setVolume } = useAudio()

const showPopup = ref(false)
const popupRef = useTemplateRef('popupRef')
const controlRef = useTemplateRef('controlRef')
const volumeTrackRef = useTemplateRef('volumeTrackRef')

// Close popup when clicking outside
onClickOutside(controlRef, () => {
  showPopup.value = false
})

const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) return 'icon-[mdi--volume-off]'
  if (volume.value < 0.3) return 'icon-[mdi--volume-low]'
  if (volume.value < 0.7) return 'icon-[mdi--volume-medium]'
  return 'icon-[mdi--volume-high]'
})

const togglePopup = () => {
  showPopup.value = !showPopup.value
}

// Slider Logic
const isDragging = ref(false)

const updateVolumeFromEvent = (clientY: number) => {
  if (!volumeTrackRef.value) return
  const rect = volumeTrackRef.value.getBoundingClientRect()
  // Calculate volume based on Y position relative to track height
  // Bottom is 0, Top is 1
  const distFromBottom = rect.bottom - clientY
  const newVolume = Math.max(0, Math.min(1, distFromBottom / rect.height))
  setVolume(newVolume)
}

const handleTouchStart = (e: TouchEvent) => {
  isDragging.value = true
  updateVolumeFromEvent(e.touches[0].clientY)
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
}

const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return
  e.preventDefault()
  updateVolumeFromEvent(e.touches[0].clientY)
}

const handleTouchEnd = () => {
  isDragging.value = false
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
}

// Mouse support
const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true
  updateVolumeFromEvent(e.clientY)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return
  e.preventDefault()
  updateVolumeFromEvent(e.clientY)
}

const handleMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}
</script>

<template>
  <div ref="controlRef" class="relative flex items-center justify-center">
    <!-- Popup Bubble -->
    <Transition name="fade-slide">
      <div
        v-if="showPopup"
        ref="popupRef"
        class="absolute bottom-full mb-3 flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/10 p-4 shadow-xl backdrop-blur-xl"
      >
        <!-- Volume Value Text -->
        <span class="text-primary mb-3 text-sm font-bold">{{ Math.round(volume * 100) }}%</span>

        <!-- Vertical Slider Container -->
        <div
          class="relative flex h-32 w-10 cursor-pointer touch-none justify-center"
          @touchstart.prevent="handleTouchStart"
          @mousedown.prevent="handleMouseDown"
        >
          <!-- Track Reference (for calculations) -->
          <div ref="volumeTrackRef" class="absolute top-2 bottom-2 w-full"></div>

          <!-- Background Track -->
          <div class="absolute top-2 bottom-2 w-1.5 rounded-full bg-white/20"></div>

          <!-- Active Track -->
          <div
            class="bg-primary absolute bottom-2 w-1.5 rounded-full transition-[height] duration-75 will-change-[height]"
            :style="{ height: `calc(${volume * 100}% * (1 - 16px / 128px))` }"
          >
            <!-- Simplified: Just map height to percentage of track area. 
                  The track is h-32 (128px) minus padding (say 16px total).
                  Let's use the trackRef height logic directly in style.
             -->
          </div>

          <!-- Re-implementing simplified style for robustness -->
          <div
            class="bg-primary absolute bottom-2 w-1.5 rounded-full"
            :style="{ height: `calc((100% - 16px) * ${volume})` }"
          ></div>

          <!-- Thumb (Circle) -->
          <div
            class="absolute flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-lg"
            :style="{ bottom: `calc(8px + (100% - 16px) * ${volume} - 8px)` }"
          >
            <div class="bg-primary/50 h-1.5 w-1.5 rounded-full"></div>
          </div>
        </div>

        <!-- Arrow (Triangle) -->
        <div
          class="absolute top-full left-1/2 mt-px -ml-2 border-8 border-transparent border-t-white/10"
        ></div>
      </div>
    </Transition>

    <!-- Toggle Button -->
    <Button
      variant="ghost"
      size="icon-lg"
      rounded="full"
      class="control-btn flex h-14 w-14 items-center justify-center rounded-full"
      :class="{ 'text-primary': showPopup }"
      @click.stop="togglePopup"
      :icon="volumeIcon"
      icon-class="text-primary/70 group-hover:text-primary h-7 w-7 transition-colors"
    >
    </Button>
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}
</style>
