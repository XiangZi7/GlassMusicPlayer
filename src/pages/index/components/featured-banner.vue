<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import { computed, useTemplateRef } from "vue";
import { useMouseInElement } from "@vueuse/core";
import AppIcon from "@/components/ui/AppIcon.vue";
import { usePlayerStore } from "@/stores/player";
import { formatTime } from "@/utils/format";
const player = usePlayerStore();
const banner = useTemplateRef<HTMLElement>("banner");
const { elementX, elementY, elementWidth, elementHeight, isOutside } =
  useMouseInElement(banner);
const parallax = computed(() => {
  const enabled =
    player.settings.glass === "liquid" &&
    player.settings.motion &&
    !isOutside.value;
  return {
    "--rx": `${enabled ? (elementY.value / Math.max(1, elementHeight.value) - 0.5) * -8 : 0}deg`,
    "--ry": `${enabled ? (elementX.value / Math.max(1, elementWidth.value) - 0.5) * 10 : 0}deg`,
  };
});
</script>

<template>
  <!-- 首页主打横幅：原稿立绘与封面分层，液态模式随鼠标产生视差。 -->
  <section
    ref="banner"
    class="banner relative mt-5 h-52 overflow-hidden rounded-[22px] border border-white/20 xl:h-56"
    :style="parallax"
    aria-label="今日主打"
  >
    <div
      class="absolute -inset-10 bg-cover bg-center opacity-20 blur-2xl"
      :style="{ backgroundImage: `url('${player.currentTrack.cover}')` }"
    />
    <div
      class="absolute inset-0 bg-linear-to-r from-[#090b13]/90 via-[#121328]/60 to-[#151125]/30"
    />
    <div class="relative z-10 flex h-full w-[62%] flex-col justify-center px-6">
      <p class="mb-3 text-[9px] font-extrabold tracking-[.14em] text-white/60">
        今日主打 · FEATURED
      </p>
      <h2
        class="truncate text-[28px] font-extrabold tracking-tight xl:text-[34px]"
      >
        {{ player.currentTrack.album }}
      </h2>
      <p class="mt-2 truncate text-[11px] text-white/65">
        {{ player.currentTrack.title }} — {{ player.currentTrack.artist }}
      </p>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <BaseButton
          variant="primary"
          class="min-h-9 px-4"
          @click="player.playTrack(player.currentId)"
        >
          <AppIcon name="play" :size="12" />立即播放</BaseButton
        ><span class="font-mono text-[8px] text-white/50"
          >{{ player.currentTrack.quality }} ·
          {{ formatTime(player.duration) }}</span
        >
      </div>
    </div>
    <div
      class="banner-art absolute bottom-0 right-0 top-0 w-[49%] [perspective:800px]"
    >
      <div
        class="absolute inset-6 rounded-full opacity-30 blur-3xl"
        :style="{ backgroundColor: player.currentTrack.color }"
      />
      <img
        v-for="(album, index) in player.albums.slice(0, 3).reverse()"
        :key="album.id"
        :src="album.cover"
        alt="专辑封面装饰"
        class="absolute top-[30%] aspect-square w-[44%] rounded-xl border border-white/20 object-cover shadow-2xl"
        :style="{
          right: `${10 + index * 12}%`,
          transform: `rotate(${(index - 1) * -10}deg) translateZ(${index * 15}px)`,
        }"
      /><img
        class="banner-singer absolute -bottom-1 right-0 h-[102%] w-full object-contain object-right-bottom [filter:drop-shadow(-10px_10px_16px_#0008)]"
        src="/images/featured-singer.webp"
        alt="黑发女主唱插画"
      />
    </div>
  </section>
</template>

<style scoped>
.banner-art {
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transform-origin: center;
  transition: transform 0.5s ease-out;
}
.banner-singer {
  transform: translateZ(40px);
}
</style>
