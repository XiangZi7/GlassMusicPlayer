<script setup lang="ts">
import Header from './header.vue'
import Aside from './aside.vue'
import Footer from './footer.vue'
import Particle from './particle.vue'
</script>

<template>
  <div class="anime-gradient relative flex h-full w-full overflow-hidden">
    <Particle />
    <!-- 主容器 -->
    <div class="w-full flex flex-col py-6 px-36">
      <div class="glass-container flex flex-1 flex-col overflow-hidden">
        <!-- 头部区域 -->
        <Header />
        <!-- 主内容区域 -->
        <main class="flex flex-1 overflow-x-hidden">
          <!-- 左侧边栏 -->
          <Aside />
          <!-- 右侧主内容 -->
          <router-view />
        </main>
        <Footer />
      </div>
    </div>
  </div>
</template>
