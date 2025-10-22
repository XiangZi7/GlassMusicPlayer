<template>
  <header class="glass-nav m-4 flex items-center justify-between p-4">
    <!-- 左侧菜单栏 -->
    <div class="flex items-center space-x-6">
      <!-- Logo -->
      <div class="flex items-center space-x-3">
        <div
          class="animate-pulse-glow flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-purple-600"
        >
          <span class="text-lg font-bold text-white">🎵</span>
        </div>
        <h1 class="text-xl font-bold text-white">AniMusic</h1>
      </div>

      <!-- 导航菜单 -->
      <nav class="hidden items-center space-x-1 md:flex">
        <button class="glass-button px-4 py-2 text-sm font-medium text-white">首页</button>
        <button
          class="px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          发现音乐
        </button>
        <button
          class="px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          我的音乐
        </button>
        <button
          class="px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          歌单
        </button>
      </nav>
    </div>

    <!-- 右侧功能区 -->
    <div class="flex items-center space-x-4">
      <!-- 搜索框 -->
      <div class="glass-card hidden min-w-0 items-center px-4 py-2 lg:flex">
        <span class="icon-[mdi--magnify] mr-2 h-4 w-4 text-white/60"></span>
        <input
          type="text"
          placeholder="搜索音乐、歌手、专辑..."
          class="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/50 outline-none"
        />
      </div>

      <!-- 用户头像 -->
      <div
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 transition-transform hover:scale-110"
      >
        <span class="text-xs font-bold text-white">U</span>
      </div>

      <!-- 移动端菜单按钮 -->
      <button class="glass-button p-2 md:hidden">
        <span class="icon-[mdi--menu] h-5 w-5 text-white"></span>
      </button>
    </div>
  </header>
</template>
