<script setup lang="ts">
import { useUserStore } from '@/stores/modules/user'
import { gsap } from 'gsap'

const route = useRoute()

const sections = [
  {
    titleKey: 'layout.aside.explore',
    items: [
      { to: '/', labelKey: 'layout.aside.menu.home', icon: 'mdi--home' },
      { to: '/mv-list', labelKey: 'layout.aside.menu.mv', icon: 'mdi--video' },
      { to: '/charts', labelKey: 'layout.aside.menu.charts', icon: 'mdi--chart-line' },
      { to: '/artists', labelKey: 'layout.aside.menu.artists', icon: 'mdi--account-music' },
      { to: '/new-albums', labelKey: 'layout.aside.menu.newAlbums', icon: 'mdi--album' },
      { to: '/search', labelKey: 'layout.aside.menu.search', icon: 'ic--round-search' },
    ],
  },
  {
    titleKey: 'layout.aside.myMusic',
    items: [
      { to: '/my-music', labelKey: 'layout.aside.menu.recent', icon: 'mdi--music-box-multiple' },
      {
        to: '/local-music',
        labelKey: 'layout.aside.menu.localMusic',
        icon: 'mdi--folder-music-outline',
      },
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

// 活动指示器相关
const indicatorRef = ref<HTMLElement | null>(null)
const navContainerRef = ref<HTMLElement | null>(null)

// 更新指示器位置
const updateIndicator = () => {
  if (!indicatorRef.value || !navContainerRef.value) return

  const activeLink = navContainerRef.value.querySelector('.nav-link-active') as HTMLElement
  if (!activeLink) {
    // 隐藏指示器
    gsap.to(indicatorRef.value, {
      opacity: 0,
      duration: 0.2,
    })
    return
  }

  const containerRect = navContainerRef.value.getBoundingClientRect()
  const linkRect = activeLink.getBoundingClientRect()

  gsap.to(indicatorRef.value, {
    y: linkRect.top - containerRect.top,
    height: linkRect.height,
    opacity: 1,
    duration: 0.3,
    ease: 'power3.out',
  })
}

// 监听路由变化
watch(
  () => route.path,
  () => {
    nextTick(() => {
      updateIndicator()
    })
  },
  { immediate: true }
)

// 组件挂载后初始化
onMounted(() => {
  nextTick(() => {
    updateIndicator()
  })
})

// 检查是否是当前路由
const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>
<template>
  <aside class="hidden w-64 shrink-0 p-4 py-0 lg:block">
    <div class="glass-card relative h-full p-4">
      <!-- 滑动指示器 -->
      <div
        ref="indicatorRef"
        class="nav-indicator pointer-events-none absolute right-2 left-2 rounded-lg bg-white/10 opacity-0"
        style="height: 40px; z-index: 0"
      ></div>

      <div ref="navContainerRef">
        <div v-for="sec in sections" :key="sec.titleKey" class="mb-6">
          <h3 class="text-primary mb-3 text-xs font-semibold tracking-wide uppercase">
            {{ $t(sec.titleKey) }}
          </h3>
          <nav class="relative space-y-1">
            <router-link
              v-for="item in sec.items"
              :key="item.to"
              :to="item.to"
              class="nav-link text-primary/70 hover:text-primary relative z-10 flex items-center space-x-3 rounded-lg p-2 transition-all duration-200"
              :class="{
                'nav-link-active text-primary font-medium': isActive(item.to),
                'hover:bg-white/5': !isActive(item.to),
              }"
            >
              <span
                class="h-5 w-5 transition-transform duration-200"
                :class="[`icon-[${item.icon}]`, { 'scale-110': isActive(item.to) }]"
              ></span>
              <span>{{ $t(item.labelKey) }}</span>
            </router-link>
            <div class="hidden">
              <span class="icon-[mdi--chevron-right]"></span>
            </div>
          </nav>
        </div>
      </div>

      <div class="mt-6" v-if="userStore.isLoggedIn">
        <h4 class="text-primary/60 mb-3 text-sm font-medium">
          {{ $t('layout.aside.playlists.created') }}
        </h4>
        <div class="space-y-2">
          <div
            v-for="playlist in userPlaylists"
            :key="playlist.id"
            class="group flex cursor-pointer items-center space-x-3 rounded-lg p-2 transition-all duration-200 hover:bg-white/10"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-pink-400 to-purple-500 text-xs transition-transform duration-200 group-hover:scale-105"
            >
              {{ playlist.name.charAt(0) }}
            </div>
            <span
              class="text-primary/80 group-hover:text-primary truncate text-sm transition-colors"
              >{{ playlist.name }}</span
            >
          </div>
        </div>
      </div>
      <div class="hidden">
        <span class="icon-[mdi--home] h-5 w-5"></span>
        <span class="icon-[mdi--video] h-5 w-5"></span>
        <span class="icon-[mdi--chart-line] h-5 w-5"></span>
        <span class="icon-[ic--round-search] h-5 w-5"></span>
        <span class="icon-[mdi--music-box-multiple] h-5 w-5"></span>
        <span class="icon-[mdi--heart-outline] h-5 w-5"></span>
        <span class="icon-[mdi--cog] h-5 w-5"></span>
        <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
        <span class="icon-[mdi--account-music] h-5 w-5"></span>
        <span class="icon-[mdi--album] h-5 w-5"></span>
        <span class="icon-[mdi--folder-music-outline] h-5 w-5"></span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* 导航指示器过渡 */
.nav-indicator {
  transition: opacity 0.2s ease;
}

/* 导航链接悬停效果 */
.nav-link {
  position: relative;
}

.nav-link::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 0.5rem;
  background: transparent;
  transition: background 0.2s ease;
}

.nav-link:hover::before {
  background: rgba(255, 255, 255, 0.05);
}

.nav-link-active::before {
  background: transparent;
}
</style>
