<script setup lang="ts">
import LoginDialog from '@/components/Auth/LoginDialog.vue'
import { useUserStore } from '@/stores/modules/user'
import { useGlobalStore } from '@/stores/modules/global'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
const navItems = [{ to: '/', labelKey: 'layout.nav.home', accent: true }]

const router = useRouter()
const { t } = useI18n()
// 头部本地状态：搜索输入值、登录弹窗开关、历史下拉开关
const state = reactive({
  searchQuery: '',
  showLogin: false,
  historyOpen: false,
})
// 解构为响应式引用，便于模板绑定
const { searchQuery, showLogin, historyOpen } = toRefs(state)
// 用户与全局 store，引入全局搜索历史
const userStore = useUserStore()
const globalStore = useGlobalStore()
const { searchHistory, theme } = storeToRefs(globalStore)
const themeIcon = computed(() => {
  if (theme.value === 'system') return 'icon-[mdi--theme-light-dark]'
  if (theme.value === 'dark') return 'icon-[mdi--weather-night]'
  return 'icon-[mdi--weather-sunny]'
})
const cycleTheme = () => {
  const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const idx = order.indexOf(theme.value)
  globalStore.setTheme(order[(idx + 1) % 3])
}
// 回车搜索：写入搜索历史，关闭下拉，并跳转到搜索页
const handleSearchEnter = () => {
  const q = state.searchQuery.trim()
  if (!q) return
  globalStore.addSearchHistory(q)
  state.historyOpen = false
  router.push({ path: '/search', query: { q } })
}
// 聚焦时如果有历史则打开下拉
const openHistoryIfAny = () => {
  if (searchHistory.value.length > 0) {
    updateDropdownPos()
    state.historyOpen = true
  }
}
// 选择历史项后直接填充并执行搜索
const selectHistory = (q: string) => {
  state.searchQuery = q
  handleSearchEnter()
}
const clearSearch = () => {
  state.searchQuery = ''
  state.historyOpen = false
}
// 搜索框容器用于点击外部关闭下拉
const rootRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' })
const updateDropdownPos = () => {
  const el = rootRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  dropdownStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}
const onDocClick = (e: Event) => {
  const el = rootRef.value
  const dd = dropdownRef.value
  if (!el) return
  const target = e.target as Node
  if (el.contains(target)) return
  if (dd && dd.contains(target)) return
  state.historyOpen = false
}
// 监听与清理：文档点击关闭下拉
onMounted(() => {
  document.addEventListener('pointerdown', onDocClick)
})
onUnmounted(() => document.removeEventListener('pointerdown', onDocClick))
</script>
<template>
  <header class="glass-nav m-4 flex items-center justify-between p-4">
    <!-- 左侧菜单栏 -->
    <div class="flex items-center space-x-6">
      <!-- Logo -->
      <div class="flex items-center space-x-3">
        <img src="/logo.png" alt="logo" class="w-10" />
        <h1 class="text-primary text-xl font-bold">Glass Music Player</h1>
      </div>

      <!-- 导航菜单 -->
      <nav class="hidden items-center space-x-2 md:flex">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          :class="[
            item.accent ? 'glass-button text-primary' : 'text-primary/70 hover:text-primary',
            $route.path === item.to ? 'text-primary bg-white/10' : '',
          ]"
        >
          {{ t(item.labelKey) }}
        </RouterLink>
        <button
          class="text-primary flex cursor-pointer items-center p-2"
          aria-label="back"
          @click="router.back()"
        >
          <span class="icon-[mdi--chevron-left] h-5 w-5"></span>
        </button>
        <button
          class="text-primary flex cursor-pointer items-center p-2"
          aria-label="forward"
          @click="router.forward()"
        >
          <span class="icon-[mdi--chevron-right] h-5 w-5"></span>
        </button>
      </nav>
      <!-- 外链菜单 -->
      <nav class="hidden items-center space-x-2 md:flex">
        <a
          href="https://github.com/XiangZi7/GlassMusicPlayer"
          target="_blank"
          rel="noopener noreferrer"
          class="glass-button text-primary rounded-lg px-4 py-2 text-sm font-medium"
        >
          <span class="icon-[mdi--github] mr-2 h-4 w-4"></span>
          {{ t('layout.nav.repo') }}
          <span class="icon-[mdi--open-in-new] ml-2 h-4 w-4"></span>
        </a>
        <a
          href="https://miraitv.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          class="glass-button text-primary rounded-lg px-4 py-2 text-sm font-medium"
        >
          <span class="icon-[mdi--movie-open-play] mr-2 h-4 w-4"></span>
          {{ t('layout.nav.movies') }}
          <span class="icon-[mdi--open-in-new] ml-2 h-4 w-4"></span>
        </a>
      </nav>
    </div>

    <!-- 右侧功能区 -->
    <div class="flex items-center space-x-4">
      <!-- 搜索框 -->
      <div ref="rootRef" class="glass-card relative hidden min-w-0 items-center px-4 py-2 lg:flex">
        <span class="icon-[mdi--magnify] text-primary/60 mr-2 h-4 w-4"></span>
        <input
          v-model="searchQuery"
          @keyup.enter="handleSearchEnter"
          @focus="openHistoryIfAny"
          type="text"
          :placeholder="t('common.search.placeholder')"
          class="text-primary placeholder-primary/50 min-w-0 flex-1 bg-transparent pr-10 text-sm outline-none"
        />
        <button
          class="absolute top-1/2 right-3 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition-opacity duration-150"
          :class="searchQuery ? 'opacity-80 hover:opacity-100' : 'pointer-events-none opacity-0'"
          :title="t('common.clear')"
          @click="clearSearch"
        >
          <span class="icon-[mdi--close] text-primary/70 h-4 w-4"></span>
        </button>
      </div>
      <Teleport to="body">
        <div
          v-if="historyOpen && searchHistory.length"
          ref="dropdownRef"
          class="glass-dropdown fixed z-99999 overflow-hidden rounded-2xl shadow-lg"
          :style="dropdownStyle"
        >
          <ul class="max-h-60 overflow-auto">
            <li
              v-for="opt in searchHistory"
              :key="opt"
              class="group relative flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-(--glass-dropdown-text) hover:bg-(--glass-hover-item-bg)"
              @mousedown.prevent="selectHistory(opt)"
            >
              <span class="truncate pr-8">{{ opt }}</span>
              <button
                class="absolute top-1/2 right-2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition-opacity duration-150 group-hover:opacity-80"
                :title="t('common.delete')"
                @mousedown.stop.prevent="globalStore.removeSearchHistory(opt)"
              >
                <span class="icon-[mdi--close] h-4 w-4 text-(--glass-dropdown-text)"></span>
              </button>
            </li>
          </ul>
        </div>
      </Teleport>

      <!-- 主题切换 -->
      <button
        class="glass-button text-primary flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg"
        :title="theme === 'system' ? t('components.settings.themeOptions.system') : theme === 'dark' ? t('components.settings.themeOptions.dark') : t('components.settings.themeOptions.light')"
        @click="cycleTheme"
      >
        <span :class="[themeIcon, 'h-5 w-5 transition-transform duration-300']"></span>
      </button>

      <!-- 用户头像 / 登录按钮 -->
      <div v-if="userStore.isLoggedIn" class="flex items-center gap-2">
        <img :src="userStore.avatarUrl" alt="avatar" class="h-8 w-8 rounded-full object-cover" />
        <span class="text-primary/90 text-sm">{{ userStore.nickname }}</span>
      </div>
      <button
        v-else
        class="glass-button text-primary flex items-center gap-1 px-3 py-2 text-sm"
        @click="showLogin = true"
      >
        <icon-ic:baseline-person-pin />
        {{ t('auth.login') }}
      </button>

      <!-- 移动端菜单按钮 -->
      <button class="glass-button p-2 md:hidden">
        <span class="icon-[mdi--menu] text-primary h-5 w-5"></span>
      </button>
    </div>
  </header>
  <LoginDialog v-if="showLogin" @close="showLogin = false" />
</template>
