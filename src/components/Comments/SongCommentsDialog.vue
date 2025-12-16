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
  <div v-if="show" class="fixed inset-0 z-50000 flex items-center justify-center p-4">
    <Transition name="mask" appear>
      <div v-if="show" class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close" />
    </Transition>

    <Transition name="dialog" appear>
      <div v-if="show" class="relative z-10 w-full max-w-2xl">
        <div class="glass-container-strong overflow-hidden">
          <Button
            variant="ghost"
            size="icon-lg"
            rounded="full"
            class="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20"
            icon="mdi--close"
            icon-class="h-4 w-4 text-primary"
            @click="close"
          />

          <div class="relative p-6 pb-4">
            <div class="mb-4 flex items-center gap-4">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/25"
              >
                <span class="icon-[mdi--comment-text-multiple] h-6 w-6 text-white" />
              </div>
              <div>
                <h2 class="text-primary text-xl font-bold">{{ $t('comments.title') }}</h2>
                <p class="text-primary/50 mt-0.5 text-sm">
                  {{ $t('comments.total', { total: state.total }) }}
                </p>
              </div>
            </div>
          </div>

          <div class="max-h-[60vh] overflow-auto px-6">
            <div v-if="state.loading" class="pb-4">
              <PageSkeleton :sections="['list']" :list-count="8" />
            </div>
            <div v-else class="space-y-3 pb-4">
              <div v-for="(c, idx) in state.comments" :key="idx" class="glass-card flex gap-3 p-4">
                <div class="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
                  <img
                    v-if="c.user?.avatarUrl"
                    :src="c.user?.avatarUrl + '?param=100y100'"
                    class="h-full w-full object-cover"
                    alt="avatar"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center bg-linear-to-br from-pink-400 to-purple-500"
                  >
                    <span class="icon-[mdi--account] h-5 w-5 text-white" />
                  </div>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-primary truncate text-sm font-medium">{{
                      c.user?.nickname || $t('comments.user')
                    }}</span>
                    <span
                      v-if="c.ipLocation?.location || c.ipLocation?.ip"
                      class="text-primary/40 text-xs"
                    >
                      {{ c.ipLocation?.location || c.ipLocation?.ip }}
                    </span>
                    <span v-if="c.timeStr || c.time" class="text-primary/40 text-xs">
                      {{ c.timeStr || (c.time ? new Date(c.time).toLocaleString() : '') }}
                    </span>
                  </div>

                  <p class="text-primary/80 mt-2 text-sm leading-relaxed">{{ c.content }}</p>

                  <div
                    v-if="Array.isArray(c.beReplied) && c.beReplied.length"
                    class="mt-3 space-y-2"
                  >
                    <div v-for="(r, ri) in c.beReplied" :key="ri" class="rounded-xl bg-white/5 p-3">
                      <span class="text-primary/60 text-xs font-medium"
                        >@{{ r?.user?.nickname || $t('comments.user') }}</span
                      >
                      <p class="text-primary/50 mt-1 text-xs leading-relaxed">{{ r?.content }}</p>
                    </div>
                  </div>

                  <div class="text-primary/40 mt-3 flex items-center gap-1.5">
                    <span class="icon-[mdi--thumb-up-outline] h-4 w-4" />
                    <span class="text-xs">{{ c.likedCount || 0 }}</span>
                  </div>
                </div>
              </div>

              <div v-if="state.comments.length === 0" class="py-12 text-center">
                <span
                  class="icon-[mdi--comment-off-outline] text-primary/30 mx-auto mb-3 block h-12 w-12"
                />
                <p class="text-primary/50 text-sm">{{ $t('comments.empty') }}</p>
              </div>
            </div>
          </div>

          <div class="border-t border-white/10 p-4">
            <Pagination
              v-model="state.page"
              :total="state.total"
              :page-size="state.limit"
              :max-buttons="5"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.mask-enter-active,
.mask-leave-active {
  transition: opacity 0.3s ease;
}
.mask-enter-from,
.mask-leave-to {
  opacity: 0;
}
</style>
