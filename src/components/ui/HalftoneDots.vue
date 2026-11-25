<script setup lang="ts">
// 半调点阵画布宿主：自身不算数据，绘制由播放器频谱服务按横幅 canvas 相同的绑定方式接管
// （catalog-audio 通过 [data-halftone-dots] 找到这块画布交给 createSpectrum）。
// 这是横幅三层架构的中间层（背景渐变层与人物层之间）：点田不再烤进底图，未播放时按
// 点田剖面（halftone-profile）绘制彩色静态场，真实 AnalyserNode 数据（live 模式）时
// 同一片田随实频起伏，两态之间由频谱服务做约 300ms 的混合过渡。
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
