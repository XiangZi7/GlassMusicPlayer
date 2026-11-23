// 每组偶数句，换组时手书缩进和对话气泡的奇偶排列仍与真实行号一致。
const groupSize = 16

// 短歌词保留普通文档流；长歌词按组保留占位高度，仅创建视区和焦点附近的行。
export function createLyricWindow(viewport, count, renderRows) {
  viewport.replaceChildren()
  if (count < 96) {
    renderRows(viewport, 0, count)
    return null
  }
  const groups = []
  const mounted = new Set()
  const fragment = viewport.ownerDocument.createDocumentFragment()
  let estimatedHeight = 72
  for (let start = 0; start < count; start += groupSize) {
    const group = viewport.ownerDocument.createElement('div')
    group.className = 'fl-group'
    group.style.height = Math.min(groupSize, count - start) * estimatedHeight + 'px'
    groups.push(group)
    fragment.append(group)
  }
  viewport.append(fragment)

  // 还原目标组真实行高，已挂载的行和其中的焦点保持原节点。
  function mount(groupIndex) {
    const group = groups[groupIndex]
    if (!group || mounted.has(groupIndex)) return
    const start = groupIndex * groupSize
    renderRows(group, start, Math.min(count, start + groupSize))
    group.style.removeProperty('height')
    mounted.add(groupIndex)
  }

  // 根据组在滚动容器中的实际位置查找视口边缘。
  function groupAt(offset) {
    let left = 0
    let right = groups.length - 1
    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2)
      if (groups[mid].offsetTop <= offset) left = mid
      else right = mid - 1
    }
    return left
  }

  // 保留视区两侧的缓冲组、当前唱句和真实键盘焦点，移出的组按实测高度占位。
  function sync(active, layoutChanged = false) {
    const scrollTop = viewport.scrollTop
    const anchor = groupAt(scrollTop)
    const anchorTop = groups[anchor].offsetTop
    const first = Math.max(0, anchor - 1)
    const last = Math.min(groups.length - 1, groupAt(scrollTop + viewport.clientHeight) + 1)
    const keep = new Set()
    for (let i = first; i <= last; i++) keep.add(i)
    keep.add(Math.floor(Math.max(0, active) / groupSize))
    const focused = viewport.ownerDocument.activeElement
    if (focused?.matches('.fl-line') && viewport.contains(focused))
      keep.add(Math.floor(Number(focused.dataset.lj) / groupSize))
    for (const i of keep) mount(i)
    if (layoutChanged && groups[anchor].offsetHeight) {
      const sample = groups[anchor]
      estimatedHeight = sample.offsetHeight / sample.childElementCount
      for (let i = 0; i < groups.length; i++) {
        if (!mounted.has(i))
          groups[i].style.height = Math.min(groupSize, count - i * groupSize) * estimatedHeight + 'px'
      }
    }
    for (const i of mounted) {
      if (keep.has(i)) continue
      const group = groups[i]
      group.style.height = group.offsetHeight + 'px'
      group.replaceChildren()
      mounted.delete(i)
    }
    const correction = groups[anchor].offsetTop - anchorTop
    if (correction) viewport.scrollTo({ top: scrollTop + correction, behavior: 'instant' })
  }

  // 用时间轴的绝对行号查找节点；键盘跳到尚未挂载的目标时即时创建该组。
  function row(index, ensure) {
    if (!Number.isInteger(index) || index < 0 || index >= count) return
    const i = Math.floor(index / groupSize)
    if (ensure) mount(i)
    return groups[i].children[index % groupSize]
  }
  return { row, sync }
}

// 两种渲染方式共用相同的时间轴行号。
export function lyricRow(viewport, index, ensure = false) {
  return viewport._window ? viewport._window.row(index, ensure) : viewport.children[index]
}

// 浏览与指针命中只读取当前挂载的行，返回顺序始终与时间轴一致。
export function mountedLyricRows(viewport) {
  return viewport._window ? viewport.querySelectorAll('.fl-line') : viewport.children
}
