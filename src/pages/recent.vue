<script setup lang="ts">
const categories = [
  { key: 'all', label: '全部', emoji: '✨' },
  { key: 'song', label: '歌曲', emoji: '🎵' },
  { key: 'playlist', label: '歌单', emoji: '📜' },
  { key: 'mv', label: 'MV', emoji: '🎬' },
]

const selected = ref('all')

const items = [
  {
    type: 'song',
    name: '千本樱',
    artist: '初音未来',
    time: '2小时前',
    emoji: '🌸',
    gradient: 'from-pink-400 to-purple-500',
  },
  {
    type: 'song',
    name: '残酷天使的行动纲领',
    artist: '高橋洋子',
    time: '昨天',
    emoji: '👼',
    gradient: 'from-orange-400 to-red-500',
  },
  {
    type: 'song',
    name: '打上花火',
    artist: 'DAOKO',
    time: '3天前',
    emoji: '🎆',
    gradient: 'from-blue-400 to-purple-500',
  },
  {
    type: 'playlist',
    name: '治愈系精选',
    artist: '歌单',
    time: '5天前',
    emoji: '🌈',
    gradient: 'from-blue-400 to-cyan-500',
  },
  {
    type: 'mv',
    name: 'Your Name',
    artist: 'RADWIMPS',
    time: '1周前',
    emoji: '⭐',
    gradient: 'from-purple-400 to-pink-500',
  },
]

const filtered = computed(() =>
  selected.value === 'all' ? items : items.filter(i => i.type === selected.value)
)
</script>

<template>
  <div class="relative flex-1 overflow-hidden">
    <div class="absolute inset-0 -z-10">
      <div class="glow top-20 left-20 bg-purple-500/30"></div>
      <div class="glow right-32 bottom-24 bg-pink-500/30"></div>
      <div class="glow top-1/3 right-10 bg-blue-500/25"></div>
    </div>

    <div class="h-full overflow-auto p-6">
      <div class="mb-8">
        <div class="relative overflow-hidden rounded-2xl bg-black/30 p-6 backdrop-blur">
          <div class="shimmer absolute inset-0"></div>
          <div class="relative z-10 flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold text-white">最近播放</h1>
              <p class="mt-1 text-sm text-white/70">为你记录最近的动人旋律与精彩瞬间</p>
            </div>
            <div class="hidden gap-2 md:flex">
              <div
                v-for="cat in categories"
                :key="cat.key"
                class="glass-button flex items-center gap-2 px-4 py-2 text-white"
                :class="selected === cat.key ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'"
                @click="selected = cat.key"
              >
                <span>{{ cat.emoji }}</span>
                <span class="text-sm">{{ cat.label }}</span>
              </div>
            </div>
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
                  <span class="icon-[mdi--play] h-5 w-5 text-white"></span>
                </button>
              </div>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-white"
                >
                  {{ item.type.toUpperCase() }}
                </span>
                <span class="text-xs text-purple-300">{{ item.time }}</span>
              </div>
              <h3
                class="mt-1 truncate text-base font-semibold text-white group-hover:text-pink-300"
              >
                {{ item.name }}
              </h3>
              <p class="truncate text-sm text-purple-300">{{ item.artist }}</p>
            </div>

            <div
              class="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button class="text-purple-300 transition-colors hover:text-white">
                <span class="icon-[mdi--heart-outline] h-5 w-5"></span>
              </button>
              <button class="text-purple-300 transition-colors hover:text-white">
                <span class="icon-[mdi--dots-horizontal] h-5 w-5"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
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
