<script setup lang="ts">
import { reactive, shallowRef, watch, type Component } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { notify } from '@/services/notification'

const props = defineProps<{ section: 'audio' | 'storage' }>()
const panel = shallowRef<Component>()
const state = reactive({
  // 读取当前分类失败时显示重新加载按钮。
  failed: false,
  // 每次手动重试重新发起模块读取。
  attempt: 0,
})

// 只在进入对应分类后加载表单；离开或快速切换时忽略旧请求。
watch(
  [() => props.section, () => state.attempt],
  async ([section], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    panel.value = undefined
    state.failed = false
    try {
      const module =
        section === 'audio'
          ? await import('@/pages/settings/components/equalizer-panel.vue')
          : await import('@/pages/settings/components/storage-panel.vue')
      if (active) panel.value = module.default
    } catch {
      if (!active) return
      state.failed = true
      notify('设置面板加载失败，请重试', 'error')
    }
  },
  { immediate: true }
)
</script>

<template>
  <!-- 分类内容区：模块就绪后沿用原表单及设置草稿。 -->
  <component
    :is="panel"
    v-if="panel"
  />
  <div
    v-else
    class="grid min-h-[140px] place-items-center"
  >
    <!-- 失败重试按钮及居中加载反馈。 -->
    <BaseButton
      v-if="state.failed"
      class="newpl-btn rounded-full px-4 py-2"
      @click="state.attempt++"
    >
      重新加载
    </BaseButton>
    <span
      v-else
      role="status"
      class="text-[13px] opacity-70"
      >正在加载设置…</span
    >
  </div>
</template>
