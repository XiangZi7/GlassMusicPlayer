<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'

// 横幅点阵 three.js 版参数：点由覆盖场在 GPU 上重新生成（不采样带点原图，避免摩尔纹），
// 点径走面积律；平滑/淡入淡出沿用 spectrum.ts 已验证的 CPU 侧口径（整层 1000ms 包络），
// 本组件读它发布在同位点画布 dataset 上的每列 alpha（平滑后能量）与 dotsTarget（平滑前
// 的每列原始能量），再在组件内做峰值保持 + 对比扩展 + 全场呼吸三级整形后喂给 shader——
// 旧口径只拿平滑后能量做 ≤+30% 覆盖调制（点径增幅封顶 +14% 且密区被点径上限裁平），
// 真机上肉眼看不出动；新口径让峰值列的点径增幅达到 30–40% 量级并同步提亮，静止与
// 低能量时仍回到细版原样。
// 细版口径（用户嫌粗版略粗后收细）：原生 pitch 由 33 降到 26.5（横幅宽 872 时显示约
// 8.45 CSS px），点径基础上限 0.44·pitch；覆盖场增益由 0.8 降到 0.66，给峰值留出
// 不被上限裁平的 headroom（密区基础点径约 0.41·pitch，仍在细版口径内），峰值列的
// 点径上限随能量短暂放宽到 0.53·pitch、随能量回落立即收回，不整体变粗。
// 覆盖场纹理的模糊尺度已按新点距同比缩放重新生成。
const DOTS_COLS = 28
const DOTS_MAX_ALPHA = 0.35
const NATIVE_PITCH = 26.5
const FIELD_GAIN = 0.66
const RADIUS_CAP = 0.44
const RADIUS_CAP_PEAK = 0.09
const COVERAGE_GAIN = 0.95
const BREATH_GAIN = 0.18
// 峰值包络释放时间常数：快起慢落，峰后约半秒滑回当前能量地板。
const PEAK_RELEASE_MS = 420
// 对比扩展指数：把中低能量压下去、让峰从均值里跳出来。
const CONTRAST_EXP = 1.6
// 显示能量合成权重：平滑能量打底 + 整形后的峰值包络主导。
const BASE_MIX = 0.3
const PEAK_MIX = 0.9
// 全场呼吸包络时间常数：低频列（左侧 7 列）均值驱动，起 110ms / 落 420ms。
const BREATH_ATTACK_MS = 110
const BREATH_RELEASE_MS = 420
const BREATH_COLS = 7
// 横向渐变淡化（用户看对比图后要求）：点层 alpha 沿可见横幅横向坐标自左向右由
// GRAD_MIN 经 smoothstep 平滑升到 1、到 GRAD_END 处满格——左侧点慢慢化进背景，
// 中部点田向人物过渡的那一段不再有“点层边界”的硬过渡。只乘 alpha（不透明度），
// 不动点径与 coverage；峰值提亮与点径调制原样保留、与渐变相乘叠加（左侧峰值也被
// 渐变压低是预期行为，但点径涨落仍在，不会“左边死了”）。
const GRAD_MIN = 0.3
const GRAD_END = 0.6
const DOT_INK = new Vector3(15 / 255, 148 / 255, 235 / 255)

// 三层素材与裁切口径由横幅按当前人物传入（素材映射在 services/player/banner-art.ts），
// 缺省即原始人物那套，老调用方不传参时行为与参数化之前一致。
const props = withDefaults(
  defineProps<{
    // 干净背景层路径。
    bgSrc?: string
    // 人物层路径（带透明通道）。
    charaSrc?: string
    // 覆盖场纹理路径（半分辨率）。
    coverageSrc?: string
    // 素材原生宽（图像空间口径）。
    imageWidth?: number
    // 素材原生高。
    imageHeight?: number
    // 展开态 cover 裁切横向位置（0–1 分数）。
    posX?: number
    // 展开态 cover 裁切纵向位置。
    posY?: number
    // 窄窗（≤700px）裁切横向位置。
    posXNarrow?: number
  }>(),
  {
    bgSrc: '/images/pop-hero-bg.webp',
    charaSrc: '/images/pop-hero-chara.webp',
    coverageSrc: '/images/pop-hero-coverage.webp',
    imageWidth: 2736,
    imageHeight: 912,
    posX: 0.62,
    posY: 0.36,
    posXNarrow: 0.88,
  }
)

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
// 以格心采样覆盖场（先乘细版增益）、按面积律 r=(pitch/2)·√coverage 定点径；音频的
// 显示能量（已在 CPU 侧做峰值保持 + 对比扩展）按列把覆盖率放大至多约 ×1.95（点径
// 增幅 30–40% 量级），点径上限随能量在 0.44–0.53·pitch 间浮动（峰值瞬间短暂放宽、
// 回落即收回）；全场呼吸 uniform 再给覆盖率与 alpha 一个随低频涨落的慢 swell；
// 峰值列同步提亮 alpha 并把墨色向亮青蓝轻推，让峰“亮起来”而不只是变大；最后 alpha
// 再乘横向渐变因子（按可见区归一横坐标 vUv.x，与列索引同一口径，不受 cover 裁切的
// 图像空间偏移影响），左侧渐隐化入背景。
const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uCoverage;
  uniform float uLevels[${DOTS_COLS}];
  uniform float uBreath;
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
    float covMod = coverage * ${FIELD_GAIN.toFixed(2)} * (1.0 + ${COVERAGE_GAIN.toFixed(2)} * energy) * (1.0 + ${BREATH_GAIN.toFixed(2)} * uBreath);
    float rCap = pitch * (${RADIUS_CAP.toFixed(2)} + ${RADIUS_CAP_PEAK.toFixed(2)} * energy);
    float rImg = min(0.5 * pitch * sqrt(covMod), rCap);
    float dist = length(imgPx - center);
    // 点缘用 1.5 个图像像素宽的 smoothstep 做抗锯齿，避免点边在缩放下发毛。
    float mask = 1.0 - smoothstep(rImg - 1.5, rImg + 1.5, dist);
    // 横向渐变因子：左缘只剩 GRAD_MIN 的不透明度，沿可见区横坐标平滑升到 GRAD_END
    // 处满格；只作用于 alpha，不改点径与覆盖。
    float grad = mix(${GRAD_MIN.toFixed(2)}, 1.0, smoothstep(0.0, ${GRAD_END.toFixed(2)}, vUv.x));
    float alpha = mask * clamp((0.80 + 0.34 * energy) * (0.94 + 0.10 * uBreath), 0.0, 1.0) * 0.97 * grad;
    vec3 ink = mix(uInk, vec3(0.62, 0.92, 1.0), 0.38 * energy);
    gl_FragColor = vec4(ink, alpha);
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
// 每列原始能量（spectrum 平滑前）：峰值包络的攻击只认它，避开平滑与 alpha 限幅把瞬态磨平。
const rawLevels = new Float32Array(DOTS_COLS)
// 每列峰值包络：瞬时跟上原始能量、之后按时间常数慢衰减到当前原始值为止（快起慢落）。
const peakLevels = new Float32Array(DOTS_COLS)
// 整形后的显示能量：真正喂给 shader 的每列调制量（峰值主导 + 对比扩展）。
const dispLevels = new Float32Array(DOTS_COLS)
// 全场呼吸包络：低频列峰值均值的慢涨落，驱动全场覆盖与 alpha 的 swell。
let breathLevel = 0
// 上一帧整形的时间戳：峰值衰减与呼吸都按真实帧间隔推进，不按帧数凑系数。
let shapeStamp: number | undefined

// 读取同位点画布 dataset 上 spectrum.ts 发布的每列 alpha 与平滑前目标，并还原能量：
// alpha = 包络 × 0.35 × 平滑能量，能量只在包络足够大时才可信，其余时刻归零防噪声放大；
// dotsTarget 是同一时刻未经平滑的每列原始能量，非 live 时 spectrum 侧已归零。
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
  const targets = (sourceCanvas.dataset.dotsTarget ?? '').split(',')
  for (let col = 0; col < DOTS_COLS; col++) {
    const alpha = Number(parts[col] ?? 0) || 0
    levels[col] =
      fade > 0.05 ? Math.min(1, Math.max(0, alpha / DOTS_MAX_ALPHA)) : 0
    const raw = Number(targets[col] ?? 0) || 0
    rawLevels[col] =
      live && fade > 0.05 ? Math.min(1, Math.max(0, raw)) : 0
  }
  return { fade, live }
}

// 把原始能量整形成显示能量：每列先做峰值保持（攻击即时、释放 420ms 时间常数、
// 地板为当前原始值），再经对比扩展与平滑能量合成；低频 7 列的峰值均值另走一条
// 慢包络成为全场呼吸。只吃 live 实测数据，非 live 时原始值已归零、包络自然衰减回落，
// 拿不到数据就如实静止，不造模拟假动。
function shapeLevels(timestamp: number): void {
  const dt =
    shapeStamp === undefined
      ? 16
      : Math.min(100, Math.max(0, timestamp - shapeStamp))
  shapeStamp = timestamp
  const decay = Math.exp(-dt / PEAK_RELEASE_MS)
  for (let col = 0; col < DOTS_COLS; col++) {
    const raw = rawLevels[col]!
    peakLevels[col] =
      raw > peakLevels[col]! ? raw : Math.max(raw, peakLevels[col]! * decay)
    dispLevels[col] = Math.min(
      1,
      BASE_MIX * levels[col]! +
        PEAK_MIX * Math.pow(peakLevels[col]!, CONTRAST_EXP)
    )
  }
  let bass = 0
  for (let col = 0; col < BREATH_COLS; col++) bass += peakLevels[col]!
  bass /= BREATH_COLS
  const tau = bass > breathLevel ? BREATH_ATTACK_MS : BREATH_RELEASE_MS
  breathLevel += (bass - breathLevel) * (1 - Math.exp(-dt / tau))
}

// 按横幅 cover 裁切口径刷新 shader 的图像空间参数：与底图 object-position 同口径
// （位置分数由当前人物素材映射经 props 传入），保证点场与三层素材严丝合缝。
function syncGeometry(): void {
  if (!renderer || !material || !glCanvas.value) return
  const width = glCanvas.value.clientWidth
  const height = glCanvas.value.clientHeight
  if (!width || !height) return
  renderer.setSize(width, height, false)
  const scale = Math.max(width / props.imageWidth, height / props.imageHeight)
  const posX = width <= 700 ? props.posXNarrow : props.posX
  const posY = props.posY
  material.uniforms.uSize!.value.set(width, height)
  material.uniforms.uScale!.value = scale
  material.uniforms.uOffset!.value.set(
    (width - props.imageWidth * scale) * posX,
    (height - props.imageHeight * scale) * posY
  )
  if (glCanvas.value) {
    glCanvas.value.dataset.threePitch = (NATIVE_PITCH * scale).toFixed(2)
    // 细版点径上限的显示口径（CSS px），供 QA 与粗版触顶值同口径对比。
    glCanvas.value.dataset.threeRmaxCss = (RADIUS_CAP * NATIVE_PITCH * scale).toFixed(2)
    // 横向渐变参数（左缘不透明度下限 / 满格位置），供 QA 按同一公式核算 g(u)。
    glCanvas.value.dataset.threeGradMin = GRAD_MIN.toFixed(2)
    glCanvas.value.dataset.threeGradEnd = GRAD_END.toFixed(2)
  }
}

// three.js 渲染主循环：包络为零时整层隐藏且跳过绘制（静态横幅就是单图版原样），
// 并清零峰值/呼吸状态让下次播放从干净状态起；包络大于零时把整层透明度设为包络值
// （与同位点版同一条 1 秒淡入淡出口径），先整形能量再写入 uniform 绘制一帧，
// 并发布原始/显示能量、点径调制峰值与呼吸值供 QA 量化。
function tick(): void {
  frame = requestAnimationFrame(tick)
  if (!renderer || !scene || !camera || !material || !root.value || !glCanvas.value)
    return
  const { fade } = readLevels()
  root.value.style.opacity = fade > 0.002 ? String(fade) : '0'
  glCanvas.value.dataset.threeFade = fade.toFixed(3)
  if (fade <= 0.002) {
    peakLevels.fill(0)
    dispLevels.fill(0)
    breathLevel = 0
    shapeStamp = undefined
    return
  }
  shapeLevels(performance.now())
  const started = performance.now()
  const uniform = material.uniforms.uLevels!.value as Float32Array
  uniform.set(dispLevels)
  material.uniforms.uBreath!.value = breathLevel
  let maxEnergy = 0
  for (const value of dispLevels) maxEnergy = Math.max(maxEnergy, value)
  glCanvas.value.dataset.threeModMax = (
    Math.sqrt(1 + COVERAGE_GAIN * maxEnergy) - 1
  ).toFixed(3)
  glCanvas.value.dataset.threeLevels = Array.from(levels, value =>
    value.toFixed(3)
  ).join(',')
  glCanvas.value.dataset.threeDispLevels = Array.from(dispLevels, value =>
    value.toFixed(3)
  ).join(',')
  glCanvas.value.dataset.threeBreath = breathLevel.toFixed(3)
  renderer.render(scene, camera)
  const elapsed = performance.now() - started
  const previous = Number(glCanvas.value.dataset.threeFrameMs ?? elapsed)
  glCanvas.value.dataset.threeFrameMs = (previous * 0.9 + elapsed * 0.1).toFixed(2)
}

// 加载当前人物的覆盖场纹理（离线派生：提取点层 alpha 经格尺度模糊并按 4/π 标定，
// 模糊尺度已按细版新点距同比缩放）；切换人物时换纹理，旧纹理释放不残留。
function loadCoverage(src: string): void {
  new TextureLoader().load(src, texture => {
    if (!material) {
      texture.dispose()
      return
    }
    const previous = material.uniforms.uCoverage!.value as
      | InstanceType<typeof Texture>
      | null
    material.uniforms.uCoverage!.value = texture
    previous?.dispose()
  })
}

// 人物切换时同步新素材：覆盖场换纹理、图像空间尺寸换新图口径、裁切几何立即重算，
// 不等下一次窗口尺寸变化才对齐。
watch(
  () => [props.coverageSrc, props.imageWidth, props.imageHeight, props.posX, props.posY, props.posXNarrow] as const,
  ([src ]) => {
    if (!material) return
    material.uniforms.uImageSize!.value.set(props.imageWidth, props.imageHeight)
    loadCoverage(src)
    syncGeometry()
  }
)

// 初始化 three.js 场景：只引入渲染器/正交相机/平面/着色器材质四件，覆盖场纹理来自
// 当前人物的离线派生素材，加载完成前整层保持隐藏，不让无点版本闪现。
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
      uLevels: { value: dispLevels },
      uBreath: { value: 0 },
      uSize: { value: new Vector2(1, 1) },
      uImageSize: { value: new Vector2(props.imageWidth, props.imageHeight) },
      uScale: { value: 1 },
      uOffset: { value: new Vector2(0, 0) },
      uInk: { value: DOT_INK },
    },
  })
  const mesh = new Mesh(geometry, material)
  scene.add(mesh)
  loadCoverage(props.coverageSrc)
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
      :src="props.bgSrc"
      :width="props.imageWidth"
      :height="props.imageHeight"
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
      :src="props.charaSrc"
      :width="props.imageWidth"
      :height="props.imageHeight"
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
   与单图版严丝合缝，点层夹在两者之间。裁切位置读横幅根节点按当前人物写入的
   CSS 变量，与底图、shader 几何同一口径，缺省即原始人物的 62% 36% / 88% 36%。 */
.halftone-three-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: var(--banner-art-pos, 62% 36%);
}
@container (max-width: 700px) {
  .halftone-three-layer {
    object-position: var(--banner-art-pos-narrow, 88% 36%);
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
