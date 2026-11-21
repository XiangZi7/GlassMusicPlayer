<script setup lang="ts">
import TrayMenu from '@/components/tray/TrayMenu.vue'
import { useTrayMenu } from '@/composables/useTrayMenu'

const {
  snapshot,
  glassStyle,
  motion,
  miniEnabled,
  busy,
  error,
  cycle,
  opened,
  run,
  dismiss,
  resize,
} = useTrayMenu()
</script>

<template>
  <!-- 仅在卡片外保留透明阴影画布，菜单不使用主播放器窗口外框。 -->
  <div
    class="native-tray"
    @contextmenu.prevent
  >
    <TrayMenu
      :snapshot="snapshot"
      :glass-style="glassStyle"
      :motion="motion"
      :mini-enabled="miniEnabled"
      :busy="busy"
      :error="error"
      :cycle="cycle"
      :opened="opened"
      @action="run"
      @toggle="run('toggle')"
      @dismiss="dismiss"
      @resize="resize"
    />
  </div>
</template>

<style scoped>
:global(html[data-tray-surface]),
:global(html[data-tray-surface] body),
:global(html[data-tray-surface] #app) {
  background: transparent !important;
}
.native-tray {
  width: 100%;
  height: 100%;
  padding: 32px;
  background: transparent;
}
</style>
