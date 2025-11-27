<script setup lang="ts">
import { useUserStore } from '@/stores/modules/user'
const sections = [
  {
    titleKey: 'layout.aside.explore',
    items: [
      { to: '/', labelKey: 'layout.aside.menu.home', icon: 'mdi--home' },
      { to: '/mv-list', labelKey: 'layout.aside.menu.mv', icon: 'mdi--video' },
      { to: '/charts', labelKey: 'layout.aside.menu.charts', icon: 'mdi--chart-line' },
      { to: '/search', labelKey: 'layout.aside.menu.search', icon: 'ic--round-search' },
    ],
  },
  {
    titleKey: 'layout.aside.myMusic',
    items: [
      { to: '/recent', labelKey: 'layout.aside.menu.recent', icon: 'mdi--clock-outline' },
      { to: '/likes', labelKey: 'layout.aside.menu.likes', icon: 'mdi--heart-outline' },
    ],
  },
  {
    titleKey: 'layout.aside.system',
    items: [{ to: '/settings', labelKey: 'layout.aside.menu.settings', icon: 'mdi--cog' }],
  },
]

const state = reactive({
  // 用户创建的歌单列表
  userPlaylists: [
    { id: 1, name: '我喜欢的音乐' },
    { id: 2, name: '华语流行' },
    { id: 3, name: '二次元音乐' },
    { id: 4, name: '轻音乐' },
  ],
})
const { userPlaylists } = toRefs(state)
const userStore = useUserStore()
</script>
<template>
  <aside class="hidden w-64 shrink-0 px-4 py-0 lg:block">
    <div class="glass-card h-full p-4">
      <div v-for="sec in sections" :key="sec.titleKey" class="mb-6">
        <h3 class="mb-3 text-xs font-semibold tracking-wide text-white/70 uppercase">
          {{ $t(sec.titleKey) }}
        </h3>
        <nav class="space-y-2">
          <router-link
            v-for="item in sec.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center space-x-3 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            :class="{ 'bg-white/10 text-white': $route.path === item.to }"
          >
            <span class="h-5 w-5" :class="`icon-[${item.icon}]`"></span>
            <span>{{ $t(item.labelKey) }}</span>
          </router-link>
          <div class="hidden">
            <span class="icon-[mdi--chevron-right]"></span>
          </div>
        </nav>
      </div>

      <div class="mt-6" v-if="userStore.isLoggedIn">
        <h4 class="mb-3 text-sm font-medium text-white/60">
          {{ $t('layout.aside.playlists.created') }}
        </h4>
        <div class="space-y-2">
          <div
            v-for="playlist in userPlaylists"
            :key="playlist.id"
            class="flex cursor-pointer items-center space-x-3 rounded-lg p-2 transition-colors hover:bg-white/10"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-pink-400 to-purple-500 text-xs"
            >
              {{ playlist.name.charAt(0) }}
            </div>
            <span class="truncate text-sm text-white/80">{{ playlist.name }}</span>
          </div>
        </div>
      </div>
      <div class="hidden">
        <span class="icon-[mdi--home] h-5 w-5"></span>
        <span class="icon-[mdi--video] h-5 w-5"></span>
        <span class="icon-[mdi--chart-line] h-5 w-5"></span>
        <span class="icon-[ic--round-search] h-5 w-5"></span>
        <span class="icon-[mdi--clock-outline] h-5 w-5"></span>
        <span class="icon-[mdi--heart-outline] h-5 w-5"></span>
        <span class="icon-[mdi--cog] h-5 w-5"></span>
        <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
      </div>
    </div>
  </aside>
</template>
