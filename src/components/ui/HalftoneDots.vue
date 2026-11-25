<script setup lang="ts">
// 半调点阵画布宿主：自身不算数据，绘制由播放器频谱服务按横幅 canvas 相同的绑定方式接管
// （catalog-audio 通过 [data-halftone-dots] 找到这块画布交给 createSpectrum）。
// 只有真实 AnalyserNode 数据（live 模式）会让点阵动起来；暂停、未播放或示例曲目时服务只画一帧静态基础剖面。
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
