<script setup lang="ts">
import LocalMusicSettings from '@/components/Settings/LocalMusicSettings.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="h-full overflow-auto p-6 w-full">
    <div class="mb-8">
      <h1 class="text-primary text-2xl font-bold">{{ t('components.settings.localMusic') }}</h1>
      <p class="text-primary/50 mt-1 text-sm">{{ t('components.settings.localMusicDesc') }}</p>
    </div>

    <LocalMusicSettings />
  </div>
</template>
