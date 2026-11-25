<script setup lang="ts">
// 半调点阵画布宿主：自身不算数据，绘制由播放器频谱服务按横幅 canvas 相同的绑定方式接管
// （catalog-audio 通过 [data-halftone-dots] 找到这块画布交给 createSpectrum）。
// 横幅插画带烤入点田，静态长相由底图承担，这一层只在真实 AnalyserNode 数据（live 模式）
// 时按点田剖面（halftone-profile）叠加调制点；暂停、静态或示例曲目时画布保持全透明。
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
