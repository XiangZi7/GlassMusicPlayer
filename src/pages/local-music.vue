<script setup lang="ts">
import LocalMusicSettings from '@/components/Settings/LocalMusicSettings.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="h-full w-full overflow-auto p-4">
    <!-- 头部卡片 -->
    <div class="relative mb-6 overflow-hidden">
      <!-- 背景装饰 -->
      <div class="absolute inset-0 overflow-hidden rounded-3xl">
        <div class="h-full w-full scale-110 bg-linear-to-br from-green-500/20 to-emerald-600/20 blur-3xl"></div>
      </div>

      <!-- 内容 -->
      <div class="relative z-10 overflow-hidden rounded-3xl">
        <div class="glass-container p-6 md:p-8">
          <div class="flex items-center gap-4">
            <div
              class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-green-500 to-emerald-600 shadow-lg"
            >
              <span class="icon-[mdi--folder-music-outline] h-7 w-7 text-white" />
            </div>
            <div>
              <h1 class="text-primary text-2xl font-bold md:text-3xl">
                {{ t('components.settings.localMusic') }}
              </h1>
              <p class="text-primary/60 mt-1 text-sm">{{ t('components.settings.localMusicDesc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 本地音乐设置组件 -->
    <LocalMusicSettings />
  </div>
</template>
