import type { Ref } from 'vue'
import { commentMusic } from '@/api'

export interface CommentCountOptions {
  /** 歌曲ID（响应式） */
  songId: Ref<number | string | undefined>
}

export function useCommentCount(options: CommentCountOptions) {
  const { songId } = options

  const commentCount = ref(0)
  const isLoading = ref(false)

  /**
   * 加载歌曲评论数量
   * @param id 歌曲ID
   */
  const loadCommentCount = async (id?: number | string) => {
    if (!id) {
      commentCount.value = 0
      return
    }

    isLoading.value = true
    try {
      const res: any = await commentMusic({ id: Number(id), limit: 1, offset: 0 })
      commentCount.value = Number(res?.data?.total ?? res?.total ?? res?.totalCount ?? 0)
    } catch {
      commentCount.value = 0
    } finally {
      isLoading.value = false
    }
  }

  // 监听歌曲ID变化，自动加载评论数量
  watch(
    songId,
    id => {
      loadCommentCount(id)
    },
    { immediate: true }
  )

  return {
    commentCount,
    isLoading,
    loadCommentCount,
  }
}
