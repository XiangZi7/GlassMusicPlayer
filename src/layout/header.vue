<script setup lang="ts">
// 头部导航：集成登录弹窗与用户信息展示
import LoginDialog from '@/components/Auth/LoginDialog.vue'
import { useUserStore } from '@/stores/modules/user'
const navItems = [
  { to: '/', label: '首页', accent: true },
  { to: '/discover', label: '发现音乐' },
  { to: '/my-music', label: '我的音乐' },
]

const router = useRouter()
const state = reactive({
  searchQuery: '',
  showLogin: false,
})
const { searchQuery, showLogin } = toRefs(state)
const userStore = useUserStore()
const handleSearchEnter = () => {
  const q = state.searchQuery.trim()
  if (!q) return
  router.push({ path: '/search', query: { q } })
}
</script>
<template>
  <header class="glass-nav m-4 flex items-center justify-between p-4">
    <!-- 左侧菜单栏 -->
    <div class="flex items-center space-x-6">
      <!-- Logo -->
      <div class="flex items-center space-x-3">
        <img src="/logo.png" alt="logo" class="w-10" />
        <h1 class="text-xl font-bold text-white">Glass Music Player</h1>
      </div>

      <!-- 导航菜单 -->
      <nav class="hidden items-center space-x-2 md:flex">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          :class="[
            item.accent ? 'glass-button text-white' : 'text-white/70 hover:text-white',
            $route.path === item.to ? 'bg-white/10 text-white' : '',
          ]"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <!-- 外链菜单 -->
      <nav class="hidden items-center space-x-2 md:flex">
        <a
          href="https://github.com/XiangZi7/GlassMusicPlayer"
          target="_blank"
          rel="noopener noreferrer"
          class="glass-button rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          <span class="icon-[mdi--github] mr-2 h-4 w-4"></span>
          项目仓库
          <span class="icon-[mdi--open-in-new] ml-2 h-4 w-4"></span>
        </a>
        <a
          href="https://miraitv.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          class="glass-button rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          <span class="icon-[mdi--movie-open-play] mr-2 h-4 w-4"></span>
          影视网站
          <span class="icon-[mdi--open-in-new] ml-2 h-4 w-4"></span>
        </a>
      </nav>
    </div>

    <!-- 右侧功能区 -->
    <div class="flex items-center space-x-4">
      <!-- 搜索框 -->
      <div class="glass-card hidden min-w-0 items-center px-4 py-2 lg:flex">
        <span class="icon-[mdi--magnify] mr-2 h-4 w-4 text-white/60"></span>
        <input
          v-model="searchQuery"
          @keyup.enter="handleSearchEnter"
          type="text"
          placeholder="搜索音乐、歌手、专辑..."
          class="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/50 outline-none"
        />
      </div>

      <!-- 用户头像 / 登录按钮 -->
      <div v-if="userStore.isLoggedIn" class="flex items-center gap-2">
        <img :src="userStore.avatarUrl" alt="avatar" class="h-8 w-8 rounded-full object-cover" />
        <span class="text-sm text-white/90">{{ userStore.nickname }}</span>
      </div>
      <button
        v-else
        class="glass-button flex items-center gap-1 px-3 py-2 text-sm text-white"
        @click="showLogin = true"
      >
        <icon-ic:baseline-person-pin />
        登录
      </button>

      <!-- 移动端菜单按钮 -->
      <button class="glass-button p-2 md:hidden">
        <span class="icon-[mdi--menu] h-5 w-5 text-white"></span>
      </button>
    </div>
  </header>
  <LoginDialog v-if="showLogin" @close="showLogin = false" />
</template>
