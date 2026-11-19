<script setup lang="ts">
import { toRef } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'

defineProps<{ variant: 'titlebar' | 'page' }>()
const { state, controller } = usePlayer()
const draft = toRef(state, 'queryDraft')

// 回车或点击放大镜才提交当前关键词，并打开搜索页。
function submit(): void {
  const player = controller()
  if (!player) return
  player.setQuery(state.queryDraft)
  if (state.page !== 'search') player.navigate('search')
}
</script>

<template>
  <!-- 搜索表单只在提交时更新搜索词，继续使用原有的页内与标题栏样式。 -->
  <form
    role="search"
    :class="
      variant === 'titlebar'
        ? 'chrome-search ml-auto flex h-[30px] w-[196px] flex-none items-center gap-[7px] rounded-full px-[10px] text-inherit'
        : 'search-box mt-[16px] flex min-h-[46px] items-center gap-[10px] rounded-[14px] px-[14px]'
    "
    @submit.prevent="submit"
  >
    <BaseButton
      type="submit"
      aria-label="搜索"
      class="grid size-[26px] flex-none place-items-center rounded-full p-0 text-inherit"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.3"
        aria-hidden="true"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    </BaseButton>
    <input
      v-model="draft"
      maxlength="100"
      type="text"
      :data-top-search="variant === 'titlebar' ? '' : null"
      :data-search-input="variant === 'page' ? '' : null"
      aria-label="搜索歌曲、歌手"
      placeholder="搜索歌曲、歌手…"
      autocomplete="off"
    />
  </form>
</template>
