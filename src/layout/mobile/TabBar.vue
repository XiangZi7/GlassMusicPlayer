<script setup lang="ts">
import MiniPlayerMobile from '@/components/Mobile/MiniPlayerMobile.vue'

const items = [
  { to: '/', icon: 'icon-[mdi--home]', label: '首页' },
  { to: '/discover', icon: 'icon-[mdi--compass-outline]', label: '发现' },
  { to: '/search', icon: 'icon-[mdi--magnify]', label: '搜索' },
  { to: '/my-music', icon: 'icon-[mdi--music-circle-outline]', label: '我的' },
  { to: '/settings', icon: 'icon-[mdi--cog-outline]', label: '设置' },
]

const emit = defineEmits(['show-player'])

</script>

<template>
  <MiniPlayerMobile @open="emit('show-player')" />

  <nav
    class="fixed right-0 bottom-0 left-0 z-50 border-t border-white/10 bg-[#131826]/95 backdrop-blur-sm"
  >
    <div class="mx-auto flex items-center justify-around">
      <RouterLink
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        class="flex flex-col items-center justify-center py-2 text-xs"
        :class="$route.path.startsWith(it.to) ? 'text-white' : 'text-white/60'"
      >
        <component :is="'span'" :class="it.icon" class="mb-1 h-5 w-5" />
        <span>{{ it.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
