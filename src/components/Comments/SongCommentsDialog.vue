<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { commentMusic } from '@/api'
import Pagination from '@/components/Ui/Pagination.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import Button from '@/components/Ui/Button.vue'

const show = defineModel<boolean>('show', { default: false })
const props = defineProps<{ songId: number | string | null }>()

const isMobile = useMediaQuery('(max-width: 768px)')

const state = reactive({
  loading: false,
  total: 0,
  comments: [] as Array<any>,
  page: 1,
  limit: 20,
  more: true,
})

const loadComments = async () => {
  if (!props.songId) return
  try {
    state.loading = true
    const res: any = await commentMusic({
      id: Number(props.songId),
      limit: state.limit,
      offset: (state.page - 1) * state.limit,
    })
    const list = res?.data?.comments || res?.comments || []
    state.comments = Array.isArray(list) ? list : []
    state.total = Number(res?.data?.total ?? res?.total ?? res?.totalCount ?? state.comments.length)
    state.more = Boolean(res?.data?.more ?? res?.more ?? state.comments.length === state.limit)
  } finally {
    state.loading = false
  }
}

watch(
  () => show.value,
  v => {
    if (v) loadComments()
  }
)
watch(
  () => props.songId,
  () => {
    if (show.value) loadComments()
  }
)
watch(
  () => state.page,
  () => {
    if (show.value) loadComments()
  }
)

const close = () => (show.value = false)

// Mobile swipe-to-close
const contentRef = ref<HTMLElement>()
const startY = ref(0)
const translateY = ref(0)
const isDragging = ref(false)

const onTouchStart = (e: TouchEvent) => {
  if (contentRef.value && contentRef.value.scrollTop > 0) return
  startY.value = e.touches[0].clientY
  isDragging.value = true
}

const onTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return
  const dy = e.touches[0].clientY - startY.value
  if (dy > 0) translateY.value = dy
}

const onTouchEnd = () => {
  if (!isDragging.value) return
  isDragging.value = false
  if (translateY.value > 120) close()
  translateY.value = 0
}

const formatTime = (t: number | string) => {
  if (!t) return ''
  return new Date(Number(t)).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<template>
  <Transition name="drawer">
    <div v-if="show" class="fixed inset-0 z-50000 flex">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close" />

      <!-- ═══ Drawer Panel ═══ -->
      <div
        class="drawer-panel relative z-10 flex flex-col overflow-hidden"
        :class="
          isMobile
            ? 'mt-auto max-h-[88vh] w-full rounded-t-3xl'
            : 'ml-auto h-full w-full max-w-[550px]'
        "
        :style="
          isMobile && isDragging
            ? { transform: `translateY(${translateY}px)`, transition: 'none' }
            : undefined
        "
      >
        <!-- Mobile: drag handle -->
        <div
          v-if="isMobile"
          class="flex shrink-0 cursor-grab items-center justify-center pt-3 pb-1"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div class="drag-bar h-1.5 w-10 rounded-full" />
        </div>

        <!-- ═══ Header ═══ -->
        <div class="drawer-header flex shrink-0 items-center justify-between px-5 py-4">
          <div class="flex items-center gap-3.5">
            <div class="header-icon flex h-11 w-11 items-center justify-center rounded-xl">
              <span class="icon-[mdi--comment-text-multiple] h-6 w-6 text-white" />
            </div>
            <div>
              <h2 class="drawer-title text-lg font-bold">{{ $t('comments.title') }}</h2>
              <p class="drawer-subtitle mt-0.5 text-sm">
                {{ $t('comments.total', { total: state.total }) }}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-md"
            rounded="full"
            icon="icon-[mdi--close]"
            icon-class="h-5 w-5"
            class="close-btn"
            @click="close"
          />
        </div>

        <!-- ═══ Content ═══ -->
        <div
          ref="contentRef"
          class="custom-scrollbar flex-1 overflow-y-auto px-4 pb-4 md:px-5"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <!-- Loading -->
          <div v-if="state.loading" class="py-2">
            <PageSkeleton :sections="['list']" :list-count="6" />
          </div>

          <!-- Comments -->
          <div v-else-if="state.comments.length" class="space-y-3">
            <div v-for="(c, idx) in state.comments" :key="idx" class="comment-card rounded-xl p-4">
              <!-- Top row: avatar + name + meta + like -->
              <div class="flex items-start gap-3">
                <div class="h-10 w-10 shrink-0 overflow-hidden rounded-full md:h-11 md:w-11">
                  <img
                    v-if="c.user?.avatarUrl"
                    :src="c.user?.avatarUrl + '?param=100y100'"
                    class="h-full w-full object-cover"
                    alt=""
                  />
                  <div
                    v-else
                    class="avatar-fallback flex h-full w-full items-center justify-center"
                  >
                    <span class="icon-[mdi--account] h-5 w-5 text-white" />
                  </div>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="comment-name truncate text-sm font-semibold">
                      {{ c.user?.nickname || $t('comments.user') }}
                    </span>
                    <span v-if="c.ipLocation?.location" class="comment-meta text-xs">
                      {{ c.ipLocation.location }}
                    </span>
                  </div>
                  <span class="comment-meta text-xs">
                    {{ c.timeStr || formatTime(c.time) }}
                  </span>
                </div>

                <div class="like-btn flex shrink-0 items-center gap-1.5">
                  <span class="icon-[mdi--thumb-up-outline] h-5 w-5" />
                  <span class="text-xs font-medium">{{ c.likedCount || 0 }}</span>
                </div>
              </div>

              <!-- Body -->
              <p class="comment-body mt-3 pl-[52px] text-sm leading-relaxed">
                {{ c.content }}
              </p>

              <!-- Replies -->
              <div
                v-if="Array.isArray(c.beReplied) && c.beReplied.length"
                class="mt-3 space-y-2 pl-[52px]"
              >
                <div
                  v-for="(r, ri) in c.beReplied"
                  :key="ri"
                  class="reply-card rounded-lg px-3.5 py-3"
                >
                  <div class="flex items-center gap-2">
                    <div class="h-6 w-6 shrink-0 overflow-hidden rounded-full">
                      <img
                        v-if="r?.user?.avatarUrl"
                        :src="r.user.avatarUrl + '?param=50y50'"
                        class="h-full w-full object-cover"
                        alt=""
                      />
                      <div
                        v-else
                        class="avatar-fallback flex h-full w-full items-center justify-center"
                      >
                        <span class="icon-[mdi--account] h-3 w-3 text-white" />
                      </div>
                    </div>
                    <span class="reply-name text-xs font-semibold">
                      {{ r?.user?.nickname || $t('comments.user') }}
                    </span>
                  </div>
                  <p class="reply-body mt-1.5 pl-8 text-xs leading-relaxed">{{ r?.content }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty -->
          <div v-else class="flex flex-col items-center justify-center py-16">
            <div class="empty-icon mb-4 flex h-20 w-20 items-center justify-center rounded-full">
              <span class="icon-[mdi--comment-off-outline] h-10 w-10" />
            </div>
            <p class="empty-text text-sm font-medium">{{ $t('comments.empty') }}</p>
          </div>
        </div>

        <!-- ═══ Footer ═══ -->
        <div v-if="state.total > state.limit" class="drawer-footer shrink-0 px-4 py-3 md:px-5">
          <Pagination
            v-model="state.page"
            :total="state.total"
            :page-size="state.limit"
            :max-buttons="isMobile ? 3 : 5"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ═══ Panel ═══ */
.drawer-panel {
  background: var(--glass-bg-overlay);
  backdrop-filter: blur(var(--glass-blur-lg)) saturate(150%);
  -webkit-backdrop-filter: blur(var(--glass-blur-lg)) saturate(150%);
  border: 1px solid var(--glass-border-default);
  box-shadow: var(--glass-shadow-xl);
}

/* ═══ Header ═══ */
.drawer-header {
  border-bottom: 1px solid var(--glass-border-subtle);
}

.header-icon {
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  box-shadow: 0 4px 14px rgba(236, 72, 153, 0.35);
}

.drawer-title {
  color: var(--glass-text-contrast);
}
.drawer-subtitle {
  color: var(--glass-text-secondary);
}

.close-btn {
  color: var(--glass-text-muted);
}
.close-btn:hover {
  background: var(--glass-interactive-hover-muted);
  color: var(--glass-text-contrast);
}

.drag-bar {
  background: var(--glass-border-strong);
}

/* ═══ Comment Card ═══ */
.comment-card {
  background: var(--glass-bg-card);
  border: 1px solid var(--glass-border-subtle);
  transition: background 0.2s ease;
}

.comment-card:hover {
  background: var(--glass-interactive-hover-muted);
}

.avatar-fallback {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.6), rgba(139, 92, 246, 0.6));
}

.comment-name {
  color: var(--glass-text-contrast);
}
.comment-meta {
  color: var(--glass-text-muted);
}
.comment-body {
  color: var(--glass-text-primary);
}

.like-btn {
  color: var(--glass-text-muted);
  cursor: pointer;
  transition: color 0.2s ease;
}

.like-btn:hover {
  color: #ec4899;
}

/* ═══ Reply ═══ */
.reply-card {
  background: var(--glass-interactive-hover-muted);
  border-left: 2px solid rgba(236, 72, 153, 0.3);
}

.reply-name {
  color: var(--glass-text-secondary);
}
.reply-body {
  color: var(--glass-text-secondary);
}

/* ═══ Empty ═══ */
.empty-icon {
  background: var(--glass-interactive-hover-muted);
  color: var(--glass-text-muted);
}

.empty-text {
  color: var(--glass-text-secondary);
}

/* ═══ Footer ═══ */
.drawer-footer {
  border-top: 1px solid var(--glass-border-subtle);
}

/* ═══ Scrollbar ═══ */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--glass-interactive-hover-muted);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--glass-interactive-hover);
}

/* ═══ Transition ═══ */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

/* Desktop: slide from right */
@media (min-width: 769px) {
  .drawer-enter-from .drawer-panel,
  .drawer-leave-to .drawer-panel {
    transform: translateX(100%);
  }
}

/* Mobile: slide from bottom */
@media (max-width: 768px) {
  .drawer-enter-from .drawer-panel,
  .drawer-leave-to .drawer-panel {
    transform: translateY(100%);
  }
}
</style>
