<script setup lang="ts">
// 半调点阵画布宿主：自身不算数据，绘制由播放器频谱服务按横幅 canvas 相同的绑定方式接管
// （catalog-audio 通过 [data-halftone-dots] 找到这块画布交给 createSpectrum）。
// 横幅点阵分工（v15）：静态点田是从原图逐点提取的图层（pop-hero-dots.webp，在横幅组件
// 里以 img 呈现），这块画布只在真实 AnalyserNode 数据（live 模式）时接管画动态点，
// 稳态非 live 时保持全透明；两呈现之间由横幅组件按画布的 data-spectrum-mode 做约
// 300ms 交叉淡化，画布内部另有约 300ms 的参数混合（频谱服务的 dotsBlend）。
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
