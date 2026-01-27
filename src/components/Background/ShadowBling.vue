<template>
  <div ref="containerRef" :class="className" :style="style" class="relative w-full h-full overflow-hidden"></div>
</template>

<script setup lang="ts">
import { type CSSProperties, useTemplateRef, onMounted, onUnmounted, watch } from 'vue'
import { Renderer, Program, Mesh, Color, Triangle, Vec2 } from 'ogl'

interface ShadowBlingProps {
  bgColors?: string[] // [base, highlight1, highlight2]
  speed?: number
  intensity?: number
  className?: string
  style?: CSSProperties
}

const props = withDefaults(defineProps<ShadowBlingProps>(), {
  bgColors: () => ['#000000', '#ffffff', '#808080'],
  speed: 1.0,
  intensity: 1.0,
  className: '',
  style: () => ({}),
})

const containerRef = useTemplateRef<HTMLDivElement>('containerRef')
let renderer: Renderer | null = null
let program: Program | null = null
let mesh: Mesh | null = null
let animationId: number
const mouse = new Vec2(0.5, 0.5)
const targetMouse = new Vec2(0.5, 0.5)

const VERT = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uSpeed;
uniform float uIntensity;

out vec4 fragColor;

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspectRatio = uResolution.x / uResolution.y;
  
  // Mouse interaction
  vec2 mouse = uMouse;
  mouse.x *= aspectRatio;
  vec2 aspectUv = uv;
  aspectUv.x *= aspectRatio;
  
  float dist = distance(aspectUv, mouse);
  float mouseInfluence = smoothstep(0.5, 0.0, dist);
  
  // Distortion based on noise and time
  float t = uTime * uSpeed * 0.2;
  float noise1 = snoise(uv * 3.0 + t);
  float noise2 = snoise(uv * 6.0 - t * 1.5);
  
  // Displace UVs
  vec2 distortedUv = uv + vec2(noise1, noise2) * 0.1 * uIntensity;
  
  // Chromatic aberration based on mouse distance
  float aberration = 0.02 * mouseInfluence * uIntensity + 0.005;
  
  vec3 color;
  
  // Mix colors based on noise
  float mixVal = (noise1 + noise2) * 0.5 + 0.5;
  
  // Base gradient
  vec3 baseColor = mix(uColor1, uColor2, uv.y + noise1 * 0.2);
  
  // Add shimmer/bling at mouse position
  float shimmer = pow(1.0 - dist, 4.0) * 2.0;
  shimmer += snoise(aspectUv * 10.0 + t * 5.0) * 0.2 * mouseInfluence;
  
  color = mix(baseColor, uColor3, shimmer);
  
  // Add some grain/dither
  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
  color += grain * 0.05;

  fragColor = vec4(color, 1.0);
}
`

const init = () => {
  if (!containerRef.value) return

  renderer = new Renderer({ alpha: true })
  const gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)
  
  function resize() {
    if (!containerRef.value) return
    renderer?.setSize(containerRef.value.offsetWidth, containerRef.value.offsetHeight)
    program?.uniforms.uResolution.value.set(gl.canvas.width, gl.canvas.height)
  }
  
  window.addEventListener('resize', resize)
  containerRef.value.appendChild(gl.canvas)

  const geometry = new Triangle(gl)
  
  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new Vec2(gl.canvas.width, gl.canvas.height) },
      uMouse: { value: new Vec2(0.5, 0.5) },
      uColor1: { value: new Color(props.bgColors[0]) },
      uColor2: { value: new Color(props.bgColors[1]) },
      uColor3: { value: new Color(props.bgColors[2]) },
      uSpeed: { value: props.speed },
      uIntensity: { value: props.intensity },
    },
  })

  mesh = new Mesh(gl, { geometry, program })
  
  resize()
  requestAnimationFrame(update)

  // Mouse move listener
  window.addEventListener('mousemove', onMouseMove)
}

const onMouseMove = (e: MouseEvent) => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = 1.0 - (e.clientY - rect.top) / rect.height // Flip Y for WebGL
  targetMouse.set(x, y)
}

const update = (t: number) => {
  animationId = requestAnimationFrame(update)
  
  if (!program || !renderer || !mesh) return

  program.uniforms.uTime.value = t * 0.001
  
  // Smooth mouse
  mouse.lerp(targetMouse, 0.05)
  program.uniforms.uMouse.value.copy(mouse)
  
  renderer.render({ scene: mesh })
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', () => {}) // Need proper cleanup
  window.removeEventListener('mousemove', onMouseMove)
  renderer?.gl.canvas.remove()
})

watch(() => props.bgColors, (newColors) => {
  if (program) {
    program.uniforms.uColor1.value = new Color(newColors[0])
    program.uniforms.uColor2.value = new Color(newColors[1])
    program.uniforms.uColor3.value = new Color(newColors[2])
  }
})
</script>
