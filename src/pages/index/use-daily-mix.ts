import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { usePlayer } from '@/composables/usePlayer'
import { catalogKey } from '@/services/player/catalog'
import { formatTime } from '@/utils/format'
import type { SourceTrack } from '@/types/prototype'

// 每日推荐与当前队列的归属判断：顶部条与主打 tile 共用同一套主按钮状态，避免两处口径不一致。
export function useDailyMix(songs: MaybeRefOrGetter<SourceTrack[]>, loading: MaybeRefOrGetter<boolean>) {
  const { state, tracks, controller } = usePlayer()
  // 只在所有曲目都有时长时展示整组总时长。
  const duration = computed(() => {
    let total = 0
    for (const song of toValue(songs)) {
      const seconds = song.dur
      if (!seconds) return ''
      total += seconds
    }
    return formatTime(total)
  })
  // 整份队列与今日曲单一致时，主按钮控制正在播放的那一首。
  const currentMix = computed(() => {
    const list = toValue(songs)
    const queue = state.queue
    return !state.radioOn && queue?.length === list.length &&
      queue.every((index, position) => {
        const current = tracks[index]?.catalog
        const pick = list[position]?.catalog
        return current && pick && catalogKey(current) === catalogKey(pick)
      }) &&
      queue.includes(state.idx)
  })
  const playing = computed(() => currentMix.value && state.playing)
  const pending = computed(() => currentMix.value && state.audioLoading)
  // 当前曲单的播放和取源状态决定主按钮的操作。
  const actionLabel = computed(() => {
    if (toValue(loading)) return '加载中'
    if (pending.value) return '取消加载'
    if (playing.value) return '暂停'
    return currentMix.value && state.t > 0 ? '继续播放' : '播放歌单'
  })

  // 开始今日曲单，已在这份队列中时支持暂停、继续与取消加载，否则交给调用方按日推顺序起播。
  function playFeatured(fallback: () => void): void {
    if (!toValue(songs).length) return
    if (currentMix.value) controller()?.dispatch({ type: 'toggle' })
    else fallback()
  }

  return { duration, currentMix, playing, pending, actionLabel, playFeatured }
}
