<script setup lang="ts">
import { computed } from 'vue'
import SlidingTabs from '@/components/ui/SlidingTabs.vue'
import { usePlayer } from '@/composables/usePlayer'
import type { PlayerPage, SortMode } from '@/stores/player'
const props = defineProps<{
  options: { label: string; value: string }[]
  hook: string
  kind?: 'tabs' | 'segment'
  settingKey?: keyof typeof state.settings
}>()
const { state, controller } = usePlayer()
const selected = computed(() => {
  if (props.settingKey) return String(state.settings[props.settingKey])
  if (props.hook === 'data-sort') {
    const key = props.options[0]?.value.split(':')[0] || ''
    return `${key}:${state.sorts[key] || 'def'}`
  }
  return state.page === 'album'
    ? 'albums'
    : state.page === 'artist'
      ? 'artists'
      : state.page
})
// 排序更新当前列表；业务标签通过播放器导航进入真实路由。
function select(value: string): void {
  if (props.settingKey) {
    Object.assign(state.settings, { [props.settingKey]: value })
    controller()?.render()
    return
  }
  if (props.hook === 'data-sort') {
    const [key, mode] = value.split(':')
    if (key && mode) {
      state.sorts[key] = mode as SortMode
      state.pg[key] = 1
    }
  } else controller()?.navigate(value as PlayerPage)
}
</script>
<template>
  <SlidingTabs
    :model-value="selected"
    :options="options"
    :kind="kind"
    :group="kind === 'segment' ? undefined : hook"
    @update:model-value="select"
  />
</template>
