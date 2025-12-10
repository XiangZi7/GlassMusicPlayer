<script setup lang="ts">
import LocalMusicSettings from '@/components/Settings/LocalMusicSettings.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="h-full flex-1 overflow-auto px-4 pb-8">
    <div class="mb-6 pt-2">
      <h1 class="text-primary text-xl font-bold">{{ t('components.settings.localMusic') }}</h1>
      <p class="text-primary/50 mt-1 text-xs">
        {{ t('components.settings.localMusicDesc') }}
      </p>
    </div>

    <LocalMusicSettings />
  </div>
</template>
