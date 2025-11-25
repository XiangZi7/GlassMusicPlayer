<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'
import { storeToRefs } from 'pinia'

const settings = useSettingsStore()
const { footerLyrics, backgroundType } = storeToRefs(settings)

const bgOptions = [
  { key: 'aurora', label: '极光' },
  { key: 'colorbends', label: '渐变波' },
  { key: 'ultimate', label: '高级' },
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
  <div class="flex-1 overflow-auto px-3 pb-6">
    <section class="mb-6">
      <h2 class="mb-2 text-sm font-semibold text-white">背景样式</h2>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="opt in bgOptions"
          :key="opt.key"
          class="glass-button rounded-lg px-3 py-2 text-sm"
          :class="backgroundType===opt.key ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'"
          @click="settings.setBackgroundType(opt.key as any)"
        >
          {{ opt.label }}
        </button>
      </div>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-semibold text-white">底部歌词</h2>
      <div class="glass-card mb-3 flex items-center justify-between p-3">
        <span class="text-sm text-white/90">显示底部歌词</span>
        <label class="inline-flex cursor-pointer items-center">
          <input type="checkbox" class="hidden" v-model="footerLyrics.enabled" />
          <span class="relative h-6 w-10 rounded-full bg-white/20">
            <span :class="footerLyrics.enabled ? 'translate-x-5 bg-pink-500' : 'translate-x-0 bg-white'" class="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-transform"></span>
          </span>
        </label>
      </div>
      <div class="glass-card p-3">
        <label class="mb-2 block text-xs text-white/80">显示语言（最多选择两种）</label>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="originalChecked ? 'bg-white/20 text-white ring-1 ring-white/20' : 'bg-white/10 text-white/70'"
            @click="originalChecked = !originalChecked"
          >原文</button>
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="transChecked ? 'bg-white/20 text-white ring-1 ring-white/20' : 'bg-white/10 text白色/70'"
            @click="transChecked = !transChecked"
          >译文</button>
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="romaChecked ? 'bg白色/20 text白色 ring-1 ring白色/20' : 'bg白色/10 text白色/70'"
            @click="romaChecked = !romaChecked"
          >罗马音</button>
        </div>
      </div>
    </section>
  </div>
</template>
