<script setup lang="ts">
const route = useRoute()
const playlistId = route.params.id

// 当前激活的tab
const activeTab = ref('songs')

// 歌单信息
const playlistInfo = ref({
  name: '二次元神曲精选',
  description:
    '收录了最经典的动漫歌曲，从经典的EVA主题曲到现代的YOASOBI热门单曲，每一首都能唤起你心中的二次元回忆。让我们一起沉浸在这些美妙的旋律中，重温那些感动人心的动漫时光。',
  creator: '二次元音乐达人',
  createTime: '2024-01-15',
  songCount: 25,
  likes: '12.8万',
  category: '二次元',
  emoji: '🎌',
  gradient: 'from-pink-500 via-purple-500 to-indigo-600',
})

// 当前播放歌曲索引
const currentPlayingIndex = ref(2)

// 歌曲列表
const songs = ref([
  {
    name: '残酷天使的行动纲领',
    artist: '高橋洋子',
    album: '新世纪福音战士',
    duration: '4:06',
    emoji: '👼',
    gradient: 'from-orange-400 to-red-500',
  },
  {
    name: '千本樱',
    artist: '初音未来',
    album: 'VOCALOID精选',
    duration: '4:04',
    emoji: '🌸',
    gradient: 'from-pink-400 to-purple-500',
  },
  {
    name: '打上花火',
    artist: 'DAOKO',
    album: '烟花电影原声',
    duration: '4:49',
    emoji: '🎆',
    gradient: 'from-blue-400 to-purple-500',
  },
  {
    name: '前前前世',
    artist: 'RADWIMPS',
    album: '你的名字原声',
    duration: '4:44',
    emoji: '⭐',
    gradient: 'from-yellow-400 to-orange-500',
  },
  {
    name: '夜に駆ける',
    artist: 'YOASOBI',
    album: 'THE BOOK',
    duration: '4:23',
    emoji: '🌙',
    gradient: 'from-indigo-500 to-purple-600',
  },
  {
    name: 'Lemon',
    artist: '米津玄師',
    album: 'Lemon',
    duration: '4:15',
    emoji: '🍋',
    gradient: 'from-yellow-300 to-green-400',
  },
  {
    name: '紅蓮華',
    artist: 'LiSA',
    album: '鬼灭之刃OP',
    duration: '4:04',
    emoji: '🔥',
    gradient: 'from-red-500 to-orange-600',
  },
  {
    name: '炎',
    artist: 'LiSA',
    album: '鬼灭之刃剧场版',
    duration: '4:17',
    emoji: '🔥',
    gradient: 'from-orange-500 to-red-600',
  },
])

// 新评论内容
const newComment = ref('')

// 评论列表
const comments = ref([
  {
    username: '动漫迷小王',
    avatar: '王',
    avatarGradient: 'from-blue-400 to-cyan-500',
    time: '2小时前',
    content:
      '这个歌单太棒了！每一首歌都是经典，特别是残酷天使的行动纲领，每次听都会想起EVA的经典画面。感谢UP主的用心整理！',
    likes: 128,
    replies: [
      {
        username: '二次元收藏家',
        avatar: '收',
        avatarGradient: 'from-purple-400 to-pink-500',
        time: '1小时前',
        content: '同感！这些歌曲都承载着满满的回忆呢~',
      },
    ],
  },
  {
    username: 'YOASOBI粉丝',
    avatar: 'Y',
    avatarGradient: 'from-pink-400 to-red-500',
    time: '5小时前',
    content:
      '夜に駆ける真的是神曲！YOASOBI的音乐总是能触动人心，配上这个歌单的其他歌曲，简直是完美的二次元音乐之旅。',
    likes: 89,
    replies: [],
  },
  {
    username: '初音未来爱好者',
    avatar: '初',
    avatarGradient: 'from-cyan-400 to-blue-500',
    time: '1天前',
    content:
      '千本樱永远的神！初音未来的声音就是有种魔力，能让人瞬间进入二次元的世界。这个歌单收录的都是精品啊！',
    likes: 156,
    replies: [
      {
        username: 'VOCALOID制作人',
        avatar: 'V',
        avatarGradient: 'from-green-400 to-teal-500',
        time: '20小时前',
        content: '作为制作人，我也很喜欢这些经典作品，它们代表了VOCALOID文化的精髓。',
      },
      {
        username: '音乐评论员',
        avatar: '评',
        avatarGradient: 'from-yellow-400 to-orange-500',
        time: '18小时前',
        content: '从音乐制作的角度来说，这些歌曲的编曲和旋律都非常出色。',
      },
    ],
  },
])

// 播放歌曲
const handlePlaySong = (song: any, index: number) => {
  currentPlayingIndex.value = index
  console.log(`播放歌曲: ${song.name}`)
}

// 处理喜欢歌曲
const handleLikeSong = (song: any, index: number) => {
  songs.value[index].liked = !songs.value[index].liked
  console.log(`${songs.value[index].liked ? '喜欢' : '取消喜欢'}: ${song.name}`)
}

// 处理更多选项
const handleMoreOptions = (song: any, index: number) => {
  console.log(`更多选项: ${song.name}`)
}

// 处理排序
const handleSort = () => {
  console.log('排序歌曲')
}

// 处理筛选
const handleFilter = () => {
  console.log('筛选歌曲')
}

// 播放歌曲 (保留原有方法以兼容其他地方的调用)
const playSong = (index: number) => {
  currentPlayingIndex.value = index
  console.log(`播放歌曲: ${songs.value[index].name}`)
}

// 提交评论
const submitComment = () => {
  if (!newComment.value.trim()) return

  const comment = {
    username: '我',
    avatar: '我',
    avatarGradient: 'from-pink-400 to-purple-500',
    time: '刚刚',
    content: newComment.value,
    likes: 0,
    replies: [],
  }

  comments.value.unshift(comment)
  newComment.value = ''
}
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <!-- 歌单头部信息 -->
      <section class="relative mb-8 overflow-hidden">
        <!-- 背景模糊效果 -->
        <div class="absolute inset-0">
          <div
            class="h-full w-full scale-110 bg-linear-to-br opacity-30 blur-3xl"
            :class="playlistInfo.gradient"
          ></div>
        </div>

        <!-- 浮动音符背景 -->
        <div class="absolute inset-0 overflow-hidden">
          <div class="floating-notes">
            <div v-for="i in 8" :key="i" class="note" :style="{ animationDelay: i * 0.8 + 's' }">
              {{ ['🎵', '🎶', '♪', '♫', '🎼', '🎤', '🎧', '🎸'][i - 1] }}
            </div>
          </div>
        </div>

        <div class="relative z-10 p-8">
          <div
            class="flex flex-col items-start space-y-6 lg:flex-row lg:items-center lg:space-y-0 lg:space-x-8"
          >
            <!-- 歌单封面 -->
            <div class="shrink-0">
              <div class="group relative">
                <div
                  class="h-64 w-64 rounded-3xl bg-linear-to-br p-1 shadow-2xl transition-all duration-500 hover:scale-105"
                  :class="playlistInfo.gradient"
                >
                  <div
                    class="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-black/20 backdrop-blur-sm"
                  >
                    <div
                      class="flex h-full w-full items-center justify-center bg-linear-to-br text-8xl"
                      :class="playlistInfo.gradient"
                    >
                      {{ playlistInfo.emoji }}
                    </div>
                  </div>
                </div>

                <!-- 播放按钮覆盖层 -->
                <div
                  class="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                >
                  <button
                    class="glass-button flex h-20 w-20 items-center justify-center bg-white/20 hover:bg-white/30"
                  >
                    <span class="icon-[mdi--play] h-8 w-8 text-white"></span>
                  </button>
                </div>

                <!-- 旋转光环 -->
                <div
                  class="border-gradient-to-r absolute -inset-2 animate-spin rounded-full border-2 from-pink-400 to-purple-600 opacity-30"
                  style="animation-duration: 10s"
                ></div>
              </div>
            </div>

            <!-- 歌单信息 -->
            <div class="min-w-0 flex-1">
              <div class="mb-2">
                <span
                  class="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
                >
                  {{ playlistInfo.category }}
                </span>
              </div>

              <h1 class="animate-fade-in-up mb-4 text-4xl font-bold text-white lg:text-5xl">
                {{ playlistInfo.name }}
              </h1>

              <p
                class="animate-fade-in-up mb-6 text-lg leading-relaxed text-white/80"
                style="animation-delay: 0.2s"
              >
                {{ playlistInfo.description }}
              </p>

              <!-- 歌单统计信息 -->
              <div
                class="animate-fade-in-up mb-6 flex flex-wrap items-center gap-6 text-white/70"
                style="animation-delay: 0.4s"
              >
                <div class="flex items-center space-x-2">
                  <span class="icon-[mdi--account-circle] h-5 w-5"></span>
                  <span>{{ playlistInfo.creator }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="icon-[mdi--calendar] h-5 w-5"></span>
                  <span>{{ playlistInfo.createTime }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="icon-[mdi--music-note] h-5 w-5"></span>
                  <span>{{ playlistInfo.songCount }}首歌曲</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="icon-[mdi--heart] h-5 w-5 text-red-400"></span>
                  <span>{{ playlistInfo.likes }}</span>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div
                class="animate-fade-in-up flex flex-wrap items-center gap-4"
                style="animation-delay: 0.6s"
              >
                <button
                  class="glass-button bg-linear-to-r from-pink-500 to-purple-600 px-8 py-3 font-medium text-white transition-transform hover:scale-105"
                >
                  <span class="icon-[mdi--play] mr-2 h-5 w-5"></span>
                  播放全部
                </button>
                <button class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20">
                  <span class="icon-[mdi--heart-outline] mr-2 h-5 w-5"></span>
                  收藏
                </button>
                <button class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20">
                  <span class="icon-[mdi--share] mr-2 h-5 w-5"></span>
                  分享
                </button>
                <button class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20">
                  <span class="icon-[mdi--download] mr-2 h-5 w-5"></span>
                  下载
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 主要内容区域 -->
      <div class="px-8 pb-8">
        <!-- Tab 导航 -->
        <div class="mb-8">
          <div class="flex items-center space-x-8 border-b border-white/10">
            <button
              class="tab-button relative px-2 pb-4 text-lg font-medium transition-all duration-300"
              :class="activeTab === 'songs' ? 'text-white' : 'text-purple-300 hover:text-white'"
              @click="activeTab = 'songs'"
            >
              <span class="icon-[mdi--format-list-numbered] mr-2 h-5 w-5"></span>
              歌曲列表 ({{ songs.length }})
              <div
                v-if="activeTab === 'songs'"
                class="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-linear-to-r from-pink-500 to-purple-600"
              ></div>
            </button>
            <button
              class="tab-button relative px-2 pb-4 text-lg font-medium transition-all duration-300"
              :class="activeTab === 'comments' ? 'text-white' : 'text-purple-300 hover:text-white'"
              @click="activeTab = 'comments'"
            >
              <span class="icon-[mdi--comment-multiple] mr-2 h-5 w-5"></span>
              评论区 ({{ comments.length }})
              <div
                v-if="activeTab === 'comments'"
                class="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-linear-to-r from-pink-500 to-purple-600"
              ></div>
            </button>
          </div>
        </div>

        <!-- 歌曲列表 Tab -->
        <section v-show="activeTab === 'songs'" class="animate-fade-in">
          <SongList
            :songs="songs"
            :current-playing-index="currentPlayingIndex"
            :show-header="true"
            :show-controls="true"
            @play="handlePlaySong"
            @like="handleLikeSong"
            @more="handleMoreOptions"
            @sort="handleSort"
            @filter="handleFilter"
          />
        </section>

        <!-- 评论区 Tab -->
        <section v-show="activeTab === 'comments'" class="animate-fade-in">
          <div class="glass-card p-6">
            <!-- 发表评论 -->
            <div class="mb-8">
              <div class="flex items-start space-x-4">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-pink-400 to-purple-500 font-bold text-white"
                >
                  我
                </div>
                <div class="flex-1">
                  <textarea
                    v-model="newComment"
                    placeholder="写下你的评论..."
                    class="w-full resize-none rounded-lg border border-white/20 bg-white/10 p-4 text-white placeholder-purple-300 transition-colors focus:border-pink-400 focus:outline-none"
                    rows="3"
                  ></textarea>
                  <div class="mt-3 flex items-center justify-between">
                    <div class="flex items-center space-x-4 text-purple-300">
                      <button class="transition-colors hover:text-white">
                        <span class="icon-[mdi--emoticon-outline] h-5 w-5"></span>
                      </button>
                      <button class="transition-colors hover:text-white">
                        <span class="icon-[mdi--image-outline] h-5 w-5"></span>
                      </button>
                    </div>
                    <button
                      class="glass-button bg-linear-to-r from-pink-500 to-purple-600 px-6 py-2 font-medium text-white disabled:opacity-50"
                      :disabled="!newComment.trim()"
                      @click="submitComment"
                    >
                      发表评论
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 评论列表 -->
            <div class="space-y-6">
              <div v-for="(comment, index) in comments" :key="index" class="comment-item">
                <div class="flex items-start space-x-4">
                  <!-- 用户头像 -->
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br font-bold text-white"
                    :class="comment.avatarGradient"
                  >
                    {{ comment.avatar }}
                  </div>

                  <!-- 评论内容 -->
                  <div class="min-w-0 flex-1">
                    <div class="mb-2 flex items-center space-x-2">
                      <h4 class="font-medium text-white">{{ comment.username }}</h4>
                      <span class="text-xs text-purple-400">{{ comment.time }}</span>
                    </div>

                    <p class="mb-3 leading-relaxed text-white/90">{{ comment.content }}</p>

                    <!-- 评论操作 -->
                    <div class="flex items-center space-x-6 text-purple-300">
                      <button
                        class="flex items-center space-x-1 transition-colors hover:text-white"
                      >
                        <span class="icon-[mdi--thumb-up-outline] h-4 w-4"></span>
                        <span class="text-sm">{{ comment.likes }}</span>
                      </button>
                      <button
                        class="flex items-center space-x-1 transition-colors hover:text-white"
                      >
                        <span class="icon-[mdi--reply] h-4 w-4"></span>
                        <span class="text-sm">回复</span>
                      </button>
                      <button class="transition-colors hover:text-white">
                        <span class="icon-[mdi--dots-horizontal] h-4 w-4"></span>
                      </button>
                    </div>

                    <!-- 回复列表 -->
                    <div
                      v-if="comment.replies && comment.replies.length > 0"
                      class="mt-4 space-y-3"
                    >
                      <div
                        v-for="(reply, replyIndex) in comment.replies"
                        :key="replyIndex"
                        class="flex items-start space-x-3 border-l-2 border-white/10 pl-4"
                      >
                        <div
                          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold text-white"
                          :class="reply.avatarGradient"
                        >
                          {{ reply.avatar }}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="mb-1 flex items-center space-x-2">
                            <h5 class="text-sm font-medium text-white">{{ reply.username }}</h5>
                            <span class="text-xs text-purple-400">{{ reply.time }}</span>
                          </div>
                          <p class="text-sm text-white/80">{{ reply.content }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 加载更多评论 -->
            <div class="mt-8 text-center">
              <button class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20">
                加载更多评论
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tab切换动画 */
.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Tab按钮悬停效果 */
.tab-button:hover {
  transform: translateY(-2px);
}

/* 动画定义 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes noteFloat {
  0% {
    transform: translateY(100vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) rotate(360deg);
    opacity: 0;
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out forwards;
}

.floating-notes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.note {
  position: absolute;
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.2);
  animation: noteFloat 12s linear infinite;
}

.note:nth-child(1) {
  left: 10%;
  animation-duration: 12s;
}
.note:nth-child(2) {
  left: 20%;
  animation-duration: 14s;
}
.note:nth-child(3) {
  left: 30%;
  animation-duration: 10s;
}
.note:nth-child(4) {
  left: 50%;
  animation-duration: 13s;
}
.note:nth-child(5) {
  left: 60%;
  animation-duration: 11s;
}
.note:nth-child(6) {
  left: 70%;
  animation-duration: 15s;
}
.note:nth-child(7) {
  left: 80%;
  animation-duration: 9s;
}
.note:nth-child(8) {
  left: 90%;
  animation-duration: 16s;
}

/* 评论区样式 */
.comment-item {
  position: relative;
}

.comment-item::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 50px;
  bottom: -10px;
  width: 1px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), transparent);
}

.comment-item:last-child::before {
  display: none;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .song-item {
    flex-direction: column;
    align-items: flex-start;
    space-y: 2;
  }

  .song-item .w-12,
  .song-item .w-24,
  .song-item .w-20 {
    width: auto;
  }
}
</style>
