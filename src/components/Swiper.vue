<script setup lang="ts">
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import type SwiperClass from 'swiper'
import { ref } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination } from 'swiper/modules'

// props
interface Props {
  images: string[]
}
defineProps<Props>()

// swiper 实例引用
const swiper = ref<SwiperClass | null>(null)
const onSwiper = (sw: SwiperClass) => {
  swiper.value = sw
  console.log('🚀 swiper 实例:', sw)
}

const onSlideChange = (): void => {
  console.log('slide 切换了')
}
</script>
<template>
  <div class="relative mx-auto max-w-4xl">
    <!-- 自定义左右箭头 -->
    <button
      class="custom-prev absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-gray-800/50 p-2 text-white"
      @click="swiper?.slidePrev()"
      aria-label="Previous slide"
    >
      ‹
    </button>
    <button
      class="custom-next absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-gray-800/50 p-2 text-white"
      @click="swiper?.slideNext()"
      aria-label="Next slide"
    >
      ›
    </button>

    <!-- Swiper 主体 -->
    <Swiper
      @swiper="onSwiper"
      :modules="[Navigation, Pagination]"
      :slides-per-view="3"
      :space-between="30"
      loop
      :navigation="{ prevEl: '.custom-prev', nextEl: '.custom-next' }"
      :pagination="{ el: '.custom-pagination', clickable: true }"
      @slideChange="onSlideChange"
    >
      <SwiperSlide v-for="(src, idx) in images" :key="idx" class="flex justify-center">
        <img
          :src="src"
          :alt="`Slide ${idx + 1}`"
          class="h-60 w-full rounded-lg object-cover shadow-lg"
        />
      </SwiperSlide>
    </Swiper>

    <!-- 自定义分页容器 -->
    <div class="custom-pagination mt-4 flex justify-center space-x-2"></div>
  </div>
</template>

<style scoped>
.custom-prev,
.custom-next {
  cursor: pointer;
}
/* 分页点样式 */
.custom-pagination .swiper-pagination-bullet {
  width: 0.75rem;
  height: 0.75rem;
  background-color: gray;
  opacity: 0.5;
  border-radius: 50%;
}
.custom-pagination .swiper-pagination-bullet-active {
  background-color: white;
  opacity: 1;
  transform: scale(1.2);
  transition: transform 0.3s;
}
</style>
