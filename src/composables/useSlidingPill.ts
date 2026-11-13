import { nextTick, onActivated, onMounted, watch, type Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'

const previousTabs = new Map<string, string>()

// 标签与分页共用原稿测量方式，CSS 保留原来的时长和缓动。
export function useSlidingPill(
  root: Ref<HTMLElement | null>,
  selected: () => string,
  group?: string
): void {
  let initialized = false
  let lastWidth = 0
  let lastHeight = 0

  // 首帧或尺寸变化直接定位；选项变化让同一胶囊节点执行原稿 FLIP。
  function place(target: HTMLElement, snap: boolean): void {
    const pill = root.value?.querySelector<HTMLElement>('[data-slide-pill]')
    if (!pill) return
    if (snap) pill.style.transition = 'none'
    pill.style.width = `${target.offsetWidth}px`
    pill.style.height = `${target.offsetHeight}px`
    pill.style.transform = `translate(${target.offsetLeft}px,${target.offsetTop}px)`
    pill.style.opacity = '1'
    if (snap) {
      void pill.offsetWidth
      pill.style.transition = ''
    }
  }

  // 新路由标签条从上一标签的位置继续滑动，与原稿重复标签条一致。
  async function update(snap = false): Promise<void> {
    await nextTick()
    const el = root.value
    if (!el) return
    const current = selected()
    const buttons = [...el.querySelectorAll<HTMLElement>('[data-slide-value]')]
    const button = buttons.find(node => node.dataset.slideValue === current)
    if (!button || !button.getClientRects().length) return
    const previous = group ? previousTabs.get(group) : undefined
    if (previous && previous !== current && !snap) {
      const old = buttons.find(node => node.dataset.slideValue === previous)
      if (old) place(old, true)
      place(button, false)
    } else place(button, snap || !initialized)
    initialized = true
    if (group) previousTabs.set(group, current)
  }

  onMounted(() => {
    void update()
  })
  onActivated(() => {
    void update()
  })
  watch(
    selected,
    () => {
      void update()
    },
    { flush: 'post' }
  )
  useResizeObserver(root, entries => {
    const rect = entries[0]?.contentRect
    if (
      !rect?.width ||
      !rect.height ||
      (rect.width === lastWidth && rect.height === lastHeight)
    )
      return
    const measured = lastWidth > 0
    lastWidth = rect.width
    lastHeight = rect.height
    // 首次观察和缓存页面重新显示不打断正在滑动的胶囊。
    if (!initialized || measured) void update(measured)
  })
}
