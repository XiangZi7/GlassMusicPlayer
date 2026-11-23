<script setup lang="ts">
import { toRefs, watch } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { useRouter } from 'vue-router'
import { getPublicUserPlaylists, type MusicPlatform } from '@/api'
import { usePlayer } from '@/composables/usePlayer'
import { openSettingsWindow } from '@/services/desktop'
import { publicAvatar } from '@/services/public-avatar'
import { usePlayerStore } from '@/stores/player'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlayerSearchBox from '@/components/player/PlayerSearchBox.vue'
import AccountMenu from '@/components/player/AccountMenu.vue'
import LocalWeather from '@/components/player/LocalWeather.vue'
import WindowControls from '@/components/ui/WindowControls.vue'

const { state } = usePlayer()
const { settings, linkedProfiles } = toRefs(state)
const router = useRouter()
const { setLinkedProfile } = usePlayerStore()

// 旧公开关联缺少头像时，按原 UID 补齐一次；取消关联或切换账号后丢弃旧响应。
watch(
  () => state.linkedProfiles.netease?.userId,
  async (userId, _, onCleanup) => {
    if (!userId || publicAvatar(state.linkedProfiles.netease?.avatarUrl)) return
    const request = new AbortController()
    onCleanup(() => request.abort())
    try {
      const profile = await getPublicUserPlaylists(
        'netease',
        userId,
        1,
        1,
        request.signal
      )
      const current = state.linkedProfiles.netease
      const avatarUrl = publicAvatar(profile.avatarUrl)
      if (
        !request.signal.aborted &&
        profile.platform === 'netease' &&
        profile.userId === userId &&
        current?.userId === userId &&
        !publicAvatar(current.avatarUrl) &&
        avatarUrl
      )
        setLinkedProfile('netease', { ...current, avatarUrl })
    } catch {
      // 头像补齐失败时保留关联和已有的中性头像。
    }
  },
  { immediate: true }
)

function connectPlatform(platform: MusicPlatform): void {
  void router.push({
    path: '/connect',
    query: { platform, account: String(Date.now()) },
  })
}
function openSettings(): void {
  if (isTauri()) void openSettingsWindow()
  else void router.push('/settings')
}
</script>

<template>
  <!-- 搜索/天气/账号/设置属于标题栏；桌面小窗入口统一由系统托盘提供。 -->
  <div
    class="win-chrome windows-titlebar relative z-[5] flex h-[42px] flex-none items-center gap-[14px] p-[0_16px]"
    data-tauri-drag-region
  >
    <div class="chrome-nav flex flex-none items-center gap-[4px]">
      <BaseButton
        data-nav-back
        aria-label="后退"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14.5 5.5L8 12l6.5 6.5" /></svg
      ></BaseButton>
      <BaseButton
        data-nav-fwd
        aria-label="前进"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9.5 5.5L16 12l-6.5 6.5" /></svg
      ></BaseButton>
    </div>
    <span
      aria-hidden="true"
      class="h-3.5 w-px shrink-0 bg-white/10"
    ></span>
    <div
      class="chrome-title flex-1 text-center text-[12.5px] font-bold tracking-[.02em] opacity-[.85]"
      data-chrome-title
      data-tauri-drag-region
    >
      首页
    </div>
    <PlayerSearchBox variant="titlebar" />
    <LocalWeather :enabled="settings.weather" :motion="settings.motion" />
    <div class="titlebar-account-actions flex flex-none items-center gap-1">
      <BaseButton
        type="button"
        class="titlebar-settings grid size-9 place-items-center rounded-[10px] bg-transparent text-white/65 transition-colors duration-150 hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/75"
        aria-label="打开设置"
        title="设置"
        data-titlebar-settings
        @click.stop="openSettings"
      >
        <svg
          class="size-[16px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="3"
          />
          <path
            d="m9.3 3-.6 2a7.8 7.8 0 0 0-1.8 1L4.8 5.5 2.7 9.2l1.5 1.5a8.2 8.2 0 0 0 0 2.6l-1.5 1.5 2.1 3.7 2.1-.5a7.8 7.8 0 0 0 1.8 1l.6 2h5.4l.6-2a7.8 7.8 0 0 0 1.8-1l2.1.5 2.1-3.7-1.5-1.5a8.2 8.2 0 0 0 0-2.6l1.5-1.5-2.1-3.7-2.1.5a7.8 7.8 0 0 0-1.8-1l-.6-2z"
          />
        </svg>
      </BaseButton>
      <AccountMenu
        :profiles="linkedProfiles"
        @platform="connectPlatform"
      />
    </div>
    <WindowControls />
  </div>
</template>

<style scoped>
.windows-titlebar {
  height: 48px;
  gap: 12px;
  padding: 0 0 0 16px;
}
.windows-titlebar .chrome-nav button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}
.windows-titlebar .chrome-title {
  position: static;
  flex: 1 1 0;
  min-width: 0;
  max-width: none;
  transform: none;
  text-align: left;
  font-size: 13px;
  line-height: 20px;
  letter-spacing: 0;
  opacity: 0.7;
}
.windows-titlebar .chrome-search {
  width: clamp(220px, 23vw, 340px);
  margin-left: 0;
  font-size: 13px;
}
.windows-titlebar .chrome-search :deep(input) {
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0;
}
.windows-titlebar .chrome-search :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>
