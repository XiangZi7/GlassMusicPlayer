<script setup lang="ts">
import CoverThumbnail from '@/components/player/CoverThumbnail.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

withDefaults(
  defineProps<{
    rows: readonly {
      id: string
      title: string
      coverUrl: string | null
      trackCount: number | null
    }[]
    motion?: boolean
  }>(),
  { motion: true }
)
const emit = defineEmits<{ open: [id: string] }>()
</script>

<template>
  <div
    class="playlist-grid-shell min-w-0"
    :class="{ 'playlist-grid-calm': !motion }"
  >
    <!-- 歌单网格以实际封面为主，整张卡是进入详情的键盘与鼠标入口。 -->
    <ul class="playlist-grid m-0 grid list-none items-stretch gap-3.5 p-1">
      <li
        v-for="item in rows"
        :key="item.id"
        class="min-w-0"
      >
        <BaseButton
          class="playlist-card flex h-full w-full min-w-0 cursor-pointer flex-col rounded-[18px] border p-2.5 text-left text-inherit"
          :title="item.title"
          :data-library-playlist="item.id"
          @click="emit('open', item.id)"
        >
          <!-- 封面组件按实际像素密度请求图片并在失败时回退。 -->
          <span
            class="playlist-cover relative block aspect-square w-full overflow-hidden rounded-xl"
          >
            <CoverThumbnail
              class="playlist-art block size-full object-cover"
              :src="item.coverUrl ?? ''"
              :size="180"
              alt=""
              loading="lazy"
            />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-1 px-1 pt-2.5 pb-0.5">
            <strong
              class="line-clamp-2 min-h-10 text-sm leading-5 font-semibold wrap-anywhere text-white/95"
            >
              {{ item.title }}
            </strong>
            <small
              v-if="item.trackCount != null"
              class="text-xs leading-4 text-white/65"
              >{{ item.trackCount }} 首</small
            >
          </span>
        </BaseButton>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.playlist-grid-shell {
  container-type: inline-size;
}
.playlist-grid {
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(100%, clamp(8rem, 15cqi, 10.5rem)), 1fr)
  );
}
.playlist-card {
  border-color: rgb(255 255 255 / 10%);
  background: rgb(255 255 255 / 5.5%);
}
.playlist-cover {
  background: rgb(255 255 255 / 5%);
}
.playlist-cover::after {
  position: absolute;
  inset: 0;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: inherit;
  pointer-events: none;
  content: '';
}
.playlist-card:is(:hover, :focus-visible) {
  border-color: rgb(255 255 255 / 23%);
  background-color: rgb(255 255 255 / 9%);
}
.liquid-win .playlist-card {
  border-color: rgb(255 255 255 / 26%);
  background:
    linear-gradient(165deg, rgb(255 255 255 / 15%), rgb(255 255 255 / 4%)),
    rgb(255 255 255 / 2%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 38%);
}
.liquid-win .playlist-card:is(:hover, :focus-visible) {
  border-color: rgb(255 255 255 / 40%);
  background-color: rgb(255 255 255 / 7%);
}
.playlist-card:focus-visible {
  outline: 2px solid rgb(255 255 255 / 85%);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  .playlist-grid-shell:not(.playlist-grid-calm) .playlist-card {
    transition:
      background-color 160ms ease,
      border-color 160ms ease;
  }
  .playlist-grid-shell:not(.playlist-grid-calm) .playlist-art {
    transition: transform 180ms ease;
  }
  .playlist-grid-shell:not(.playlist-grid-calm)
    .playlist-card:is(:hover, :focus-visible)
    .playlist-art {
    transform: scale(1.035);
  }
}
</style>
