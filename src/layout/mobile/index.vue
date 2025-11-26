<script setup lang="ts">
// 移动端布局：重新排版为纯色背景 + 顶部简洁导航 + 底部标签栏
// 不复用 PC 的 Aside/Footer，采用移动端专属组件
import MobileHeader from './Header.vue'
import MobileTabBar from './TabBar.vue'
import PlayerDrawerMobile from '@/components/Mobile/PlayerDrawerMobile.vue'

// 播放器抽屉：沿用全局组件以便在移动端也能开启
const state = reactive({ isDrawerOpen: false })
const { isDrawerOpen } = toRefs(state)
const openPlayerDrawer = () => {
  state.isDrawerOpen = true
}
</script>

<template>
  <!-- 纯色背景容器：移动端更简洁、更聚焦内容 -->
  <div class="text-primary flex h-dvh w-full flex-col">
    <!-- 顶部导航（含搜索/登录入口） -->
    <MobileHeader />

    <!-- 内容区域：页面组件渲染 -->
    <main
      class="flex flex-1 flex-col pt-3"
      style="
        padding-bottom: calc(
          var(--mobile-tabbar-h, 56px) + var(--mobile-miniplayer-h, 0px) +
            env(safe-area-inset-bottom)
        );
      "
    >
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
      <PlayerDrawerMobile v-model="isDrawerOpen" />
    </main>

    <!-- 底部标签栏：主要导航入口，适配拇指操作 -->
    <MobileTabBar @show-player="openPlayerDrawer" />
  </div>
</template>
