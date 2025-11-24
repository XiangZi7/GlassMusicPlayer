<script setup lang="ts">
import { commentMusic } from '@/api'
import Pagination from '@/components/Ui/Pagination.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'

const show = defineModel<boolean>('show', { default: false })
const props = defineProps<{ songId: number | string | null }>()

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
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-99999 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/60" @click="close"></div>
    <div
      class="glass-container relative z-10 w-[720px] max-w-[92vw] overflow-hidden rounded-3xl p-6"
    >
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-white">歌曲评论</h3>
        <button
          class="glass-button flex h-9 w-9 items-center justify-center rounded-full"
          @click="close"
        >
          <span class="icon-[mdi--close] h-5 w-5 text-white/80"></span>
        </button>
      </div>
      <p class="mb-4 text-sm text-white/70">总计 {{ state.total }} 条</p>
      <div class="max-h-[60vh] overflow-auto">
        <div v-if="state.loading" class="px-1">
          <PageSkeleton :sections="['list']" :list-count="8" />
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="(c, idx) in state.comments"
            :key="idx"
            class="glass-card flex items-start gap-3 p-3"
          >
            <div class="h-10 w-10 overflow-hidden rounded-md">
              <img
                v-if="c.user?.avatarUrl"
                :src="c.user?.avatarUrl + '?param=100y100'"
                class="h-full w-full object-cover"
                alt="avatar"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center rounded-md bg-linear-to-br from-pink-400 to-purple-500"
              >
                <span class="icon-[mdi--account] h-5 w-5 text-white"></span>
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm text-white">{{ c.user?.nickname || '用户' }}</p>
                <span class="text-xs text-white/60">{{
                  c.ipLocation?.location || c.ipLocation?.ip || ''
                }}</span>
                <span class="text-xs text-white/60">{{
                  c.timeStr || (c.time ? new Date(c.time).toLocaleString() : '')
                }}</span>
              </div>
              <p class="mt-1 text-sm text-white/80">{{ c.content }}</p>
              <div v-if="Array.isArray(c.beReplied) && c.beReplied.length" class="mt-2 space-y-2">
                <div v-for="(r, ri) in c.beReplied" :key="ri" class="rounded-lg bg-white/5 p-2">
                  <p class="truncate text-xs text-white">@{{ r?.user?.nickname || '用户' }}</p>
                  <p class="mt-1 text-xs text-white/70">{{ r?.content }}</p>
                </div>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1 text-white/60">
              <span class="icon-[mdi--thumb-up-outline] h-4 w-4"></span>
              <span class="text-xs">{{ c.likedCount || 0 }}</span>
            </div>
          </div>
          <div v-if="state.comments.length === 0" class="text-center text-white/70">暂无评论</div>
        </div>
      </div>
      <div class="mt-4 flex items-center justify-end gap-2">
        <Pagination v-model="state.page" :total="state.total" :page-size="state.limit" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* no-op */
</style>
