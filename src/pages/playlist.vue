<template>
  <div class="flex-1 overflow-hidden">
    <div class="h-full overflow-auto">
      <!-- 歌单头部信息 -->
      <section class="relative mb-8 overflow-hidden">
        <!-- 背景模糊效果 -->
        <div class="absolute inset-0">
          <div 
            class="h-full w-full bg-gradient-to-br opacity-30 blur-3xl scale-110"
            :class="playlistInfo.gradient"
          ></div>
        </div>
        
        <!-- 浮动音符背景 -->
        <div class="absolute inset-0 overflow-hidden">
          <div class="floating-notes">
            <div v-for="i in 8" :key="i" class="note" :style="{ animationDelay: i * 0.8 + 's' }">
              {{ ['🎵', '🎶', '♪', '♫', '🎼', '🎤', '🎧', '🎸'][i-1] }}
            </div>
          </div>
        </div>

        <div class="relative z-10 p-8">
          <div class="flex flex-col lg:flex-row items-start lg:items-center space-y-6 lg:space-y-0 lg:space-x-8">
            <!-- 歌单封面 -->
            <div class="flex-shrink-0">
              <div class="relative group">
                <div 
                  class="w-64 h-64 rounded-3xl bg-gradient-to-br p-1 shadow-2xl transition-all duration-500 hover:scale-105"
                  :class="playlistInfo.gradient"
                >
                  <div class="w-full h-full rounded-3xl bg-black/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                    <div 
                      class="w-full h-full bg-gradient-to-br flex items-center justify-center text-8xl"
                      :class="playlistInfo.gradient"
                    >
                      {{ playlistInfo.emoji }}
                    </div>
                  </div>
                </div>
                
                <!-- 播放按钮覆盖层 -->
                <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl">
                  <button class="glass-button w-20 h-20 flex items-center justify-center bg-white/20 hover:bg-white/30">
                    <span class="icon-[mdi--play] w-8 h-8 text-white"></span>
                  </button>
                </div>

                <!-- 旋转光环 -->
                <div class="absolute -inset-2 rounded-full border-2 border-gradient-to-r from-pink-400 to-purple-600 opacity-30 animate-spin" style="animation-duration: 10s"></div>
              </div>
            </div>

            <!-- 歌单信息 -->
            <div class="flex-1 min-w-0">
              <div class="mb-2">
                <span class="inline-block px-3 py-1 text-xs font-medium text-white bg-white/20 rounded-full backdrop-blur-sm">
                  {{ playlistInfo.category }}
                </span>
              </div>
              
              <h1 class="text-4xl lg:text-5xl font-bold text-white mb-4 animate-fade-in-up">
                {{ playlistInfo.name }}
              </h1>
              
              <p class="text-lg text-white/80 mb-6 leading-relaxed animate-fade-in-up" style="animation-delay: 0.2s">
                {{ playlistInfo.description }}
              </p>

              <!-- 歌单统计信息 -->
              <div class="flex flex-wrap items-center gap-6 mb-6 text-white/70 animate-fade-in-up" style="animation-delay: 0.4s">
                <div class="flex items-center space-x-2">
                  <span class="icon-[mdi--account-circle] w-5 h-5"></span>
                  <span>{{ playlistInfo.creator }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="icon-[mdi--calendar] w-5 h-5"></span>
                  <span>{{ playlistInfo.createTime }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="icon-[mdi--music-note] w-5 h-5"></span>
                  <span>{{ playlistInfo.songCount }}首歌曲</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="icon-[mdi--heart] w-5 h-5 text-red-400"></span>
                  <span>{{ playlistInfo.likes }}</span>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="flex flex-wrap items-center gap-4 animate-fade-in-up" style="animation-delay: 0.6s">
                <button class="glass-button bg-gradient-to-r from-pink-500 to-purple-600 px-8 py-3 text-white font-medium hover:scale-105 transition-transform">
                  <span class="icon-[mdi--play] w-5 h-5 mr-2"></span>
                  播放全部
                </button>
                <button class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20">
                  <span class="icon-[mdi--heart-outline] w-5 h-5 mr-2"></span>
                  收藏
                </button>
                <button class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20">
                  <span class="icon-[mdi--share] w-5 h-5 mr-2"></span>
                  分享
                </button>
                <button class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20">
                  <span class="icon-[mdi--download] w-5 h-5 mr-2"></span>
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
              class="tab-button pb-4 px-2 text-lg font-medium transition-all duration-300 relative"
              :class="activeTab === 'songs' ? 'text-white' : 'text-purple-300 hover:text-white'"
              @click="activeTab = 'songs'"
            >
              <span class="icon-[mdi--format-list-numbered] mr-2 h-5 w-5"></span>
              歌曲列表 ({{ songs.length }})
              <div 
                v-if="activeTab === 'songs'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full"
              ></div>
            </button>
            <button 
              class="tab-button pb-4 px-2 text-lg font-medium transition-all duration-300 relative"
              :class="activeTab === 'comments' ? 'text-white' : 'text-purple-300 hover:text-white'"
              @click="activeTab = 'comments'"
            >
              <span class="icon-[mdi--comment-multiple] mr-2 h-5 w-5"></span>
              评论区 ({{ comments.length }})
              <div 
                v-if="activeTab === 'comments'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full"
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
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  我
                </div>
                <div class="flex-1">
                  <textarea 
                    v-model="newComment"
                    placeholder="写下你的评论..."
                    class="w-full bg-white/10 border border-white/20 rounded-lg p-4 text-white placeholder-purple-300 resize-none focus:outline-none focus:border-pink-400 transition-colors"
                    rows="3"
                  ></textarea>
                  <div class="flex items-center justify-between mt-3">
                    <div class="flex items-center space-x-4 text-purple-300">
                      <button class="hover:text-white transition-colors">
                        <span class="icon-[mdi--emoticon-outline] w-5 h-5"></span>
                      </button>
                      <button class="hover:text-white transition-colors">
                        <span class="icon-[mdi--image-outline] w-5 h-5"></span>
                      </button>
                    </div>
                    <button 
                      class="glass-button bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-2 text-white font-medium disabled:opacity-50"
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
              <div 
                v-for="(comment, index) in comments" 
                :key="index"
                class="comment-item"
              >
                <div class="flex items-start space-x-4">
                  <!-- 用户头像 -->
                  <div 
                    class="w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold flex-shrink-0"
                    :class="comment.avatarGradient"
                  >
                    {{ comment.avatar }}
                  </div>
                  
                  <!-- 评论内容 -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2 mb-2">
                      <h4 class="text-white font-medium">{{ comment.username }}</h4>
                      <span class="text-purple-400 text-xs">{{ comment.time }}</span>
                    </div>
                    
                    <p class="text-white/90 leading-relaxed mb-3">{{ comment.content }}</p>
                    
                    <!-- 评论操作 -->
                    <div class="flex items-center space-x-6 text-purple-300">
                      <button class="flex items-center space-x-1 hover:text-white transition-colors">
                        <span class="icon-[mdi--thumb-up-outline] w-4 h-4"></span>
                        <span class="text-sm">{{ comment.likes }}</span>
                      </button>
                      <button class="flex items-center space-x-1 hover:text-white transition-colors">
                        <span class="icon-[mdi--reply] w-4 h-4"></span>
                        <span class="text-sm">回复</span>
                      </button>
                      <button class="hover:text-white transition-colors">
                        <span class="icon-[mdi--dots-horizontal] w-4 h-4"></span>
                      </button>
                    </div>

                    <!-- 回复列表 -->
                    <div v-if="comment.replies && comment.replies.length > 0" class="mt-4 space-y-3">
                      <div 
                        v-for="(reply, replyIndex) in comment.replies" 
                        :key="replyIndex"
                        class="flex items-start space-x-3 pl-4 border-l-2 border-white/10"
                      >
                        <div 
                          class="w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          :class="reply.avatarGradient"
                        >
                          {{ reply.avatar }}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center space-x-2 mb-1">
                            <h5 class="text-white text-sm font-medium">{{ reply.username }}</h5>
                            <span class="text-purple-400 text-xs">{{ reply.time }}</span>
                          </div>
                          <p class="text-white/80 text-sm">{{ reply.content }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 加载更多评论 -->
            <div class="text-center mt-8">
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

<script setup lang="ts">
import SongList from '../components/SongList.vue'

const route = useRoute()
const playlistId = route.params.id

// 当前激活的tab
const activeTab = ref('songs')

// 歌单信息
const playlistInfo = ref({
  name: '二次元神曲精选',
  description: '收录了最经典的动漫歌曲，从经典的EVA主题曲到现代的YOASOBI热门单曲，每一首都能唤起你心中的二次元回忆。让我们一起沉浸在这些美妙的旋律中，重温那些感动人心的动漫时光。',
  creator: '二次元音乐达人',
  createTime: '2024-01-15',
  songCount: 25,
  likes: '12.8万',
  category: '二次元',
  emoji: '🎌',
  gradient: 'from-pink-500 via-purple-500 to-indigo-600'
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
    gradient: 'from-orange-400 to-red-500' 
  },
  { 
    name: '千本樱', 
    artist: '初音未来', 
    album: 'VOCALOID精选', 
    duration: '4:04', 
    emoji: '🌸', 
    gradient: 'from-pink-400 to-purple-500' 
  },
  { 
    name: '打上花火', 
    artist: 'DAOKO', 
    album: '烟花电影原声', 
    duration: '4:49', 
    emoji: '🎆', 
    gradient: 'from-blue-400 to-purple-500' 
  },
  { 
    name: '前前前世', 
    artist: 'RADWIMPS', 
    album: '你的名字原声', 
    duration: '4:44', 
    emoji: '⭐', 
    gradient: 'from-yellow-400 to-orange-500' 
  },
  { 
    name: '夜に駆ける', 
    artist: 'YOASOBI', 
    album: 'THE BOOK', 
    duration: '4:23', 
    emoji: '🌙', 
    gradient: 'from-indigo-500 to-purple-600' 
  },
  { 
    name: 'Lemon', 
    artist: '米津玄師', 
    album: 'Lemon', 
    duration: '4:15', 
    emoji: '🍋', 
    gradient: 'from-yellow-300 to-green-400' 
  },
  { 
    name: '紅蓮華', 
    artist: 'LiSA', 
    album: '鬼灭之刃OP', 
    duration: '4:04', 
    emoji: '🔥', 
    gradient: 'from-red-500 to-orange-600' 
  },
  { 
    name: '炎', 
    artist: 'LiSA', 
    album: '鬼灭之刃剧场版', 
    duration: '4:17', 
    emoji: '🔥', 
    gradient: 'from-orange-500 to-red-600' 
  }
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
    content: '这个歌单太棒了！每一首歌都是经典，特别是残酷天使的行动纲领，每次听都会想起EVA的经典画面。感谢UP主的用心整理！',
    likes: 128,
    replies: [
      {
        username: '二次元收藏家',
        avatar: '收',
        avatarGradient: 'from-purple-400 to-pink-500',
        time: '1小时前',
        content: '同感！这些歌曲都承载着满满的回忆呢~'
      }
    ]
  },
  {
    username: 'YOASOBI粉丝',
    avatar: 'Y',
    avatarGradient: 'from-pink-400 to-red-500',
    time: '5小时前',
    content: '夜に駆ける真的是神曲！YOASOBI的音乐总是能触动人心，配上这个歌单的其他歌曲，简直是完美的二次元音乐之旅。',
    likes: 89,
    replies: []
  },
  {
    username: '初音未来爱好者',
    avatar: '初',
    avatarGradient: 'from-cyan-400 to-blue-500',
    time: '1天前',
    content: '千本樱永远的神！初音未来的声音就是有种魔力，能让人瞬间进入二次元的世界。这个歌单收录的都是精品啊！',
    likes: 156,
    replies: [
      {
        username: 'VOCALOID制作人',
        avatar: 'V',
        avatarGradient: 'from-green-400 to-teal-500',
        time: '20小时前',
        content: '作为制作人，我也很喜欢这些经典作品，它们代表了VOCALOID文化的精髓。'
      },
      {
        username: '音乐评论员',
        avatar: '评',
        avatarGradient: 'from-yellow-400 to-orange-500',
        time: '18小时前',
        content: '从音乐制作的角度来说，这些歌曲的编曲和旋律都非常出色。'
      }
    ]
  }
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
    replies: []
  }
  
  comments.value.unshift(comment)
  newComment.value = ''
}
</script>

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

.note:nth-child(1) { left: 10%; animation-duration: 12s; }
.note:nth-child(2) { left: 20%; animation-duration: 14s; }
.note:nth-child(3) { left: 30%; animation-duration: 10s; }
.note:nth-child(4) { left: 50%; animation-duration: 13s; }
.note:nth-child(5) { left: 60%; animation-duration: 11s; }
.note:nth-child(6) { left: 70%; animation-duration: 15s; }
.note:nth-child(7) { left: 80%; animation-duration: 9s; }
.note:nth-child(8) { left: 90%; animation-duration: 16s; }

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