<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'
import { storeToRefs } from 'pinia'
import { useGlobalStore } from '@/stores/modules/global'

const settings = useSettingsStore()
const { footerLyrics, backgroundType } = storeToRefs(settings)
const globalStore = useGlobalStore()
const { theme } = storeToRefs(globalStore)

const bgOptions = [
  { key: 'aurora', label: '极光' },
  { key: 'colorbends', label: '渐变波' },
  { key: 'ultimate', label: '高级' },
]

const themeOptions = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '暗黑' },
  { key: 'system', label: '跟随系统' },
]

const toggleMode = (mode: 'original' | 'trans' | 'roma', checked: boolean) => {
  const modes = new Set(footerLyrics.value.modes)
  if (checked) {
    modes.add(mode)
    const arr = Array.from(modes).slice(0, 2)
    settings.setFooterLyricsModes(arr as Array<'original' | 'trans' | 'roma'>)
  } else {
    modes.delete(mode)
    const arr = Array.from(modes)
    settings.setFooterLyricsModes(arr as Array<'original' | 'trans' | 'roma'>)
  }
}

const originalChecked = computed({
  get: () => footerLyrics.value.modes.includes('original'),
  set: v => toggleMode('original', v as boolean),
})
const transChecked = computed({
  get: () => footerLyrics.value.modes.includes('trans'),
  set: v => toggleMode('trans', v as boolean),
})
const romaChecked = computed({
  get: () => footerLyrics.value.modes.includes('roma'),
  set: v => toggleMode('roma', v as boolean),
})
</script>

<template>
  <div class="flex-1 overflow-auto px-3 pb-6 h-full">
    <section class="mb-6">
      <h2 class="mb-2 text-sm font-semibold text-primary">主题模式</h2>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="opt in themeOptions"
          :key="opt.key"
          class="glass-button rounded-lg px-3 py-2 text-sm"
          :class="theme===opt.key ? 'text-primary' : 'text-primary/70'"
          @click="globalStore.setTheme(opt.key as 'light' | 'dark' | 'system')"
        >
          {{ opt.label }}
        </button>
      </div>
    </section>
    <section class="mb-6">
      <h2 class="mb-2 text-sm font-semibold text-primary">背景样式</h2>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="opt in bgOptions"
          :key="opt.key"
          class="glass-button rounded-lg px-3 py-2 text-sm"
          :class="backgroundType===opt.key ? 'bg-hover-glass text-primary' : 'bg-button-glass text-primary/70'"
          @click="settings.setBackgroundType(opt.key as any)"
        >
          {{ opt.label }}
        </button>
      </div>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-semibold text-primary">底部歌词</h2>
      <div class="glass-card mb-3 flex items-center justify-between p-3">
        <span class="text-sm text-primary">显示底部歌词</span>
        <label class="inline-flex cursor-pointer items-center">
          <input type="checkbox" class="hidden" v-model="footerLyrics.enabled" />
          <span class="relative h-6 w-10 rounded-full bg-hover-glass">
            <span :class="footerLyrics.enabled ? 'translate-x-5 bg-pink-500' : 'translate-x-0 bg-button-glass'" class="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-transform"></span>
          </span>
        </label>
      </div>
      <div class="glass-card p-3">
        <label class="mb-2 block text-xs text-primary/80">显示语言（最多选择两种）</label>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="originalChecked ? 'bg-hover-glass text-primary ring-1 ring-[color:var(--glass-border)]' : 'bg-button-glass text-primary/70'"
            @click="originalChecked = !originalChecked"
          >原文</button>
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="transChecked ? 'bg-hover-glass text-primary ring-1 ring-[color:var(--glass-border)]' : 'bg-button-glass text-primary/70'"
            @click="transChecked = !transChecked"
          >译文</button>
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="romaChecked ? 'bg-hover-glass text-primary ring-1 ring-[color:var(--glass-border)]' : 'bg-button-glass text-primary/70'"
            @click="romaChecked = !romaChecked"
          >罗马音</button>
        </div>
      </div>
    </section>
  </div>
</template>
