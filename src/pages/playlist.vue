<script setup lang="ts">
import { playlistDetail, playlistTrackAll, commentNew } from '@/api'
import { useAudio } from '@/composables/useAudio'
import type { Song as StoreSong } from '@/stores/interface'
import { PlaylistInfo, PlaylistSong, CommentItem } from '@/typings'
const route = useRoute()
const playlistId = route.params.id

interface PlaylistState {
  activeTab: 'songs' | 'comments'
  playlistInfo: PlaylistInfo
  isCollected: boolean
  songs: PlaylistSong[]
  newComment: string
  comments: CommentItem[]
}

const state = reactive<PlaylistState>({
  // 当前激活的 Tab
  activeTab: 'songs',
  // 歌单基本信息
  playlistInfo: {} as PlaylistInfo,
  // 是否已收藏
  isCollected: false,
  // 歌曲列表
  songs: [],
  // 新评论内容
  newComment: '',
  // 评论列表
  comments: [],
})
const { activeTab, playlistInfo, songs, newComment, comments } = toRefs(state)
const { setPlaylist, play } = useAudio()

const gradients: string[] = ['from-purple-500 to-pink-500']
const emojis: string[] = ['🎵', '🎶', '♪', '♫', '🎼']

const pickGradient = (): string => gradients[Math.floor(Math.random() * gradients.length)]

const loadPlaylist = async (id: number) => {
  try {
    const [detailRes, tracksRes] = await Promise.all([
      playlistDetail({ id }),
      playlistTrackAll({ id, limit: 100 }),
    ])
    const detail =
      (detailRes as any)?.playlist || (detailRes as any)?.data?.playlist || (detailRes as any)?.data
    if (detail) {
      state.playlistInfo = {
        name: detail?.name || state.playlistInfo.name,
        description: detail?.description || '',
        creator: detail?.creator?.nickname || '',
        createTime: detail?.createTime ? new Date(detail.createTime).toLocaleDateString() : '',
        songCount: detail?.trackCount || 0,
        likes: String(detail?.subscribedCount || detail?.bookedCount || 0),
        category: detail?.tags?.[0] || '歌单',
        emoji: state.playlistInfo.emoji,
        gradient: pickGradient(),
        coverImgUrl: detail?.coverImgUrl || '',
      }
    }

    const tracks =
      (tracksRes as any)?.songs || (tracksRes as any)?.data?.songs || (tracksRes as any)?.data || []
    if (Array.isArray(tracks) && tracks.length) {
      state.songs = tracks.map((t: any, i: number) => ({
        id: t?.id || 0,
        mvId: t?.mv,
        name: t?.name || '',
        artist: Array.isArray(t?.ar)
          ? t.ar.map((a: any) => a.name).join(' / ')
          : Array.isArray(t?.artists)
            ? t.artists.map((a: any) => a.name).join(' / ')
            : '',
        album: t?.al?.name || t?.album?.name || '',
        duration: t?.dt ?? t?.duration ?? 0,
        emoji: emojis[i % emojis.length],
        gradient: gradients[i % gradients.length],
        liked: false,
        cover: t?.al?.picUrl || t?.album?.picUrl || '',
      }))
    }
  } catch {}
}

const loadComments = async (id: number) => {
  try {
    const res = await commentNew({ id, type: 2, sortType: 1, pageNo: 1, pageSize: 10 })
    const list = (res as any)?.data?.comments || (res as any)?.comments || []
    if (Array.isArray(list)) {
      state.comments = list.map((c: any, i: number) => ({
        username: c?.user?.nickname || '用户',
        avatarGradient: gradients[i % gradients.length],
        time: c?.time ? new Date(c.time).toLocaleString() : '',
        content: c?.content || '',
        likes: c?.likedCount || 0,
        avatarUrl: c?.user?.avatarUrl || '',
        replies: (c?.beReplied || []).map((r: any) => ({
          username: r?.user?.nickname || '用户',
          avatarUrl: r?.user?.avatarUrl || '',
          avatarGradient: gradients[(i + 1) % gradients.length],
          time: '',
          content: r?.content || '',
        })),
      }))
    }
  } catch {}
}

onMounted(() => {
  const idNum = Number(playlistId)
  if (!Number.isNaN(idNum) && idNum > 0) {
    loadPlaylist(idNum)
    loadComments(idNum)
  }
})
// 处理排序
const handleSort = () => {
  console.log('排序歌曲')
}

// 处理筛选
const handleFilter = () => {
  console.log('筛选歌曲')
}
// 提交评论
const submitComment = () => {
  if (!state.newComment.trim()) return

  const comment = {
    username: '我',
    avatar: '我',
    avatarGradient: 'from-pink-400 to-purple-500',
    time: '刚刚',
    content: state.newComment,
    likes: 0,
    avatarUrl: '',
    replies: [],
  }

  state.comments.unshift(comment)
  state.newComment = ''
}

// 播放全部
const mapToStoreSong = (s: PlaylistSong): StoreSong => ({
  id: s.id,
  name: s.name,
  artist: s.artist,
  album: s.album,
  duration: s.duration,
  cover: s.cover,
  emoji: s.emoji,
  gradient: s.gradient,
  liked: s.liked,
})

const playAll = async () => {
  try {
    if (!Array.isArray(state.songs) || state.songs.length === 0) return
    const list: StoreSong[] = state.songs.map(mapToStoreSong)
    console.log('🚀 ~ file: playlist.vue:179 ~ state.songs:', state.songs)
    setPlaylist(list, 0)
    play(list[0], 0)
  } catch {}
}

// 收藏切换
const toggleCollect = () => {
  state.isCollected = !state.isCollected
}

// 分享
const sharePlaylist = async () => {
  const url = location.origin + location.pathname + `#/playlist/${playlistId}`
  const title = String((state.playlistInfo as any)?.name || '歌单')
  const text = String((state.playlistInfo as any)?.description || '')
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
    } else {
      await navigator.clipboard.writeText(url)
    }
  } catch {}
}
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- 歌单头部信息 -->
    <section class="relative mb-8 flex shrink-0 overflow-hidden rounded-tl-3xl rounded-bl-3xl">
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
            <div class="group relative overflow-hidden rounded-3xl">
              <img class="h-auto w-64 object-cover" :src="playlistInfo.coverImgUrl" alt="" />
              <!-- 播放按钮覆盖层 -->
              <div
                class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              >
                <button
                  class="glass-button flex h-20 w-20 items-center justify-center bg-white/20 hover:bg-white/30"
                >
                  <span class="icon-[mdi--play] h-8 w-8 text-white"></span>
                </button>
              </div>
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
              class="animate-fade-in-up mb-6 line-clamp-3 text-lg leading-relaxed text-white/80"
              style="animation-delay: 0.2s"
              :title="playlistInfo.description"
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
                @click="playAll"
              >
                <span class="icon-[mdi--play] mr-2 h-5 w-5"></span>
                播放全部
              </button>
              <button
                class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20"
                @click="toggleCollect"
              >
                <span class="icon-[mdi--heart-outline] mr-2 h-5 w-5"></span>
                {{ state.isCollected ? '已收藏' : '收藏' }}
              </button>
              <button
                class="glass-button bg-white/10 px-6 py-3 text-white hover:bg-white/20"
                @click="sharePlaylist"
              >
                <span class="icon-[mdi--share] mr-2 h-5 w-5"></span>
                分享
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- Tab 导航 -->
    <div class="mb-4 px-8">
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
    <!-- 主要内容区域 -->
    <div class="flex flex-1 flex-col overflow-hidden px-8 pb-8">
      <!-- 歌曲列表 Tab -->
      <section v-show="activeTab === 'songs'" class="h-full overflow-hidden">
        <SongList
          :songs="songs"
          :show-header="true"
          :show-controls="true"
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
                <img :src="comment.avatarUrl" alt="" class="h-10 w-10 rounded-full" />

                <!-- 评论内容 -->
                <div class="min-w-0 flex-1">
                  <div class="mb-2 flex items-center space-x-2">
                    <h4 class="font-medium text-white">{{ comment.username }}</h4>
                    <span class="text-xs text-purple-400">{{ comment.time }}</span>
                  </div>

                  <p class="mb-3 leading-relaxed text-white/90">{{ comment.content }}</p>

                  <!-- 评论操作 -->
                  <div class="flex items-center space-x-6 text-purple-300">
                    <button class="flex items-center space-x-1 transition-colors hover:text-white">
                      <span class="icon-[mdi--thumb-up-outline] h-4 w-4"></span>
                      <span class="text-sm">{{ comment.likes }}</span>
                    </button>
                    <button class="flex items-center space-x-1 transition-colors hover:text-white">
                      <span class="icon-[mdi--reply] h-4 w-4"></span>
                      <span class="text-sm">回复</span>
                    </button>
                    <button class="transition-colors hover:text-white">
                      <span class="icon-[mdi--dots-horizontal] h-4 w-4"></span>
                    </button>
                  </div>

                  <!-- 回复列表 -->
                  <div v-if="comment.replies && comment.replies.length > 0" class="mt-4 space-y-3">
                    <div
                      v-for="(reply, replyIndex) in comment.replies"
                      :key="replyIndex"
                      class="flex items-start space-x-3 border-l-2 border-white/10 pl-4"
                    >
                      <!-- 用户头像 -->
                      <img :src="reply.avatarUrl" alt="" class="h-8 w-8 rounded-full" />
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
