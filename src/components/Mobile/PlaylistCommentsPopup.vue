<script setup lang="ts">
import MobileDrawer from './MobileDrawer.vue'
import { commentMusic, commentPlaylist } from '@/api'
import { useI18n } from 'vue-i18n'
import PageSkeleton from '@/components/PageSkeleton.vue'
import LazyImage from '@/components/Ui/LazyImage.vue'
import { formatDate } from '@/utils/time'
import Pagination from '@/components/Ui/Pagination.vue'

const { t } = useI18n()
const props = withDefaults(defineProps<{
  id: number | string | null | undefined
  type?: 'music' | 'playlist'
}>(), {
  type: 'music'
})

const isOpen = defineModel<boolean>('show', { default: false })

const state = reactive({
  loading: false,
  total: 0,
  comments: [] as Array<any>,
  page: 1,
  limit: 20,
})

const loadComments = async () => {
  if (!props.id) return
  try {
    state.loading = true
    const api = props.type === 'playlist' ? commentPlaylist : commentMusic
    const res: any = await api({
      id: Number(props.id),
      limit: state.limit,
      offset: (state.page - 1) * state.limit,
    })
    const list = res?.data?.comments || res?.comments || []
    state.comments = Array.isArray(list) ? list : []
    state.total = Number(res?.data?.total ?? res?.total ?? res?.totalCount ?? state.comments.length)
  } finally {
    state.loading = false
  }
}

watch(
  () => isOpen.value,
  val => {
    if (val) {
      loadComments()
    }
  }
)

watch(
  () => props.id,
  () => {
    if (isOpen.value) {
      state.page = 1
      loadComments()
    }
  }
)

watch(
  () => state.page,
  () => {
    if (isOpen.value) loadComments()
  }
)
</script>

<template>
  <MobileDrawer v-model:show="isOpen" :title="t('comments.title') + ` (${state.total})`">
    <div class="h-full overflow-y-auto p-4">
      <div v-if="state.loading" class="py-4">
        <PageSkeleton :sections="['list']" :list-count="6" />
      </div>
      <div v-else-if="state.comments.length === 0" class="flex h-64 flex-col items-center justify-center text-primary/40">
        <span class="icon-[mdi--comment-off-outline] mb-2 h-12 w-12"></span>
        <p class="text-sm">{{ t('common.noData') }}</p>
      </div>
      <div v-else class="space-y-4 pb-4">
        <div v-for="comment in state.comments" :key="comment.commentId" class="flex gap-3">
          <!-- 头像 -->
          <div class="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10">
            <LazyImage
              :src="comment.user.avatarUrl + '?param=60y60'"
              class="h-full w-full object-cover"
            />
          </div>
          
          <!-- 内容 -->
          <div class="flex-1 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-primary/70">{{ comment.user.nickname }}</span>
              <span class="text-[10px] text-primary/40">{{ formatDate(comment.time) }}</span>
            </div>
            
            <p class="text-sm leading-relaxed text-primary/90 break-all whitespace-pre-wrap">{{ comment.content }}</p>
            
            <!-- 回复引用 -->
            <div v-if="comment.beReplied?.length" class="mt-2 rounded-lg bg-black/5 p-2 text-xs text-primary/60 dark:bg-white/5">
               <span class="font-medium text-primary/70">@{{ comment.beReplied[0].user.nickname }}:</span>
               {{ comment.beReplied[0].content }}
            </div>

            <div class="flex items-center gap-4 pt-1">
               <button class="flex items-center gap-1 text-xs text-primary/40 transition-colors hover:text-primary">
                 <span class="icon-[mdi--thumb-up-outline] h-3.5 w-3.5"></span>
                 <span v-if="comment.likedCount">{{ comment.likedCount }}</span>
               </button>
            </div>
          </div>
        </div>

        <Pagination
            v-if="state.total > state.limit"
            v-model="state.page"
            :total="state.total"
            :page-size="state.limit"
            class="mt-4"
          />
      </div>
    </div>
  </MobileDrawer>
</template>
