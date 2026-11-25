<script setup lang="ts">
// 半调点阵画布宿主：自身不算数据，绘制由播放器频谱服务按横幅 canvas 相同的绑定方式接管
// （catalog-audio 通过 [data-halftone-dots] 找到这块画布交给 createSpectrum）。
// 点的大小与颜色由原版插画的点田剖面决定（halftone-profile），画布点先映射回插画坐标再
// 采样；只有真实 AnalyserNode 数据（live 模式）会在剖面上调制，暂停或示例曲目时只画一帧静态剖面。
</script>
<template>
  <canvas class="halftone-dots" data-halftone-dots aria-hidden="true" />
</template>

<style scoped>
.halftone-dots {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
