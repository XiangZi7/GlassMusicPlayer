<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'

// 横幅点阵 three.js 版参数：点由覆盖场在 GPU 上重新生成（不采样带点原图，避免摩尔纹），
// 点径走面积律；音频只调制覆盖率（≤+30%）与少量 alpha，
// 平滑/淡入淡出全部沿用 spectrum.ts 已验证的 CPU 侧口径（attack 90ms / release 350ms、
// alpha 限幅、整层 1000ms 包络），本组件只读它发布在同位点画布 dataset 上的每列 alpha。
// 细版口径（用户嫌粗版略粗后收细）：原生 pitch 由 33 降到 26.5（横幅宽 872 时显示约
// 8.45 CSS px），点径上限由 0.56·pitch 降到 0.44·pitch，再给覆盖场 0.8 增益让密区
// 不轻易触顶、点间留出间隙；覆盖场纹理的模糊尺度已按新点距同比缩放重新生成。
const DOTS_COLS = 28
const DOTS_MAX_ALPHA = 0.35
const NATIVE_PITCH = 26.5
const FIELD_GAIN = 0.8
const RADIUS_CAP = 0.44
const COVERAGE_GAIN = 0.3
const DOT_INK = new Vector3(15 / 255, 148 / 255, 235 / 255)

const root = ref<HTMLElement>()
const glCanvas = ref<HTMLCanvasElement>()
const state = reactive({
  // WebGL 初始化失败标记：失败时整层保持隐藏，横幅回落到同位点版/单图版。
  failed: false,
})

// 点阵顶点着色器：全屏四边形，只把归一化坐标交给片元着色器。
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// 点阵片元着色器：参考 three 官方 HalftoneShader 的格点结构——在图像空间的规则格点上，
// 以格心采样覆盖场（先乘细版增益 0.8）、按面积律 r=(pitch/2)·√coverage 定点径并以
// 0.44·pitch 封顶，单墨青蓝着色；音频能量按列调制覆盖率（半径增幅 ≤约 14%）与
// alpha，不让点忽大忽小。
const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uCoverage;
  uniform float uLevels[${DOTS_COLS}];
  uniform vec2 uSize;
  uniform vec2 uImageSize;
  uniform float uScale;
  uniform vec2 uOffset;
  uniform vec3 uInk;
  void main() {
    vec2 cssPos = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
    vec2 imgPx = (cssPos - uOffset) / uScale;
    if (imgPx.x < 0.0 || imgPx.y < 0.0 || imgPx.x > uImageSize.x || imgPx.y > uImageSize.y) {
      gl_FragColor = vec4(0.0);
      return;
    }
    float pitch = ${NATIVE_PITCH.toFixed(1)};
    vec2 cell = floor(imgPx / pitch);
    vec2 center = (cell + 0.5) * pitch;
    vec2 covUv = vec2(center.x / uImageSize.x, 1.0 - center.y / uImageSize.y);
    float coverage = texture2D(uCoverage, covUv).r;
    if (coverage < 0.004) {
      gl_FragColor = vec4(0.0);
      return;
    }
    int col = int(clamp(cssPos.x / max(uSize.x, 1.0), 0.0, 0.999) * ${DOTS_COLS.toFixed(1)});
    float energy = uLevels[col];
    float covMod = clamp(coverage * ${FIELD_GAIN.toFixed(2)} * (1.0 + ${COVERAGE_GAIN.toFixed(2)} * energy), 0.0, 1.0);
    float rImg = min(0.5 * pitch * sqrt(covMod), pitch * ${RADIUS_CAP.toFixed(2)});
    float dist = length(imgPx - center);
    // 点缘用 1.5 个图像像素宽的 smoothstep 做抗锯齿，避免点边在缩放下发毛。
    float mask = 1.0 - smoothstep(rImg - 1.5, rImg + 1.5, dist);
    float alpha = mask * (0.88 + 0.12 * energy) * 0.97;
    gl_FragColor = vec4(uInk, alpha);
  }
`

let renderer: WebGLRenderer | undefined
let scene: Scene | undefined
let camera: OrthographicCamera | undefined
let material: ShaderMaterial | undefined
let geometry: PlaneGeometry | undefined
let frame = 0
let observer: ResizeObserver | undefined
let sourceCanvas: HTMLCanvasElement | null = null
const levels = new Float32Array(DOTS_COLS)

// 读取同位点画布 dataset 上 spectrum.ts 发布的每列 alpha，并还原为平滑后的能量：
// alpha = 包络 × 0.35 × 能量，能量只在包络足够大时才可信，其余时刻归零防噪声放大。
function readLevels(): { fade: number; live: boolean } {
  if (!sourceCanvas || !sourceCanvas.isConnected) {
    sourceCanvas =
      root.value
        ?.closest('[data-banner-bg]')
        ?.querySelector<HTMLCanvasElement>('[data-halftone-dots]') ?? null
  }
  if (!sourceCanvas) return { fade: 0, live: false }
  const fade = Number(sourceCanvas.dataset.dotsFade ?? 0) || 0
  const live = sourceCanvas.dataset.spectrumMode === 'live'
  const parts = (sourceCanvas.dataset.dotsAlpha ?? '').split(',')
  for (let col = 0; col < DOTS_COLS; col++) {
    const alpha = Number(parts[col] ?? 0) || 0
    levels[col] =
      fade > 0.05 ? Math.min(1, Math.max(0, alpha / DOTS_MAX_ALPHA)) : 0
  }
  return { fade, live }
}

// 按横幅 cover 裁切口径刷新 shader 的图像空间参数：与底图 object-position 同口径
// （展开 62% 36%，窄窗 ≤700px 时 88% 36%），保证点场与三层素材严丝合缝。
function syncGeometry(): void {
  if (!renderer || !material || !glCanvas.value) return
  const width = glCanvas.value.clientWidth
  const height = glCanvas.value.clientHeight
  if (!width || !height) return
  renderer.setSize(width, height, false)
  const scale = Math.max(width / 2736, height / 912)
  const posX = width <= 700 ? 0.88 : 0.62
  const posY = 0.36
  material.uniforms.uSize!.value.set(width, height)
  material.uniforms.uScale!.value = scale
  material.uniforms.uOffset!.value.set(
    (width - 2736 * scale) * posX,
    (height - 912 * scale) * posY
  )
  if (glCanvas.value) {
    glCanvas.value.dataset.threePitch = (NATIVE_PITCH * scale).toFixed(2)
    // 细版点径上限的显示口径（CSS px），供 QA 与粗版触顶值同口径对比。
    glCanvas.value.dataset.threeRmaxCss = (RADIUS_CAP * NATIVE_PITCH * scale).toFixed(2)
  }
}

// three.js 渲染主循环：包络为零时整层隐藏且跳过绘制（静态横幅就是单图版原样）；
// 包络大于零时把整层透明度设为包络值（与同位点版同一条 1 秒淡入淡出口径），
// 再把每列能量写入 uniform 数组绘制一帧，并发布帧耗时供 QA 粗测性能。
function tick(): void {
  frame = requestAnimationFrame(tick)
  if (!renderer || !scene || !camera || !material || !root.value || !glCanvas.value)
    return
  const { fade } = readLevels()
  root.value.style.opacity = fade > 0.002 ? String(fade) : '0'
  glCanvas.value.dataset.threeFade = fade.toFixed(3)
  if (fade <= 0.002) return
  const started = performance.now()
  const uniform = material.uniforms.uLevels!.value as Float32Array
  uniform.set(levels)
  let maxEnergy = 0
  for (const value of levels) maxEnergy = Math.max(maxEnergy, value)
  glCanvas.value.dataset.threeModMax = (
    Math.sqrt(1 + COVERAGE_GAIN * maxEnergy) - 1
  ).toFixed(3)
  glCanvas.value.dataset.threeLevels = Array.from(levels, value =>
    value.toFixed(3)
  ).join(',')
  renderer.render(scene, camera)
  const elapsed = performance.now() - started
  const previous = Number(glCanvas.value.dataset.threeFrameMs ?? elapsed)
  glCanvas.value.dataset.threeFrameMs = (previous * 0.9 + elapsed * 0.1).toFixed(2)
}

// 初始化 three.js 场景：只引入渲染器/正交相机/平面/着色器材质四件，覆盖场纹理来自
// 离线生成的 pop-hero-coverage.webp（提取点层 alpha 经格尺度模糊并按 4/π 标定，
// 模糊尺度已按细版新点距同比缩放），加载完成前整层保持隐藏，不让无点版本闪现。
function initThree(): void {
  if (!glCanvas.value) return
  try {
    renderer = new WebGLRenderer({
      canvas: glCanvas.value,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    })
  } catch {
    state.failed = true
    if (glCanvas.value) glCanvas.value.dataset.threeError = 'webgl-unavailable'
    return
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.setClearColor(0x000000, 0)
  scene = new Scene()
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  geometry = new PlaneGeometry(2, 2)
  material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCoverage: { value: null },
      uLevels: { value: levels },
      uSize: { value: new Vector2(1, 1) },
      uImageSize: { value: new Vector2(2736, 912) },
      uScale: { value: 1 },
      uOffset: { value: new Vector2(0, 0) },
      uInk: { value: DOT_INK },
    },
  })
  const mesh = new Mesh(geometry, material)
  scene.add(mesh)
  new TextureLoader().load('/images/pop-hero-coverage.webp', texture => {
    if (material) material.uniforms.uCoverage!.value = texture
  })
  syncGeometry()
  observer = new ResizeObserver(syncGeometry)
  if (glCanvas.value.parentElement) observer.observe(glCanvas.value.parentElement)
  frame = requestAnimationFrame(tick)
}

onMounted(initThree)

// 组件卸载时释放 WebGL 资源与帧循环，避免路由切换后残留上下文。
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  geometry?.dispose()
  material?.dispose()
  renderer?.dispose()
})
</script>
<template>
  <div
    ref="root"
    class="halftone-three"
    data-halftone-three
    :data-three-failed="state.failed || undefined"
    aria-hidden="true"
  >
    <img
      class="halftone-three-layer"
      src="/images/pop-hero-bg.webp"
      width="2736"
      height="912"
      alt=""
      decoding="async"
    />
    <canvas
      ref="glCanvas"
      class="halftone-three-gl"
      data-halftone-three-gl
    />
    <img
      class="halftone-three-layer"
      src="/images/pop-hero-chara.webp"
      width="2736"
      height="912"
      alt=""
      decoding="async"
    />
  </div>
</template>
<style scoped>
/* 三层合成根层：铺满横幅背景，初始全透明（未播静态不呈现），透明度由渲染循环按
   spectrum 的淡入淡出包络逐帧写入；自身不接指针。 */
.halftone-three {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}
/* 干净背景层与人物层共用底图的 cover 几何：同尺寸、同裁切、同 object-position，
   与单图版严丝合缝，点层夹在两者之间。 */
.halftone-three-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 62% 36%;
}
@container (max-width: 700px) {
  .halftone-three-layer {
    object-position: 88% 36%;
  }
}
/* WebGL 点层画布夹在背景层与人物层之间，尺寸与根层一致。 */
.halftone-three-gl {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
/* 折叠迷你条时整层隐藏，沿用点阵不在 compact 态出现的旧纪律。 */
.main.compact .halftone-three {
  display: none;
}
</style>
