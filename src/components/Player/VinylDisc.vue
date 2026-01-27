<script setup lang="ts">
import { gsap } from 'gsap'

interface Props {
  /** 封面图片URL */
  cover?: string
  /** 是否正在播放 */
  isPlaying?: boolean
  /** 是否加载中 */
  isLoading?: boolean
  /** 唱片尺寸（Tailwind类名） */
  size?: 'sm' | 'md' | 'lg'
  /** 是否显示唱臂 */
  showTonearm?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isPlaying: false,
  isLoading: false,
  size: 'lg',
  showTonearm: true,
})

const emit = defineEmits<{
  click: []
}>()

const albumCoverRef = useTemplateRef('albumCoverRef')
let albumRotationTween: gsap.core.Tween | null = null

// 尺寸映射
const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return {
        wrapper: 'w-[50vw] max-w-[200px]',
        disc: 'w-full',
        label: 'h-[60%] w-[60%]',
        spindle: 'h-4 w-4',
        tonearm: '-top-6 -right-3',
        pivot: 'h-6 w-6',
        shaft: 'h-20 w-1.5',
        counterweight: '-mt-1.5 ml-1 h-4 w-4',
        headshell: 'mt-0.5 h-5 w-7',
        cartridge: 'h-2.5 w-5',
        stylus: 'h-2.5',
      }
    case 'md':
      return {
        wrapper: 'w-[65vw] max-w-[280px]',
        disc: 'w-full',
        label: 'h-[65%] w-[65%]',
        spindle: 'h-6 w-6',
        tonearm: '-top-8 -right-4',
        pivot: 'h-8 w-8',
        shaft: 'h-28 w-2',
        counterweight: '-mt-2 ml-2 h-5 w-5',
        headshell: 'mt-0.5 h-6 w-9',
        cartridge: 'h-3 w-6',
        stylus: 'h-3',
      }
    case 'lg':
    default:
      return {
        wrapper: 'h-96 w-96',
        disc: 'h-full w-full',
        label: 'h-1/2 w-1/2',
        spindle: 'h-6 w-6',
        tonearm: '-top-16 -right-20',
        pivot: 'h-14 w-14',
        shaft: 'h-44 w-3',
        counterweight: '-mt-3 ml-1.5 h-8 w-8',
        headshell: 'mt-1 h-12 w-20',
        cartridge: 'h-6 w-12',
        stylus: 'h-6',
      }
  }
})

// 唱臂旋转角度
const tonearmRotation = computed(() => {
  if (props.size === 'lg') {
    return props.isPlaying ? 'rotate-16' : 'rotate-[-28deg]'
  }
  return props.isPlaying ? 'rotate-6' : 'rotate-[-18deg]'
})

/**
 * 开始封面旋转动画
 */
const startAlbumRotation = () => {
  if (albumCoverRef.value) {
    if (albumRotationTween) albumRotationTween.kill()
    albumRotationTween = gsap.to(albumCoverRef.value, {
      rotation: '+=360',
      duration: 10,
      repeat: -1,
      ease: 'none',
    })
  }
}

/**
 * 停止封面旋转动画
 */
const stopAlbumRotation = () => {
  if (albumRotationTween) {
    albumRotationTween.kill()
    albumRotationTween = null
  }
}

// 监听播放状态
watch(
  () => props.isPlaying,
  playing => {
    playing ? startAlbumRotation() : stopAlbumRotation()
  },
  { immediate: true }
)

// 清理动画
onUnmounted(() => {
  stopAlbumRotation()
})

// 暴露方法供外部调用
defineExpose({
  startAlbumRotation,
  stopAlbumRotation,
})
</script>

<template>
  <div
    class="album-wrapper relative cursor-pointer"
    :class="sizeClasses.wrapper"
    @click="emit('click')"
  >
    <!-- 黑胶唱片 -->
    <div
      ref="albumCoverRef"
      class="vinyl-disc relative aspect-square overflow-hidden rounded-full shadow-2xl"
      :class="sizeClasses.disc"
    >
      <!-- 唱片标签（封面） -->
      <div
        class="vinyl-label absolute top-1/2 left-1/2 -translate-1/2 rounded-full bg-cover bg-center"
        :class="sizeClasses.label"
        :style="{
          backgroundImage: cover
            ? `url(${cover}?param=320x320)`
            : 'linear-gradient(135deg, rgba(167,139,250,0.6) 0%, rgba(108,92,231,0.6) 100%)',
        }"
      ></div>
      <!-- 中心轴 -->
      <div
        class="spindle absolute top-1/2 left-1/2 -translate-1/2 rounded-full"
        :class="sizeClasses.spindle"
      ></div>
    </div>

    <!-- 唱臂 -->
    <div
      v-if="showTonearm"
      class="tonearm absolute z-10 origin-top-left transition-transform duration-500 ease-out"
      :class="[sizeClasses.tonearm, tonearmRotation]"
    >
      <div class="arm-pivot relative rounded-full" :class="sizeClasses.pivot"></div>
      <div class="arm-shaft -mt-px rounded-full" :class="sizeClasses.shaft"></div>
      <div class="counterweight rounded-full" :class="sizeClasses.counterweight"></div>
      <div class="headshell relative rounded-md" :class="sizeClasses.headshell">
        <div
          class="cartridge absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm"
          :class="sizeClasses.cartridge"
        ></div>
        <div
          class="stylus absolute top-full left-1/2 w-[2px] -translate-x-1/2"
          :class="sizeClasses.stylus"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vinyl-disc {
  background: radial-gradient(circle at 50% 50%, #1a1a1a 0%, #0a0a0a 60%, #000 100%);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.vinyl-disc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: repeating-radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.04) 0px,
    rgba(255, 255, 255, 0.04) 1px,
    transparent 2px,
    transparent 4px
  );
  pointer-events: none;
}

.vinyl-disc::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
  mix-blend-mode: screen;
  pointer-events: none;
}

.vinyl-label {
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 2px 20px rgba(0, 0, 0, 0.3);
}

.spindle {
  background: radial-gradient(circle at 30% 30%, #d0d0d0, #808080 60%, #505050);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.tonearm {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}

.arm-pivot {
  background: conic-gradient(from 180deg at 50% 50%, #d0d0d0, #b0b0b0, #909090, #d0d0d0);
}

.arm-shaft {
  background: linear-gradient(180deg, #c0c0c0 0%, #a0a0a0 50%, #808080 100%);
}

.counterweight {
  background: radial-gradient(circle at 30% 30%, #a0a0a0, #707070 60%, #505050);
}

.headshell {
  background: linear-gradient(135deg, #606060, #404040);
}

.cartridge {
  background: linear-gradient(180deg, #707070, #404040);
}

.stylus {
  background: linear-gradient(180deg, #d0d0d0, #909090);
}
</style>
