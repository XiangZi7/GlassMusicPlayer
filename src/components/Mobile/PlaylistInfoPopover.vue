<script setup lang="ts">
const props = defineProps<{
  songCount: number
  likes: string
  playCount?: string
  createTime?: string
  category?: string
}>()

const open = ref(false)
const triggerRef = ref<HTMLElement>()
const popoverRef = ref<HTMLElement>()

const toggle = () => (open.value = !open.value)

const onDocClick = (e: Event) => {
  const t = e.target as Node
  if (triggerRef.value && triggerRef.value.contains(t)) return
  if (popoverRef.value && popoverRef.value.contains(t)) return
  open.value = false
}

onMounted(() => document.addEventListener('pointerdown', onDocClick))
onUnmounted(() => document.removeEventListener('pointerdown', onDocClick))
</script>

<template>
  <div ref="triggerRef" class="relative inline-block">
    <Button
      variant="ghost"
      size="icon-lg"
      rounded="full"
      class="info-trigger flex h-7 w-7 items-center justify-center rounded-full"
      icon="mdi--information-outline"
      icon-class="h-4 w-4 text-primary/60"
      @click.stop="toggle"
    />
    <Transition name="popover">
      <div
        v-if="open"
        ref="popoverRef"
        class="info-popover absolute bottom-full left-0 z-50 mb-2 min-w-[140px] rounded-xl p-3"
      >
        <div class="space-y-2 text-xs">
          <div class="flex items-center gap-2">
            <span class="icon-[mdi--music-note] h-4 w-4 text-pink-400"></span>
            <span class="text-primary/80">{{ songCount }}首歌曲</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="icon-[mdi--heart] h-4 w-4 text-pink-400"></span>
            <span class="text-primary/80">{{ likes }}收藏</span>
          </div>
          <div v-if="playCount" class="flex items-center gap-2">
            <span class="icon-[mdi--play] h-4 w-4 text-pink-400"></span>
            <span class="text-primary/80">{{ playCount }}播放</span>
          </div>
          <div v-if="category" class="flex items-center gap-2">
            <span class="icon-[mdi--tag] h-4 w-4 text-pink-400"></span>
            <span class="text-primary/80">{{ category }}</span>
          </div>
          <div v-if="createTime" class="flex items-center gap-2">
            <span class="icon-[mdi--calendar] h-4 w-4 text-pink-400"></span>
            <span class="text-primary/80">{{ createTime }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.info-trigger {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.info-trigger:active {
  transform: scale(0.9);
  background: rgba(255, 255, 255, 0.2);
}

.info-popover {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.popover-enter-active,
.popover-leave-active {
  transition: all 0.2s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}
</style>
