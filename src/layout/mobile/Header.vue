<script setup lang="ts">
// 移动端头部：左侧 Logo/标题，右侧搜索与登录入口
const router = useRouter()
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

// 搜索入口：跳转到搜索页
const goSearch = () => router.push('/search')

// 登录入口：沿用 PC 逻辑，显示登录弹窗（若全局自动注册，可直接触发）
const state = reactive({ showLogin: false })
const { showLogin } = toRefs(state)
</script>

<template>
  <header class="glass-nav flex items-center justify-between px-3 py-2">
    <div class="flex items-center gap-2">
      <router-link to="/" class="flex items-center gap-2">
        <img src="/logo.svg" alt="logo" class="w-9 rounded" />
        <h1 class="text-primary text-base font-semibold">Glass Music Player</h1>
      </router-link>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="hover:bg-hover-glass rounded-md p-2"
        :title="t('common.search.label')"
        @click="goSearch"
      >
        <span class="icon-[mdi--magnify] h-5 w-5"></span>
      </button>
      <button
        class="hover:bg-hover-glass rounded-md p-2"
        :title="t('auth.login')"
        @click="showLogin = true"
      >
        <span class="icon-[mdi--account] h-5 w-5"></span>
      </button>
    </div>
  </header>
  <LoginDialog v-if="showLogin" @close="showLogin = false" />
</template>
