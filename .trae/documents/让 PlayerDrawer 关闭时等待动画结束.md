## 问题定位
- 关闭时使用 `v-if="isOpen"` 会立即卸载抽屉节点，导致 `closeDrawer` 的 GSAP 退场动画不可见或被打断（src/components/PlayerDrawer.vue:302）。
- 当前 `closeDrawer` 虽然设置了 `onComplete` 去 `display: 'none'`，但组件在 `v-if` 下已被移除，动画无法正常播放（src/components/PlayerDrawer.vue:255–273）。

## 改动方案（推荐）
- 引入独立的渲染控制 `isRendered`，用它决定是否渲染抽屉；`isOpen` 仅作为打开/关闭的意图。
- 当 `isOpen` 变为 `true`：先将 `isRendered = true`，`nextTick` 后执行 `openDrawer` 入场动画。
- 当 `isOpen` 变为 `false`：执行 `closeDrawer` 退场动画，在动画完成的 `onComplete` 中再将 `isRendered = false`，确保动画完整结束后再卸载。
- 将模板上的 `v-if="isOpen"` 改为 `v-if="isRendered"`，避免因意图切换导致的立即卸载。

## 代码修改
- 添加渲染状态并更新监听逻辑（src/components/PlayerDrawer.vue:73 之后、275–287）：
```ts
const isRendered = ref(false)

watch(() => isOpen.value, async newVal => {
  if (newVal) {
    isRendered.value = true
    await nextTick()
    openDrawer()
  } else {
    closeDrawer()
  }
})
```
- 将模板条件改为按渲染状态控制（src/components/PlayerDrawer.vue:302）：
```vue
<div v-if="isRendered" ref="drawerRef" class="absolute inset-0 z-50 flex backdrop-blur-xl">
```
- 在关闭动画完成后再卸载（src/components/PlayerDrawer.vue:255–273）：
```ts
const closeDrawer = () => {
  if (drawerRef.value) {
    const tl = gsap.timeline({
      onComplete: () => {
        isRendered.value = false
      },
    })
    tl.to(drawerRef.value, {
      y: '-100%',
      opacity: 0,
      duration: 0.4,
      ease: 'power3.in',
    })
    stopAlbumRotation()
    stopLyricsScroll()
  }
}
```
- 可选：已有 `onMounted` 的 `display: 'none'`（src/components/PlayerDrawer.vue:290–294）在采用 `isRendered` 后不再必要，可保留或移除，功能不受影响。

## 备选方案（基于 Transition）
- 使用 `<Transition :css="false" @enter="onEnter" @leave="onLeave">` 包裹 `v-if="isOpen"`，在 `leave` 钩子中执行 GSAP 退场并在 `done` 回调后卸载：
```vue
<Transition :css="false" @enter="onEnter" @leave="onLeave">
  <div v-if="isOpen" ref="drawerRef" class="absolute inset-0 z-50 flex backdrop-blur-xl">
    ...
  </div>
</Transition>
```
```ts
const onEnter = (el, done) => {
  gsap.timeline({ onComplete: done })
    .fromTo(el, { y: '-100%', opacity: 0 }, { y: '0%', opacity: 1, duration: 0.6, ease: 'power3.out' })
}
const onLeave = (el, done) => {
  gsap.timeline({ onComplete: done })
    .to(el, { y: '-100%', opacity: 0, duration: 0.4, ease: 'power3.in' })
}
```
- 该方案保持 `isOpen` 控制渲染，但通过过渡钩子确保卸载在动画完成后进行。

## 验证
- 打开抽屉：确认入场动画按现有逻辑正常播放（src/components/PlayerDrawer.vue:205–251）。
- 关闭抽屉：确认退场动画完整播放后才卸载，不再瞬间消失。
- 快速点击打开/关闭：确认不会出现中途卸载或动画被打断的视觉闪烁。
- 播放状态：关闭时专辑旋转和歌词滚动停止（src/components/PlayerDrawer.vue:270–273），无残留定时器或动画。