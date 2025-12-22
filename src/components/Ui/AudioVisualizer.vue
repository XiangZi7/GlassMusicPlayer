<script setup lang="ts">
export interface AudioVisualizerProps {
  frequencyData: Uint8Array
  timeDomainData: Uint8Array
  type?: 'bars' | 'wave' | 'circular'
  barCount?: number
  barWidth?: number
  barGap?: number
  color?: string
  gradientColors?: string[]
  showMirror?: boolean
  height?: number
}

const props = withDefaults(defineProps<AudioVisualizerProps>(), {
  type: 'bars',
  barCount: 64,
  barWidth: 4,
  barGap: 2,
  color: '#3b82f6',
  gradientColors: () => ['#3b82f6', '#8b5cf6', '#ec4899'],
  showMirror: false,
  height: 200
})

const canvasRef = ref<HTMLCanvasElement>()
let animationId: number | null = null

// 检测是否有音频活动
const hasAudioActivity = (data: Uint8Array, threshold = 10) => {
  // 计算平均值，如果平均值太低说明没有音频播放
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i]
  }
  const average = sum / data.length
  return average > threshold
}

// 绘制频谱柱状图
const drawBars = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const { frequencyData, barCount, barWidth, barGap, gradientColors, showMirror } = props

  if (frequencyData.length === 0) return

  // 如果没有音频活动，不绘制任何内容
  if (!hasAudioActivity(frequencyData)) return

  // 创建渐变色
  const gradient = ctx.createLinearGradient(0, height, 0, 0)
  gradientColors.forEach((color, index) => {
    gradient.addColorStop(index / (gradientColors.length - 1), color)
  })

  const totalBarWidth = barWidth + barGap

  // 让柱子占满整个宽度
  const actualBarCount = Math.floor(width / totalBarWidth)
  const startX = (width - totalBarWidth * actualBarCount) / 2

  // 只使用频谱数据的前半部分（低频到中频），因为高频通常能量很小
  // 使用对数分布来映射频率，使得低频有更多柱子，高频较少
  const usableDataLength = Math.floor(frequencyData.length * 0.6) // 只用前60%的数据

  for (let i = 0; i < actualBarCount; i++) {
    // 使用对数分布来采样数据，让低频区域有更密集的采样
    const logIndex = Math.log(i + 1) / Math.log(actualBarCount + 1)
    const dataIndex = Math.floor(logIndex * usableDataLength)

    // 获取该位置的频率值，并对相邻数据做平滑
    let sum = 0
    const smoothRange = 2
    let count = 0
    for (let j = -smoothRange; j <= smoothRange; j++) {
      const idx = Math.min(Math.max(dataIndex + j, 0), frequencyData.length - 1)
      sum += frequencyData[idx]
      count++
    }
    const average = sum / count

    // 使用非线性映射增强可视化效果
    // 对低音量进行放大，使得小幅度的变化也能看得清楚
    const normalized = average / 255
    const enhanced = Math.pow(normalized, 0.7) // 使用0.7的幂次，放大小值
    const barHeight = enhanced * height

    const x = startX + i * totalBarWidth

    // 绘制主柱子
    ctx.fillStyle = gradient
    ctx.fillRect(x, height - barHeight, barWidth, barHeight)

    // 绘制镜像效果
    if (showMirror) {
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillRect(x, height, barWidth, barHeight * 0.5)
      ctx.restore()
    }
  }
}

// 绘制波形图
const drawWave = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const { timeDomainData, gradientColors } = props

  if (timeDomainData.length === 0) return

  // 检测波形数据是否有变化（不是静止在128附近）
  let variance = 0
  for (let i = 0; i < timeDomainData.length; i++) {
    variance += Math.abs(timeDomainData[i] - 128)
  }
  const averageVariance = variance / timeDomainData.length
  if (averageVariance < 2) return // 如果波形太平说明没有音频

  const sliceWidth = width / timeDomainData.length
  const centerY = height / 2

  // 创建渐变色
  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradientColors.forEach((color, index) => {
    gradient.addColorStop(index / (gradientColors.length - 1), color)
  })

  ctx.strokeStyle = gradient
  ctx.lineWidth = 2
  ctx.beginPath()

  for (let i = 0; i < timeDomainData.length; i++) {
    const v = timeDomainData[i] / 128.0 // 0-255 转 0-2
    const y = (v - 1) * centerY + centerY // 转换为 Y 坐标

    if (i === 0) {
      ctx.moveTo(0, y)
    } else {
      ctx.lineTo(i * sliceWidth, y)
    }
  }

  ctx.stroke()

  // 绘制镜像效果
  if (props.showMirror) {
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.strokeStyle = gradient
    ctx.lineWidth = 2
    ctx.beginPath()

    for (let i = 0; i < timeDomainData.length; i++) {
      const v = timeDomainData[i] / 128.0
      const y = centerY - (v - 1) * centerY // 镜像 Y 坐标

      if (i === 0) {
        ctx.moveTo(0, y)
      } else {
        ctx.lineTo(i * sliceWidth, y)
      }
    }

    ctx.stroke()
    ctx.restore()
  }
}

// 绘制圆形频谱
const drawCircular = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const { frequencyData, barCount, gradientColors } = props

  if (frequencyData.length === 0) return

  // 如果没有音频活动，不绘制任何内容
  if (!hasAudioActivity(frequencyData)) return

  const centerX = width / 2
  const centerY = height / 2
  // 内圆半径：容器的37.5%（对应75%封面的半径，即288px在384px中的半径144px）
  const radius = Math.min(width, height) * 0.375
  // 频谱条最大高度：容器的25%（从内圆延伸到边缘）
  const maxBarHeight = Math.min(width, height) * 0.25

  // 创建径向渐变
  const gradient = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, radius + maxBarHeight)
  gradientColors.forEach((color, index) => {
    gradient.addColorStop(index / (gradientColors.length - 1), color)
  })

  // 使用对数分布采样，类似柱状图的处理
  const usableDataLength = Math.floor(frequencyData.length * 0.6)
  const angleStep = (Math.PI * 2) / barCount

  for (let i = 0; i < barCount; i++) {
    // 使用对数分布来采样数据
    const logIndex = Math.log(i + 1) / Math.log(barCount + 1)
    const dataIndex = Math.floor(logIndex * usableDataLength)

    // 获取该位置的频率值，并对相邻数据做平滑
    let sum = 0
    const smoothRange = 2
    let count = 0
    for (let j = -smoothRange; j <= smoothRange; j++) {
      const idx = Math.min(Math.max(dataIndex + j, 0), frequencyData.length - 1)
      sum += frequencyData[idx]
      count++
    }
    const average = sum / count

    // 使用非线性映射增强可视化效果
    const normalized = average / 255
    const enhanced = Math.pow(normalized, 0.7)
    const barHeight = enhanced * maxBarHeight

    const angle = angleStep * i - Math.PI / 2 // 从顶部开始

    // 计算起点和终点
    const x1 = centerX + Math.cos(angle) * radius
    const y1 = centerY + Math.sin(angle) * radius
    const x2 = centerX + Math.cos(angle) * (radius + barHeight)
    const y2 = centerY + Math.sin(angle) * (radius + barHeight)

    // 绘制线条
    ctx.strokeStyle = gradient
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

// 渲染循环
const render = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height } = canvas

  // 清空画布
  ctx.clearRect(0, 0, width, height)

  // 根据类型绘制
  switch (props.type) {
    case 'bars':
      drawBars(ctx, width, height)
      break
    case 'wave':
      drawWave(ctx, width, height)
      break
    case 'circular':
      drawCircular(ctx, width, height)
      break
  }

  animationId = requestAnimationFrame(render)
}

// 监听数据变化,启动渲染
watch(
  () => [props.frequencyData, props.timeDomainData],
  () => {
    if (!animationId && canvasRef.value) {
      render()
    }
  },
  { deep: true }
)

// 处理画布尺寸
const updateCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  // 使用 CSS 尺寸作为实际尺寸
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio

  // 缩放上下文以匹配设备像素比
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  }
}

onMounted(() => {
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)
  render()
})

onUnmounted(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', updateCanvasSize)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="audio-visualizer"
    :style="{ height: `${height}px` }"
  />
</template>

<style scoped>
.audio-visualizer {
  width: 100%;
  display: block;
}
</style>
