<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useNativeWindowFrame } from '@/composables/useNativeWindowFrame'
import NotificationHost from '@/components/ui/NotificationHost.vue'

const props = defineProps<{ cover?: string; glassStyle?: string }>()
const element = useTemplateRef<HTMLElement>('element')
const { needsCustomFrame, resizeHandles, startResize } = useNativeWindowFrame()
const material = computed(() =>
  props.glassStyle === 'liquid' ? 'liquid-win' : 'glass-win'
)

// 主播放器需要把原稿动画控制器限定在此宿主内，设置窗口直接复用插槽。
defineExpose({ element })
</script>

<template>
  <div
    ref="element"
    class="native-player h-full w-full"
    :class="{ 'win10-frame p-[var(--native-frame-inset)]': needsCustomFrame }"
  >
    <section
      id="colA"
      class="col h-full w-full"
    >
      <div
        class="h-full w-full"
        :class="material"
      >
        <div
          class="win relative flex h-full flex-col overflow-hidden text-left text-white"
          data-player
        >
          <div
            class="win-bg absolute inset-[-50px] z-[0]"
            :style="cover ? { backgroundImage: `url(${cover})` } : undefined"
            data-bg
          />
          <div class="win-veil absolute inset-0 z-[1]" />
          <slot />
          <NotificationHost />
          <!-- 原生外框缩放入口：仅覆盖可见窗口内侧，不占用穿透的阴影留白。 -->
          <template v-if="needsCustomFrame">
            <div
              v-for="handle in resizeHandles"
              :key="handle.direction"
              class="absolute z-[100] touch-none select-none"
              :class="handle.class"
              aria-hidden="true"
              @pointerdown.left.prevent="startResize(handle.direction)"
            />
          </template>
        </div>
      </div>
    </section>
  </div>
</template>
