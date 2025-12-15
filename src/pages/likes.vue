<script setup lang="ts">
import TabGroup from '@/components/Ui/TabGroup.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const tabs = [
  { key: 'all', labelKey: 'likes.tabs.all', icon: 'icon-[mdi--heart]' },
  { key: 'song', labelKey: 'likes.tabs.song', icon: 'icon-[mdi--music]' },
  { key: 'playlist', labelKey: 'likes.tabs.playlist', icon: 'icon-[mdi--playlist-music]' },
  { key: 'mv', labelKey: 'likes.tabs.mv', icon: 'icon-[mdi--video]' },
]

const state = reactive({
  // 当前激活的标签
  active: 'all',
  isPageLoading: false,
})
const { active } = toRefs(state)

const liked = [
  {
    type: 'song',
    name: '夜に駆ける',
    artist: 'YOASOBI',
    emoji: '🌙',
    gradient: 'from-indigo-400 to-purple-500',
    time: '刚刚',
  },
  {
    type: 'song',
    name: 'Lemon',
    artist: '米津玄師',
    emoji: '🍋',
    gradient: 'from-yellow-400 to-orange-500',
    time: '1天前',
  },
  {
    type: 'playlist',
    name: '治愈系精选',
    artist: '歌单',
    emoji: '🌈',
    gradient: 'from-blue-400 to-cyan-500',
    time: '3天前',
  },
  {
    type: 'mv',
    name: '打上花火',
    artist: 'DAOKO',
    emoji: '🎆',
    gradient: 'from-blue-400 to-purple-500',
    time: '1周前',
  },
]

const filtered = computed(() =>
  state.active === 'all' ? liked : liked.filter(i => i.type === state.active)
)
</script>

<template>
  <div class="relative flex-1 overflow-hidden">
    <div class="absolute inset-0 -z-10">
      <div class="glow top-16 left-24 bg-pink-500/30"></div>
      <div class="glow right-24 bottom-20 bg-purple-500/30"></div>
      <div class="glow top-1/2 right-10 bg-blue-500/25"></div>
    </div>

    <div class="h-full overflow-auto p-6">
      <PageSkeleton v-if="state.isPageLoading" :sections="['list']" :list-count="12" />
      <template v-else>
      <div class="mb-8">
        <div class="glass-container relative overflow-hidden rounded-3xl p-6">
          <div class="shimmer absolute inset-0"></div>
          <div class="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 class="text-3xl font-bold text-primary">{{ t('likes.title') }}</h1>
              <p class="mt-1 text-sm text-primary/70">{{ t('likes.subtitle') }}</p>
            </div>
            <TabGroup
              v-model="active"
              :tabs="tabs"
              variant="gradient"
              size="sm"
              :show-count="false"
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="(item, index) in filtered"
          :key="index"
          class="group relative overflow-hidden rounded-2xl bg-white/5 p-4 backdrop-blur transition-all duration-300 hover:scale-[1.02] hover:bg-white/10"
        >
          <div
            class="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            <div
              class="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-pink-500/10 blur-2xl"
            ></div>
            <div
              class="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-purple-500/10 blur-2xl"
            ></div>
          </div>

          <div class="flex items-center gap-4">
            <div class="relative">
              <div
                class="flex h-16 w-16 items-center justify-center rounded-xl bg-linear-to-br text-2xl"
                :class="item.gradient"
              >
                {{ item.emoji }}
              </div>
              <div class="overlay-center">
                <button
                  class="glass-button flex h-10 w-10 items-center justify-center rounded-full bg-white/20 opacity-0 transition-all duration-300 group-hover:opacity-100"
                >
                  <span class="icon-[mdi--play] h-5 w-5 text-primary"></span>
                </button>
              </div>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-primary"
                >
                  {{ item.type.toUpperCase() }}
                </span>
                <span class="text-xs text-purple-300">{{ item.time }}</span>
              </div>
              <h3
                class="mt-1 truncate text-base font-semibold text-primary group-hover:text-pink-300"
              >
                {{ item.name }}
              </h3>
              <p class="truncate text-sm text-purple-300">{{ item.artist }}</p>
            </div>

            <div
              class="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button class="text-pink-400 transition-colors hover:text-primary">
                <span class="icon-[mdi--heart] h-5 w-5"></span>
              </button>
              <button class="text-purple-300 transition-colors hover:text-primary">
                <span class="icon-[mdi--dots-horizontal] h-5 w-5"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.glow {
  position: absolute;
  width: 22rem;
  height: 22rem;
  border-radius: 9999px;
  filter: blur(80px);
  animation: float 10s ease-in-out infinite;
}
.shimmer {
  background: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0.06),
    rgba(255, 255, 255, 0.02) 30%,
    rgba(255, 255, 255, 0.06)
  );
  mask-image: linear-gradient(180deg, transparent, black 20%, black 80%, transparent);
  animation: shimmer 5s linear infinite;
}
.overlay-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes shimmer {
  0% {
    transform: translateX(-30%);
  }
  100% {
    transform: translateX(30%);
  }
}
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}
@keyframes spinSlow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
