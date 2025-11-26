<script setup lang="ts">
import { useSettingsStore } from '@/stores/modules/settings'
import { storeToRefs } from 'pinia'
import { useGlobalStore } from '@/stores/modules/global'

const settings = useSettingsStore()
const { footerLyrics, backgroundType } = storeToRefs(settings)
const globalStore = useGlobalStore()
const { theme } = storeToRefs(globalStore)

const footerEnabled = computed({
  get: () => footerLyrics.value.enabled,
  set: v => settings.setFooterLyricsEnabled(!!v),
})

const bgOptions = [
  { value: 'aurora', label: '极光' },
  { value: 'colorbends', label: '渐变波' },
  { value: 'ultimate', label: '高级' },
]

const themeOptions = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '暗黑' },
  { value: 'system', label: '跟随系统' },
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
  <div class="h-full flex-1 overflow-auto px-3 pb-6">
    <section class="mb-6">
      <h2 class="text-primary mb-2 text-sm font-semibold">主题模式</h2>
      <GlassSelect v-model="theme" :options="themeOptions" />
    </section>
    <section class="mb-6">
      <h2 class="text-primary mb-2 text-sm font-semibold">背景样式</h2>
      <GlassSelect v-model="backgroundType" :options="bgOptions" />
    </section>

    <section>
      <h2 class="text-primary mb-2 text-sm font-semibold">底部歌词</h2>
      <div class="glass-card mb-3 flex items-center justify-between p-3">
        <span class="text-primary text-sm">显示底部歌词</span>
        <label class="inline-flex cursor-pointer items-center">
          <input type="checkbox" class="sr-only" v-model="footerEnabled" />
          <span class="bg-hover-glass relative h-6 w-10 rounded-full">
            <span
              :class="footerEnabled ? 'translate-x-5 bg-pink-500' : ' bg-gray-500 translate-x-0'"
              class="absolute top-1/2 left-0 h-5 w-5 -translate-y-1/2 rounded-full transition-transform"
            ></span>
          </span>
        </label>
      </div>
      <div class="glass-card p-3">
        <label class="text-primary/80 mb-2 block text-xs">显示语言（最多选择两种）</label>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="
              originalChecked
                ? 'bg-hover-glass text-primary ring-1 ring-(--glass-border)'
                : 'bg-button-glass text-primary/70'
            "
            @click="originalChecked = !originalChecked"
          >
            原文
          </button>
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="
              transChecked
                ? 'bg-hover-glass text-primary ring-1 ring-(--glass-border)'
                : 'bg-button-glass text-primary/70'
            "
            @click="transChecked = !transChecked"
          >
            译文
          </button>
          <button
            class="rounded-full px-3 py-1 text-xs"
            :class="
              romaChecked
                ? 'bg-hover-glass text-primary ring-1 ring-(--glass-border)'
                : 'bg-button-glass text-primary/70'
            "
            @click="romaChecked = !romaChecked"
          >
            罗马音
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
