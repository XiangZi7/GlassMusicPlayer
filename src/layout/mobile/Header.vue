<script setup lang="ts">
// 移动端头部：左侧 Logo/标题，右侧搜索与登录入口
const router = useRouter()

// 搜索入口：跳转到搜索页
const goSearch = () => router.push('/search')

// 登录入口：沿用 PC 逻辑，显示登录弹窗（若全局自动注册，可直接触发）
const state = reactive({ showLogin: false })
const { showLogin } = toRefs(state)
</script>

<template>
  <header class="flex items-center justify-between px-3 py-2">
    <div class="flex items-center gap-2">
      <img src="/logo.png" alt="logo" class="h-7 w-7 rounded" />
      <h1 class="text-base font-semibold">Glass Music</h1>
    </div>
    <div class="flex items-center gap-2">
      <button class="rounded-md p-2 hover:bg-white/10" title="搜索" @click="goSearch">
        <span class="icon-[mdi--magnify] h-5 w-5"></span>
      </button>
      <button class="rounded-md p-2 hover:bg-white/10" title="登录" @click="showLogin = true">
        <span class="icon-[mdi--account] h-5 w-5"></span>
      </button>
    </div>
  </header>
  <LoginDialog v-if="showLogin" @close="showLogin = false" />
</template>

