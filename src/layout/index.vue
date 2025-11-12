<script setup lang="ts">
import Header from './header.vue'
import Aside from './aside.vue'
import Footer from './footer.vue'

import Aurora from '@/components/Background/Aurora.vue'
import ColorBends from '@/components/Background/ColorBends.vue'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/modules/settings'

const settings = useSettingsStore()
const { aurora, colorBends, backgroundType } = storeToRefs(settings)

const colorStops = computed(() => {
  const stops = (aurora.value.colorStops || []).slice(0, 3)
  return stops.map((s: string) => (s.startsWith('#') ? s : `#${s}`))
})

const positions = computed(() => {
  const p = aurora.value.colorPositions || [0, 0.5, 1]
  return [p[0] ?? 0, p[1] ?? 0.5, p[2] ?? 1]
})
</script>

<template>
  <div class="relative flex h-full w-full overflow-hidden bg-black">
    <div class="absolute inset-0 h-full w-full">
      <component
        :is="backgroundType === 'colorbends' ? ColorBends : Aurora"
        v-bind="
          backgroundType === 'colorbends'
            ? colorBends
            : {
                ...aurora,
                colorPositions: positions,
                colorStops: colorStops,
              }
        "
        class="h-full w-full"
      />
    </div>
    <!-- 主容器 -->
    <div class="flex w-full flex-col px-36 py-6">
      <div class="glass-container flex flex-1 flex-col overflow-hidden">
        <!-- 头部区域 -->
        <Header />
        <!-- 主内容区域 -->
        <main class="flex flex-1 overflow-x-hidden">
          <!-- 左侧边栏 -->
          <Aside />
          <!-- 右侧主内容 -->
          <router-view />
        </main>
        <Footer />
      </div>
    </div>
  </div>
</template>
