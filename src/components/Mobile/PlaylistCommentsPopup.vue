<script setup lang="ts">
import { commentHot } from '@/api'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  id: number
}>()

const { t } = useI18n()

type CommentItem = {
  username: string
  avatarUrl: string
  time: string
  timeAgo: string
  content: string
  likes: number
  isHot: boolean
}

const open = ref(false)
const loading = ref(false)
const comments = ref<CommentItem[]>([])
const commentTotal = ref(0)

const formatTimeAgo = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const months = Math.floor(diff / 2592000000)
  const years = Math.floor(diff / 31536000000)
  if (years > 0) return `${years}年前`
  if (months > 0) return `${months}个月前`
  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

const formatLikes = (count: number) => {
  if (count >= 10000) return (count / 10000).toFixed(1) + 'w'
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
  return String(count)
}

const loadComments = async () => {
  if (!props.id) return
  loading.value = true
  try {
    const res = await commentHot({ id: props.id, type: 2, limit: 10 })
    const list =
      (res as any)?.hotComments || (res as any)?.data?.comments || (res as any)?.comments || []
    commentTotal.value = (res as any)?.total || 0
    if (Array.isArray(list)) {
      comments.value = list.slice(0, 8).map((c: any) => ({
        username: c?.user?.nickname || t('comments.user'),
        avatarUrl: c?.user?.avatarUrl || '',
        time: c?.time ? new Date(c.time).toLocaleString() : '',
        timeAgo: c?.time ? formatTimeAgo(c.time) : '',
        content: c?.content || '',
        likes: c?.likedCount || 0,
        isHot: (c?.likedCount || 0) >= 100,
      }))
    }
  } finally {
    loading.value = false
  }
}

const openPopup = () => {
  open.value = true
  if (comments.value.length === 0) {
    loadComments()
  }
}

const closePopup = () => {
  open.value = false
}
</script>

<template>
  <div class="inline-block">
    <button
      class="comment-trigger flex h-8 w-8 items-center justify-center rounded-full"
      @click="openPopup"
    >
      <span class="icon-[mdi--comment-text-outline] h-5 w-5"></span>
    </button>

    <Teleport to="body">
      <Transition name="popup">
        <div v-if="open" class="popup-overlay fixed inset-0 z-9999" @click.self="closePopup">
          <div class="popup-container absolute inset-x-0 bottom-0 max-h-[80vh] rounded-t-3xl">
            <div class="popup-header sticky top-0 z-10 px-4 pt-4 pb-2">
              <div class="handle-bar mx-auto mb-3 h-1 w-10 rounded-full"></div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="icon-[mdi--fire] h-5 w-5 text-orange-500"></span>
                  <h3 class="popup-title text-sm font-semibold">热门评论</h3>
                </div>
                <div class="flex items-center gap-3">
                  <span class="popup-subtitle text-xs">共{{ commentTotal }}条</span>
                  <button class="close-btn" @click="closePopup">
                    <span class="icon-[mdi--close] h-5 w-5"></span>
                  </button>
                </div>
              </div>
            </div>

            <div class="popup-content overflow-auto px-4 pb-8">
              <div v-if="loading" class="flex items-center justify-center py-12">
                <span class="icon-[mdi--loading] loading-icon h-8 w-8 animate-spin"></span>
              </div>

              <div v-else-if="comments.length === 0" class="empty-text py-12 text-center">
                暂无评论
              </div>

              <div v-else class="comments-list space-y-4">
                <div
                  v-for="(c, i) in comments"
                  :key="i"
                  class="comment-card overflow-hidden rounded-2xl"
                >
                  <div class="comment-header flex items-center gap-3 px-4 pt-4">
                    <div class="avatar-wrapper relative">
                      <img
                        :src="c.avatarUrl + '?param=100y100'"
                        alt=""
                        class="h-10 w-10 rounded-full object-cover"
                      />
                      <div
                        v-if="i < 3"
                        class="rank-badge absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        :class="
                          i === 0
                            ? 'bg-linear-to-r from-yellow-400 to-orange-500'
                            : i === 1
                              ? 'bg-linear-to-r from-gray-300 to-gray-400'
                              : 'bg-linear-to-r from-amber-600 to-amber-700'
                        "
                      >
                        {{ i + 1 }}
                      </div>
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-primary text-[13px] font-medium">{{ c.username }}</span>
                        <span
                          v-if="c.isHot"
                          class="hot-tag rounded px-1.5 py-0.5 text-[10px] font-medium"
                        >
                          HOT
                        </span>
                      </div>
                      <span class="text-primary/40 text-[11px]">{{ c.timeAgo }}</span>
                    </div>
                    <div class="likes-badge flex items-center gap-1 rounded-full px-2.5 py-1">
                      <span class="icon-[mdi--thumb-up] h-3.5 w-3.5 text-pink-500"></span>
                      <span class="text-primary/70 text-xs font-medium">{{
                        formatLikes(c.likes)
                      }}</span>
                    </div>
                  </div>

                  <div class="comment-content px-4 py-3">
                    <p class="text-primary/80 text-[13px] leading-relaxed">{{ c.content }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.comment-trigger {
  background: var(--glass-card-bg);
  color: var(--glass-text);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
}

.comment-trigger:active {
  transform: scale(0.95);
  background: var(--glass-hover-item-bg);
}

.popup-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.popup-container {
  background: var(--glass-dropdown-bg);
  backdrop-filter: blur(var(--glass-dropdown-blur)) saturate(1.5);
  -webkit-backdrop-filter: blur(var(--glass-dropdown-blur)) saturate(1.5);
  border-top: 1px solid var(--glass-border);
}

.popup-header {
  background: var(--glass-dropdown-bg);
}

.handle-bar {
  background: var(--glass-border);
}

.popup-title {
  color: var(--glass-text);
}

.popup-subtitle {
  color: var(--glass-text);
  opacity: 0.4;
}

.close-btn {
  color: var(--glass-text);
  opacity: 0.6;
}

.close-btn:hover {
  opacity: 1;
}

.loading-icon {
  color: var(--glass-text);
  opacity: 0.4;
}

.empty-text {
  color: var(--glass-text);
  opacity: 0.4;
}

.popup-content {
  max-height: calc(80vh - 60px);
}

.comment-card {
  background: var(--glass-hover-item-bg);
  border: 1px solid var(--glass-border);
  transition: all 0.2s ease;
}

.comment-card:active {
  background: var(--glass-bg-button);
}

.avatar-wrapper {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.hot-tag {
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: white;
}

.likes-badge {
  background: var(--glass-bg-button);
}

.popup-enter-active,
.popup-leave-active {
  transition: all 0.3s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
}

.popup-enter-from .popup-container,
.popup-leave-to .popup-container {
  transform: translateY(100%);
}

.popup-enter-active .popup-container,
.popup-leave-active .popup-container {
  transition: transform 0.3s ease;
}
</style>
