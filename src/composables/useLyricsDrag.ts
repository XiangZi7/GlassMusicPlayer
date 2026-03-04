/**
 * 歌词拖动组合式函数
 * 处理歌词面板的手势拖动、预览定位和时间跳转
 * 支持鼠标与触摸两种交互模式
 */
import { gsap } from 'gsap'

export interface LyricsDragOptions {
  /** 歌词内容容器（被 gsap 变换的元素） */
  lyricsRef: Ref<HTMLElement | null>
  /** 歌词滚动外层容器（用于计算可视中心） */
  lyricsContainerRef: Ref<HTMLElement | null>
  /** 当前单行歌词数组 */
  activeSingleLyrics: Ref<{ ori: string; tran?: string; roma?: string }[]>
  /** 根据歌词索引获取对应时间戳 */
  timeForIndex: (index: number) => number | undefined
  /** 设置播放时间 */
  setCurrentTime: (time: number) => void
  /** 当前高亮歌词索引（可写） */
  currentLyricIndex: Ref<number>
  /** 是否启用自动滚动（可写） */
  autoScroll: Ref<boolean>
  /** 滚动到当前歌词位置 */
  scrollToCurrentLyric: () => void
  /** 切换自动滚动 */
  toggleAutoScroll: () => void
  /** 已格式化的总时长（用于拖动预览） */
  formattedDuration: Ref<string>
  /** 是否显示翻译 */
  showTrans: Ref<boolean>
}

export function useLyricsDrag(options: LyricsDragOptions) {
  const {
    lyricsRef,
    lyricsContainerRef,
    activeSingleLyrics,
    timeForIndex,
    setCurrentTime,
    currentLyricIndex,
    autoScroll,
    scrollToCurrentLyric,
    toggleAutoScroll,
    formattedDuration,
    showTrans,
  } = options

  /** 拖动相关内部状态 */
  const state = reactive({
    /** 是否正在拖动 */
    dragging: false,
    /** 拖动起点 Y 坐标 */
    startY: 0,
    /** 拖动开始时的歌词 scrollY */
    startScrollY: 0,
    /** 拖动过程中预览歌词索引 */
    previewIndex: -1,
  })

  /** 拖动开始（鼠标/触摸） */
  const onDragStart = (e: MouseEvent | TouchEvent) => {
    e.preventDefault()

    state.dragging = true
    autoScroll.value = false

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    state.startY = clientY

    // 读取歌词元素当前的 transform Y 偏移
    if (lyricsRef.value) {
      const transform = window.getComputedStyle(lyricsRef.value).transform
      if (transform && transform !== 'none') {
        const matrix = new DOMMatrix(transform)
        state.startScrollY = matrix.m42
      } else {
        state.startScrollY = 0
      }
    }

    // 拖动期间禁止文本选中
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }

  /** 拖动移动：实时跟随手指/鼠标，并计算最近歌词行 */
  const onDragMove = (e: MouseEvent | TouchEvent) => {
    if (!state.dragging || !lyricsRef.value || !lyricsContainerRef.value) return
    e.preventDefault()

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const deltaY = clientY - state.startY
    const newScrollY = state.startScrollY + deltaY

    gsap.set(lyricsRef.value, { y: newScrollY })

    // 找到可视区中心最近的歌词行
    const containerHeight = lyricsContainerRef.value.clientHeight
    const centerY = containerHeight / 2

    let closestIndex = 0
    let minDistance = Infinity

    const lyricElements = lyricsRef.value.children
    for (let i = 0; i < lyricElements.length - 1; i++) {
      const element = lyricElements[i] as HTMLElement
      const rect = element.getBoundingClientRect()
      const containerRect = lyricsContainerRef.value!.getBoundingClientRect()
      const elementCenterY = rect.top + rect.height / 2 - containerRect.top
      const distance = Math.abs(elementCenterY - centerY)

      if (distance < minDistance) {
        minDistance = distance
        closestIndex = i
      }
    }

    state.previewIndex = closestIndex
  }

  /** 拖动结束：跳转到预览位置，延迟恢复自动滚动 */
  const onDragEnd = () => {
    if (!state.dragging) return

    state.dragging = false

    // 恢复选中与光标样式
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
    document.body.style.cursor = ''

    // 跳转到拖动预览对应的时间点
    if (state.previewIndex >= 0 && state.previewIndex < activeSingleLyrics.value.length) {
      const targetTime = timeForIndex(state.previewIndex) ?? 0
      setCurrentTime(targetTime)
      currentLyricIndex.value = state.previewIndex
      scrollToCurrentLyric()
    }

    state.previewIndex = -1

    // 延迟 1.5s 后恢复自动滚动
    setTimeout(() => {
      toggleAutoScroll()
    }, 1500)
  }

  /** 拖动预览信息（时间 + 歌词文本） */
  const previewInfo = computed(() => {
    if (state.previewIndex < 0 || state.previewIndex >= activeSingleLyrics.value.length) {
      return null
    }

    const time = timeForIndex(state.previewIndex) ?? 0
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`

    return {
      time: formattedTime,
      totalDuration: formattedDuration.value,
      lyric: activeSingleLyrics.value[state.previewIndex],
      showTrans: showTrans.value,
    }
  })

  /** 注册/注销全局拖动事件（鼠标 + 触摸） */
  onMounted(() => {
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
    document.addEventListener('touchmove', onDragMove, { passive: false })
    document.addEventListener('touchend', onDragEnd)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    document.removeEventListener('touchmove', onDragMove)
    document.removeEventListener('touchend', onDragEnd)
  })

  return {
    /** 是否正在拖动 */
    isDragging: toRef(state, 'dragging'),
    /** 预览歌词索引 */
    previewIndex: toRef(state, 'previewIndex'),
    /** 预览信息（时间+歌词） */
    previewInfo,
    /** 绑定到歌词面板的 mousedown/touchstart */
    onDragStart,
  }
}
